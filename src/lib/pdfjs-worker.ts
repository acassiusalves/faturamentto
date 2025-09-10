
"use client";

import { GlobalWorkerOptions } from "pdfjs-dist";

export function setupPdfjsWorker() {
  // Use a static path to the worker that is copied to /public
  // This is the most reliable method for Next.js.
  GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
}
