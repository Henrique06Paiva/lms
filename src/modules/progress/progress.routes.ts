import { Router } from "../../core/router.js";
import { authenticate } from "../auth/auth.middleware.js";
import { progressService } from "./progress.service.js";

export function registerProgressRoutes(router: Router): void {
  // 1. Marca aula como concluída (RF14)
  router.post(
    "/api/lessons/:id/complete",
    authenticate,
    async (req, res) => {
      const lessonId = Number(req.params["id"]);
      const enrollment = await progressService.completeLesson(req.user!.id, lessonId);

      res.status(200).json({
        message: "Aula marcada como concluída",
        enrollment,
      });
    }
  );

  // 2. Reseta o progresso do curso (RF15)
  router.post(
    "/api/courses/:id/reset",
    authenticate,
    async (req, res) => {
      const courseId = Number(req.params["id"]);
      const enrollment = await progressService.resetCourse(req.user!.id, courseId);

      res.status(200).json({
        message: "Progresso do curso resetado com sucesso",
        enrollment,
      });
    }
  );
}
