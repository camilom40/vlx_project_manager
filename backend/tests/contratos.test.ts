import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

// Pruebas de integración del flujo de contrato → pólizas/anticipos → compras.
// Crean sus propios usuarios/proyectos (prefijo [TEST]) y los limpian al final.

const SUFIJO = `ctr-${Date.now()}`;
const PASSWORD = "Prueba123!";

const correo = (rol: string) => `${rol}-${SUFIJO}@test.vitralux.co`;

const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};
let projectId = "";
let projectId2 = "";
let contractId = "";
let contractId2 = "";

async function crearUsuario(rol: string, equipo: string) {
  const team = await prisma.team.findUnique({ where: { name: equipo } });
  if (!team) throw new Error(`Falta el equipo ${equipo} (corre el seed)`);
  const user = await prisma.user.create({
    data: {
      name: `[TEST] ${rol}`,
      email: correo(rol),
      teamId: team.id,
      passwordHash: await hashPassword(PASSWORD),
      mustChangePassword: false,
    },
  });
  ids[rol] = user.id;
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: correo(rol), password: PASSWORD });
  tokens[rol] = res.body.token;
  return user;
}

function api(rol: string) {
  const token = tokens[rol];
  return {
    get: (url: string) =>
      request(app).get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string, body?: object) =>
      request(app)
        .post(url)
        .set("Authorization", `Bearer ${token}`)
        .send(body ?? {}),
    put: (url: string, body?: object) =>
      request(app)
        .put(url)
        .set("Authorization", `Bearer ${token}`)
        .send(body ?? {}),
  };
}

const pendientesContrato = async (rol: string) =>
  (await api(rol).get("/api/pendientes")).body.pendientes.CONTRATOS ?? 0;

async function crearProyecto(nombre: string) {
  const p = await prisma.project.create({
    data: {
      name: `[TEST] ${nombre} ${SUFIJO}`,
      clientName: `[TEST] Constructora ${SUFIJO}`,
      market: "CO",
      company: "VITRALUX",
      currency: "COP",
    },
  });
  return p.id;
}

beforeAll(async () => {
  await crearUsuario("receptor", "Presupuesto");
  await crearUsuario("revisor", "Instaladores"); // "cualquier usuario"
  await crearUsuario("gerente", "Gerencia");
  await crearUsuario("tesoreria", "Tesorería");
  await crearUsuario("conta", "Contabilidad");
  await crearUsuario("compras", "Compras");
  projectId = await crearProyecto("Torre A");
  projectId2 = await crearProyecto("Torre B");
});

