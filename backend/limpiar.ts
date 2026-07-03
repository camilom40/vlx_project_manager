import "dotenv/config";
import { prisma } from "./src/lib/prisma";

const ADMIN_EMAIL = "gerencia@vitralux.co";

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(`ABORTAR: no se encontró el usuario admin (${ADMIN_EMAIL}). No se toca la base.`);
  }
  console.log("Admin confirmado, se conserva:", admin.email, "| activo:", admin.isActive);

  await prisma.$transaction([
    // AuditLog no tiene FK real hacia Project (entityId es texto genérico) -> aparte
    prisma.$executeRawUnsafe(`TRUNCATE TABLE "AuditLog" RESTART IDENTITY;`),
    // Cascada completa: Quote, Contract, Policy, Advance, Purchase, ActaVanos, DT,
    // Remision, ReworkError, ActaCorte, ActaEntrega, ActaCierre, Warranty,
    // ProjectAssignment, ProjectInstallerGroup, ProjectStageHistory, Notification,
    // Task, TaskDependency, QuoteContactLog, QuoteRejection.
    prisma.$executeRawUnsafe(`TRUNCATE TABLE "Project" RESTART IDENTITY CASCADE;`),
    prisma.$executeRawUnsafe(`TRUNCATE TABLE "Client" RESTART IDENTITY;`),
    prisma.$executeRawUnsafe(`TRUNCATE TABLE "InstallerGroup" RESTART IDENTITY CASCADE;`),
    prisma.$executeRawUnsafe(`TRUNCATE TABLE "ProjectTemplate" RESTART IDENTITY;`),
  ]);

  // Usuarios de prueba (todos menos el admin). UserPermission/InstallerGroupMember
  // de esos usuarios se van en cascada (onDelete: Cascade en el schema).
  const borrados = await prisma.user.deleteMany({
    where: { email: { not: ADMIN_EMAIL } },
  });
  console.log("Usuarios de prueba eliminados:", borrados.count);

  const restante = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  console.log("Verificación final — admin sigue existiendo:", !!restante, restante?.isActive);
}
main().finally(() => prisma.$disconnect());
