import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
};

export function serveStaticFile(
  req: IncomingMessage,
  res: ServerResponse
): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }

  const rawUrl = (req.url ?? "/").split("?")[0] || "/";

  // Não intercepta rotas de API
  if (rawUrl.startsWith("/api")) {
    return false;
  }

  let relativePath = rawUrl === "/" ? "index.html" : rawUrl.replace(/^\/+/, "");
  let filePath = path.join(PUBLIC_DIR, relativePath);

  // Previne Directory Traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return false;
  }

  // SPA Fallback: se o arquivo não tiver extensão e não existir, entrega index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", stat.size);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  return true;
}
