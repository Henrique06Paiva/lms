import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { IncomingMessage } from "node:http";
import { AppError } from "../../core/errors.js";
import type { HttpResponse } from "../../core/types.js";
import { coursesRepository, type LessonRecord } from "../courses/courses.repository.js";
import { mediaRepository, type MaterialRecord } from "./media.repository.js";

const VIDEOS_DIR = path.resolve(process.cwd(), "uploads", "videos");
const MATERIALS_DIR = path.resolve(process.cwd(), "uploads", "materials");

export class MediaService {
  constructor() {
    if (!fs.existsSync(VIDEOS_DIR)) {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    }
    if (!fs.existsSync(MATERIALS_DIR)) {
      fs.mkdirSync(MATERIALS_DIR, { recursive: true });
    }
  }

  // 1. Upload de vídeo via Streams sem carregar em memória (RF11, RNF03)
  public async uploadLessonVideo(
    lessonId: number,
    incomingStream: IncomingMessage,
    durationSeconds?: number
  ): Promise<LessonRecord> {
    const lesson = coursesRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    const filename = `lesson_${lessonId}_${Date.now()}.mp4`;
    const targetPath = path.join(VIDEOS_DIR, filename);

    // Conecta o stream HTTP diretamente ao arquivo em disco com gerenciamento automático de backpressure
    const writeStream = fs.createWriteStream(targetPath);
    await pipeline(incomingStream, writeStream);

    const updated = mediaRepository.updateLessonVideo(lessonId, filename, durationSeconds);
    if (!updated) {
      throw new AppError(500, "Falha ao associar vídeo à aula");
    }

    return updated;
  }

  // 2. Stream de vídeo com suporte a Range requests (HTTP 206) (RF13)
  public streamLessonVideo(
    lessonId: number,
    rangeHeader: string | undefined,
    res: HttpResponse
  ): void {
    const lesson = coursesRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    if (!lesson.video_filename) {
      throw new AppError(404, "Esta aula ainda não possui vídeo cadastrado");
    }

    const videoPath = path.join(VIDEOS_DIR, lesson.video_filename);
    if (!fs.existsSync(videoPath)) {
      throw new AppError(404, "Arquivo de vídeo não encontrado no servidor");
    }

    const stat = fs.statSync(videoPath);
    const totalSize = stat.size;

    // Se o cliente não solicitou Range, entrega o stream completo (HTTP 200)
    if (!rangeHeader) {
      res.status(200);
      res.setHeader("Content-Length", totalSize);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");

      const stream = fs.createReadStream(videoPath);
      stream.pipe(res);
      return;
    }

    // Processa o cabeçalho 'Range: bytes=inicio-fim'
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0] || "0", 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    // Validação de limites
    if (isNaN(start) || isNaN(end) || start >= totalSize || end >= totalSize || start > end) {
      res.setHeader("Content-Range", `bytes */${totalSize}`);
      res.status(416).end();
      return;
    }

    const chunkSize = end - start + 1;

    // Resposta parcial (HTTP 206 Partial Content)
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", chunkSize);
    res.setHeader("Content-Type", "video/mp4");

    const partialStream = fs.createReadStream(videoPath, { start, end });
    partialStream.pipe(res);
  }

  // 3. Upload de material complementar via stream (RF12)
  public async uploadMaterial(
    lessonId: number,
    title: string,
    fileType: string,
    incomingStream: IncomingMessage
  ): Promise<MaterialRecord> {
    const lesson = coursesRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    const filename = `material_${lessonId}_${Date.now()}.${fileType}`;
    const targetPath = path.join(MATERIALS_DIR, filename);

    const writeStream = fs.createWriteStream(targetPath);
    await pipeline(incomingStream, writeStream);

    return mediaRepository.createMaterial({
      lessonId,
      title: title.trim(),
      filePath: filename,
      fileType: fileType.toLowerCase(),
    });
  }

  // 4. Listagem de materiais de uma aula
  public listMaterials(lessonId: number): MaterialRecord[] {
    const lesson = coursesRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    return mediaRepository.findMaterialsByLessonId(lessonId);
  }

  // 5. Download de material complementar
  public downloadMaterial(materialId: number, res: HttpResponse): void {
    const material = mediaRepository.findMaterialById(materialId);
    if (!material) {
      throw new AppError(404, "Material não encontrado");
    }

    const fullPath = path.join(MATERIALS_DIR, material.file_path);
    if (!fs.existsSync(fullPath)) {
      throw new AppError(404, "Arquivo de material não encontrado em disco");
    }

    const stat = fs.statSync(fullPath);

    res.status(200);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(material.title)}.${material.file_type}"`
    );

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  }
}

export const mediaService = new MediaService();
