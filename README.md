# Gestor de Proyectos — Vitralux / VLX Windows

Aplicación web de gestión de proyectos para Vitralux Windows S.A.S. (Colombia) y VLX Windows Corp. (USA): ciclo de vida completo de proyectos de ventanería en 5 etapas + adicionales, con notificaciones automáticas, mini-CRM de cotizaciones, permisos granulares y dashboards gerenciales.

## Estructura

| Carpeta | Descripción |
|---|---|
| `frontend/` | Next.js + React + TypeScript (App Router, Tailwind) |
| `backend/` | API Node.js + Express + TypeScript, Prisma + PostgreSQL |

## Desarrollo local

### Base de datos (PostgreSQL portable)

PostgreSQL 17 corre en modo portable en `C:\Users\Camilo Mejia\pgsql17` (sin servicio de Windows). Si no está corriendo, iniciarlo con:

```powershell
& "C:\Users\Camilo Mejia\pgsql17\pgsql\bin\pg_ctl.exe" -D "C:\Users\Camilo Mejia\pgsql17\data" -l "C:\Users\Camilo Mejia\pgsql17\postgres.log" start
```

Base de datos de desarrollo: `vitralux_pm` (usuario `postgres`).

### Aplicación

```bash
# Backend (puerto 4000)
cd backend
cp .env.example .env   # completar valores
npm install
npm run dev

# Frontend (puerto 3000)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Variables de entorno

Ver `backend/.env.example` y `frontend/.env.example`. Nunca commitear archivos `.env` con credenciales.

## Despliegue en Railway

En el proyecto de Railway existente (el del cotizador), crear:

1. **Base de datos**: nuevo servicio PostgreSQL (o una base `vitralux_pm` separada dentro del servicio existente — nunca mezclar con los datos del cotizador).
2. **Servicio backend** (root directory: `backend/`):
   - Build: `npm install && npm run build && npx prisma migrate deploy`
   - Start: `npm start`
   - Variables: todas las de `backend/.env.example` (`DATABASE_URL` de la base nueva, `JWT_SECRET` fuerte, SMTP y Twilio para que salgan los correos y WhatsApp reales, `FRONTEND_URL` con el dominio del frontend).
   - Primera vez: ejecutar `npx prisma db seed` para crear equipos y el usuario administrador.
3. **Servicio frontend** (root directory: `frontend/`):
   - Build: `npm install && npm run build` · Start: `npm start`
   - Variables: `NEXT_PUBLIC_API_URL` con la URL pública del backend.
4. **Dominio sugerido**: `pm.vitralux.co` o `proyectos.vitralux.co` apuntando al frontend.

Sin credenciales SMTP/Twilio el sistema funciona igual: las notificaciones quedan en la bandeja de la app y registran el motivo por el que no salieron.
