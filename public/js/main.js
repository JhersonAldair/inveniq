import { session, api } from './api.js';
import { esc, errorBox, loading } from './ui.js';

const s = session.get();
if (!s) window.location.replace('/index.html');

const user = s.user;
const isAdmin = user.role === 'administrador';
const ctx = { user, isAdmin };

document.getElementById('userName').textContent = user.name;
document.getElementById('userRole').textContent = user.role;

const ROUTES = [
  { path: 'dashboard', label: 'Panel de control', icon: 'speedometer2', load: () => import('./views/dashboard.js') },
  { path: 'productos', label: 'Productos', icon: 'box-seam', load: () => import('./views/products.js') },
  { path: 'almacenes', label: 'Almacenes', icon: 'building', load: () => import('./views/warehouses.js') },
  { path: 'movimientos', label: 'Movimientos', icon: 'arrow-left-right', load: () => import('./views/movements.js') },
  { path: 'mapa', label: 'Mapa y clima', icon: 'geo-alt', load: () => import('./views/map.js') },
  { path: 'usuarios', label: 'Usuarios', icon: 'people', admin: true, load: () => import('./views/users.js') },
].filter((r) => !r.admin || isAdmin);

document.getElementById('navList').innerHTML = ROUTES.map((r) =>
  `<li class="nav-item"><a class="nav-link" href="#/${r.path}" data-route="${r.path}"><i class="bi bi-${r.icon}"></i>${esc(r.label)}</a></li>`).join('');

document.getElementById('logoutBtn').addEventListener('click', () => {
  session.clear();
  window.location.href = '/index.html';
});

const view = document.getElementById('view');
let cleanup = null;
let token = 0;

async function navigate() {
  const path = (window.location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
  const route = ROUTES.find((r) => r.path === path) || ROUTES[0];
  document.querySelectorAll('#navList .nav-link').forEach((a) => a.classList.toggle('active', a.dataset.route === route.path));
  document.title = `InvenIQ | ${route.label}`;

  const offcanvasEl = document.getElementById('sidebar');
  const oc = bootstrap.Offcanvas.getInstance(offcanvasEl);
  if (oc) oc.hide();

  if (typeof cleanup === 'function') { try { cleanup(); } catch (_) { /* nada */ } }
  cleanup = null;
  const mine = ++token;
  view.innerHTML = loading();
  try {
    const mod = await route.load();
    if (mine !== token) return;
    cleanup = await mod.render(view, ctx);
  } catch (err) {
    if (mine === token) view.innerHTML = errorBox(err.message || 'No se pudo cargar la sección');
  }
}

window.addEventListener('hashchange', navigate);
// Verifica que la sesión siga vigente antes de mostrar datos.
api('/auth/me').then(navigate).catch(() => { /* api() ya redirige en 401 */ });
