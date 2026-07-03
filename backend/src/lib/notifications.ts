import nodemailer from "nodemailer";
import twilio from "twilio";
import { prisma } from "./prisma";
import { NotificationChannel } from "../generated/prisma/enums";

// Notificaciones "el balón pasa a tu cancha": correo + WhatsApp, inmediatas.
// Si un canal no está configurado (sin SMTP/Twilio), la notificación queda
// registrada en la app con el error, para reintentarse cuando haya credenciales.

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
const twilioConfigured = Boolean(
  process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM,
);

const mailer = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : null;

const twilioClient = twilioConfigured
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

async function sendEmail(to: string, title: string, body: string) {
  if (!mailer) throw new Error("Canal de correo no configurado");
  await mailer.sendMail({
    from: process.env.EMAIL_FROM || "Gestor Vitralux <no-responder@vitralux.co>",
    to,
    subject: title,
    text: body,
  });
}

async function sendWhatsApp(phone: string, title: string, body: string) {
  if (!twilioClient) throw new Error("Canal de WhatsApp no configurado");
  const normalized = phone.replace(/[\s-]/g, "");
  await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${normalized}`,
    body: `*${title}*\n${body}`,
  });
}

/**
 * Notifica a los usuarios indicados por correo + WhatsApp (si tienen teléfono).
 * Nunca lanza: los fallos quedan registrados en la fila de Notification.
 */
export async function notify(
  recipientIds: string[],
  event: string,
  title: string,
  body: string,
  projectId?: string | null,
): Promise<void> {
  const unique = [...new Set(recipientIds.filter(Boolean))];
  if (unique.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: unique }, isActive: true },
  });
  for (const user of users) {
    // Correo
    try {
      const row = await prisma.notification.create({
        data: {
          recipientId: user.id,
          channel: NotificationChannel.CORREO,
          event,
          title,
          body,
          projectId: projectId ?? null,
        },
      });
      try {
        await sendEmail(user.email, title, body);
        await prisma.notification.update({
          where: { id: row.id },
          data: { sentAt: new Date() },
        });
      } catch (err) {
        await prisma.notification.update({
          where: { id: row.id },
          data: { error: err instanceof Error ? err.message : "Error de envío" },
        });
      }
    } catch (err) {
      console.error("Error creando notificación de correo:", err);
    }
    // WhatsApp (solo si el usuario tiene teléfono)
    if (user.phone) {
      try {
        const row = await prisma.notification.create({
          data: {
            recipientId: user.id,
            channel: NotificationChannel.WHATSAPP,
            event,
            title,
            body,
            projectId: projectId ?? null,
          },
        });
        try {
          await sendWhatsApp(user.phone, title, body);
          await prisma.notification.update({
            where: { id: row.id },
            data: { sentAt: new Date() },
          });
        } catch (err) {
          await prisma.notification.update({
            where: { id: row.id },
            data: {
              error: err instanceof Error ? err.message : "Error de envío",
            },
          });
        }
      } catch (err) {
        console.error("Error creando notificación de WhatsApp:", err);
      }
    }
  }
}

/** Ids de los usuarios asignados a un proyecto en ciertos roles. */
export async function projectRoleUserIds(
  projectId: string,
  roles: ("SUPERVISOR" | "COTIZADOR" | "PLANEADOR" | "JEFE_TALLER")[],
): Promise<string[]> {
  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId, role: { in: roles } },
    select: { userId: true },
  });
  return assignments.map((a) => a.userId);
}

/** Ids de los miembros activos de un equipo (por nombre). */
export async function teamMemberIds(teamName: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { team: { name: teamName }, isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Ids de los integrantes activos de los grupos de instaladores de un proyecto. */
export async function projectInstallerIds(
  projectId: string,
): Promise<string[]> {
  const links = await prisma.projectInstallerGroup.findMany({
    where: { projectId, isActive: true },
    include: {
      group: {
        include: {
          members: { where: { isActive: true }, select: { userId: true } },
        },
      },
    },
  });
  return links.flatMap((l) => l.group.members.map((m) => m.userId));
}
