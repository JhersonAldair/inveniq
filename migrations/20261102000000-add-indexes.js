'use strict';

/** Índices para las consultas más frecuentes (listados y reportes). */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('movements', ['createdAt'], { name: 'movements_created_idx' });
    await queryInterface.addIndex('movements', ['productId', 'warehouseId'], {
      name: 'movements_product_warehouse_idx',
    });
    await queryInterface.addIndex('products', ['category'], { name: 'products_category_idx' });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('movements', 'movements_created_idx');
    await queryInterface.removeIndex('movements', 'movements_product_warehouse_idx');
    await queryInterface.removeIndex('products', 'products_category_idx');
  },
};