afterAll(async () => {
  const userIds = Object.values(ids);
  await prisma.notification.deleteMany({
    where: { OR: [{ recipientId: { in: userIds } }, { body: { contains: SUFIJO } }] },
  });
  await prisma.auditLog.updateMany({
    where: { userId: { in: userIds } },
    data: { userId: null },
  });
  await prisma.policy.deleteMany({ where: { projectId: { in: [projectId, projectId2] } } });
  await prisma.advance.deleteMany({ where: { projectId: { in: [projectId, projectId2] } } });
  await prisma.contract.deleteMany({ where: { projectId: { in: [projectId, projectId2] } } });
  await prisma.project.deleteMany({ where: { name: { contains: SUFIJO } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("flujo de contrato", () => {
  it("registra el contrato (Presupuesto) en estado RECIBIDO", async () => {
    const res = await api("receptor").post(
      `/api/projects/${projectId}/contrato`,
    );
    expect(res.status).toBe(201);
    expect(res.body.contract.status).toBe("RECIBIDO");
    contractId = res.body.contract.id;
  });

  it("asigna revisor: un usuario sin el módulo no puede; el receptor sí", async () => {
    const negado = await api("revisor").post(
      `/api/projects/${projectId}/contrato/${contractId}/asignar-revisor`,
      { reviewerId: ids.revisor },
    );
    expect(negado.status).toBe(403);
    // Con el contrato RECIBIDO, el receptor (Presupuesto) lo tiene pendiente
    const antesReceptor = await pendientesContrato("receptor");
    expect(antesReceptor).toBeGreaterThan(0);
    const ok = await api("receptor").post(
      `/api/projects/${projectId}/contrato/${contractId}/asignar-revisor`,
      { reviewerId: ids.revisor },
    );
    expect(ok.status).toBe(200);
    expect(ok.body.contract.status).toBe("EN_REVISION");
    expect(ok.body.contract.reviewer.id).toBe(ids.revisor);
    // Al asignar, el balón se va del receptor (ya no es su pendiente)
    expect(await pendientesContrato("receptor")).toBe(antesReceptor - 1);
    // Y al revisor (cualquier usuario) le llega la notificación de asignación
    const noti = await prisma.notification.count({
      where: { recipientId: ids.revisor, event: "contrato.revisor_asignado" },
    });
    expect(noti).toBeGreaterThan(0);
  });

  it("el revisor guarda la revisión: crea el anticipo y una póliza sin valor", async () => {
    const res = await api("revisor").put(`/api/contratos/${contractId}/revision`, {
      advanceValue: 30000000,
      requiresAdvance: true,
      requiresPolicy: true,
      deliveryTermDays: 45,
      polizas: [{ type: "Cumplimiento" }],
    });
    expect(res.status).toBe(200);
    const advances = await prisma.advance.findMany({ where: { projectId } });
    expect(advances).toHaveLength(1);
    expect(advances[0].value.toString()).toBe("30000000");
    const policies = await prisma.policy.findMany({ where: { projectId } });
    expect(policies).toHaveLength(1);
    expect(policies[0].value).toBeNull();
  });

  it("enviar a firma: solo el revisor; luego Gerencia lo ve pendiente", async () => {
    const negado = await api("conta").put(`/api/contratos/${contractId}`, {
      status: "PENDIENTE_FIRMA",
    });
    expect(negado.status).toBe(403);
    const baseGerente = await pendientesContrato("gerente");
    const ok = await api("revisor").put(`/api/contratos/${contractId}`, {
      status: "PENDIENTE_FIRMA",
    });
    expect(ok.status).toBe(200);
    expect(ok.body.contract.status).toBe("PENDIENTE_FIRMA");
    expect(await pendientesContrato("gerente")).toBe(baseGerente + 1);
  });

  it("firmar: solo Gerencia; notifica a Tesorería y Contabilidad", async () => {
    const negado = await api("receptor").put(`/api/contratos/${contractId}`, {
      status: "FIRMADO",
    });
    expect(negado.status).toBe(403);
    const ok = await api("gerente").put(`/api/contratos/${contractId}`, {
      status: "FIRMADO",
    });
    expect(ok.status).toBe(200);
    expect(ok.body.contract.status).toBe("FIRMADO");
    const notiTeso = await prisma.notification.count({
      where: { recipientId: ids.tesoreria, event: "contrato.firmado" },
    });
    expect(notiTeso).toBeGreaterThan(0);
  });

  it("compras NO se habilita hasta pólizas resueltas y anticipo verificado (una sola vez)", async () => {
    // Aún no: falta resolver
    let proj = await prisma.project.findUnique({ where: { id: projectId } });
    expect(proj?.purchasingUnlockedNotifiedAt).toBeNull();

    const policy = await prisma.policy.findFirst({ where: { projectId } });
    await api("tesoreria").put(`/api/polizas/${policy!.id}`, {
      status: "ENVIADA_AL_CLIENTE",
    });
    // Póliza resuelta pero anticipo aún no → sigue bloqueado
    proj = await prisma.project.findUnique({ where: { id: projectId } });
    expect(proj?.purchasingUnlockedNotifiedAt).toBeNull();

    const advance = await prisma.advance.findFirst({ where: { projectId } });
    await api("conta").put(`/api/anticipos/${advance!.id}`, {
      status: "VERIFICADO",
    });
    proj = await prisma.project.findUnique({ where: { id: projectId } });
    expect(proj?.purchasingUnlockedNotifiedAt).not.toBeNull();

    const notiCompras = await prisma.notification.count({
      where: { recipientId: ids.compras, event: "compras.habilitadas" },
    });
    expect(notiCompras).toBeGreaterThan(0);

    // Un segundo cambio de estado de póliza no re-notifica a Compras
    await api("tesoreria").put(`/api/polizas/${policy!.id}`, {
      status: "PAGADA",
    });
    const notiCompras2 = await prisma.notification.count({
      where: { recipientId: ids.compras, event: "compras.habilitadas" },
    });
    expect(notiCompras2).toBe(notiCompras);
  });

  it("contrato sin póliza y sin anticipo: al firmar habilita Compras de inmediato", async () => {
    const rec = await api("receptor").post(
      `/api/projects/${projectId2}/contrato`,
    );
    contractId2 = rec.body.contract.id;
    await api("receptor").post(
      `/api/projects/${projectId2}/contrato/${contractId2}/asignar-revisor`,
      { reviewerId: ids.revisor },
    );
    await api("revisor").put(`/api/contratos/${contractId2}/revision`, {
      requiresAdvance: false,
      requiresPolicy: false,
    });
    await api("revisor").put(`/api/contratos/${contractId2}`, {
      status: "PENDIENTE_FIRMA",
    });
    await api("gerente").put(`/api/contratos/${contractId2}`, {
      status: "FIRMADO",
    });
    const proj = await prisma.project.findUnique({ where: { id: projectId2 } });
    expect(proj?.purchasingUnlockedNotifiedAt).not.toBeNull();
  });
});
