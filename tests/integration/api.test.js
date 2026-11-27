const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');

let admin; let operator; let wh; let wh2; let prod;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

beforeAll(async () => {
  await sequelize.query('TRUNCATE movements, stocks, products, warehouses, users RESTART IDENTITY CASCADE');
  await User.bulkCreate([
    { name: 'Admin Test', email: 'admin@test.pe', passwordHash: bcrypt.hashSync('Admin2026!', 4), role: 'administrador' },
    { name: 'Operador Test', email: 'op@test.pe', passwordHash: bcrypt.hashSync('Operador2026!', 4), role: 'operador' },
    { name: 'Inactivo', email: 'off@test.pe', passwordHash: bcrypt.hashSync('Inactivo2026!', 4), role: 'operador', active: false },
  ]);
  admin = await login('admin@test.pe', 'Admin2026!');
  operator = await login('op@test.pe', 'Operador2026!');
});
afterAll(async () => { await sequelize.close(); });

describe('Autenticación', () => {
  test('registro crea siempre un operador', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Nuevo Usuario', email: 'nuevo@test.pe', password: 'Clave12345', role: 'administrador' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('operador');
    expect(res.body.token).toBeTruthy();
  });
  test('rechaza correo duplicado', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Otro Nombre', email: 'nuevo@test.pe', password: 'Clave12345' });
    expect(res.status).toBe(409);
  });
  test('rechaza contraseña débil', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Otro Nombre', email: 'debil@test.pe', password: 'abcdefgh' });
    expect(res.status).toBe(400);
    expect(res.body.details.password).toMatch(/Mínimo 8/);
  });
  test('login correcto devuelve token y no expone el hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.pe', password: 'Admin2026!' });
    expect(res.status).toBe(200);
    expect(res.body.user.passwordHash).toBeUndefined();
  });
  test('login incorrecto devuelve 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.pe', password: 'incorrecta1' });
    expect(res.status).toBe(401);
  });
  test('usuario inactivo no puede ingresar', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'off@test.pe', password: 'Inactivo2026!' });
    expect(res.status).toBe(401);
  });
  test('rutas protegidas exigen token válido', async () => {
    expect((await request(app).get('/api/products')).status).toBe(401);
    expect((await request(app).get('/api/products').set(auth('token-falso'))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth(admin))).body.user.email).toBe('admin@test.pe');
  });
});

describe('Control de roles', () => {
  test('operador no puede crear productos ni gestionar usuarios', async () => {
    const p = await request(app).post('/api/products').set(auth(operator)).send({ sku: 'OP-001', name: 'Producto', category: 'Test' });
    expect(p.status).toBe(403);
    expect((await request(app).get('/api/users').set(auth(operator))).status).toBe(403);
  });
  test('administrador lista y edita usuarios, pero no su propia cuenta', async () => {
    const list = await request(app).get('/api/users').set(auth(admin));
    expect(list.status).toBe(200);
    const op = list.body.data.find((u) => u.email === 'op@test.pe');
    const upd = await request(app).put(`/api/users/${op.id}`).set(auth(admin)).send({ role: 'administrador' });
    expect(upd.body.role).toBe('administrador');
    await request(app).put(`/api/users/${op.id}`).set(auth(admin)).send({ role: 'operador' });
    const me = list.body.data.find((u) => u.email === 'admin@test.pe');
    expect((await request(app).put(`/api/users/${me.id}`).set(auth(admin)).send({ active: false })).status).toBe(409);
  });
});

describe('Almacenes', () => {
  test('CRUD completo con validación', async () => {
    const bad = await request(app).post('/api/warehouses').set(auth(admin)).send({ name: 'AL', city: '', address: 'x', latitude: 200, longitude: 0, capacity: 0 });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.details)).toEqual(expect.arrayContaining(['name', 'city', 'address', 'latitude', 'capacity']));

    const c1 = await request(app).post('/api/warehouses').set(auth(admin)).send({ name: 'Almacén Central', city: 'Lima', address: 'Av. Principal 123', latitude: -12.05, longitude: -77.04, capacity: 100 });
    expect(c1.status).toBe(201);
    wh = c1.body;
    const c2 = await request(app).post('/api/warehouses').set(auth(admin)).send({ name: 'Almacén Norte', city: 'Trujillo', address: 'Zona Industrial 45', latitude: -8.1, longitude: -79.0, capacity: 50 });
    wh2 = c2.body;

    const upd = await request(app).put(`/api/warehouses/${wh.id}`).set(auth(admin)).send({ city: 'Callao' });
    expect(upd.body.city).toBe('Callao');
    const list = await request(app).get('/api/warehouses').set(auth(operator));
    expect(list.body.total).toBe(2);
    expect((await request(app).get('/api/warehouses/99999').set(auth(admin))).status).toBe(404);
  });
});

