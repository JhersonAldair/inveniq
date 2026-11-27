const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(100), allowNull: false },
  role: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'operador',
    validate: { isIn: [['administrador', 'operador']] },
  },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'users' });

const Warehouse = sequelize.define('Warehouse', {
  name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  city: { type: DataTypes.STRING(80), allowNull: false },
  address: { type: DataTypes.STRING(200), allowNull: false },
  latitude: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: false,
    get() { return Number(this.getDataValue('latitude')); },
  },
  longitude: {
    type: DataTypes.DECIMAL(9, 6),
    allowNull: false,
    get() { return Number(this.getDataValue('longitude')); },
  },
  capacity: { type: DataTypes.INTEGER, allowNull: false },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'warehouses' });

const Product = sequelize.define('Product', {
  sku: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(160), allowNull: false },
  category: { type: DataTypes.STRING(60), allowNull: false },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'unidad' },
  unitCost: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    get() { return Number(this.getDataValue('unitCost')); },
  },
  minStock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'products' });

const Stock = sequelize.define('Stock', {
  productId: { type: DataTypes.INTEGER, allowNull: false },
  warehouseId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'stocks' });

const Movement = sequelize.define('Movement', {
  type: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['entrada', 'salida']] } },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  warehouseId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  reference: { type: DataTypes.STRING(80) },
  notes: { type: DataTypes.TEXT },
  status: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'registrado',
    validate: { isIn: [['registrado', 'anulado']] },
  },
}, { tableName: 'movements' });

Product.hasMany(Stock, { foreignKey: 'productId', as: 'stocks' });
Stock.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Warehouse.hasMany(Stock, { foreignKey: 'warehouseId', as: 'stocks' });
Stock.belongsTo(Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });

Movement.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Movement.belongsTo(Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
Movement.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Product.hasMany(Movement, { foreignKey: 'productId', as: 'movements' });
Warehouse.hasMany(Movement, { foreignKey: 'warehouseId', as: 'movements' });
User.hasMany(Movement, { foreignKey: 'userId', as: 'movements' });

module.exports = { sequelize, User, Warehouse, Product, Stock, Movement };
