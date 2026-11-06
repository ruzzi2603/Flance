import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

export type UserMediaKind = "avatar" | "company-photo";

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class SupabaseMediaStorageService {
  private readonly logger = new Logger(SupabaseMediaStorageService.name);
  private bucketReady: Promise<void> | null = null;

  async uploadUserImage(userId: string, kind: UserMediaKind, file: UploadedImage): Promise<string> {
    const config = this.getConfig();
    const image = this.identifyImage(file.buffer);
    if (!image || image.contentType !== file.mimetype) {
      throw new UnsupportedMediaTypeException("Envie uma imagem PNG, JPEG ou WebP válida.");
    }
    if (!file.buffer.length || file.buffer.length > 2 * 1024 * 1024) {
      throw new UnsupportedMediaTypeException("A imagem deve ter no máximo 2 MB.");
    }

    await this.ensureBucket(config);
    const path = `${userId}/${kind}/${randomUUID()}.${image.extension}`;
    const imageBytes = new Uint8Array(file.buffer.length);
    imageBytes.set(file.buffer);
    const response = await fetch(
      `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${this.encodePath(path)}`,
      {
        method: "POST",
        headers: {
          apikey: config.secretKey,
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": image.contentType,
          "cache-control": "max-age=31536000",
          "x-upsert": "false",
        },
        body: new Blob([imageBytes.buffer], { type: image.contentType }),
        signal: AbortSignal.timeout(20_000),
      },
    ).catch((error: unknown) => {
      this.logger.error(`Falha de conexão ao enviar mídia ao Supabase (${this.errorName(error)}).`);
      throw new ServiceUnavailableException("Não foi possível armazenar a imagem agora. Tente novamente.");
    });

    if (!response.ok) {
      this.logger.error(`Supabase Storage recusou upload (HTTP ${response.status}).`);
      throw new ServiceUnavailableException("O armazenamento de imagens não aceitou o arquivo.");
    }

    return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${this.encodePath(path)}`;
  }

  private getConfig() {
    const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const bucket = (process.env.SUPABASE_STORAGE_BUCKET || "flance-media").trim();
    if (!url || !secretKey) {
      throw new ServiceUnavailableException("O armazenamento de imagens ainda não está configurado.");
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) throw new Error("invalid URL");
    } catch {
      throw new InternalServerErrorException("SUPABASE_URL deve ser a URL HTTPS do projeto Supabase.");
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(bucket)) {
      throw new InternalServerErrorException("SUPABASE_STORAGE_BUCKET inválido.");
    }
    return { url, secretKey, bucket };
  }

  private async ensureBucket(config: { url: string; secretKey: string; bucket: string }) {
    if (!this.bucketReady) {
      this.bucketReady = this.checkBucket(config).catch((error) => {
        this.bucketReady = null;
        throw error;
      });
    }
    return this.bucketReady;
  }

  private async checkBucket(config: { url: string; secretKey: string; bucket: string }) {
    let response = await this.requestBucket(config);
    if (response.status === 404) {
      response = await fetch(`${config.url}/storage/v1/bucket`, {
        method: "POST",
        headers: {
          apikey: config.secretKey,
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: config.bucket,
          name: config.bucket,
          public: true,
          file_size_limit: 2 * 1024 * 1024,
          allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch((error: unknown) => {
        this.logger.error(`Falha ao criar bucket de mídia (${this.errorName(error)}).`);
        throw new ServiceUnavailableException("Não foi possível preparar o armazenamento de imagens.");
      });
      if (response.status === 409) response = await this.requestBucket(config);
    }
    if (!response.ok) {
      this.logger.error(`Supabase Storage recusou consulta de bucket (HTTP ${response.status}).`);
      throw new ServiceUnavailableException("Não foi possível validar o bucket de imagens.");
    }
    const bucket = (await response.json()) as { public?: boolean; file_size_limit?: number | null };
    if (!bucket.public) {
      throw new ServiceUnavailableException(`O bucket "${config.bucket}" precisa ser público para exibir imagens de perfil.`);
    }
    if (bucket.file_size_limit != null && bucket.file_size_limit < 2 * 1024 * 1024) {
      throw new ServiceUnavailableException(`Aumente o limite do bucket "${config.bucket}" para 2 MB.`);
    }
  }

  private async requestBucket(config: { url: string; secretKey: string; bucket: string }) {
    return fetch(`${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`, {
      headers: { apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}` },
      signal: AbortSignal.timeout(10_000),
    }).catch((error: unknown) => {
      this.logger.error(`Falha ao conferir bucket de mídia (${this.errorName(error)}).`);
      throw new ServiceUnavailableException("Não foi possível conectar ao armazenamento de imagens.");
    });
  }

  private identifyImage(buffer: Buffer): { contentType: string; extension: string } | null {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      return { contentType: "image/png", extension: "png" };
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { contentType: "image/jpeg", extension: "jpg" };
    }
    if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      return { contentType: "image/webp", extension: "webp" };
    }
    return null;
  }

  private encodePath(path: string) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  private errorName(error: unknown) {
    return error instanceof Error ? error.name : "network";
  }
}