describe('Productos', () => {
  test('crear, duplicar, buscar y editar', async () => {
    const res = await request(app).post('/api/products').set(auth(admin)).send({ sku: 'ROD-001', name: 'Rodamiento 6204', category: 'Repuestos', unitCost: 18.5, minStock: 10 });
    expect(res.status).toBe(201);
    prod = res.body;
    expect(prod.totalStock).toBe(0);
    expect(prod.level).toBe('critico');

    const dup = await request(app).post('/api/products').set(auth(admin)).send({ sku: 'ROD-001', name: 'Otro', category: 'Repuestos' });
    expect(dup.status).toBe(409);

    const bad = await request(app).post('/api/products').set(auth(admin)).send({ sku: 'a b', name: 'Producto', category: 'Test', unitCost: -2 });
    expect(bad.status).toBe(400);

    const found = await request(app).get('/api/products?q=rodam').set(auth(operator));
    expect(found.body.total).toBe(1);

    const upd = await request(app).put(`/api/products/${prod.id}`).set(auth(admin)).send({ minStock: 5 });
    expect(upd.body.minStock).toBe(5);
    expect((await request(app).get('/api/products/abc').set(auth(admin))).status).toBe(400);
    expect((await request(app).get('/api/products/categories').set(auth(admin))).body.data).toContain('Repuestos');
  });
});

describe('Movimientos y stock', () => {
  let entry;
  const mv = (token, body) => request(app).post('/api/movements').set(auth(token)).send(body);

  test('una entrada incrementa el stock', async () => {
    const res = await mv(operator, { type: 'entrada', productId: prod.id, warehouseId: wh.id, quantity: 40, reference: 'OC-1' });
    expect(res.status).toBe(201);
    entry = res.body;
    const p = await request(app).get(`/api/products/${prod.id}`).set(auth(admin));
    expect(p.body.totalStock).toBe(40);
    expect(p.body.level).toBe('normal');
  });
  test('una salida descuenta el stock', async () => {
    await mv(operator, { type: 'salida', productId: prod.id, warehouseId: wh.id, quantity: 15 });
    const s = await request(app).get(`/api/stock?productId=${prod.id}&warehouseId=${wh.id}`).set(auth(admin));
    expect(s.body.data[0].quantity).toBe(25);
  });
  test('rechaza salida mayor al stock disponible', async () => {
    const res = await mv(operator, { type: 'salida', productId: prod.id, warehouseId: wh.id, quantity: 26 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Stock insuficiente/);
  });
  test('rechaza entrada que excede la capacidad del almacén', async () => {
    const res = await mv(admin, { type: 'entrada', productId: prod.id, warehouseId: wh2.id, quantity: 51 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Capacidad excedida/);
  });
  test('valida datos del movimiento', async () => {
    const res = await mv(admin, { type: 'traslado', productId: 'x', warehouseId: 0, quantity: -3 });
    expect(res.status).toBe(400);
    expect((await mv(admin, { type: 'entrada', productId: 9999, warehouseId: wh.id, quantity: 1 })).status).toBe(404);
  });
  test('solo el administrador edita notas; las cantidades no se modifican', async () => {
    expect((await request(app).put(`/api/movements/${entry.id}`).set(auth(operator)).send({ notes: 'x' })).status).toBe(403);
    const res = await request(app).put(`/api/movements/${entry.id}`).set(auth(admin)).send({ notes: 'Corregido', quantity: 999 });
    expect(res.body.notes).toBe('Corregido');
    expect(res.body.quantity).toBe(40);
  });
  test('anular revierte el stock y no se puede repetir', async () => {
    const out = await mv(admin, { type: 'salida', productId: prod.id, warehouseId: wh.id, quantity: 5 });
    expect((await request(app).delete(`/api/movements/${out.body.id}`).set(auth(operator))).status).toBe(403);
    const res = await request(app).delete(`/api/movements/${out.body.id}`).set(auth(admin));
    expect(res.body.status).toBe('anulado');
    const s = await request(app).get(`/api/stock?productId=${prod.id}&warehouseId=${wh.id}`).set(auth(admin));
    expect(s.body.data[0].quantity).toBe(25);
    expect((await request(app).delete(`/api/movements/${out.body.id}`).set(auth(admin))).status).toBe(409);
  });
  test('no se puede anular una entrada si dejaría el stock negativo', async () => {
    const res = await request(app).delete(`/api/movements/${entry.id}`).set(auth(admin));
    expect(res.status).toBe(409);
  });
  test('filtra el historial por tipo y producto', async () => {
    const res = await request(app).get(`/api/movements?type=entrada&productId=${prod.id}`).set(auth(admin));
    expect(res.body.data.every((m) => m.type === 'entrada')).toBe(true);
    expect(res.body.data[0].product.sku).toBe('ROD-001');
  });
  test('salidas simultáneas no generan stock negativo (control de concurrencia)', async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => mv(admin, { type: 'salida', productId: prod.id, warehouseId: wh.id, quantity: 10 })));
    const ok = results.filter((r) => r.status === 201).length;
    expect(ok).toBe(2); // solo caben 2 salidas de 10 con 25 disponibles
    const s = await request(app).get(`/api/stock?productId=${prod.id}&warehouseId=${wh.id}`).set(auth(admin));
    expect(s.body.data[0].quantity).toBe(5);
  });
});

