const express = require('express');
const { Stock, Product, Warehouse } = require('../models');
const { parseId } = require('../utils/validate');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.productId) where.productId = parseId(req.query.productId);
  if (req.query.warehouseId) where.warehouseId = parseId(req.query.warehouseId);
  const data = await Stock.findAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit', 'minStock'] },
      { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'city'] },
    ],
    order: [['warehouseId', 'ASC'], ['productId', 'ASC']],
  });
  res.json({ data, total: data.length });
}));

module.exports = router;
