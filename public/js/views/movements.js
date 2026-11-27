import { api } from '../api.js';
import { DataTable } from '../table.js';
import { validateField, bindLiveValidation, showFieldErrors, collectValues } from '../validators.js';
import { esc, fmtNum, fmtDate, fieldHtml, formModal, confirmDialog, toast } from '../ui.js';

export async function render(root, { isAdmin }) {
  const [products, warehouses] = await Promise.all([api('/products'), api('/warehouses')]);

  const fields = [
    { name: 'productId', label: 'Producto', type: 'select', required: true, placeholder: 'Seleccione un producto', options: products.data.map((p) => ({ value: p.id, label: `${p.sku} | ${p.name}` })), col: 'col-md-4' },
    { name: 'warehouseId', label: 'Almacén', type: 'select', required: true, placeholder: 'Seleccione un almacén', options: warehouses.data.map((w) => ({ value: w.id, label: `${w.name} (${w.city})` })), col: 'col-md-3' },
    { name: 'quantity', label: 'Cantidad', type: 'number', integer: true, required: true, min: 1, max: 10000000, step: '1', col: 'col-md-2 col-6' },
    { name: 'reference', label: 'Referencia', maxLength: 80, placeholder: 'OC-1234 / OS-5678', col: 'col-md-3 col-6' },
    { name: 'notes', label: 'Notas', maxLength: 500, col: 'col-md-7' },
  ];

  root.innerHTML = `
    <h1 class="page-title mb-3">Movimientos de inventario</h1>
    <div class="iq-card mb-3"><div class="iq-card-h">Registrar movimiento</div><div class="iq-card-b">
      <form id="movForm" novalidate>
        <div class="row g-3 align-items-end">
          <div class="col-md-3"><span class="form-label d-block">Tipo de movimiento</span>
            <div class="btn-group w-100 type-toggle" role="group" aria-label="Tipo de movimiento">
              <input type="radio" class="btn-check" name="type" id="tIn" value="entrada" checked><label class="btn btn-outline-success" for="tIn"><i class="bi bi-box-arrow-in-down me-1"></i>Entrada</label>
              <input type="radio" class="btn-check" name="type" id="tOut" value="salida"><label class="btn btn-outline-danger" for="tOut"><i class="bi bi-box-arrow-up me-1"></i>Salida</label>
            </div></div>
          ${fields.slice(0, 2).map((f) => fieldHtml(f, '', 'mv')).join('')}
          ${fields.slice(2).map((f) => fieldHtml(f, '', 'mv')).join('')}
          <div class="col-md-2"><button class="btn btn-primary w-100" type="submit" id="movBtn">Registrar</button></div>
        </div>
        <div id="avail" class="small mt-2 text-secondary"></div>
        <div id="movErr" class="alert alert-danger d-none mt-3 mb-0" role="alert"></div>
      </form>
    </div></div>
    <div class="iq-card"><div class="iq-card-h">Historial</div><div class="iq-card-b" id="tbl"></div></div>`;

  const form = root.querySelector('#movForm');
  bindLiveValidation(form, fields);

  // Muestra el stock disponible para el par producto + almacén seleccionado.
  const avail = root.querySelector('#avail');
  async function showAvailable() {
    const p = form.elements.productId.value; const w = form.elements.warehouseId.value;
    if (!p || !w) { avail.textContent = ''; return; }
    try {
      const res = await api('/stock', { query: { productId: p, warehouseId: w } });
      const q = res.data[0] ? res.data[0].quantity : 0;
      avail.innerHTML = `Stock disponible en este almacén: <strong>${fmtNum(q)}</strong>`;
    } catch (_) { avail.textContent = ''; }
  }
  form.elements.productId.addEventListener('change', showAvailable);
  form.elements.warehouseId.addEventListener('change', showAvailable);

  const errBox = root.querySelector('#movErr');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('d-none');
    if (!showFieldErrors(form, fields)) return;
    const btn = root.querySelector('#movBtn');
    btn.disabled = true;
    try {
      const body = { type: form.elements.type.value, ...collectValues(form, fields) };
      body.productId = Number(body.productId); body.warehouseId = Number(body.warehouseId);
      await api('/movements', { method: 'POST', body });
      toast(`${body.type === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente`);
      form.reset();
      form.querySelectorAll('.is-valid,.is-invalid').forEach((i) => i.classList.remove('is-valid', 'is-invalid'));
      avail.textContent = '';
      await load();
    } catch (err) {
      if (err.details && Object.keys(err.details).length) showFieldErrors(form, fields, err.details);
      errBox.textContent = err.message; errBox.classList.remove('d-none');
    } finally { btn.disabled = false; }
  });

  let rows = [];
  const columns = [
    { key: 'createdAt', label: 'Fecha', render: (r) => fmtDate(r.createdAt), className: 'text-nowrap' },
    { key: 'type', label: 'Tipo', render: (r) => `<span class="badge text-bg-${r.type === 'entrada' ? 'success' : 'warning'}">${r.type === 'entrada' ? 'Entrada' : 'Salida'}</span>` },
    { key: 'product', label: 'Producto', render: (r) => `${esc(r.product.name)}<br><small class="text-secondary">${esc(r.product.sku)}</small>`, value: (r) => r.product.name },
    { key: 'warehouse', label: 'Almacén', render: (r) => esc(r.warehouse.city), value: (r) => r.warehouse.city },
    { key: 'quantity', label: 'Cant.', className: 'text-end', render: (r) => fmtNum(r.quantity) },
    { key: 'reference', label: 'Referencia', render: (r) => esc(r.reference || '-') },
    { key: 'user', label: 'Usuario', render: (r) => esc(r.user.name), value: (r) => r.user.name },
    { key: 'status', label: 'Estado', render: (r) => (r.status === 'anulado' ? '<span class="badge text-bg-danger">Anulado</span>' : '<span class="badge text-bg-primary">Registrado</span>') },
    {
      key: 'id', label: 'Acciones', sortable: false, exportable: false, className: 'text-nowrap',
      render: (r) => (isAdmin ? `<button class="btn btn-sm btn-outline-primary" data-act="edit" data-id="${r.id}" title="Editar referencia y notas"><i class="bi bi-pencil"></i></button>
        ${r.status === 'registrado' ? `<button class="btn btn-sm btn-outline-danger" data-act="void" data-id="${r.id}" title="Anular"><i class="bi bi-x-circle"></i></button>` : ''}` : ''),
    },
  ];
  const filters = `<select class="form-select form-select-sm" id="fType" aria-label="Filtrar por tipo"><option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option></select>
    <input type="date" class="form-control form-control-sm" id="fFrom" aria-label="Desde"><input type="date" class="form-control form-control-sm" id="fTo" aria-label="Hasta">`;
  const table = new DataTable(root.querySelector('#tbl'), { columns, rows, pageSize: 10, exportName: 'movimientos', toolbarExtra: filters, rowClass: (r) => (r.status === 'anulado' ? 'text-decoration-line-through text-secondary' : '') });

  async function load() {
    const res = await api('/movements', { query: { type: root.querySelector('#fType').value, from: root.querySelector('#fFrom').value, to: root.querySelector('#fTo').value } });
    rows = res.data; table.setRows(rows);
  }
  ['#fType', '#fFrom', '#fTo'].forEach((s) => root.querySelector(s).addEventListener('change', () => load().catch((e) => toast(e.message, 'danger'))));
  await load();

  root.querySelector('#tbl').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const m = rows.find((r) => r.id === Number(b.dataset.id));
    try {
      if (b.dataset.act === 'void' && await confirmDialog(`Se anulará el movimiento de ${m.type} (${m.quantity} u. de ${m.product.name}) y se revertirá el stock.`, { okText: 'Anular movimiento' })) {
        await api(`/movements/${m.id}`, { method: 'DELETE' });
        toast('Movimiento anulado y stock revertido');
        await load();
      }
      if (b.dataset.act === 'edit') {
        formModal({
          title: `Editar movimiento #${m.id}`,
          fields: [
            { name: 'reference', label: 'Referencia', maxLength: 80, omitEmpty: false },
            { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 500, omitEmpty: false },
          ],
          values: { reference: m.reference || '', notes: m.notes || '' },
          onSubmit: async (v) => { await api(`/movements/${m.id}`, { method: 'PUT', body: v }); toast('Movimiento actualizado'); await load(); },
        });
      }
    } catch (err) { toast(err.message, 'danger'); }
  });
}
