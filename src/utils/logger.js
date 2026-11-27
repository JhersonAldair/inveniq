const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', '..', 'logs');
const logFile = path.join(logDir, 'app.log');
const silent = process.env.NODE_ENV === 'test';

try { fs.mkdirSync(logDir, { recursive: true }); } catch (_) { /* sin permisos: solo consola */ }

function write(level, message, meta) {
  if (silent) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, message, ...(meta || {}) });
  (level === 'error' ? console.error : console.log)(line);
  fs.appendFile(logFile, line + '\n', () => {});
}

module.exports = {
  info: (m, meta) => write('info', m, meta),
  warn: (m, meta) => write('warn', m, meta),
  error: (m, meta) => write('error', m, meta),
};
