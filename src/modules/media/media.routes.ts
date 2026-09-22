import { Router } from "../../core/router.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { mediaService } from "./media.service.js";

export function registerMediaRoutes(router: Router): void {
  // 1. Upload de vídeo da aula via Streams (Admin) (RF11, RNF03)
  router.post(
    "/api/lessons/:id/video",
    authenticate,
    requireRole("admin"),
    async (req, res) => {
      const lessonId = Number(req.params["id"]);
      const durationSeconds = req.query["duration"]
        ? parseInt(req.query["duration"], 10)
        : undefined;

      const lesson = await mediaService.uploadLessonVideo(
        lessonId,
        req,
        durationSeconds
      );

      res.status(200).json({
        message: "Upload de vídeo realizado com sucesso",
        lesson,
      });
    }
  );

  // 2. Stream de vídeo com suporte a Range requests (Seek) (RF13)
  router.get(
    "/api/lessons/:id/video",
    authenticate,
    (req, res) => {
      const lessonId = Number(req.params["id"]);
      const range = req.headers["range"];

      mediaService.streamLessonVideo(lessonId, range, res);
    }
  );

  // 3. Upload de material complementar via stream (Admin) (RF12)
  router.post(
    "/api/lessons/:id/materials",
    authenticate,
    requireRole("admin"),
    async (req, res) => {
      const lessonId = Number(req.params["id"]);
      const title = req.query["title"] || "Material Complementar";
      const fileType = req.query["type"] || "pdf";

      const material = await mediaService.uploadMaterial(
        lessonId,
        title,
        fileType,
        req
      );

      res.status(201).json({
        message: "Material complementar enviado com sucesso",
        material,
      });
    }
  );

  // 4. Listagem de materiais de uma aula (RF12)
  router.get(
    "/api/lessons/:id/materials",
    authenticate,
    (req, res) => {
      const lessonId = Number(req.params["id"]);
      const materials = mediaService.listMaterials(lessonId);
      res.status(200).json({ materials });
    }
  );

  // 5. Download de material complementar
  router.get(
    "/api/materials/:id/download",
    authenticate,
    (req, res) => {
      const materialId = Number(req.params["id"]);
      mediaService.downloadMaterial(materialId, res);
    }
  );
}
