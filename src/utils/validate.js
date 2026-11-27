const AppError = require('./AppError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida y normaliza un objeto según reglas declarativas.
 * Reglas soportadas: required, type (string|int|number|email|boolean),
 * min, max, minLength, maxLength, pattern, oneOf, message.
 * Devuelve { values, errors }.
 */
function validate(data, rules, { partial = false } = {}) {
  const values = {};
  const errors = {};
  const src = data && typeof data === 'object' ? data : {};

  for (const [field, rule] of Object.entries(rules)) {
    let v = src[field];
    const missing = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

    if (missing) {
      if (rule.required && !partial) errors[field] = 'Este campo es obligatorio';
      continue;
    }

    const type = rule.type || 'string';
    if (type === 'string' || type === 'email') {
      if (typeof v !== 'string') { errors[field] = 'Debe ser texto'; continue; }
      v = v.trim();
      if (type === 'email') {
        v = v.toLowerCase();
        if (!EMAIL_RE.test(v)) { errors[field] = 'Correo electrónico no válido'; continue; }
      }
      if (rule.minLength && v.length < rule.minLength) {
        errors[field] = `Debe tener al menos ${rule.minLength} caracteres`; continue;
      }
      if (rule.maxLength && v.length > rule.maxLength) {
        errors[field] = `No debe superar ${rule.maxLength} caracteres`; continue;
      }
      if (rule.pattern && !rule.pattern.test(v)) {
        errors[field] = rule.message || 'Formato no válido'; continue;
      }
      if (rule.oneOf && !rule.oneOf.includes(v)) {
        errors[field] = `Valores permitidos: ${rule.oneOf.join(', ')}`; continue;
      }
    } else if (type === 'int' || type === 'number') {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || (type === 'int' && !Number.isInteger(n))) {
        errors[field] = type === 'int' ? 'Debe ser un número entero' : 'Debe ser un número'; continue;
      }
      if (rule.min !== undefined && n < rule.min) { errors[field] = `Debe ser mayor o igual a ${rule.min}`; continue; }
      if (rule.max !== undefined && n > rule.max) { errors[field] = `Debe ser menor o igual a ${rule.max}`; continue; }
      v = n;
    } else if (type === 'boolean') {
      if (typeof v !== 'boolean') { errors[field] = 'Debe ser verdadero o falso'; continue; }
    }
    values[field] = v;
  }
  return { values, errors };
}

/** Middleware: valida req.body y lo reemplaza por los valores normalizados. */
function validateBody(rules, options) {
  return (req, _res, next) => {
    const { values, errors } = validate(req.body, rules, options);
    if (Object.keys(errors).length) {
      return next(new AppError(400, 'Datos no válidos', errors));
    }
    req.body = values;
    return next();
  };
}

/** Convierte un parámetro de ruta en entero positivo o lanza 400. */
function parseId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(400, 'Identificador no válido');
  return n;
}

module.exports = { validate, validateBody, parseId, EMAIL_RE };
