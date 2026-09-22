import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { AppError } from "./errors.js";
import { enhanceRequest } from "./request.js";
import { enhanceResponse } from "./response.js";
import { Router } from "./router.js";

export function createAppServer(router: Router): http.Server {
  const server = http.createServer(
    async (rawReq: IncomingMessage, rawRes: ServerResponse) => {
      const res = enhanceResponse(rawRes);

      try {
        const req = await enhanceRequest(rawReq);

        // Suporte a pre-flight CORS caso necessário
        if (req.method === "OPTIONS") {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");
          res.status(204).end();
          return;
        }

        const handled = await router.handle(req, res);

        if (!handled) {
          res.status(404).json({
            error: "Rota não encontrada",
            path: req.url,
            method: req.method,
          });
        }
      } catch (error: any) {
        if (error instanceof AppError) {
          res.status(error.statusCode).json({
            error: error.message,
            ...(error.details ? { details: error.details } : {}),
          });
          return;
        }

        console.error("💥 [Core HTTP] Erro não tratado:", error);
        res.status(500).json({
          error: "Erro interno do servidor",
        });
      }
    }
  );

  return server;
}
