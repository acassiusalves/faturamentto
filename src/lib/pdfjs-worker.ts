
"use client";

import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";

export function setupPdfjsWorker() {
  if (typeof window === "undefined") return;

  try {
    const worker = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url),
      { type: "module" }
    );
    GlobalWorkerOptions.workerPort = worker;
  } catch (err) {
    console.warn("[pdfjs] fallback para arquivo público:", err);
    GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
  }
}
