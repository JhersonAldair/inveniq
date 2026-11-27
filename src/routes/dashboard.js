const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize, Product, Warehouse } = require('../models');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { stockLevel } = require('../services/stockService');

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (_req, res) => {
  const q = (sql) => sequelize.query(sql, { type: QueryTypes.SELECT });

  const [totals] = await q(`
    SELECT
      (SELECT COUNT(*) FROM products WHERE active) AS products,
      (SELECT COUNT(*) FROM warehouses WHERE active) AS warehouses,
      (SELECT COALESCE(SUM(quantity),0) FROM stocks) AS units,
      (SELECT COALESCE(SUM(s.quantity * p.\"unitCost\"),0) FROM stocks s JOIN products p ON p.id = s."productId") AS value
  `);

  const perProduct = await q(`
    SELECT p.id, p.sku, p.name, p.category, p."minStock", COALESCE(SUM(s.quantity),0) AS total
    FROM products p LEFT JOIN stocks s ON s."productId" = p.id
    WHERE p.active GROUP BY p.id ORDER BY p.name
  `);
  const lowStock = perProduct
    .map((r) => ({ ...r, total: Number(r.total), level: stockLevel(Number(r.total), r.minStock) }))
    .filter((r) => r.level !== 'normal')
    .sort((a, b) => (a.total / (a.minStock || 1)) - (b.total / (b.minStock || 1)));

  const byCategory = await q(`
    SELECT p.category, COALESCE(SUM(s.quantity),0) AS units
    FROM products p LEFT JOIN stocks s ON s."productId" = p.id
    WHERE p.active GROUP BY p.category ORDER BY units DESC
  `);

  const days = await q(`
    SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.type='entrada'),0) AS entradas,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.type='salida'),0) AS salidas
    FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d
    LEFT JOIN movements m ON m."createdAt"::date = d::date AND m.status = 'registrado'
    GROUP BY d ORDER BY d
  `);

  const warehouses = await Warehouse.findAll({ where: { active: true }, order: [['name', 'ASC']] });
  const usage = await q('SELECT "warehouseId" AS id, SUM(quantity) AS used FROM stocks GROUP BY "warehouseId"');
  const usedMap = new Map(usage.map((u) => [u.id, Number(u.used)]));

  res.json({
    totals: {
      products: Number(totals.products),
      warehouses: Number(totals.warehouses),
      units: Number(totals.units),
      value: Number(totals.value),
      lowStock: lowStock.length,
      critical: lowStock.filter((l) => l.level === 'critico').length,
    },
    lowStock: lowStock.slice(0, 10),
    byCategory: byCategory.map((c) => ({ category: c.category, units: Number(c.units) })),
    movementsByDay: days.map((d) => ({ day: d.day, entradas: Number(d.entradas), salidas: Number(d.salidas) })),
    warehouseUsage: warehouses.map((w) => {
      const used = usedMap.get(w.id) || 0;
      return { id: w.id, name: w.name, city: w.city, capacity: w.capacity, used, pct: Math.round((used / w.capacity) * 1000) / 10 };
    }),
  });
}));

module.exports = router;
