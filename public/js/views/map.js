import { api } from '../api.js';
import { esc, fmtNum, toast } from '../ui.js';

const LAST_KEY = 'inveniq_last_location';
const color = (pct) => (pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : '#15803d');

function haversineKm(a, b) {
  const R = 6371; const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const ADVICE_CLS = { optimo: 'success', precaucion: 'warning', alerta: 'danger' };

async function weatherHtml(w) {
  try {
    const c = await api('/external/weather', { query: { lat: w.latitude, lng: w.longitude } });
    return `<div class="mt-2"><strong>${c.temperature} °C</strong> | ${esc(c.description)}<br>Humedad ${c.humidity}% | Viento ${c.wind} km/h
      <div class="mt-1"><span class="badge text-bg-${ADVICE_CLS[c.advice.level]}">${esc(c.advice.level)}</span> <small>${esc(c.advice.text)}</small></div>
      <div class="text-secondary" style="font-size:.72rem">Fuente: ${esc(c.source)}</div></div>`;
  } catch (err) {
    return `<div class="mt-2 text-danger small">${esc(err.message)}</div>`;
  }
}

export async function render(root) {
  const { data: warehouses } = await api('/warehouses');
  root.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h1 class="page-title mb-0">Mapa de almacenes y clima</h1>
      <button class="btn btn-primary" id="locBtn"><i class="bi bi-crosshair me-1"></i>Usar mi ubicación</button>
    </div>
    <div class="row g-3">
      <div class="col-12 col-lg-8"><div id="map" role="application" aria-label="Mapa interactivo de almacenes"></div></div>
      <div class="col-12 col-lg-4">
        <div id="nearest" class="iq-card mb-3 d-none"><div class="iq-card-b"></div></div>
        <div class="iq-card"><div class="iq-card-h">Almacenes</div><div class="list-group list-group-flush" id="list">
          ${warehouses.map((w) => `<div class="list-group-item wh-item" data-id="${w.id}" style="--lvl-c:${color(w.usagePct)}" tabindex="0" role="button">
            <div class="d-flex justify-content-between"><strong>${esc(w.name)}</strong><span class="badge" style="background:${color(w.usagePct)}">${w.usagePct}%</span></div>
            <small class="text-secondary">${esc(w.city)} | ${fmtNum(w.used)} / ${fmtNum(w.capacity)} u.</small></div>`).join('')}
        </div></div>
      </div>
    </div>
    <p class="text-secondary small mt-2 mb-0">El color del marcador indica la ocupación: verde bajo 70%, ámbar de 70% a 89% y rojo desde 90%. Haga clic en un marcador para ver el clima y las condiciones de almacenamiento.</p>`;

  const map = L.map(root.querySelector('#map'), { scrollWheelZoom: false }).setView([-9.2, -75.0], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; Colaboradores de OpenStreetMap' }).addTo(map);
  map.on('focus', () => map.scrollWheelZoom.enable());
  map.on('blur', () => map.scrollWheelZoom.disable());

  const markers = new Map();
  warehouses.forEach((w) => {
    const m = L.circleMarker([w.latitude, w.longitude], { radius: 13, color: '#fff', weight: 2, fillColor: color(w.usagePct), fillOpacity: 0.95 }).addTo(map);
    const base = (extra) => `<div style="min-width:220px"><strong>${esc(w.name)}</strong><br>${esc(w.address)}<br>Ocupación: <strong>${w.usagePct}%</strong> (${fmtNum(w.used)} / ${fmtNum(w.capacity)})<div class="wx mt-2">${extra}</div></div>`;
    m.bindPopup(base('<span class="text-secondary">Consultando clima...</span>'));
    m.on('popupopen', async (e) => {
      // Se reemplaza el contenido completo: popup.update() volvería a dibujar el contenido original.
      e.popup.setContent(base(await weatherHtml(w)));
    });
    markers.set(w.id, m);
  });
  if (warehouses.length) map.fitBounds(warehouses.map((w) => [w.latitude, w.longitude]), { padding: [40, 40] });

  root.querySelector('#list').addEventListener('click', (e) => {
    const item = e.target.closest('.wh-item');
    if (!item) return;
    const w = warehouses.find((x) => x.id === Number(item.dataset.id));
    map.flyTo([w.latitude, w.longitude], 10);
    markers.get(w.id).openPopup();
  });

  // Geolocalización del navegador: almacén más cercano al usuario.
  let userLayer = null;
  function showNearest(pos) {
    if (userLayer) userLayer.remove();
    const nearest = warehouses.map((w) => ({ w, km: haversineKm(pos, { lat: w.latitude, lng: w.longitude }) })).sort((a, b) => a.km - b.km)[0];
    userLayer = L.layerGroup().addTo(map);
    L.circleMarker([pos.lat, pos.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#0b4f8a', fillOpacity: 1 }).bindTooltip('Su ubicación').addTo(userLayer);
    if (nearest) {
      L.polyline([[pos.lat, pos.lng], [nearest.w.latitude, nearest.w.longitude]], { color: '#0b4f8a', dashArray: '6 8' }).addTo(userLayer);
      map.fitBounds([[pos.lat, pos.lng], [nearest.w.latitude, nearest.w.longitude]], { padding: [60, 60] });
      const box = root.querySelector('#nearest');
      box.classList.remove('d-none');
      box.querySelector('.iq-card-b').innerHTML = `<div class="text-secondary small">Almacén más cercano</div><div class="fs-5 fw-bold">${esc(nearest.w.name)}</div><div>A <strong>${nearest.km.toFixed(1)} km</strong> de su ubicación.</div>`;
    }
  }

  const btn = root.querySelector('#locBtn');
  btn.addEventListener('click', () => {
    if (!('geolocation' in navigator)) { toast('Su navegador no admite geolocalización', 'warning'); return; }
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition((p) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      try { localStorage.setItem(LAST_KEY, JSON.stringify(pos)); } catch (_) { /* opcional */ }
      showNearest(pos); btn.disabled = false;
    }, (err) => {
      btn.disabled = false;
      const msg = err.code === 1 ? 'Permiso de ubicación denegado. Habilítelo en el navegador.' : 'No se pudo obtener su ubicación.';
      toast(msg, 'warning');
      let last = null;
      try { last = JSON.parse(localStorage.getItem(LAST_KEY)); } catch (_) { /* nada */ }
      if (last) { toast('Se usa su última ubicación guardada.', 'info'); showNearest(last); }
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });

  return () => map.remove();
}
