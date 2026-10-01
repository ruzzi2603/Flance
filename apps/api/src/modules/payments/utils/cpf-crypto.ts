import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { InternalServerErrorException } from "@nestjs/common";

const VERSION = "v1";

function getEncryptionKey() {
  const secret = process.env.ASAAS_CPF_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new InternalServerErrorException("A criptografia de dados de cobrança não está configurada.");
  }
  return createHash("sha256").update("flance:asaas-cpf:v1:").update(secret).digest();
}

export function encryptCpf(cpf: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(cpf, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptCpf(value: string) {
  if (!value.startsWith(`${VERSION}:`)) {
    // Legacy rows may contain the old plaintext value; new writes always use AES-GCM.
    return value.replace(/\D/g, "");
  }
  const [, encodedIv, encodedTag, encodedCiphertext] = value.split(":");
  if (!encodedIv || !encodedTag || !encodedCiphertext) {
    throw new InternalServerErrorException("Dados de cobrança armazenados em formato inválido.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new InternalServerErrorException("Não foi possível descriptografar os dados de cobrança.");
  }
}