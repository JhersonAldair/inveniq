// Cliente HTTP y manejo de sesión (JWT en sessionStorage).
const KEY = 'inveniq_session';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || {};
  }
}

export const session = {
  get() {
    try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (_) { return null; }
  },
  set(token, user) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ token, user })); } catch (_) { /* almacenamiento no disponible */ }
  },
  clear() {
    try { sessionStorage.removeItem(KEY); } catch (_) { /* nada */ }
  },
};

function toQuery(query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, v);
  });
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function api(path, { method = 'GET', body, query, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const s = session.get();
  if (auth && s) headers.Authorization = `Bearer ${s.token}`;

  let res;
  try {
    res = await fetch(`/api${path}${toQuery(query)}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (_) {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Verifique su conexión.');
  }

  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (_) { /* respuesta sin cuerpo */ }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      session.clear();
      window.location.href = '/index.html';
    }
    throw new ApiError(res.status, (data && data.error) || 'Error inesperado', data && data.details);
  }
  return data;
}
