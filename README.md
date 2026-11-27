# InvenIQ

Sistema web de gestión de inventario y almacenes industriales. Proyecto del curso Desarrollo de Aplicaciones Web (UNMSM, Ingeniería Industrial, 2026-2).

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 semántico, CSS3, Bootstrap 5, JavaScript ES2022 (módulos), Chart.js, Leaflet |
| Backend | Node.js 22, Express 5 |
| Base de datos | PostgreSQL 16, ORM Sequelize, migraciones con sequelize-cli |
| Seguridad | JWT, bcrypt, helmet (CSP), límite de intentos de acceso, roles |
| Servicios externos | OpenStreetMap (mapas), Open-Meteo (clima), API Geolocation del navegador |
| Calidad | Jest + Supertest, GitHub Actions |

## Puesta en marcha local

Requisitos: Node.js 20 o superior y PostgreSQL 14 o superior.

```bash
npm install
cp .env.example .env            # ajuste DATABASE_URL y JWT_SECRET
createdb inventario && createdb inventario_test
npm run migrate                 # crea las tablas
npm run seed                    # datos de demostración
npm start                       # http://localhost:3000
```

Cuentas de demostración: `admin@inveniq.pe` / `Admin2026!` (administrador) y `operador@inveniq.pe` / `Operador2026!` (operador).

Variable opcional `CORS_ORIGIN`: lista de orígenes permitidos para consumir la API desde otro dominio. Por defecto CORS está desactivado porque el frontend se sirve desde el mismo servidor.

## Pruebas

```bash
npm test
```

Las pruebas recrean el esquema en la base `inventario_test` ejecutando las migraciones reales.

## Roles

| Acción | Administrador | Operador |
|---|---|---|
| Consultar productos, almacenes, stock, tablero y mapa | Sí | Sí |
| Registrar entradas y salidas | Sí | Sí |
| Crear, editar y dar de baja productos y almacenes | Sí | No |
| Editar notas y anular movimientos | Sí | No |
| Gestionar usuarios | Sí | No |

## API REST

Todas las rutas, salvo `/api/auth/*` y `/health`, requieren `Authorization: Bearer <token>`.

| Recurso | Métodos |
|---|---|
| `/api/auth` | `POST /register`, `POST /login`, `GET /me` |
| `/api/users` | `GET /`, `PUT /:id` |
| `/api/products` | `GET /`, `GET /categories`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `/api/warehouses` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `/api/movements` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` (anula) |
| `/api/stock` | `GET /` |
| `/api/dashboard` | `GET /` |
| `/api/external/weather` | `GET /?lat=&lng=` |

## Despliegue en Render

1. Suba el repositorio a GitHub.
2. En Render, cree un Blueprint a partir de `render.yaml`. Se crean el servicio web y la base PostgreSQL.
3. El flujo de CI de GitHub Actions (`.github/workflows/ci.yml`) ejecuta las pruebas en cada push.
