import crypto from "node:crypto";

export function generateSalt(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashPassword(password: string, salt: string): string {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): boolean {
  const computedHash = hashPassword(password, salt);
  const bufExpected = Buffer.from(expectedHash, "hex");
  const bufComputed = Buffer.from(computedHash, "hex");

  if (bufExpected.length !== bufComputed.length) {
    return false;
  }

  // Previne timing attacks usando comparação em tempo constante
  return crypto.timingSafeEqual(bufExpected, bufComputed);
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
