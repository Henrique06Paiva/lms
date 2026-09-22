import fs from "node:fs";

function sanitize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function generatePdfBuffer(data: {
  studentName: string;
  courseTitle: string;
  workloadHours: number;
  code: string;
  issueDate: string;
}): Buffer {
  const student = sanitize(data.studentName);
  const course = sanitize(data.courseTitle);
  const hours = data.workloadHours;
  const code = sanitize(data.code);
  const date = sanitize(data.issueDate);

  // Comandos de desenho em PostScript / PDF para A4 paisagem (842 x 595 pontos)
  const streamContent = `
q
% Moldura externa decorativa azul
3 w
0.1 0.3 0.6 RG
40 40 762 515 re S

% Moldura interna cinza
1 w
0.7 0.7 0.7 RG
46 46 750 503 re S

% Cabecalho principal
BT
/F2 28 Tf
0.1 0.2 0.5 rg
230 470 Td
(CERTIFICADO DE CONCLUSAO) Tj
ET

BT
/F1 14 Tf
0.3 0.3 0.3 rg
365 410 Td
(Certificamos que) Tj
ET

% Nome do Aluno
BT
/F2 22 Tf
0.1 0.1 0.1 rg
100 360 Td
(${student}) Tj
ET

BT
/F1 14 Tf
0.3 0.3 0.3 rg
100 320 Td
(concluiu com exito o curso de formacao profissional:) Tj
ET

% Titulo do Curso
BT
/F2 20 Tf
0.1 0.3 0.6 rg
100 280 Td
(${course}) Tj
ET

% Detalhes
BT
/F1 12 Tf
0.4 0.4 0.4 rg
100 210 Td
(Carga Horaria: ${hours} horas    |    Data de Emissao: ${date}) Tj
ET

% Rodape com codigo unico e autenticacao
BT
/F1 10 Tf
0.5 0.5 0.5 rg
100 130 Td
(Codigo de Autenticidade: ${code}) Tj
ET

BT
/F1 9 Tf
0.6 0.6 0.6 rg
100 110 Td
(Verificacao publica disponivel em: /api/certificates/${code}) Tj
ET
Q
`.trim();

  const streamLength = Buffer.byteLength(streamContent, "utf-8");

  // Estrutura hierarquica de objetos do PDF 1.4
  const objects: string[] = [];

  // Objeto 1: Catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

  // Objeto 2: Pages
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");

  // Objeto 3: Page (842 x 595 - A4 Paisagem)
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj"
  );

  // Objeto 4: Stream de conteudo visual
  objects.push(
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`
  );

  // Objeto 5: Fonte Normal (Helvetica)
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  );

  // Objeto 6: Fonte Negrito (Helvetica-Bold)
  objects.push(
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj"
  );

  // Montagem do arquivo com tabela XREF
  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(output, "utf-8"));
    output += obj + "\n";
  }

  const xrefStart = Buffer.byteLength(output, "utf-8");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    const formatted = String(offset).padStart(10, "0");
    output += `${formatted} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(output, "utf-8");
}

// Execucao direta como subprocesso (CLI)
if (process.argv[1]?.endsWith("pdf_worker.ts") || process.argv[1]?.endsWith("pdf_worker.js")) {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const found = args.find((a) => a.startsWith(`--${name}=`));
    return found ? found.split("=")[1] : "";
  };

  const studentName = getArg("student") || "Aluno";
  const courseTitle = getArg("course") || "Curso";
  const workloadHours = parseInt(getArg("hours") || "0", 10);
  const code = getArg("code") || "EDU-CERT";
  const issueDate = getArg("date") || new Date().toISOString().split("T")[0] || "";
  const outputPath = getArg("output");

  if (!outputPath) {
    console.error("Parametro --output e obrigatorio");
    process.exit(1);
  }

  try {
    const pdfBuf = generatePdfBuffer({
      studentName,
      courseTitle,
      workloadHours,
      code,
      issueDate,
    });

    fs.writeFileSync(outputPath, pdfBuf);
    console.log(`[PDF Worker] Certificado gerado com sucesso: ${outputPath}`);
    process.exit(0);
  } catch (err) {
    console.error("[PDF Worker] Erro ao gerar PDF:", err);
    process.exit(1);
  }
}
