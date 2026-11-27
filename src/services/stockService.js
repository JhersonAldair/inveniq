const { sequelize, Stock, Movement, Product, Warehouse } = require('../models');
const AppError = require('../utils/AppError');

/**
 * Aplica un delta (positivo o negativo) al stock de un producto en un almacén,
 * dentro de una transacción y con bloqueo de fila para evitar condiciones de carrera.
 * Reglas de negocio: el stock no puede ser negativo ni superar la capacidad del almacén.
 */
async function applyDelta({ productId, warehouseId, delta, transaction }) {
  const warehouse = await Warehouse.findByPk(warehouseId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!warehouse || !warehouse.active) throw new AppError(404, 'Almacén no encontrado o inactivo');

  const [stock] = await Stock.findOrCreate({
    where: { productId, warehouseId },
    defaults: { quantity: 0 },
    transaction,
  });
  await stock.reload({ transaction, lock: transaction.LOCK.UPDATE });

  const next = stock.quantity + delta;
  if (next < 0) {
    throw new AppError(409, `Stock insuficiente: disponible ${stock.quantity}, solicitado ${Math.abs(delta)}`);
  }
  if (delta > 0) {
    const used = (await Stock.sum('quantity', { where: { warehouseId }, transaction })) || 0;
    if (used + delta > warehouse.capacity) {
      throw new AppError(409, `Capacidad excedida: el almacén admite ${warehouse.capacity} unidades y tiene ${used}`);
    }
  }
  stock.quantity = next;
  await stock.save({ transaction });
  return stock;
}

/** Registra un movimiento (entrada o salida) y actualiza el stock de forma atómica. */
async function registerMovement({ type, productId, warehouseId, quantity, reference, notes }, userId) {
  return sequelize.transaction(async (transaction) => {
    const product = await Product.findByPk(productId, { transaction });
    if (!product || !product.active) throw new AppError(404, 'Producto no encontrado o inactivo');

    const delta = type === 'entrada' ? quantity : -quantity;
    await applyDelta({ productId, warehouseId, delta, transaction });

    return Movement.create(
      { type, productId, warehouseId, quantity, reference, notes, userId },
      { transaction },
    );
  });
}

/** Anula un movimiento y revierte su efecto sobre el stock. */
async function cancelMovement(id) {
  return sequelize.transaction(async (transaction) => {
    const movement = await Movement.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!movement) throw new AppError(404, 'Movimiento no encontrado');
    if (movement.status === 'anulado') throw new AppError(409, 'El movimiento ya está anulado');

    const delta = movement.type === 'entrada' ? -movement.quantity : movement.quantity;
    await applyDelta({
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      delta,
      transaction,
    });
    movement.status = 'anulado';
    await movement.save({ transaction });
    return movement;
  });
}

/** Stock total por producto, junto con el indicador de nivel. */
function stockLevel(total, minStock) {
  if (total <= minStock) return 'critico';
  if (total <= minStock * 1.5) return 'bajo';
  return 'normal';
}

async function totalsByProduct() {
  const rows = await Stock.findAll({
    attributes: ['productId', [sequelize.fn('SUM', sequelize.col('quantity')), 'total']],
    group: ['productId'],
    raw: true,
  });
  return new Map(rows.map((r) => [r.productId, Number(r.total)]));
}

module.exports = { registerMovement, cancelMovement, stockLevel, totalsByProduct, applyDelta };
