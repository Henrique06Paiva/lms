import { createAppServer } from "./core/server.js";
import { Router } from "./core/router.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerCoursesRoutes } from "./modules/courses/courses.routes.js";
import { registerMediaRoutes } from "./modules/media/media.routes.js";
import { registerProgressRoutes } from "./modules/progress/progress.routes.js";
import { registerCertificatesRoutes } from "./modules/certificates/certificates.routes.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const router = new Router();

// Registra todos os módulos do EduCore
registerAuthRoutes(router);
registerCoursesRoutes(router);
registerMediaRoutes(router);
registerProgressRoutes(router);
registerCertificatesRoutes(router);

const server = createAppServer(router);

server.listen(PORT, () => {
  console.log(`🚀 [EduCore] Servidor rodando com sucesso em http://localhost:${PORT}`);
});
