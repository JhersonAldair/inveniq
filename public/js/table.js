// Tabla de datos dinámica: búsqueda, ordenamiento, paginación y exportación CSV.
import { esc } from './ui.js';

export class DataTable {
  /**
   * columns: [{ key, label, sortable, render(row) -> html, value(row) -> valor para ordenar/buscar/exportar, className }]
   */
  constructor(container, { columns, rows = [], pageSize = 10, rowClass, emptyText = 'No hay registros para mostrar', exportName = 'datos', toolbarExtra = '' }) {
    this.el = container;
    this.columns = columns;
    this.rows = rows;
    this.pageSize = pageSize;
    this.rowClass = rowClass;
    this.emptyText = emptyText;
    this.exportName = exportName;
    this.toolbarExtra = toolbarExtra;
    this.page = 1;
    this.query = '';
    this.sort = { key: null, dir: 1 };
    this.build();
  }

  value(col, row) { return col.value ? col.value(row) : row[col.key]; }

  build() {
    this.el.innerHTML = `
      <div class="dt-toolbar">
        <input type="search" class="form-control dt-search" placeholder="Buscar en la tabla..." aria-label="Buscar en la tabla">
        <div class="d-flex gap-2 align-items-center">${this.toolbarExtra}
          <button type="button" class="btn btn-outline-primary btn-sm dt-export"><i class="bi bi-download me-1"></i>CSV</button>
        </div>
      </div>
      <div class="table-responsive"><table class="table table-hover align-middle mb-2"><thead></thead><tbody></tbody></table></div>
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 dt-footer"><small class="text-secondary dt-info"></small><nav aria-label="Paginación"><ul class="pagination pagination-sm mb-0"></ul></nav></div>`;
    this.el.querySelector('.dt-search').addEventListener('input', (e) => { this.query = e.target.value.trim().toLowerCase(); this.page = 1; this.render(); });
    this.el.querySelector('.dt-export').addEventListener('click', () => this.exportCsv());
    this.el.querySelector('thead').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-key]');
      if (!th) return;
      const key = th.dataset.key;
      this.sort = { key, dir: this.sort.key === key ? -this.sort.dir : 1 };
      this.render();
    });
    this.el.querySelector('.pagination').addEventListener('click', (e) => {
      const a = e.target.closest('a[data-page]');
      if (!a) return;
      e.preventDefault();
      this.page = Number(a.dataset.page);
      this.render();
    });
    this.render();
  }

  setRows(rows) { this.rows = rows; this.page = 1; this.render(); }

  filtered() {
    let list = this.rows;
    if (this.query) {
      list = list.filter((r) => this.columns.some((c) => String(this.value(c, r) ?? '').toLowerCase().includes(this.query)));
    }
    if (this.sort.key) {
      const col = this.columns.find((c) => c.key === this.sort.key);
      const dir = this.sort.dir;
      list = [...list].sort((a, b) => {
        const x = this.value(col, a); const y = this.value(col, b);
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x ?? '').localeCompare(String(y ?? ''), 'es', { numeric: true }) * dir;
      });
    }
    return list;
  }

  render() {
    const list = this.filtered();
    const pages = Math.max(1, Math.ceil(list.length / this.pageSize));
    this.page = Math.min(this.page, pages);
    const start = (this.page - 1) * this.pageSize;
    const slice = list.slice(start, start + this.pageSize);

    this.el.querySelector('thead').innerHTML = `<tr>${this.columns.map((c) => {
      const sortable = c.sortable !== false && c.key;
      const arrow = this.sort.key === c.key ? (this.sort.dir === 1 ? ' <i class="bi bi-caret-up-fill"></i>' : ' <i class="bi bi-caret-down-fill"></i>') : '';
      return `<th scope="col" class="${sortable ? 'sortable' : ''} ${c.className || ''}" ${sortable ? `data-key="${esc(c.key)}"` : ''}>${esc(c.label)}${arrow}</th>`;
    }).join('')}</tr>`;

    this.el.querySelector('tbody').innerHTML = slice.length
      ? slice.map((r) => `<tr class="${this.rowClass ? this.rowClass(r) : ''}">${this.columns.map((c) => `<td class="${c.className || ''}">${c.render ? c.render(r) : esc(this.value(c, r))}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${this.columns.length}" class="text-center text-secondary py-4">${esc(this.emptyText)}</td></tr>`;

    this.el.querySelector('.dt-info').textContent = list.length
      ? `Mostrando ${start + 1} a ${Math.min(start + this.pageSize, list.length)} de ${list.length}`
      : '0 resultados';

    const items = [];
    const add = (label, page, disabled, active) => items.push(`<li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}"><a class="page-link" href="#" data-page="${page}">${label}</a></li>`);
    add('&laquo;', this.page - 1, this.page === 1);
    const from = Math.max(1, this.page - 2); const to = Math.min(pages, this.page + 2);
    for (let p = from; p <= to; p += 1) add(p, p, false, p === this.page);
    add('&raquo;', this.page + 1, this.page === pages);
    this.el.querySelector('.pagination').innerHTML = pages > 1 ? items.join('') : '';
  }

  exportCsv() {
    const cols = this.columns.filter((c) => c.key && c.exportable !== false);
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => q(c.label)).join(',')];
    this.filtered().forEach((r) => lines.push(cols.map((c) => q(this.value(c, r))).join(',')));
    const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.exportName}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