describe('Bajas lógicas y tablero', () => {
  test('no se da de baja un producto ni un almacén con stock', async () => {
    expect((await request(app).delete(`/api/products/${prod.id}`).set(auth(admin))).status).toBe(409);
    expect((await request(app).delete(`/api/warehouses/${wh.id}`).set(auth(admin))).status).toBe(409);
    expect((await request(app).put(`/api/warehouses/${wh.id}`).set(auth(admin)).send({ capacity: 1 })).status).toBe(409);
  });
  test('almacén sin stock se da de baja y deja de listarse', async () => {
    expect((await request(app).delete(`/api/warehouses/${wh2.id}`).set(auth(admin))).status).toBe(204);
    const list = await request(app).get('/api/warehouses').set(auth(admin));
    expect(list.body.data.map((w) => w.id)).not.toContain(wh2.id);
  });
  test('el tablero resume totales, alertas y movimientos', async () => {
    const res = await request(app).get('/api/dashboard').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ products: 1, warehouses: 1, units: 5 });
    expect(res.body.totals.value).toBeCloseTo(5 * 18.5);
    expect(res.body.movementsByDay).toHaveLength(7);
    expect(res.body.lowStock[0].sku).toBe('ROD-001');
  });
});

describe('Servicio externo de clima', () => {
  const sample = { current: { temperature_2m: 22.4, relative_humidity_2m: 60, wind_speed_10m: 8, weather_code: 2, time: '2026-11-27T10:00' } };
  afterEach(() => jest.restoreAllMocks());

  test('valida las coordenadas', async () => {
    expect((await request(app).get('/api/external/weather?lat=abc&lng=1').set(auth(admin))).status).toBe(400);
    expect((await request(app).get('/api/external/weather?lat=95&lng=1').set(auth(admin))).status).toBe(400);
  });
  test('transforma la respuesta y usa caché', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => sample });
    const a = await request(app).get('/api/external/weather?lat=-12.05&lng=-77.04').set(auth(admin));
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ temperature: 22.4, humidity: 60, description: 'Parcialmente nublado', cached: false });
    expect(a.body.advice.level).toBe('optimo');
    const b = await request(app).get('/api/external/weather?lat=-12.05&lng=-77.04').set(auth(admin));
    expect(b.body.cached).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  test('devuelve 502 si el servicio externo falla', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('sin red'));
    const res = await request(app).get('/api/external/weather?lat=-5&lng=-80').set(auth(admin));
    expect(res.status).toBe(502);
  });
});

describe('Manejo de errores', () => {
  test('JSON mal formado devuelve 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
  });
  test('ruta de API inexistente devuelve 404', async () => {
    expect((await request(app).get('/api/no-existe').set(auth(admin))).status).toBe(404);
  });
  test('health check', async () => {
    expect((await request(app).get('/health')).body.status).toBe('ok');
  });
});
