"use client";

import { useActionState, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Loader2,
  FileText,
  BrainCircuit,
  ScanSearch,
  MapPin,
  Database,
  RotateCcw,
  Edit,
  X,
  User,
  Bot,
} from "lucide-react";
import {
  fetchLabelAction,
  analyzeLabelAction,
  analyzeZplAction,
  remixLabelDataAction,
  remixZplDataAction,
  correctExtractedDataAction,
  regenerateZplAction,
  debugMappingAction,
} from "@/app/actions";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?worker";
import { ProcessingStatus } from "./processing-status";
import { MappingDebugger } from "./mapping-debugger";
import { SimpleDataEditor } from "@/components/simple-data-editor";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker as any;

export default function EtiquetasPage() {
  const [url, setUrl] = useState("");
  const [fetchState, fetchFormAction, fetching] = useActionState(fetchLabelAction, {
    labelUrl: null as string | null,
    error: null as string | null,
    rawError: null as string | null,
    zplContent: null as string | null,
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Etiquetas (PDF/ZPL)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="URL do PDF/ZPL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <form action={fetchFormAction}>
              <input type="hidden" name="url" value={url} />
              <Button type="submit" disabled={fetching}>
                {fetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
            </form>
          </div>

          {fetchState?.error && <p className="text-sm text-destructive">{fetchState.error}</p>}

          {fetchState?.zplContent && (
            <>
              <h3 className="font-medium">ZPL extraído</h3>
              <pre className="p-3 bg-muted rounded max-h-64 overflow-auto text-xs">
                {fetchState.zplContent}
              </pre>

              {/* Debug opcional */}
              <MappingDebugger zpl={fetchState.zplContent} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Deixa visível para confirmar que o componente está ok */}
      <ProcessingStatus isRemixingZpl={false} />
    </div>
  );
}
