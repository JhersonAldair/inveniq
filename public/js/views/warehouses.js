import { api } from '../api.js';
import { DataTable } from '../table.js';
import { esc, fmtNum, pctClass, formModal, confirmDialog, toast } from '../ui.js';

const fields = [
  { name: 'name', label: 'Nombre del almacén', required: true, minLength: 3, maxLength: 120, col: 'col-md-8' },
  { name: 'city', label: 'Ciudad', required: true, minLength: 2, maxLength: 80, col: 'col-md-4' },
  { name: 'address', label: 'Dirección', required: true, minLength: 5, maxLength: 200 },
  { name: 'latitude', label: 'Latitud', type: 'number', required: true, min: -90, max: 90, step: 'any', help: 'Entre -90 y 90. Ej.: -12.0566', col: 'col-md-4' },
  { name: 'longitude', label: 'Longitud', type: 'number', required: true, min: -180, max: 180, step: 'any', help: 'Entre -180 y 180. Ej.: -77.1181', col: 'col-md-4' },
  { name: 'capacity', label: 'Capacidad (unidades)', type: 'number', integer: true, required: true, min: 1, step: '1', col: 'col-md-4' },
];

export async function render(root, { isAdmin }) {
  root.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h1 class="page-title mb-0">Almacenes</h1>
      ${isAdmin ? '<button class="btn btn-primary" id="newBtn"><i class="bi bi-plus-lg me-1"></i>Nuevo almacén</button>' : ''}
    </div>
    <div class="iq-card"><div class="iq-card-b" id="tbl"></div></div>`;

  let rows = [];
  const columns = [
    { key: 'name', label: 'Almacén', render: (r) => `<strong>${esc(r.name)}</strong><br><small class="text-secondary">${esc(r.address)}</small>` },
    { key: 'city', label: 'Ciudad' },
    { key: 'capacity', label: 'Capacidad', className: 'text-end', render: (r) => fmtNum(r.capacity) },
    { key: 'used', label: 'En uso', className: 'text-end', render: (r) => fmtNum(r.used) },
    {
      key: 'usagePct', label: 'Ocupación', render: (r) => `<div class="d-flex align-items-center gap-2" style="min-width:150px"><div class="progress flex-grow-1"><div class="progress-bar ${pctClass(r.usagePct)}" style="width:${Math.min(100, r.usagePct)}%"></div></div><small>${r.usagePct}%</small></div>`,
    },
    { key: 'items', label: 'Productos', className: 'text-end' },
    {
      key: 'id', label: 'Acciones', sortable: false, exportable: false, className: 'text-nowrap',
      render: (r) => (isAdmin ? `<button class="btn btn-sm btn-outline-primary" data-act="edit" data-id="${r.id}" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${r.id}" title="Dar de baja"><i class="bi bi-trash"></i></button>` : '<span class="text-secondary">Solo lectura</span>'),
    },
  ];
  const table = new DataTable(root.querySelector('#tbl'), { columns, rows, pageSize: 10, exportName: 'almacenes' });

  async function load() { rows = (await api('/warehouses')).data; table.setRows(rows); }
  await load();

  const openForm = (w) => formModal({
    title: w ? `Editar almacén: ${w.name}` : 'Nuevo almacén', fields, values: w || {},
    onSubmit: async (v) => {
      await api(w ? `/warehouses/${w.id}` : '/warehouses', { method: w ? 'PUT' : 'POST', body: v });
      toast(w ? 'Almacén actualizado' : 'Almacén creado');
      await load();
    },
  });
  root.querySelector('#newBtn')?.addEventListener('click', () => openForm(null));
  root.querySelector('#tbl').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const w = rows.find((r) => r.id === Number(b.dataset.id));
    try {
      if (b.dataset.act === 'edit') openForm(w);
      if (b.dataset.act === 'del' && await confirmDialog(`Se dará de baja el almacén "${w.name}".`, { okText: 'Dar de baja' })) {
        await api(`/warehouses/${w.id}`, { method: 'DELETE' });
        toast('Almacén dado de baja');
        await load();
      }
    } catch (err) { toast(err.message, 'danger'); }
  });
}
