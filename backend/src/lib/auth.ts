import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 10;

export interface TokenPayload {
  userId: string;
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Falta la variable de entorno JWT_SECRET");
  }
  return secret;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: TokenPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN ||
    "8h") as jwt.SignOptions["expiresIn"];
  return jwt.sign(payload, jwtSecret(), { expiresIn });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, jwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

// Contraseña temporal legible para comunicar por teléfono/WhatsApp
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I/L
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `Vlx-${suffix}`;
}
