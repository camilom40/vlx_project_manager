import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { teamsRouter } from "./routes/teams";
import { projectsRouter } from "./routes/projects";
import { installerGroupsRouter } from "./routes/installerGroups";

const app = express();
const PORT = process.env.PORT || 4000;

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

app.use((_req, res) => {
  res.status(404).json({ error: "Recurso no encontrado." });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: "Ocurrió un error inesperado. Intenta de nuevo.",
  });
});

app.listen(PORT, () => {
  console.log(`API escuchando en el puerto ${PORT}`);
});
