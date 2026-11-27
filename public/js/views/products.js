import { api } from '../api.js';
import { DataTable } from '../table.js';
import { esc, fmtNum, fmtMoney, levelBadge, formModal, confirmDialog, infoModal, toast, LEVELS } from '../ui.js';

const fields = [
  { name: 'sku', label: 'SKU', required: true, minLength: 3, maxLength: 30, pattern: /^[A-Za-z0-9\-_.]+$/, message: 'Solo letras, números, guion y punto', col: 'col-md-4' },
  { name: 'name', label: 'Nombre del producto', required: true, minLength: 3, maxLength: 160, col: 'col-md-8' },
  { name: 'category', label: 'Categoría', required: true, minLength: 3, maxLength: 60, col: 'col-md-4' },
  { name: 'unit', label: 'Unidad de medida', maxLength: 20, default: 'unidad', col: 'col-md-4' },
  { name: 'unitCost', label: 'Costo unitario (S/)', type: 'number', required: true, min: 0, step: '0.01', col: 'col-md-4' },
  { name: 'minStock', label: 'Stock mínimo (todas las sedes)', type: 'number', integer: true, required: true, min: 0, step: '1', help: 'Por debajo de este valor se emite una alerta de reposición.', col: 'col-md-6' },
];

export async function render(root, { isAdmin }) {
  root.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h1 class="page-title mb-0">Productos</h1>
      ${isAdmin ? '<button class="btn btn-primary" id="newBtn"><i class="bi bi-plus-lg me-1"></i>Nuevo producto</button>' : ''}
    </div>
    <div class="iq-card"><div class="iq-card-b" id="tbl"></div></div>`;

  let rows = [];
  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Producto', render: (r) => `<strong>${esc(r.name)}</strong>` },
    { key: 'category', label: 'Categoría' },
    { key: 'unitCost', label: 'Costo unit.', className: 'text-end', render: (r) => fmtMoney(r.unitCost), value: (r) => r.unitCost },
    { key: 'totalStock', label: 'Stock total', className: 'text-end', render: (r) => `<strong>${fmtNum(r.totalStock)}</strong> <small class="text-secondary">${esc(r.unit)}</small>` },
    { key: 'minStock', label: 'Mínimo', className: 'text-end', render: (r) => fmtNum(r.minStock) },
    { key: 'level', label: 'Nivel', render: (r) => levelBadge(r.level), value: (r) => LEVELS[r.level].label },
    {
      key: 'id', label: 'Acciones', sortable: false, exportable: false, className: 'text-nowrap',
      render: (r) => `<button class="btn btn-sm btn-outline-primary" data-act="view" data-id="${r.id}" title="Ver stock por almacén"><i class="bi bi-eye"></i></button>
        ${isAdmin ? ` <button class="btn btn-sm btn-outline-primary" data-act="edit" data-id="${r.id}" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${r.id}" title="Dar de baja"><i class="bi bi-trash"></i></button>` : ''}`,
    },
  ];

  const levelFilter = `<select class="form-select form-select-sm" id="lvl" aria-label="Filtrar por nivel"><option value="">Todos los niveles</option><option value="critico">Crítico</option><option value="bajo">Bajo</option><option value="normal">Normal</option></select>`;
  const table = new DataTable(root.querySelector('#tbl'), {
    columns, rows, pageSize: 10, exportName: 'productos', toolbarExtra: levelFilter,
    rowClass: (r) => `row-${r.level}`,
  });

  async function load() {
    const lvl = root.querySelector('#lvl').value;
    const res = await api('/products', { query: { level: lvl } });
    rows = res.data;
    table.setRows(rows);
  }
  root.querySelector('#lvl').addEventListener('change', () => load().catch((e) => toast(e.message, 'danger')));
  await load();

  const openForm = (product) => formModal({
    title: product ? `Editar producto: ${product.sku}` : 'Nuevo producto',
    fields, values: product || {},
    onSubmit: async (v) => {
      await api(product ? `/products/${product.id}` : '/products', { method: product ? 'PUT' : 'POST', body: v });
      toast(product ? 'Producto actualizado' : 'Producto creado');
      await load();
    },
  });

  root.querySelector('#newBtn')?.addEventListener('click', () => openForm(null));
  root.querySelector('#tbl').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const p = rows.find((r) => r.id === Number(b.dataset.id));
    try {
      if (b.dataset.act === 'edit') openForm(p);
      if (b.dataset.act === 'del' && await confirmDialog(`Se dará de baja el producto "${p.name}". Esta acción conserva su historial de movimientos.`, { okText: 'Dar de baja' })) {
        await api(`/products/${p.id}`, { method: 'DELETE' });
        toast('Producto dado de baja');
        await load();
      }
      if (b.dataset.act === 'view') {
        const detail = await api(`/products/${p.id}`);
        infoModal(`${detail.sku} | ${detail.name}`, `
          <p class="mb-2">Stock total: <strong>${fmtNum(detail.totalStock)}</strong> ${esc(detail.unit)} ${levelBadge(detail.level)}</p>
          <div class="table-responsive"><table class="table table-sm"><thead><tr><th>Almacén</th><th>Ciudad</th><th class="text-end">Cantidad</th></tr></thead><tbody>
          ${detail.stocks.length ? detail.stocks.map((s) => `<tr><td>${esc(s.warehouse.name)}</td><td>${esc(s.warehouse.city)}</td><td class="text-end">${fmtNum(s.quantity)}</td></tr>`).join('') : '<tr><td colspan="3" class="text-center text-secondary">Sin stock registrado</td></tr>'}
          </tbody></table></div>`, 'modal-md');
      }
    } catch (err) { toast(err.message, 'danger'); }
  });
}
