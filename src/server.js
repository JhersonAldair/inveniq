require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const logger = require('./utils/logger');

const port = Number(process.env.PORT) || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    app.listen(port, () => logger.info(`InvenIQ escuchando en el puerto ${port}`));
  } catch (err) {
    logger.error('No se pudo conectar a la base de datos', { message: err.message });
    process.exit(1);
  }
})();
