import { NextFunction, Request, Response, Router } from "express";
import { logAudit } from "../lib/audit";
import { can } from "../lib/permissions";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppModule } from "../generated/prisma/enums";

// Clientes / constructoras: se seleccionan al crear proyectos
export const clientsRouter = Router();

clientsRouter.use(authenticate);

// Listar: basta con trabajar con proyectos O gestionar clientes
function puedeVerClientes(req: Request, res: Response, next: NextFunction) {
  const perms = req.user!.permissions;
  if (
    can(perms, AppModule.CLIENTES, "ver") ||
    can(perms, AppModule.PROYECTOS, "ver")
  ) {
    next();
    return;
  }
  res.status(403).json({ error: "No tienes permiso para ver los clientes." });
}

clientsRouter.get("/", puedeVerClientes, async (req, res) => {
  const { buscar, activos } = req.query;
  const clients = await prisma.client.findMany({
    where: {
      isActive: activos === "todos" ? undefined : true,
      ...(buscar
        ? {
            OR: [
              { name: { contains: String(buscar), mode: "insensitive" } },
              { contactName: { contains: String(buscar), mode: "insensitive" } },
              { email: { contains: String(buscar), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  });
  res.json({ clients });
});

clientsRouter.post(
  "/",
  authorize(AppModule.CLIENTES, "editar"),
  async (req, res) => {
    const { name, contactName, email, phone, taxId, address, city, notes } =
      req.body ?? {};
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: "El nombre del cliente es obligatorio." });
      return;
    }
    const trimmed = String(name).trim();
    const existing = await prisma.client.findUnique({
      where: { name: trimmed },
    });
    if (existing) {
      res.status(409).json({ error: "Ya existe un cliente con ese nombre." });
      return;
    }
    const client = await prisma.client.create({
      data: {
        name: trimmed,
        contactName: contactName ? String(contactName).trim() : null,
        email: email ? String(email).toLowerCase().trim() : null,
        phone: phone ? String(phone).trim() : null,
        taxId: taxId ? String(taxId).trim() : null,
        address: address ? String(address).trim() : null,
        city: city ? String(city).trim() : null,
        notes: notes ? String(notes) : null,
      },
      include: { _count: { select: { projects: true } } },
    });
    await logAudit(req.user!.id, "crear_cliente", "Client", client.id, {
      name: trimmed,
    });
    res.status(201).json({ client });
  },
);

clientsRouter.put(
  "/:id",
  authorize(AppModule.CLIENTES, "editar"),
  async (req, res) => {
    const existing = await prisma.client.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!existing) {
      res.status(404).json({ error: "Cliente no encontrado." });
      return;
    }
    const { name, contactName, email, phone, taxId, address, city, notes, isActive } =
      req.body ?? {};
    if (name) {
      const dup = await prisma.client.findFirst({
        where: { name: String(name).trim(), NOT: { id: existing.id } },
      });
      if (dup) {
        res.status(409).json({ error: "Ya existe un cliente con ese nombre." });
        return;
      }
    }
    const client = await prisma.client.update({
      where: { id: existing.id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        contactName:
          contactName !== undefined
            ? contactName
              ? String(contactName).trim()
              : null
            : undefined,
        email:
          email !== undefined
            ? email
              ? String(email).toLowerCase().trim()
              : null
            : undefined,
        phone:
          phone !== undefined ? (phone ? String(phone).trim() : null) : undefined,
        taxId:
          taxId !== undefined ? (taxId ? String(taxId).trim() : null) : undefined,
        address:
          address !== undefined
            ? address
              ? String(address).trim()
              : null
            : undefined,
        city:
          city !== undefined ? (city ? String(city).trim() : null) : undefined,
        notes: notes !== undefined ? (notes ? String(notes) : null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: { _count: { select: { projects: true } } },
    });
    // Mantener sincronizado el nombre denormalizado en los proyectos
    if (name !== undefined) {
      await prisma.project.updateMany({
        where: { clientId: client.id },
        data: { clientName: client.name },
      });
    }
    await logAudit(req.user!.id, "editar_cliente", "Client", client.id);
    res.json({ client });
  },
);
