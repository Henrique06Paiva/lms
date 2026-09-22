import type { IncomingMessage } from "node:http";
import { AppError } from "./errors.js";
import type { HttpRequest } from "./types.js";

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) continue;
    const key = rawKey.trim();
    const value = rest.join("=").trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  return cookies;
}

export async function parseBody(
  rawReq: IncomingMessage,
  maxBytes = 2 * 1024 * 1024
): Promise<any> {
  const contentType = rawReq.headers["content-type"] ?? "";

  // Uploads binários ou streams (vídeos, arquivos grandes) não são consumidos aqui
  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("video/") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("application/pdf")
  ) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let receivedBytes = 0;

    rawReq.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        rawReq.destroy();
        reject(new AppError(413, "Payload too large (limite excedido)"));
        return;
      }
      chunks.push(chunk);
    });

    rawReq.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      const rawString = Buffer.concat(chunks).toString("utf-8");

      if (contentType.includes("application/json")) {
        try {
          resolve(JSON.parse(rawString));
        } catch {
          reject(new AppError(400, "JSON com formato inválido"));
        }
      } else {
        resolve(rawString);
      }
    });

    rawReq.on("error", (err) => {
      reject(new AppError(400, `Erro ao processar corpo da requisição: ${err.message}`));
    });
  });
}

export async function enhanceRequest(rawReq: IncomingMessage): Promise<HttpRequest> {
  const req = rawReq as HttpRequest;

  const host = rawReq.headers.host ?? "localhost";
  const protocol = (rawReq.socket as any)?.encrypted ? "https" : "http";
  const fullUrl = new URL(rawReq.url ?? "/", `${protocol}://${host}`);

  req.params = {};
  req.query = {};
  for (const [key, val] of fullUrl.searchParams.entries()) {
    req.query[key] = val;
  }

  req.cookies = parseCookies(rawReq.headers.cookie);

  const method = (rawReq.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH"].includes(method)) {
    req.body = await parseBody(rawReq);
  } else {
    req.body = {};
  }

  return req;
}
