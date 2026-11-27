const { execSync } = require('child_process');

// Recrea el esquema de la base de pruebas ejecutando las migraciones reales.
module.exports = async () => {
  const env = { ...process.env, NODE_ENV: 'test' };
  execSync('npx sequelize-cli db:migrate:undo:all', { env, stdio: 'ignore' });
  execSync('npx sequelize-cli db:migrate', { env, stdio: 'ignore' });
};
