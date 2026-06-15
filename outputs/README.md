# TGT - Sistema de servicio técnico

Aplicación web real para gestionar clientes, turnos y reparaciones. Incluye portal del cliente, panel técnico, PostgreSQL, autenticación por roles y contraseñas protegidas con bcrypt.

## Arquitectura

- Frontend: HTML, JavaScript y Bootstrap.
- Backend: Node.js y Express.
- Base de datos: PostgreSQL.
- Autenticación: JWT en cookie `httpOnly`.
- Roles: `ADMIN` y `CLIENT`.

## Requisitos

1. Node.js 20 o superior.
2. PostgreSQL 15 o superior, o Docker Desktop.
3. Terminal PowerShell.

## Puesta en marcha

Abrí PowerShell dentro de esta carpeta:

```powershell
cd "C:\Users\fedep\Documents\Codex\2026-06-13\voy-a-necesitar-una-pagina-ah\outputs"
```

### 1. Instalar dependencias

```powershell
npm install
```

### 2. Iniciar PostgreSQL

La opción más simple es Docker:

```powershell
docker compose up -d
```

Esto crea la base `tgt_db` en `localhost:5432`.

Sin Docker, instalá PostgreSQL y creá una base y un usuario con los valores que figuran en `.env.example`.

### 3. Crear el archivo de configuración

```powershell
Copy-Item .env.example .env
```

Editá `.env` y cambiá obligatoriamente:

```env
JWT_SECRET=una-clave-aleatoria-muy-larga-y-privada
ADMIN_EMAIL=tu-email
ADMIN_PASSWORD=una-clave-segura
```

No subas `.env` a GitHub.

### 4. Crear las tablas

```powershell
npm run db:migrate
```

### 5. Crear la cuenta del técnico

```powershell
npm run admin:create
```

El registro visible en la página crea solamente cuentas de clientes. Esto evita que una persona se otorgue permisos administrativos.

### 6. Iniciar TGT

Durante el desarrollo:

```powershell
npm run dev
```

Luego abrí:

[http://localhost:3000](http://localhost:3000)

No abras `index.html` con `file://`: la versión real necesita el servidor para acceder a PostgreSQL.

## Recorrido del cliente

1. Selecciona **Registrate**.
2. Carga nombre, email, teléfono, dirección y contraseña.
3. Inicia sesión automáticamente.
4. Solicita un turno indicando equipo, modelo, fecha, horario y problema.
5. Consulta sus turnos y el estado de sus reparaciones.
6. Puede actualizar sus datos o cancelar turnos futuros.

## Recorrido del técnico

1. Ingresa con la cuenta creada mediante `npm run admin:create`.
2. Consulta clientes, agenda y reparaciones.
3. Registra órdenes de reparación.
4. Actualiza estado y fecha estimada de entrega.
5. Consulta el historial de trabajos finalizados.

## Seguridad aplicada

- Hash bcrypt con 12 rondas para contraseñas.
- Cookie de sesión `httpOnly`, `sameSite=lax` y `secure` en producción.
- Consultas SQL parametrizadas.
- Rutas protegidas por autenticación y rol.
- Encabezados de seguridad mediante Helmet.
- Registro público restringido al rol cliente.
- Restricciones e integridad referencial en PostgreSQL.

Para producción se debe usar HTTPS, una clave JWT única y PostgreSQL administrado.

## Copias de seguridad

Con PostgreSQL instalado y `DATABASE_URL` configurada:

```powershell
.\scripts\backup.ps1
```

El archivo se guarda en `backups/`. Para automatizarlo diariamente, programá este script en el Programador de tareas de Windows.

Los proveedores administrados como Render, Railway, Neon o Supabase también ofrecen respaldos automáticos según el plan.

## Publicación 24/7

1. Creá un repositorio privado en GitHub.
2. Subí el contenido de esta carpeta, excepto `.env`.
3. Creá una base PostgreSQL administrada.
4. Creá un servicio web Node o Docker.
5. Configurá las variables `DATABASE_URL`, `JWT_SECRET` y `NODE_ENV=production`.
6. Ejecutá una vez `npm run db:migrate` y `npm run admin:create`.
7. Configurá el comando de inicio:

```text
npm start
```

8. Activá HTTPS, dominio propio, monitoreo y backups.

## Publicación en Vercel con base de datos

El proyecto ya está preparado para Vercel con:

- `api/index.js`: entrada serverless para Express.
- `vercel.json`: envía todas las rutas a la aplicación.
- `.env.vercel.example`: variables necesarias para producción.
- `database/schema.sql`: estructura completa de PostgreSQL.

### 1. Crear la base PostgreSQL

En Vercel podés crear una base desde **Storage** usando Postgres, o conectar una base PostgreSQL externa como Neon, Supabase o Railway.

Copiá la cadena de conexión de producción y cargala en Vercel como variable:

```env
DATABASE_URL=postgresql://usuario:password@host:5432/base?sslmode=require
```

También agregá estas variables en **Project Settings > Environment Variables**:

```env
NODE_ENV=production
DB_POOL_MAX=5
JWT_SECRET=una-clave-aleatoria-muy-larga-y-privada
ADMIN_NAME=Administrador TGT
ADMIN_EMAIL=tu-email
ADMIN_PASSWORD=una-clave-segura
```

### 2. Crear las tablas

Después de configurar `DATABASE_URL`, ejecutá una sola vez:

```powershell
npm run db:migrate
```

Para hacerlo desde tu computadora contra la base de Vercel, podés crear temporalmente un `.env` local con la `DATABASE_URL` de producción y luego correr el comando. No subas ese `.env` a GitHub.

### 3. Crear el administrador

Con las variables `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` configuradas:

```powershell
npm run admin:create
```

### 4. Desplegar

Conectá el repositorio en Vercel y desplegá. Vercel usará `api/index.js`, por eso no hace falta cambiar el frontend ni las rutas `/api/...`.

## Estructura

```text
outputs/
  api/
    index.js
  database/schema.sql
  public/
    index.html
    styles.css
    app.js
  scripts/backup.ps1
  src/
    auth.js
    create-admin.js
    db.js
    migrate.js
    server.js
  .env.example
  docker-compose.yml
  Dockerfile
  package.json
```

## Próximas mejoras recomendadas

- Recuperación de contraseña por email.
- Confirmaciones y avisos por WhatsApp o email.
- Carga de imágenes del equipo.
- Auditoría de cambios por técnico.
- Paginación y reportes.
- Pruebas automáticas.
- Migraciones SQL versionadas.
