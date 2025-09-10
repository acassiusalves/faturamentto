"use client";

import { GlobalWorkerOptions } from "pdfjs-dist";

export function setupPdfjsWorker() {
  if (typeof window === "undefined") return;

  try {
    // carrega o worker do próprio bundle da app (sem CDN)
    const worker = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" }
    );
    GlobalWorkerOptions.workerPort = worker;
  } catch (err) {
    console.warn("[pdfjs] fallback para arquivo público:", err);
    // Fallback caso o bundler não suporte new URL(...):
    // copie `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
    // para `/public/pdf.worker.mjs`
    GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
  }
}