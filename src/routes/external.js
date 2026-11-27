const express = require('express');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

// Caché en memoria (10 minutos) para no saturar el servicio externo.
const cache = new Map();
const TTL_MS = 10 * 60 * 1000;

const WEATHER_CODES = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla con escarcha', 51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa',
  61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa', 80: 'Chubascos', 81: 'Chubascos fuertes',
  82: 'Chubascos violentos', 95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo',
};

/** Evalúa condiciones de almacenamiento a partir del clima actual. */
function storageAdvice(temp, humidity) {
  if (temp >= 32 || humidity >= 85) return { level: 'alerta', text: 'Condiciones adversas para almacenar materiales sensibles. Revisar ventilación y control de humedad.' };
  if (temp >= 28 || humidity >= 75) return { level: 'precaucion', text: 'Condiciones límite. Monitorear productos sensibles a humedad o calor.' };
  return { level: 'optimo', text: 'Condiciones adecuadas para el almacenamiento.' };
}

router.get('/weather', asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new AppError(400, 'Coordenadas no válidas');
  }
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return res.json({ ...hit.data, cached: true });

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
    + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto';
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const c = body.current;
    const data = {
      temperature: c.temperature_2m,
      humidity: c.relative_humidity_2m,
      wind: c.wind_speed_10m,
      description: WEATHER_CODES[c.weather_code] || 'Sin descripción',
      advice: storageAdvice(c.temperature_2m, c.relative_humidity_2m),
      source: 'Open-Meteo',
      time: c.time,
    };
    cache.set(key, { at: Date.now(), data });
    return res.json({ ...data, cached: false });
  } catch (err) {
    logger.warn('Fallo del servicio meteorológico', { message: err.message });
    throw new AppError(502, 'El servicio meteorológico no está disponible en este momento');
  }
}));

module.exports = router;
