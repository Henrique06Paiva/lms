import { createAppServer } from "./core/server.js";
import { Router } from "./core/router.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerCoursesRoutes } from "./modules/courses/courses.routes.js";
import { registerMediaRoutes } from "./modules/media/media.routes.js";
import { registerProgressRoutes } from "./modules/progress/progress.routes.js";
import { registerCertificatesRoutes } from "./modules/certificates/certificates.routes.js";

import { runMigrations } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import { db } from "./db/connection.js";

// Inicialização automática do banco de dados e seed para produção
try {
  runMigrations();
  const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any)?.count || 0;
  if (userCount === 0) {
    console.log("🌱 [EduCore] Banco vazio detectado. Executando seed corporativo automático...");
    await seed();
  }
} catch (err) {
  console.error("⚠️ [EduCore] Aviso na inicialização do banco:", err);
}

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const router = new Router();

// Registra todos os módulos do EduCore
registerAuthRoutes(router);
registerCoursesRoutes(router);
registerMediaRoutes(router);
registerProgressRoutes(router);
registerCertificatesRoutes(router);

const server = createAppServer(router);

server.listen(PORT, HOST, () => {
  console.log(`🚀 [EduCore] Servidor rodando com sucesso em http://${HOST}:${PORT}`);
});
