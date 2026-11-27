const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { User } = require('../models');

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET no está definido');
  return s;
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

/** Exige un token Bearer válido y carga el usuario activo en req.user. */
async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Se requiere autenticación');

    let payload;
    try {
      payload = jwt.verify(token, secret());
    } catch (_) {
      throw new AppError(401, 'Sesión no válida o expirada');
    }
    const user = await User.findByPk(payload.sub);
    if (!user || !user.active) throw new AppError(401, 'Usuario no válido o desactivado');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Autoriza solo los roles indicados. Debe ir después de authenticate. */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'Se requiere autenticación'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'No tiene permisos para realizar esta acción'));
    }
    return next();
  };
}

module.exports = { authenticate, authorize, signToken };
