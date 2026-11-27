// Validación de formularios en el cliente (el servidor valida de nuevo).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Devuelve el mensaje de error de un campo o cadena vacía si es válido. */
export function validateField(field, raw) {
  const value = typeof raw === 'string' ? raw.trim() : raw;
  if (value === '' || value === null || value === undefined) {
    return field.required ? 'Este campo es obligatorio' : '';
  }
  const type = field.type || 'text';
  if (type === 'email' && !EMAIL_RE.test(value)) return 'Correo electrónico no válido';
  if (type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Debe ser un número';
    if (field.integer && !Number.isInteger(n)) return 'Debe ser un número entero';
    if (field.min !== undefined && n < field.min) return `Debe ser mayor o igual a ${field.min}`;
    if (field.max !== undefined && n > field.max) return `Debe ser menor o igual a ${field.max}`;
  }
  if (typeof value === 'string') {
    if (field.minLength && value.length < field.minLength) return `Debe tener al menos ${field.minLength} caracteres`;
    if (field.maxLength && value.length > field.maxLength) return `No debe superar ${field.maxLength} caracteres`;
    if (field.pattern && !field.pattern.test(value)) return field.message || 'Formato no válido';
  }
  return '';
}

function setState(input, message) {
  const fb = input.closest('div')?.querySelector('.invalid-feedback');
  input.classList.toggle('is-invalid', !!message);
  input.classList.toggle('is-valid', !message && input.value.trim() !== '');
  if (fb) fb.textContent = message || '';
}

export function bindLiveValidation(form, fields) {
  fields.forEach((f) => {
    const input = form.elements[f.name];
    if (!input) return;
    const run = () => setState(input, validateField(f, input.value));
    input.addEventListener('blur', run);
    input.addEventListener('input', () => { if (input.classList.contains('is-invalid')) run(); });
  });
}

/**
 * Valida todos los campos y marca los errores. Si se pasa serverErrors
 * (objeto campo -> mensaje) solo muestra esos. Devuelve true si todo es válido.
 */
export function showFieldErrors(form, fields, serverErrors) {
  let ok = true;
  let first = null;
  fields.forEach((f) => {
    const input = form.elements[f.name];
    if (!input) return;
    const msg = serverErrors ? (serverErrors[f.name] || '') : validateField(f, input.value);
    if (serverErrors && !msg) return;
    setState(input, msg);
    if (msg) { ok = false; first = first || input; }
  });
  if (first) first.focus();
  return ok;
}

/** Lee los valores del formulario aplicando la conversión de cada campo. */
export function collectValues(form, fields) {
  const out = {};
  fields.forEach((f) => {
    const input = form.elements[f.name];
    if (!input) return;
    let v = input.value.trim();
    if (v === '') { if (!f.required && f.omitEmpty !== false) return; }
    if (f.type === 'number' && v !== '') v = Number(v);
    if (f.cast) v = f.cast(v);
    out[f.name] = v;
  });
  return out;
}
