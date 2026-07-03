import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword, generateTempPassword } from "../src/lib/auth";
import { AppModule } from "../src/generated/prisma/enums";

// Permisos base por equipo (Gerencia tiene acceso total implícito en código)
const TEAM_PERMISSIONS: Record<string, Partial<Record<AppModule, "ver" | "editar">>> = {
  Presupuesto: {
    PROYECTOS: "editar",
    COTIZACIONES: "editar",
    CRM: "editar",
    CONTRATOS: "editar",
    POLIZAS: "ver",
    ANTICIPOS: "ver",
    NOTIFICACIONES: "ver",
  },
  Contabilidad: {
    PROYECTOS: "ver",
    CONTRATOS: "ver",
    POLIZAS: "editar",
    ANTICIPOS: "editar",
    ACTAS: "editar",
    NOTIFICACIONES: "ver",
  },
  Producción: {
    PROYECTOS: "ver",
    PRODUCCION: "editar",
    ERRORES: "editar",
    NOTIFICACIONES: "ver",
  },
  Planeación: {
    PROYECTOS: "ver",
    PRODUCCION: "editar",
    COMPRAS: "ver",
    ERRORES: "editar",
    NOTIFICACIONES: "ver",
  },
  Tesorería: {
    PROYECTOS: "ver",
    ANTICIPOS: "editar",
    GARANTIAS: "editar",
    NOTIFICACIONES: "ver",
  },
  Gerencia: {}, // acceso total implícito
  Compras: {
    PROYECTOS: "ver",
    COMPRAS: "editar",
    NOTIFICACIONES: "ver",
  },
  Instaladores: {
    INSTALACION: "ver",
    NOTIFICACIONES: "ver",
  },
};

async function main() {
  console.log("Sembrando equipos...");
  for (const [name, perms] of Object.entries(TEAM_PERMISSIONS)) {
    const team = await prisma.team.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    for (const [module, action] of Object.entries(perms)) {
      await prisma.teamPermission.upsert({
        where: {
          teamId_module: { teamId: team.id, module: module as AppModule },
        },
        update: {},
        create: {
          teamId: team.id,
          module: module as AppModule,
          canView: true,
          canEdit: action === "editar",
        },
      });
    }
  }

  const adminEmail = "gerencia@vitralux.co";
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (!existing) {
    const gerencia = await prisma.team.findUnique({
      where: { name: "Gerencia" },
    });
    const tempPassword = generateTempPassword();
    await prisma.user.create({
      data: {
        name: "Administrador Gerencia",
        email: adminEmail,
        passwordHash: await hashPassword(tempPassword),
        teamId: gerencia!.id,
        mustChangePassword: true,
      },
    });
    console.log("================================================");
    console.log(`Usuario administrador creado: ${adminEmail}`);
    console.log(`Contraseña temporal (cámbiala al entrar): ${tempPassword}`);
    console.log("================================================");
  } else {
    console.log(`El usuario administrador ya existe (${adminEmail}).`);
  }
  console.log("Seed completado.");
}

main().finally(() => prisma.$disconnect());
