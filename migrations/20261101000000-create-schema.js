'use strict';

/**
 * Migración inicial: crea las tablas del sistema de inventario.
 * Orden de creación respeta las llaves foráneas.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    const timestamps = {
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    };

    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      email: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      passwordHash: { type: Sequelize.STRING(100), allowNull: false },
      role: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'operador' },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps,
    });
    await queryInterface.addConstraint('users', {
      fields: ['role'],
      type: 'check',
      where: { role: ['administrador', 'operador'] },
      name: 'users_role_check',
    });

    await queryInterface.createTable('warehouses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      city: { type: Sequelize.STRING(80), allowNull: false },
      address: { type: Sequelize.STRING(200), allowNull: false },
      latitude: { type: Sequelize.DECIMAL(9, 6), allowNull: false },
      longitude: { type: Sequelize.DECIMAL(9, 6), allowNull: false },
      capacity: { type: Sequelize.INTEGER, allowNull: false },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps,
    });
    await queryInterface.addConstraint('warehouses', {
      fields: ['capacity'],
      type: 'check',
      where: { capacity: { [Op.gt]: 0 } },
      name: 'warehouses_capacity_check',
    });

    await queryInterface.createTable('products', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      sku: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(160), allowNull: false },
      category: { type: Sequelize.STRING(60), allowNull: false },
      unit: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'unidad' },
      unitCost: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      minStock: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps,
    });
    await queryInterface.addConstraint('products', {
      fields: ['unitCost'],
      type: 'check',
      where: { unitCost: { [Op.gte]: 0 } },
      name: 'products_cost_check',
    });

    await queryInterface.createTable('stocks', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'RESTRICT',
      },
      warehouseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'warehouses', key: 'id' },
        onDelete: 'RESTRICT',
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });
    await queryInterface.addConstraint('stocks', {
      fields: ['productId', 'warehouseId'],
      type: 'unique',
      name: 'stocks_product_warehouse_unique',
    });
    await queryInterface.addConstraint('stocks', {
      fields: ['quantity'],
      type: 'check',
      where: { quantity: { [Op.gte]: 0 } },
      name: 'stocks_quantity_check',
    });

    await queryInterface.createTable('movements', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      type: { type: Sequelize.STRING(10), allowNull: false },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'RESTRICT',
      },
      warehouseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'warehouses', key: 'id' },
        onDelete: 'RESTRICT',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      reference: { type: Sequelize.STRING(80), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'registrado' },
      ...timestamps,
    });
    await queryInterface.addConstraint('movements', {
      fields: ['type'],
      type: 'check',
      where: { type: ['entrada', 'salida'] },
      name: 'movements_type_check',
    });
    await queryInterface.addConstraint('movements', {
      fields: ['status'],
      type: 'check',
      where: { status: ['registrado', 'anulado'] },
      name: 'movements_status_check',
    });
    await queryInterface.addConstraint('movements', {
      fields: ['quantity'],
      type: 'check',
      where: { quantity: { [Op.gt]: 0 } },
      name: 'movements_quantity_check',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('movements');
    await queryInterface.dropTable('stocks');
    await queryInterface.dropTable('products');
    await queryInterface.dropTable('warehouses');
    await queryInterface.dropTable('users');
  },
};
