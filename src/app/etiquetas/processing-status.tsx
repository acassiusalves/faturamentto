
"use client";

import { Loader2 } from "lucide-react";

export const ProcessingStatus = ({ isRemixingZpl }: { isRemixingZpl: boolean }) => {
    if (!isRemixingZpl) return null;
    
    return (
      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-md mb-4">
        <Loader2 className="animate-spin text-blue-600" size={20} />
        <div className="flex-1">
          <p className="font-medium text-blue-900">Processando alterações...</p>
          <div className="text-sm text-blue-700 space-y-1 mt-1">
            <p>🤖 <strong>1º:</strong> Detecção automática de campos</p>
            <p>⚓ <strong>2º:</strong> Âncoras fixas (se template conhecido)</p>
            <p>🧠 <strong>3º:</strong> IA como último recurso</p>
          </div>
        </div>
      </div>
    );
};
