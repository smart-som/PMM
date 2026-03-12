import { Paragraph, Packer, TextRun, Document, HeadingLevel } from "docx";
import { jsPDF } from "jspdf";

import { getSectionBody, parsePrdDocument } from "@/lib/prd/markdown";

type PrdExportInput = {
  content: string;
  exportedAtLabel: string;
  projectLabel: string;
  title: string;
};

function splitMarkdownIntoParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function buildExportLines(input: PrdExportInput) {
  const parsedDocument = parsePrdDocument(input.content);
  const lines: string[] = [
    input.title.trim() || "Product Requirements Document",
    `Scope: ${input.projectLabel}`,
    `Exported: ${input.exportedAtLabel}`
  ];

  parsedDocument.sections
    .filter((section) => section.present)
    .forEach((section) => {
      const body = getSectionBody(section.markdown, section.title);
      lines.push("");
      lines.push(section.title);
      lines.push(body || "No content provided.");
    });

  if (parsedDocument.additionalNotes.trim()) {
    lines.push("");
    lines.push("Additional Notes");
    lines.push(parsedDocument.additionalNotes.trim());
  }

  return lines;
}

function slugifyFilenamePart(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "product-requirements-document";
}

export function buildPrdExportFilename(title: string, extension: "docx" | "pdf", date = new Date()) {
  const dateLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
  return `${slugifyFilenamePart(title)}-${dateLabel}.${extension}`;
}

export async function createPrdDocxBlob(input: PrdExportInput) {
  const parsedDocument = parsePrdDocument(input.content);
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      text: input.title.trim() || "Product Requirements Document"
    }),
    new Paragraph({
      children: [new TextRun({ bold: true, text: "Scope: " }), new TextRun(input.projectLabel)]
    }),
    new Paragraph({
      children: [new TextRun({ bold: true, text: "Exported: " }), new TextRun(input.exportedAtLabel)]
    }),
    new Paragraph({ text: "" })
  ];

  parsedDocument.sections
    .filter((section) => section.present)
    .forEach((section) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          text: section.title
        })
      );

      const body = getSectionBody(section.markdown, section.title);
      const paragraphs = splitMarkdownIntoParagraphs(body || "No content provided.");

      paragraphs.forEach((paragraph) => {
        const lines = paragraph.split("\n").map((line) => line.trimEnd());
        lines.forEach((line) => {
          const trimmedLine = line.trim();
          if (!trimmedLine) {
            children.push(new Paragraph({ text: "" }));
            return;
          }

          if (/^[-*]\s+/.test(trimmedLine)) {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                text: trimmedLine.replace(/^[-*]\s+/, "")
              })
            );
            return;
          }

          children.push(new Paragraph({ text: trimmedLine }));
        });
      });

      children.push(new Paragraph({ text: "" }));
    });

  if (parsedDocument.additionalNotes.trim()) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        text: "Additional Notes"
      })
    );

    splitMarkdownIntoParagraphs(parsedDocument.additionalNotes).forEach((paragraph) => {
      children.push(new Paragraph({ text: paragraph }));
    });
  }

  const document = new Document({
    sections: [{ children }]
  });

  return Packer.toBlob(document);
}

export function createPrdPdfBlob(input: PrdExportInput) {
  const pdf = new jsPDF({
    format: "a4",
    unit: "pt"
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const lineHeight = 18;
  let cursorY = margin;

  const ensurePageSpace = (requiredHeight = lineHeight) => {
    if (cursorY + requiredHeight <= pageHeight - margin) return;
    pdf.addPage();
    cursorY = margin;
  };

  const writeWrappedText = (text: string, fontSize: number, options?: { bold?: boolean }) => {
    pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    const wrappedLines = pdf.splitTextToSize(text, pageWidth - margin * 2) as string[];
    wrappedLines.forEach((line) => {
      ensurePageSpace(lineHeight);
      pdf.text(line, margin, cursorY);
      cursorY += lineHeight;
    });
  };

  const lines = buildExportLines(input);
  lines.forEach((line, index) => {
    if (!line.trim()) {
      cursorY += lineHeight * 0.45;
      ensurePageSpace();
      return;
    }

    const isHeader = index === 0 || lines[index - 1] === "";
    writeWrappedText(line, isHeader ? 16 : 11, { bold: isHeader });
    if (index === 0) {
      cursorY += 4;
    }
  });

  return pdf.output("blob");
}
