const express = require('express');
const { Op, literal } = require('sequelize');
const { Product, Stock, Warehouse } = require('../models');
const AppError = require('../utils/AppError');
const { validateBody, parseId } = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { stockLevel } = require('../services/stockService');

const router = express.Router();
router.use(authenticate);

const rules = {
  sku: { required: true, minLength: 3, maxLength: 30, pattern: /^[A-Za-z0-9\-_.]+$/, message: 'Solo letras, números, guion y punto' },
  name: { required: true, minLength: 3, maxLength: 160 },
  category: { required: true, minLength: 3, maxLength: 60 },
  unit: { maxLength: 20 },
  unitCost: { type: 'number', min: 0, max: 100000000 },
  minStock: { type: 'int', min: 0, max: 10000000 },
};

const totalStockLiteral = literal(
  '(SELECT COALESCE(SUM("quantity"), 0) FROM "stocks" WHERE "stocks"."productId" = "Product"."id")',
);

function decorate(p) {
  const json = p.toJSON();
  json.totalStock = Number(json.totalStock || 0);
  json.level = stockLevel(json.totalStock, json.minStock);
  return json;
}

router.get('/', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.active !== 'all') where.active = true;
  if (req.query.category) where.category = req.query.category;
  if (req.query.q) {
    const q = `%${String(req.query.q).slice(0, 60)}%`;
    where[Op.or] = [{ name: { [Op.iLike]: q } }, { sku: { [Op.iLike]: q } }];
  }
  const rows = await Product.findAll({
    where,
    attributes: { include: [[totalStockLiteral, 'totalStock']] },
    order: [['name', 'ASC']],
    limit: Math.min(Number(req.query.limit) || 1000, 1000),
  });
  let data = rows.map(decorate);
  if (req.query.level) data = data.filter((p) => p.level === req.query.level);
  res.json({ data, total: data.length });
}));

router.get('/categories', asyncHandler(async (_req, res) => {
  const rows = await Product.findAll({ attributes: ['category'], group: ['category'], order: [['category', 'ASC']], raw: true });
  res.json({ data: rows.map((r) => r.category) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const product = await Product.findByPk(parseId(req.params.id), {
    attributes: { include: [[totalStockLiteral, 'totalStock']] },
    include: [{ model: Stock, as: 'stocks', include: [{ model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'city'] }] }],
  });
  if (!product) throw new AppError(404, 'Producto no encontrado');
  res.json(decorate(product));
}));

router.post('/', authorize('administrador'), validateBody(rules), asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ ...product.toJSON(), totalStock: 0, level: stockLevel(0, product.minStock) });
}));

router.put('/:id', authorize('administrador'), validateBody(rules, { partial: true }), asyncHandler(async (req, res) => {
  const product = await Product.findByPk(parseId(req.params.id));
  if (!product) throw new AppError(404, 'Producto no encontrado');
  await product.update(req.body);
  res.json(product);
}));

// Baja lógica: conserva el historial de movimientos.
router.delete('/:id', authorize('administrador'), asyncHandler(async (req, res) => {
  const product = await Product.findByPk(parseId(req.params.id));
  if (!product) throw new AppError(404, 'Producto no encontrado');
  const units = (await Stock.sum('quantity', { where: { productId: product.id } })) || 0;
  if (units > 0) throw new AppError(409, `No se puede dar de baja: aún hay ${units} unidades en stock`);
  await product.update({ active: false });
  res.status(204).end();
}));

module.exports = router;
