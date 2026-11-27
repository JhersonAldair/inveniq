require('dotenv').config();
const { Sequelize } = require('sequelize');
const configs = require('../config/config');

const env = process.env.NODE_ENV || 'development';
const cfg = configs[env];
const url = process.env[cfg.use_env_variable];

if (!url) {
  throw new Error(`Falta la variable de entorno ${cfg.use_env_variable} para el entorno ${env}`);
}

const sequelize = new Sequelize(url, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: cfg.dialectOptions,
});

module.exports = sequelize;
