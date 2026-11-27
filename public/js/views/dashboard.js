import { api } from '../api.js';
import { esc, fmtNum, fmtMoney, levelBadge, pctClass } from '../ui.js';

export async function render(root) {
  const d = await api('/dashboard');
  const t = d.totals;
  const charts = [];

  const kpi = (label, value, icon, color, sub = '') => `
    <div class="col-12 col-sm-6 col-xl-3"><div class="iq-card kpi p-3 h-100" style="--kpi:${color}">
      <div class="d-flex justify-content-between align-items-start">
        <div><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div><small class="text-secondary">${sub}</small></div>
        <i class="bi bi-${icon} kpi-icon"></i></div></div></div>`;

  root.innerHTML = `
    <h1 class="page-title mb-3">Panel de control</h1>
    <div class="row g-3 mb-3">
      ${kpi('Productos activos', fmtNum(t.products), 'box-seam', '#0b4f8a', `${fmtNum(t.warehouses)} almacenes`)}
      ${kpi('Unidades en stock', fmtNum(t.units), 'stack', '#0e7490')}
      ${kpi('Valor del inventario', fmtMoney(t.value), 'cash-coin', '#15803d')}
      ${kpi('Alertas de reposición', fmtNum(t.lowStock), 'exclamation-triangle-fill', t.critical ? '#dc2626' : '#d97706', `${fmtNum(t.critical)} en nivel crítico`)}
    </div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-xl-7"><div class="iq-card h-100"><div class="iq-card-h">Movimientos de los últimos 7 días</div><div class="iq-card-b"><div style="height:290px"><canvas id="chMov" aria-label="Gráfico de entradas y salidas por día" role="img"></canvas></div></div></div></div>
      <div class="col-12 col-xl-5"><div class="iq-card h-100"><div class="iq-card-h">Unidades por categoría</div><div class="iq-card-b"><div style="height:290px"><canvas id="chCat" aria-label="Gráfico de unidades por categoría" role="img"></canvas></div></div></div></div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-xl-7"><div class="iq-card h-100"><div class="iq-card-h"><span>Productos que necesitan reposición</span><a href="#/movimientos" class="btn btn-sm btn-primary">Registrar entrada</a></div><div class="iq-card-b">
        ${d.lowStock.length ? `<div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Producto</th><th class="text-end">Stock</th><th class="text-end">Mínimo</th><th>Cobertura</th><th>Nivel</th></tr></thead><tbody>
        ${d.lowStock.map((p) => {
    const pct = Math.min(100, Math.round((p.total / Math.max(1, p.minStock)) * 100));
    return `<tr class="row-${p.level}"><td><strong>${esc(p.name)}</strong><br><small class="text-secondary">${esc(p.sku)}</small></td><td class="text-end">${fmtNum(p.total)}</td><td class="text-end">${fmtNum(p.minStock)}</td>
          <td style="min-width:110px"><div class="progress"><div class="progress-bar ${p.level === 'critico' ? 'p-danger' : 'p-warn'}" style="width:${pct}%"></div></div></td><td>${levelBadge(p.level)}</td></tr>`;
  }).join('')}</tbody></table></div>` : '<div class="text-success fw-semibold"><i class="bi bi-check-circle-fill me-1"></i>Todo el inventario está sobre su nivel mínimo.</div>'}
      </div></div></div>
      <div class="col-12 col-xl-5"><div class="iq-card h-100"><div class="iq-card-h">Ocupación de almacenes</div><div class="iq-card-b">
        ${d.warehouseUsage.map((w) => `<div class="mb-3"><div class="d-flex justify-content-between"><span class="fw-semibold">${esc(w.name)}</span><span>${w.pct}%</span></div>
          <div class="progress" role="progressbar" aria-label="Ocupación de ${esc(w.name)}" aria-valuenow="${w.pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar ${pctClass(w.pct)}" style="width:${Math.min(100, w.pct)}%"></div></div>
          <small class="text-secondary">${fmtNum(w.used)} de ${fmtNum(w.capacity)} unidades</small></div>`).join('')}
      </div></div></div>
    </div>`;

  const fmtDay = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit' });
  charts.push(new Chart(root.querySelector('#chMov'), {
    type: 'bar',
    data: {
      labels: d.movementsByDay.map((x) => fmtDay(x.day)),
      datasets: [
        { label: 'Entradas', data: d.movementsByDay.map((x) => x.entradas), backgroundColor: '#15803d', borderRadius: 4 },
        { label: 'Salidas', data: d.movementsByDay.map((x) => x.salidas), backgroundColor: '#f59e0b', borderRadius: 4 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Unidades' } } } },
  }));
  charts.push(new Chart(root.querySelector('#chCat'), {
    type: 'bar',
    data: { labels: d.byCategory.map((c) => c.category), datasets: [{ label: 'Unidades', data: d.byCategory.map((c) => c.units), backgroundColor: '#0b4f8a', borderRadius: 4 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
  }));

  return () => charts.forEach((c) => c.destroy());
}
