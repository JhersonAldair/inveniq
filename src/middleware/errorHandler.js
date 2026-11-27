const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

function notFound(req, _res, next) {
  next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors && err.errors[0] ? err.errors[0].path : 'valor';
    return res.status(409).json({
      error: 'Ya existe un registro con ese valor',
      details: { [field]: 'Debe ser único' },
    });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({ error: 'El registro está relacionado con otros datos' });
  }
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeDatabaseError') {
    logger.warn('Error de base de datos', { message: err.message, path: req.path });
    return res.status(400).json({ error: 'Datos no válidos' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON válido' });
  }
  logger.error('Error no controlado', { message: err.message, stack: err.stack, path: req.path });
  return res.status(500).json({ error: 'Error interno del servidor' });
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
