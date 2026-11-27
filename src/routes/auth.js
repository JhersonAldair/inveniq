const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const { validateBody } = require('../utils/validate');
const { authenticate, signToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Limita intentos de autenticación para mitigar fuerza bruta.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente nuevamente en unos minutos.' },
});

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

router.post(
  '/register',
  authLimiter,
  validateBody({
    name: { required: true, minLength: 3, maxLength: 120 },
    email: { required: true, type: 'email', maxLength: 160 },
    password: {
      required: true,
      pattern: PASSWORD_RE,
      message: 'Mínimo 8 caracteres, con al menos una letra y un número',
    },
  }),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (await User.findOne({ where: { email } })) {
      throw new AppError(409, 'Ya existe una cuenta con ese correo', { email: 'Correo ya registrado' });
    }
    // El registro público siempre crea usuarios con rol operador.
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role: 'operador' });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.post(
  '/login',
  authLimiter,
  validateBody({
    email: { required: true, type: 'email' },
    password: { required: true, maxLength: 72 },
  }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new AppError(401, 'Correo o contraseña incorrectos');
    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
