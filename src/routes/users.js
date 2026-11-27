const express = require('express');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const { validateBody, parseId } = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate, authorize('administrador'));

const attrs = ['id', 'name', 'email', 'role', 'active', 'createdAt'];

router.get('/', asyncHandler(async (_req, res) => {
  const data = await User.findAll({ attributes: attrs, order: [['id', 'ASC']] });
  res.json({ data, total: data.length });
}));

router.put(
  '/:id',
  validateBody({
    role: { oneOf: ['administrador', 'operador'] },
    active: { type: 'boolean' },
  }, { partial: true }),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const user = await User.findByPk(id);
    if (!user) throw new AppError(404, 'Usuario no encontrado');
    if (user.id === req.user.id && (req.body.active === false || (req.body.role && req.body.role !== user.role))) {
      throw new AppError(409, 'No puede cambiar su propio rol ni desactivar su propia cuenta');
    }
    await user.update(req.body);
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active });
  }),
);

module.exports = router;
