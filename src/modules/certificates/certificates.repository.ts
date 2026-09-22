import { db } from "../../db/connection.js";

export interface CertificateRecord {
  id: number;
  code: string;
  user_id: number;
  course_id: number;
  issued_at: string;
  pdf_path: string | null;
}

export interface CertificateWithDetails extends CertificateRecord {
  student_name: string;
  student_email: string;
  course_title: string;
  workload_hours: number;
}

export class CertificatesRepository {
  public createCertificate(data: {
    code: string;
    userId: number;
    courseId: number;
    pdfPath: string;
  }): CertificateRecord {
    const stmt = db.prepare(`
      INSERT INTO certificates (code, user_id, course_id, pdf_path)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(data.code, data.userId, data.courseId, data.pdfPath) as CertificateRecord;
  }

  public findCertificateByCode(code: string): CertificateWithDetails | null {
    const stmt = db.prepare(`
      SELECT 
        c.*,
        u.name AS student_name,
        u.email AS student_email,
        co.title AS course_title,
        co.workload_hours
      FROM certificates c
      JOIN users u ON u.id = c.user_id
      JOIN courses co ON co.id = c.course_id
      WHERE c.code = ?
    `);

    return (stmt.get(code.trim().toUpperCase()) as CertificateWithDetails) || null;
  }

  public findCertificateByUserAndCourse(
    userId: number,
    courseId: number
  ): CertificateWithDetails | null {
    const stmt = db.prepare(`
      SELECT 
        c.*,
        u.name AS student_name,
        u.email AS student_email,
        co.title AS course_title,
        co.workload_hours
      FROM certificates c
      JOIN users u ON u.id = c.user_id
      JOIN courses co ON co.id = c.course_id
      WHERE c.user_id = ? AND c.course_id = ?
    `);

    return (stmt.get(userId, courseId) as CertificateWithDetails) || null;
  }
}

export const certificatesRepository = new CertificatesRepository();
