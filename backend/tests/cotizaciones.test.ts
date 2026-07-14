import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

// Pruebas de integración del ciclo completo de cotizaciones contra la base
// de desarrollo. Crean sus propios usuarios y datos (prefijo [TEST]) y los
// eliminan al final; no tocan datos reales.

const SUFIJO = `test-${Date.now()}`;
const PASSWORD = "Prueba123!";
const TITULO = `[TEST] Cotización ${SUFIJO}`;
const CLIENTE = `[TEST] Constructora ${SUFIJO}`;

let tokenLider = "";
let tokenCotizador = "";
let tokenConta = "";
let idCotizador = "";
let qid = "";

const correo = (rol: string) => `${rol}-${SUFIJO}@test.vitralux.co`;

async function crearUsuario(rol: string, equipo: string, lider = false) {
  const team = await prisma.team.findUnique({ where: { name: equipo } });
  if (!team) throw new Error(`Falta el equipo ${equipo} (corre el seed)`);
  const user = await prisma.user.create({
    data: {
      name: `[TEST] ${rol}`,
      email: correo(rol),
      teamId: team.id,
      isTeamLead: lider,
      passwordHash: await hashPassword(PASSWORD),
      mustChangePassword: false,
    },
  });
  return user;
}

async function login(rol: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: correo(rol), password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

function api(token: string) {
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

const pendientes = async (token: string) =>
  (await api(token).get("/api/pendientes")).body.pendientes.COTIZACIONES;

beforeAll(async () => {
  const cotizador = await crearUsuario("cotizador", "Presupuesto");
  idCotizador = cotizador.id;
  await crearUsuario("lider", "Presupuesto", true);
  await crearUsuario("conta", "Contabilidad");
  tokenLider = await login("lider");
  tokenCotizador = await login("cotizador");
  tokenConta = await login("conta");
});

afterAll(async () => {
  // Limpieza total de lo creado por la prueba
  await prisma.notification.deleteMany({
    where: { body: { contains: SUFIJO } },
  });
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `${SUFIJO}@test.vitralux.co` } },
  });
  const ids = users.map((u) => u.id);
  await prisma.notification.deleteMany({ where: { recipientId: { in: ids } } });
  await prisma.auditLog.updateMany({
    where: { userId: { in: ids } },
    data: { userId: null },
  });
  await prisma.project.deleteMany({ where: { name: { contains: SUFIJO } } });
  await prisma.quote.deleteMany({ where: { title: { contains: SUFIJO } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("ciclo de vida de la cotización", () => {
  it("registra el ingreso (INGRESADA) y cuenta como pendiente del líder", async () => {
    const baseLider = await pendientes(tokenLider);
    const res = await api(tokenCotizador).post("/api/quotes", {
      title: TITULO,
      clientName: CLIENTE,
      market: "CO",
      company: "VITRALUX",
      currency: "COP",
    });
    expect(res.status).toBe(201);
    expect(res.body.quote.status).toBe("INGRESADA");
    qid = res.body.quote.id;
    expect(await pendientes(tokenLider)).toBe(baseLider + 1);
  });

  it("no permite aprobar una cotización que no está en revisión", async () => {
    const res = await api(tokenLider).post(`/api/quotes/${qid}/aprobar`, {
      tipo: "presupuesto",
    });
    expect(res.status).toBe(400);
  });

  it("un no-líder no puede asignar (403); el líder sí (INGRESADA→BORRADOR)", async () => {
    const negado = await api(tokenCotizador).post(
      `/api/quotes/${qid}/asignar`,
      { quoterId: idCotizador },
    );
    expect(negado.status).toBe(403);
    const ok = await api(tokenLider).post(`/api/quotes/${qid}/asignar`, {
      quoterId: idCotizador,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.quote.status).toBe("BORRADOR");
    expect(ok.body.quote.assignedAt).not.toBeNull();
  });

  it("no pasa a revisión sin monto y margen", async () => {
    const res = await api(tokenCotizador).put(`/api/quotes/${qid}`, {
      completed: true,
    });
    expect(res.status).toBe(400);
  });

  it("con monto y margen pasa a revisión y el pendiente es del líder", async () => {
    const baseLider = await pendientes(tokenLider);
    const baseCot = await pendientes(tokenCotizador);
    await api(tokenCotizador).put(`/api/quotes/${qid}`, {
      amount: 50000000,
      marginPercent: 30,
    });
    const res = await api(tokenCotizador).put(`/api/quotes/${qid}`, {
      completed: true,
    });
    expect(res.body.quote.status).toBe("EN_REVISION");
    expect(await pendientes(tokenLider)).toBe(baseLider + 1);
    expect(await pendientes(tokenCotizador)).toBe(baseCot - 1);
  });

  it("aprobación de presupuesto → APROBADA; enviar → ENVIADA", async () => {
    const aprobada = await api(tokenLider).post(`/api/quotes/${qid}/aprobar`, {
      tipo: "presupuesto",
    });
    expect(aprobada.body.quote.status).toBe("APROBADA");
    const enviada = await api(tokenCotizador).post(`/api/quotes/${qid}/enviar`);
    expect(enviada.body.quote.status).toBe("ENVIADA");
    expect(enviada.body.quote.sentAt).not.toBeNull();
  });

  it("cambios solicitados → reelaborar limpia las aprobaciones y el flujo continúa", async () => {
    await api(tokenLider).post(`/api/quotes/${qid}/responder`, {
      estado: "CAMBIOS_SOLICITADOS",
    });
    const rev = await api(tokenCotizador).put(`/api/quotes/${qid}`, {
      completed: true,
    });
    expect(rev.body.quote.status).toBe("EN_REVISION");
    expect(rev.body.quote.budgetApprovedAt).toBeNull();
    const reAprobada = await api(tokenLider).post(
      `/api/quotes/${qid}/aprobar`,
      { tipo: "presupuesto" },
    );
    expect(reAprobada.body.quote.status).toBe("APROBADA");
    await api(tokenCotizador).post(`/api/quotes/${qid}/enviar`);
  });

  it("no registra respuesta del cliente sobre una cotización no enviada", async () => {
    // La actual está ENVIADA (válida); probamos con una nueva en INGRESADA
    const otra = await api(tokenCotizador).post("/api/quotes", {
      title: `${TITULO} B`,
      clientName: CLIENTE,
      market: "CO",
      company: "VITRALUX",
      currency: "COP",
    });
    const res = await api(tokenLider).post(
      `/api/quotes/${otra.body.quote.id}/responder`,
      { estado: "ACEPTADA" },
    );
    expect(res.status).toBe(400);
  });

  it("aceptada → el pendiente pasa a Contabilidad, no al cotizador", async () => {
    const baseConta = await pendientes(tokenConta);
    await api(tokenLider).post(`/api/quotes/${qid}/responder`, {
      estado: "ACEPTADA",
    });
    expect(await pendientes(tokenConta)).toBe(baseConta + 1);
    const lista = await api(tokenConta).get("/api/quotes");
    const mia = lista.body.quotes.find((q: { id: string }) => q.id === qid);
    expect(mia.requiereAccion).toBe(true);
  });

  it("generar proyecto exige centro de costo y nace en CONTRATO", async () => {
    const sinCC = await api(tokenConta).post(
      `/api/quotes/${qid}/generar-proyecto`,
    );
    expect(sinCC.status).toBe(400);
    const ok = await api(tokenConta).post(
      `/api/quotes/${qid}/generar-proyecto`,
      { costCenter: `CC-${SUFIJO}` },
    );
    expect(ok.status).toBe(201);
    expect(ok.body.project.currentStage).toBe("CONTRATO");
    expect(ok.body.project.contractAmount).toBe("50000000");
    const repetido = await api(tokenConta).post(
      `/api/quotes/${qid}/generar-proyecto`,
      { costCenter: "CC-X" },
    );
    expect(repetido.status).toBe(400);
  });

  it("los equipos del sistema no pueden renombrarse", async () => {
    const teams = await api(tokenLider).get("/api/teams");
    // El líder no gestiona equipos; usamos la base directa para obtener el id
    const presupuesto = await prisma.team.findUnique({
      where: { name: "Presupuesto" },
    });
    expect(teams.status).toBeLessThan(500);
    // Un admin de Gerencia de prueba para el endpoint protegido
    const gerencia = await prisma.team.findUnique({
      where: { name: "Gerencia" },
    });
    await prisma.user.create({
      data: {
        name: "[TEST] admin",
        email: correo("admin"),
        teamId: gerencia!.id,
        passwordHash: await hashPassword(PASSWORD),
        mustChangePassword: false,
      },
    });
    const tokenAdmin = await login("admin");
    const res = await api(tokenAdmin).put(`/api/teams/${presupuesto!.id}`, {
      name: "Presupuestos S.A.",
    });
    expect(res.status).toBe(400);
  });

  it("las fechas solo-día no se corren de día (mediodía UTC)", async () => {
    const res = await api(tokenCotizador).post("/api/quotes", {
      title: `${TITULO} C`,
      clientName: CLIENTE,
      market: "CO",
      company: "VITRALUX",
      currency: "COP",
      receivedAt: "2026-07-14",
      dueDate: "2026-07-20",
    });
    expect(res.body.quote.receivedAt).toBe("2026-07-14T12:00:00.000Z");
    expect(res.body.quote.dueDate).toBe("2026-07-20T12:00:00.000Z");
  });
});
