import { api, session, ApiError } from './api.js';
import { validateField, bindLiveValidation, showFieldErrors } from './validators.js';

if (session.get()) window.location.replace('/app.html');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const alertBox = document.getElementById('alert');

const loginFields = [
  { name: 'email', type: 'email', required: true },
  { name: 'password', required: true },
];
const registerFields = [
  { name: 'name', required: true, minLength: 3, maxLength: 120 },
  { name: 'email', type: 'email', required: true },
  { name: 'password', required: true, pattern: /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, message: 'Mínimo 8 caracteres, con al menos una letra y un número' },
  { name: 'password2', required: true },
];
bindLiveValidation(loginForm, loginFields);
bindLiveValidation(registerForm, registerFields);

function showAlert(msg) { alertBox.textContent = msg; alertBox.classList.remove('d-none'); }
function hideAlert() { alertBox.classList.add('d-none'); }

document.querySelectorAll('#authTabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const login = btn.dataset.mode === 'login';
    document.getElementById('tab-login').classList.toggle('active', login);
    document.getElementById('tab-register').classList.toggle('active', !login);
    loginForm.classList.toggle('d-none', !login);
    registerForm.classList.toggle('d-none', login);
    hideAlert();
  });
});

document.querySelectorAll('.demo').forEach((b) => b.addEventListener('click', () => {
  loginForm.elements.email.value = b.dataset.email;
  loginForm.elements.password.value = b.dataset.pass;
  loginForm.requestSubmit();
}));

async function submit(form, fields, path, btnId, extra) {
  hideAlert();
  if (!showFieldErrors(form, fields)) return;
  if (extra && !extra()) return;
  const btn = document.getElementById(btnId);
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Procesando...';
  try {
    const body = {};
    fields.filter((f) => f.name !== 'password2').forEach((f) => { body[f.name] = form.elements[f.name].value; });
    const data = await api(path, { method: 'POST', body, auth: false });
    session.set(data.token, data.user);
    window.location.href = '/app.html';
  } catch (err) {
    if (err instanceof ApiError && err.details) showFieldErrors(form, fields, err.details);
    showAlert(err.message);
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}

loginForm.addEventListener('submit', (e) => { e.preventDefault(); submit(loginForm, loginFields, '/auth/login', 'loginBtn'); });
registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submit(registerForm, registerFields, '/auth/register', 'registerBtn', () => {
    const p2 = registerForm.elements.password2;
    const msg = p2.value !== registerForm.elements.password.value ? 'Las contraseñas no coinciden' : validateField({ required: true }, p2.value);
    p2.classList.toggle('is-invalid', !!msg);
    p2.closest('div').querySelector('.invalid-feedback').textContent = msg;
    return !msg;
  });
});
