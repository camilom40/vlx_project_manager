# Gestor de Proyectos — Vitralux / VLX Windows

Aplicación web de gestión de proyectos para Vitralux Windows S.A.S. (Colombia) y VLX Windows Corp. (USA): ciclo de vida completo de proyectos de ventanería en 5 etapas + adicionales, con notificaciones automáticas, mini-CRM de cotizaciones, permisos granulares y dashboards gerenciales.

## Estructura

| Carpeta | Descripción |
|---|---|
| `frontend/` | Next.js + React + TypeScript (App Router, Tailwind) |
| `backend/` | API Node.js + Express + TypeScript, Prisma + PostgreSQL |

## Desarrollo local

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

## Despliegue

Railway: servicio frontend + servicio backend + PostgreSQL (base de datos separada del cotizador existente).
