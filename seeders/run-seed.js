/**
 * Datos de demostración. Es idempotente: si ya hay usuarios, no hace nada.
 * Genera movimientos de los últimos 14 días y deja el stock consistente con ellos.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Warehouse, Product, Stock, Movement } = require('../src/models');

// Generador pseudoaleatorio determinista para resultados reproducibles.
let seedState = 20261101;
const rnd = () => { seedState = (seedState * 1664525 + 1013904223) % 4294967296; return seedState / 4294967296; };
const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const WAREHOUSES = [
  { name: 'Centro de Distribución Callao', city: 'Callao', address: 'Av. Néstor Gambetta 5200', latitude: -12.0566, longitude: -77.1181, capacity: 6000 },
  { name: 'Almacén Arequipa', city: 'Arequipa', address: 'Parque Industrial Río Seco, Cerro Colorado', latitude: -16.409, longitude: -71.5375, capacity: 3500 },
  { name: 'Almacén Trujillo', city: 'Trujillo', address: 'Zona Industrial Av. Argentina 1200', latitude: -8.1091, longitude: -79.0215, capacity: 3000 },
  { name: 'Almacén Piura', city: 'Piura', address: 'Zona Industrial Sullana Km 2', latitude: -5.1945, longitude: -80.6328, capacity: 2200 },
  { name: 'Almacén Cusco', city: 'Cusco', address: 'Av. de la Cultura 2100', latitude: -13.532, longitude: -71.9675, capacity: 1800 },
];

const PRODUCTS = [
  ['ROD-6204', 'Rodamiento rígido de bolas 6204', 'Repuestos mecánicos', 'unidad', 18.5, 80],
  ['ROD-6306', 'Rodamiento rígido de bolas 6306', 'Repuestos mecánicos', 'unidad', 32.9, 60],
  ['COR-B65', 'Correa en V tipo B65', 'Repuestos mecánicos', 'unidad', 41.0, 40],
  ['FIL-AC01', 'Filtro de aceite hidráulico', 'Repuestos mecánicos', 'unidad', 56.8, 50],
  ['LUB-ISO68', 'Aceite hidráulico ISO 68 (balde 19 L)', 'Lubricantes', 'balde', 295.0, 25],
  ['LUB-GRS2', 'Grasa multipropósito NLGI 2 (cartucho)', 'Lubricantes', 'cartucho', 14.2, 120],
  ['LUB-REF01', 'Refrigerante industrial (galón)', 'Lubricantes', 'galón', 38.0, 40],
  ['EPP-CAS01', 'Casco de seguridad dieléctrico', 'EPP', 'unidad', 24.0, 100],
  ['EPP-GUA02', 'Guantes de nitrilo reforzado (par)', 'EPP', 'par', 9.5, 300],
  ['EPP-LEN03', 'Lentes de seguridad antiempañante', 'EPP', 'unidad', 7.8, 200],
  ['EPP-TAP04', 'Tapones auditivos (caja x100)', 'EPP', 'caja', 36.0, 30],
  ['ELE-CAB12', 'Cable THW 12 AWG (rollo 100 m)', 'Eléctricos', 'rollo', 168.0, 20],
  ['ELE-INT20', 'Interruptor termomagnético 20 A', 'Eléctricos', 'unidad', 27.5, 60],
  ['ELE-CON25', 'Contactor trifásico 25 A', 'Eléctricos', 'unidad', 94.0, 25],
  ['SEG-CIN01', 'Cinta de peligro 300 m', 'Seguridad industrial', 'rollo', 12.0, 50],
  ['SEG-EXT06', 'Extintor PQS 6 kg', 'Seguridad industrial', 'unidad', 118.0, 15],
  ['EMB-STR01', 'Film stretch industrial 18"', 'Embalaje', 'rollo', 22.0, 150],
  ['EMB-PAL01', 'Pallet de madera tratada 1.2 x 1.0 m', 'Embalaje', 'unidad', 45.0, 100],
  ['EMB-CAJ05', 'Caja de cartón corrugado 60x40x40', 'Embalaje', 'unidad', 3.9, 500],
  ['HER-LLA10', 'Juego de llaves mixtas 8-24 mm', 'Herramientas', 'juego', 85.0, 20],
  ['HER-TAL02', 'Taladro percutor industrial 800 W', 'Herramientas', 'unidad', 289.0, 8],
  ['HER-DIS05', 'Disco de corte metal 7"', 'Herramientas', 'unidad', 4.6, 400],
];

(async () => {
  await sequelize.authenticate();
  if ((await User.count()) > 0) {
    console.log('La base ya tiene datos. No se realizan cambios.');
    await sequelize.close();
    return;
  }

  const hash = (p) => bcrypt.hashSync(p, 10);
  const [admin, operator] = await User.bulkCreate([
    { name: 'Administrador del Sistema', email: 'admin@inveniq.pe', passwordHash: hash('Admin2026!'), role: 'administrador' },
    { name: 'Operador de Almacén', email: 'operador@inveniq.pe', passwordHash: hash('Operador2026!'), role: 'operador' },
  ], { returning: true });

  const warehouses = await Warehouse.bulkCreate(WAREHOUSES, { returning: true });
  const products = await Product.bulkCreate(
    PRODUCTS.map(([sku, name, category, unit, unitCost, minStock]) => ({ sku, name, category, unit, unitCost, minStock })),
    { returning: true },
  );

  // Stock inicial por producto y almacén (no todos los productos están en todos los almacenes).
  const stock = new Map();
  const movements = [];
  const now = Date.now();
  const day = 24 * 3600 * 1000;

  for (const p of products) {
    for (const w of warehouses) {
      if (rnd() < 0.3) continue;
      const base = Math.max(5, Math.round(p.minStock * (0.35 + rnd() * 1.1) / 2));
      stock.set(`${p.id}:${w.id}`, base);
      movements.push({ type: 'entrada', productId: p.id, warehouseId: w.id, userId: admin.id, quantity: base, reference: 'INV-INICIAL', notes: 'Carga de inventario inicial', status: 'registrado', createdAt: new Date(now - 15 * day), updatedAt: new Date(now - 15 * day) });
    }
  }

  // Movimientos diarios de los últimos 14 días.
  for (let d = 14; d >= 0; d--) {
    const n = randInt(3, 7);
    for (let i = 0; i < n; i++) {
      const keys = [...stock.keys()];
      const key = keys[randInt(0, keys.length - 1)];
      const [productId, warehouseId] = key.split(':').map(Number);
      const current = stock.get(key);
      const isOut = rnd() < 0.55 && current > 4;
      const quantity = isOut ? randInt(1, Math.max(1, Math.floor(current * 0.25))) : randInt(5, 40);
      const w = warehouses.find((x) => x.id === warehouseId);
      const used = [...stock.entries()].filter(([k]) => k.endsWith(`:${warehouseId}`)).reduce((s, [, v]) => s + v, 0);
      if (!isOut && used + quantity > w.capacity) continue;
      stock.set(key, current + (isOut ? -quantity : quantity));
      const at = new Date(now - d * day + randInt(1, 10) * 3600 * 1000);
      movements.push({
        type: isOut ? 'salida' : 'entrada', productId, warehouseId, quantity,
        userId: rnd() < 0.5 ? admin.id : operator.id,
        reference: isOut ? `OS-${randInt(1000, 9999)}` : `OC-${randInt(1000, 9999)}`,
        notes: isOut ? 'Despacho a planta' : 'Recepción de proveedor',
        status: 'registrado', createdAt: at, updatedAt: at,
      });
    }
  }

  await Stock.bulkCreate([...stock.entries()].map(([k, quantity]) => {
    const [productId, warehouseId] = k.split(':').map(Number);
    return { productId, warehouseId, quantity };
  }));
  await Movement.bulkCreate(movements);

  console.log(`Semilla aplicada: 2 usuarios, ${warehouses.length} almacenes, ${products.length} productos, ${movements.length} movimientos.`);
  await sequelize.close();
})().catch((e) => { console.error(e); process.exit(1); });
