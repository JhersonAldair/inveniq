import { api } from '../api.js';
import { DataTable } from '../table.js';
import { esc, fmtDate, formModal, toast } from '../ui.js';

export async function render(root, { user }) {
  root.innerHTML = `<h1 class="page-title mb-3">Usuarios</h1><div class="iq-card"><div class="iq-card-b" id="tbl"></div></div>`;
  let rows = [];
  const columns = [
    { key: 'name', label: 'Nombre', render: (r) => `<strong>${esc(r.name)}</strong>` },
    { key: 'email', label: 'Correo' },
    { key: 'role', label: 'Rol', render: (r) => `<span class="badge text-bg-${r.role === 'administrador' ? 'warning' : 'primary'}">${esc(r.role)}</span>` },
    { key: 'active', label: 'Estado', render: (r) => (r.active ? '<span class="badge text-bg-success">Activo</span>' : '<span class="badge text-bg-danger">Inactivo</span>'), value: (r) => (r.active ? 'Activo' : 'Inactivo') },
    { key: 'createdAt', label: 'Alta', render: (r) => fmtDate(r.createdAt) },
    { key: 'id', label: 'Acciones', sortable: false, exportable: false, render: (r) => (r.id === user.id ? '<span class="text-secondary small">Su cuenta</span>' : `<button class="btn btn-sm btn-outline-primary" data-id="${r.id}"><i class="bi bi-pencil"></i> Editar</button>`) },
  ];
  const table = new DataTable(root.querySelector('#tbl'), { columns, rows, exportName: 'usuarios' });
  async function load() { rows = (await api('/users')).data; table.setRows(rows); }
  await load();

  root.querySelector('#tbl').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const u = rows.find((r) => r.id === Number(b.dataset.id));
    formModal({
      title: `Editar usuario: ${u.name}`,
      fields: [
        { name: 'role', label: 'Rol', type: 'select', required: true, options: [{ value: 'operador', label: 'Operador' }, { value: 'administrador', label: 'Administrador' }], col: 'col-md-6' },
        { name: 'active', label: 'Estado', type: 'select', required: true, options: [{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }], cast: (v) => v === 'true', col: 'col-md-6' },
      ],
      values: { role: u.role, active: String(u.active) },
      onSubmit: async (v) => { await api(`/users/${u.id}`, { method: 'PUT', body: v }); toast('Usuario actualizado'); await load(); },
    });
  });
}
