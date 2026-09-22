import { Router } from "../../core/router.js";
import { authenticate } from "../auth/auth.middleware.js";
import { certificatesService } from "./certificates.service.js";

export function registerCertificatesRoutes(router: Router): void {
  // 1. Emissão de certificado (requer 100% de progresso) (RF16, RF17)
  router.post(
    "/api/courses/:id/certificate",
    authenticate,
    async (req, res) => {
      const courseId = Number(req.params["id"]);
      const certificate = await certificatesService.issueCertificate(
        req.user!.id,
        courseId
      );

      res.status(201).json({
        message: "Certificado emitido com sucesso",
        certificate,
      });
    }
  );

  // 2. Verificação pública de certificado por código único (RF18)
  router.get(
    "/api/certificates/:code",
    (req, res) => {
      const code = req.params["code"] ?? "";
      const certificate = certificatesService.verifyCertificate(code);

      res.status(200).json({
        valid: true,
        certificate: {
          code: certificate.code,
          studentName: certificate.student_name,
          courseTitle: certificate.course_title,
          workloadHours: certificate.workload_hours,
          issuedAt: certificate.issued_at,
          downloadUrl: `/api/certificates/${certificate.code}/download`,
        },
      });
    }
  );

  // 3. Download público do PDF do certificado
  router.get(
    "/api/certificates/:code/download",
    (req, res) => {
      const code = req.params["code"] ?? "";
      certificatesService.downloadCertificate(code, res);
    }
  );
}
