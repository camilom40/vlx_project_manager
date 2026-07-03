import { prisma } from "./prisma";

export async function logAudit(
  userId: string | null,
  action: string,
  entity: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });
  } catch (err) {
    // La auditoría nunca debe tumbar la operación principal
    console.error("Error registrando auditoría:", err);
  }
}
