require('dotenv').config();

const dialectOptions =
  process.env.DATABASE_SSL === 'true'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {};

const base = { dialect: 'postgres', logging: false, dialectOptions };

module.exports = {
  development: { ...base, use_env_variable: 'DATABASE_URL' },
  test: { ...base, use_env_variable: 'TEST_DATABASE_URL' },
  production: { ...base, use_env_variable: 'DATABASE_URL' },
};
