const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const root = path.join(__dirname, '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'script-src': ["'self'"],
      'connect-src': ["'self'"],
    },
  },
}));
// El frontend se sirve desde el mismo origen, por lo que CORS queda desactivado salvo
// que se declaren orígenes permitidos en CORS_ORIGIN (lista separada por comas).
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
app.use(compression());
app.use(express.json({ limit: '100kb' }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('tiny', { stream: { write: (m) => logger.info(m.trim()) } }));
}

// Librerías de interfaz servidas localmente (sin depender de CDN).
app.use('/vendor/bootstrap', express.static(nm('bootstrap', 'dist'), { maxAge: '7d' }));
app.use('/vendor/bootstrap-icons', express.static(nm('bootstrap-icons', 'font'), { maxAge: '7d' }));
app.use('/vendor/leaflet', express.static(nm('leaflet', 'dist'), { maxAge: '7d' }));
app.use('/vendor/chart.js', express.static(nm('chart.js', 'dist'), { maxAge: '7d' }));
app.use(express.static(path.join(root, 'public'), { maxAge: '1h', extensions: ['html'] }));

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/warehouses', require('./routes/warehouses'));
app.use('/api/movements', require('./routes/movements'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/external', require('./routes/external'));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
