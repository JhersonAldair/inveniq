const express = require('express');
const { Op } = require('sequelize');
const { Movement, Product, Warehouse, User } = require('../models');
const AppError = require('../utils/AppError');
const { validateBody, parseId } = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { registerMovement, cancelMovement } = require('../services/stockService');

const router = express.Router();
router.use(authenticate);

const createRules = {
  type: { required: true, oneOf: ['entrada', 'salida'] },
  productId: { required: true, type: 'int', min: 1 },
  warehouseId: { required: true, type: 'int', min: 1 },
  quantity: { required: true, type: 'int', min: 1, max: 10000000 },
  reference: { maxLength: 80 },
  notes: { maxLength: 500 },
};

const include = [
  { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit'] },
  { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'city'] },
  { model: User, as: 'user', attributes: ['id', 'name'] },
];

router.get('/', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.type) where.type = req.query.type;
  if (req.query.status) where.status = req.query.status;
  if (req.query.productId) where.productId = parseId(req.query.productId);
  if (req.query.warehouseId) where.warehouseId = parseId(req.query.warehouseId);
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt[Op.gte] = new Date(`${req.query.from}T00:00:00`);
    if (req.query.to) where.createdAt[Op.lte] = new Date(`${req.query.to}T23:59:59`);
  }
  const data = await Movement.findAll({
    where,
    include,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: Math.min(Number(req.query.limit) || 500, 1000),
  });
  res.json({ data, total: data.length });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const movement = await Movement.findByPk(parseId(req.params.id), { include });
  if (!movement) throw new AppError(404, 'Movimiento no encontrado');
  res.json(movement);
}));

router.post('/', authorize('administrador', 'operador'), validateBody(createRules), asyncHandler(async (req, res) => {
  const movement = await registerMovement(req.body, req.user.id);
  const full = await Movement.findByPk(movement.id, { include });
  res.status(201).json(full);
}));

// Solo se permite corregir datos descriptivos; las cantidades no se editan.
router.put('/:id', authorize('administrador'), validateBody({
  reference: { maxLength: 80 },
  notes: { maxLength: 500 },
}, { partial: true }), asyncHandler(async (req, res) => {
  const movement = await Movement.findByPk(parseId(req.params.id));
  if (!movement) throw new AppError(404, 'Movimiento no encontrado');
  await movement.update(req.body);
  res.json(await Movement.findByPk(movement.id, { include }));
}));

// "Eliminar" = anular: conserva el registro y revierte el stock.
router.delete('/:id', authorize('administrador'), asyncHandler(async (req, res) => {
  const movement = await cancelMovement(parseId(req.params.id));
  res.json(await Movement.findByPk(movement.id, { include }));
}));

module.exports = router;
