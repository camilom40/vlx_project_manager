import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { teamsRouter } from "./routes/teams";
import { projectsRouter } from "./routes/projects";
import { installerGroupsRouter } from "./routes/installerGroups";
import { quotesRouter } from "./routes/quotes";
import { etapa2Router } from "./routes/etapa2";
import { produccionRouter } from "./routes/produccion";
import { actasRouter } from "./routes/actas";
import { warrantiesRouter } from "./routes/warranties";
import { errorsRouter } from "./routes/errors";
import { notificationsRouter } from "./routes/notifications";
import { tasksRouter } from "./routes/tasks";
import { auditRouter } from "./routes/audit";
import { templatesRouter } from "./routes/templates";
import { dashboardRouter } from "./routes/dashboard";
import { clientsRouter } from "./routes/clients";
import { pendientesRouter } from "./routes/pendientes";

// App de Express sin `listen`: la usan el servidor (index.ts) y las
// pruebas de integración (tests/) vía supertest.
export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// Ruta de verificación de estado del servicio
app.get("/health", (_req, res) => {
  res.json({ status: "ok", servicio: "gestor-proyectos-vitralux-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/installer-groups", installerGroupsRouter);
app.use("/api/quotes", quotesRouter);
app.use("/api", etapa2Router);
app.use("/api", produccionRouter);
app.use("/api", actasRouter);
app.use("/api/warranties", warrantiesRouter);
app.use("/api/errors", errorsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api", tasksRouter);
app.use("/api/audit", auditRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/pendientes", pendientesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Recurso no encontrado." });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: "Ocurrió un error inesperado. Intenta de nuevo.",
  });
});
