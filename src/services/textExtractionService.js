// src/services/textExtractionService.js

import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

/**
 * Extract text from a PDF file.
 */
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
  }).promise;

  let fullText = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => item.str)
      .join(" ");

    fullText += pageText + "\n";
  }

  return fullText.trim();
}

/**
 * Extract text from a DOCX file.
 */
async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.extractRawText({
    arrayBuffer,
  });

  return result.value.trim();
}

/**
 * Extract text according to the uploaded file type.
 */
export async function extractTextFromFile(file) {
  if (!file) {
    throw new Error("No file selected.");
  }

  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf")) {
    return await extractPdfText(file);
  }

  if (fileName.endsWith(".docx")) {
    return await extractDocxText(file);
  }

  if (fileName.endsWith(".doc")) {
    throw new Error(
      "Plagiarism analysis currently supports PDF and DOCX files. " +
      "The uploaded DOC file can still be submitted, but its text cannot be analyzed yet."
    );
  }

  throw new Error(
    "Unsupported file type for plagiarism analysis."
  );
}