import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fork } from "node:child_process";
import { AppError } from "../../core/errors.js";
import type { HttpResponse } from "../../core/types.js";
import { authRepository } from "../auth/auth.repository.js";
import { coursesRepository } from "../courses/courses.repository.js";
import {
  certificatesRepository,
  type CertificateWithDetails,
} from "./certificates.repository.js";

const CERTIFICATES_DIR = path.resolve(process.cwd(), "uploads", "certificates");

export class CertificatesService {
  constructor() {
    if (!fs.existsSync(CERTIFICATES_DIR)) {
      fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });
    }
  }

  // 1. Emissão de Certificado via subprocesso se progresso == 100% (RF16, RF17)
  public async issueCertificate(
    userId: number,
    courseId: number
  ): Promise<CertificateWithDetails> {
    const course = coursesRepository.findCourseById(courseId);
    if (!course) {
      throw new AppError(404, "Curso não encontrado");
    }

    const user = authRepository.findUserById(userId);
    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    const enrollment = coursesRepository.findEnrollment(userId, courseId);
    if (!enrollment) {
      throw new AppError(404, "Matrícula não encontrada neste curso");
    }

    // Regra RF16: só habilita emissão com 100% de progresso
    if (enrollment.progress_percent < 100) {
      throw new AppError(
        400,
        `Certificado indisponível. Progresso atual: ${enrollment.progress_percent}%. Conclua 100% das aulas.`
      );
    }

    // Idempotência: se já emitiu, retorna o certificado existente
    const existing = certificatesRepository.findCertificateByUserAndCourse(userId, courseId);
    if (existing) {
      return existing;
    }

    // Gera código público único (RF18)
    const code = `EDU-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const filename = `cert_${code}.pdf`;
    const outputPath = path.join(CERTIFICATES_DIR, filename);
    const issueDate = new Date().toISOString().split("T")[0] || "";

    // Execução desacoplada do gerador de PDF via subprocesso (RF17)
    await this.runPdfSubprocess({
      studentName: user.name,
      courseTitle: course.title,
      workloadHours: course.workload_hours,
      code,
      issueDate,
      outputPath,
    });

    certificatesRepository.createCertificate({
      code,
      userId,
      courseId,
      pdfPath: filename,
    });

    const certDetails = certificatesRepository.findCertificateByCode(code);
    if (!certDetails) {
      throw new AppError(500, "Erro ao recuperar dados do certificado emitido");
    }

    return certDetails;
  }

  // Disparo de subprocesso usando child_process.fork nativo
  private async runPdfSubprocess(params: {
    studentName: string;
    courseTitle: string;
    workloadHours: number;
    code: string;
    issueDate: string;
    outputPath: string;
  }): Promise<void> {
    const workerTsPath = path.resolve(process.cwd(), "src", "modules", "certificates", "pdf_worker.ts");
    const workerJsPath = path.resolve(process.cwd(), "dist", "modules", "certificates", "pdf_worker.js");
    const workerPath = fs.existsSync(workerTsPath) ? workerTsPath : workerJsPath;

    const args = [
      `--student=${params.studentName}`,
      `--course=${params.courseTitle}`,
      `--hours=${params.workloadHours}`,
      `--code=${params.code}`,
      `--date=${params.issueDate}`,
      `--output=${params.outputPath}`,
    ];

    return new Promise((resolve, reject) => {
      // fork cria um subprocesso Node.js com canal IPC e herança de runtime sem problemas de shell
      const child = fork(workerPath, args, {
        stdio: "inherit",
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new AppError(500, `Falha no subprocesso de geração do PDF (código ${code})`));
        }
      });

      child.on("error", (err) => {
        reject(new AppError(500, `Erro ao inicializar subprocesso: ${err.message}`));
      });
    });
  }

  // 2. Verificação pública de autenticidade (RF18)
  public verifyCertificate(code: string): CertificateWithDetails {
    const cert = certificatesRepository.findCertificateByCode(code);
    if (!cert) {
      throw new AppError(404, "Certificado não encontrado ou código inválido");
    }

    return cert;
  }

  // 3. Download do arquivo PDF gerado
  public downloadCertificate(code: string, res: HttpResponse): void {
    const cert = this.verifyCertificate(code);
    if (!cert.pdf_path) {
      throw new AppError(404, "Arquivo de certificado não disponível");
    }

    const fullPath = path.join(CERTIFICATES_DIR, cert.pdf_path);
    if (!fs.existsSync(fullPath)) {
      throw new AppError(404, "Arquivo PDF não encontrado no disco");
    }

    const stat = fs.statSync(fullPath);

    res.status(200);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="certificado_${cert.code}.pdf"`
    );

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  }
}

export const certificatesService = new CertificatesService();
