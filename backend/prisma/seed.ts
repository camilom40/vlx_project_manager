import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword, generateTempPassword } from "../src/lib/auth";
import { AppModule } from "../src/generated/prisma/enums";

// Permisos base por equipo (Gerencia tiene acceso total implícito en código)
const TEAM_PERMISSIONS: Record<string, Partial<Record<AppModule, "ver" | "editar">>> = {
  Presupuesto: {
    PROYECTOS: "editar",
    CLIENTES: "editar",
    COTIZACIONES: "editar",
    CRM: "editar",
    CONTRATOS: "editar",
    POLIZAS: "ver",
    ANTICIPOS: "ver",
    NOTIFICACIONES: "ver",
  },
  Contabilidad: {
    // Contabilidad crea el centro de costo y genera el proyecto de la
    // cotización aceptada (necesita ver cotizaciones y editar proyectos)
    PROYECTOS: "editar",
    CLIENTES: "ver",
    COTIZACIONES: "ver",
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
  Supervisor: {
    PROYECTOS: "ver",
    PRODUCCION: "editar",
    INSTALACION: "editar",
    ACTAS: "editar",
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

  // Solo se crea un admin semilla si NINGÚN usuario de Gerencia existe todavía
  // (busca por equipo, no por correo fijo: el admin real puede haber cambiado
  // su correo desde la app).
  const gerencia = await prisma.team.findUnique({ where: { name: "Gerencia" } });
  const yaHayGerencia = await prisma.user.findFirst({
    where: { teamId: gerencia!.id },
  });
  if (!yaHayGerencia) {
    const adminEmail = "gerencia@vitralux.co";
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
    console.log(`Ya existe un usuario de Gerencia (${yaHayGerencia.email}); no se crea admin semilla.`);
  }
  console.log("Seed completado.");
}

main().finally(() => prisma.$disconnect());
