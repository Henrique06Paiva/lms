CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  issued_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  pdf_path TEXT,
  UNIQUE(user_id, course_id)
) STRICT;

CREATE INDEX idx_certificates_code ON certificates(code);
CREATE INDEX idx_certificates_user_course ON certificates(user_id, course_id);
