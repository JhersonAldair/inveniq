// Utilidades de interfaz: formato, notificaciones, diálogos y formularios modales.
import { validateField, bindLiveValidation, showFieldErrors, collectValues } from './validators.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtNum = (n) => new Intl.NumberFormat('es-PE').format(n ?? 0);
export const fmtMoney = (n) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n ?? 0);
export const fmtDate = (d) => new Date(d).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

export const LEVELS = {
  critico: { label: 'Crítico', cls: 'lvl-critico' },
  bajo: { label: 'Bajo', cls: 'lvl-bajo' },
  normal: { label: 'Normal', cls: 'lvl-normal' },
};
export const levelBadge = (level) => {
  const l = LEVELS[level] || LEVELS.normal;
  return `<span class="badge badge-lvl ${l.cls}">${l.label}</span>`;
};
export const pctClass = (pct) => (pct >= 90 ? 'p-danger' : pct >= 70 ? 'p-warn' : 'p-ok');

export function toast(message, type = 'success') {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${type} border-0`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button></div>`;
  host.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 4500 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  t.show();
}

export const loading = (text = 'Cargando...') =>
  `<div class="spinner-wrap"><div class="text-center"><div class="spinner-border text-primary mb-2" role="status"></div><div>${esc(text)}</div></div></div>`;

export const errorBox = (msg) => `<div class="alert alert-danger" role="alert"><i class="bi bi-exclamation-triangle-fill me-2"></i>${esc(msg)}</div>`;

function makeModal(html, size = '') {
  const wrap = document.createElement('div');
  wrap.className = 'modal fade';
  wrap.tabIndex = -1;
  wrap.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}"><div class="modal-content">${html}</div></div>`;
  document.body.appendChild(wrap);
  const modal = new bootstrap.Modal(wrap);
  wrap.addEventListener('hidden.bs.modal', () => { modal.dispose(); wrap.remove(); });
  return { wrap, modal };
}

export function confirmDialog(message, { title = 'Confirmar acción', okText = 'Confirmar', danger = true } = {}) {
  return new Promise((resolve) => {
    const { wrap, modal } = makeModal(`
      <div class="modal-header"><h5 class="modal-title">${esc(title)}</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
      <div class="modal-body">${esc(message)}</div>
      <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="okBtn">${esc(okText)}</button></div>`);
    let answer = false;
    wrap.querySelector('#okBtn').addEventListener('click', () => { answer = true; modal.hide(); });
    wrap.addEventListener('hidden.bs.modal', () => resolve(answer));
    modal.show();
  });
}

export function infoModal(title, bodyHtml, size = 'modal-lg') {
  const { modal } = makeModal(`
    <div class="modal-header"><h5 class="modal-title">${esc(title)}</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-footer"><button class="btn btn-primary" data-bs-dismiss="modal">Cerrar</button></div>`, size);
  modal.show();
}

/** Genera el HTML de un campo de formulario a partir de su definición. */
export function fieldHtml(f, value = '', idPrefix = 'f') {
  const id = `${idPrefix}_${f.name}`;
  const req = f.required ? ' <span class="text-danger" aria-hidden="true">*</span>' : '';
  const common = `id="${id}" name="${f.name}" ${f.required ? 'required' : ''}`;
  let input;
  if (f.type === 'select') {
    const opts = (f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
    input = `<select class="form-select" ${common}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${opts}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea class="form-control" rows="${f.rows || 3}" ${common} ${f.maxLength ? `maxlength="${f.maxLength}"` : ''}>${esc(value)}</textarea>`;
  } else {
    const attrs = [f.step ? `step="${f.step}"` : '', f.min !== undefined ? `min="${f.min}"` : '', f.max !== undefined ? `max="${f.max}"` : '', f.maxLength ? `maxlength="${f.maxLength}"` : '', f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''].join(' ');
    input = `<input class="form-control" type="${f.type || 'text'}" ${common} ${attrs} value="${esc(value)}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`;
  }
  return `<div class="${f.col || 'col-12'}"><label class="form-label" for="${id}">${esc(f.label)}${req}</label>${input}${f.help ? `<div class="form-text">${esc(f.help)}</div>` : ''}<div class="invalid-feedback"></div></div>`;
}

/**
 * Modal con formulario validado. onSubmit recibe los valores ya convertidos;
 * si el servidor responde con errores por campo, se muestran junto a cada campo.
 */
export function formModal({ title, fields, values = {}, submitText = 'Guardar', onSubmit }) {
  const body = `<form id="mForm" novalidate><div class="row g-3">${fields.map((f) => fieldHtml(f, values[f.name] ?? f.default ?? '', 'm')).join('')}</div><div id="mErr" class="alert alert-danger d-none mt-3 mb-0" role="alert"></div></form>`;
  const { wrap, modal } = makeModal(`
    <div class="modal-header"><h5 class="modal-title">${esc(title)}</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
    <div class="modal-body">${body}</div>
    <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary" id="mSubmit" type="submit" form="mForm">${esc(submitText)}</button></div>`, 'modal-lg');
  const form = wrap.querySelector('#mForm');
  const errBox = wrap.querySelector('#mErr');
  const btn = wrap.querySelector('#mSubmit');
  bindLiveValidation(form, fields);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('d-none');
    if (!showFieldErrors(form, fields)) return;
    btn.disabled = true;
    try {
      await onSubmit(collectValues(form, fields));
      modal.hide();
    } catch (err) {
      if (err.details && Object.keys(err.details).length) showFieldErrors(form, fields, err.details);
      errBox.textContent = err.message;
      errBox.classList.remove('d-none');
    } finally {
      btn.disabled = false;
    }
  });
  modal.show();
  wrap.addEventListener('shown.bs.modal', () => form.querySelector('input,select,textarea')?.focus());
}

export { validateField };
