const express = require('express');
const { Warehouse, Stock, Product } = require('../models');
const AppError = require('../utils/AppError');
const { validateBody, parseId } = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

const rules = {
  name: { required: true, minLength: 3, maxLength: 120 },
  city: { required: true, minLength: 2, maxLength: 80 },
  address: { required: true, minLength: 5, maxLength: 200 },
  latitude: { required: true, type: 'number', min: -90, max: 90 },
  longitude: { required: true, type: 'number', min: -180, max: 180 },
  capacity: { required: true, type: 'int', min: 1, max: 100000000 },
};

async function usageMap() {
  const rows = await Stock.findAll({
    attributes: ['warehouseId', [Stock.sequelize.fn('SUM', Stock.sequelize.col('quantity')), 'used'], [Stock.sequelize.fn('COUNT', Stock.sequelize.col('id')), 'items']],
    group: ['warehouseId'],
    raw: true,
  });
  return new Map(rows.map((r) => [r.warehouseId, { used: Number(r.used), items: Number(r.items) }]));
}

function decorate(w, usage) {
  const u = usage.get(w.id) || { used: 0, items: 0 };
  const json = w.toJSON();
  return { ...json, used: u.used, items: u.items, usagePct: Math.round((u.used / w.capacity) * 1000) / 10 };
}

router.get('/', asyncHandler(async (req, res) => {
  const where = req.query.active === 'all' ? {} : { active: true };
  const [rows, usage] = await Promise.all([Warehouse.findAll({ where, order: [['name', 'ASC']] }), usageMap()]);
  const data = rows.map((w) => decorate(w, usage));
  res.json({ data, total: data.length });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findByPk(parseId(req.params.id), {
    include: [{ model: Stock, as: 'stocks', include: [{ model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit'] }] }],
  });
  if (!warehouse) throw new AppError(404, 'Almacén no encontrado');
  res.json(decorate(warehouse, await usageMap()));
}));

router.post('/', authorize('administrador'), validateBody(rules), asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.create(req.body);
  res.status(201).json(decorate(warehouse, new Map()));
}));

router.put('/:id', authorize('administrador'), validateBody(rules, { partial: true }), asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findByPk(parseId(req.params.id));
  if (!warehouse) throw new AppError(404, 'Almacén no encontrado');
  if (req.body.capacity !== undefined) {
    const used = (await Stock.sum('quantity', { where: { warehouseId: warehouse.id } })) || 0;
    if (req.body.capacity < used) {
      throw new AppError(409, `La capacidad no puede ser menor al stock actual (${used} unidades)`);
    }
  }
  await warehouse.update(req.body);
  res.json(decorate(warehouse, await usageMap()));
}));

router.delete('/:id', authorize('administrador'), asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findByPk(parseId(req.params.id));
  if (!warehouse) throw new AppError(404, 'Almacén no encontrado');
  const used = (await Stock.sum('quantity', { where: { warehouseId: warehouse.id } })) || 0;
  if (used > 0) throw new AppError(409, `No se puede dar de baja: el almacén aún tiene ${used} unidades`);
  await warehouse.update({ active: false });
  res.status(204).end();
}));

module.exports = router;
