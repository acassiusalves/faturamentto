
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Save, X, RotateCcw } from 'lucide-react';
import Image from 'next/image';

interface TextPosition {
  x: number; // Coordenada na imagem
  y: number; // Coordenada na imagem  
  content: string;
  zplX: number; // Coordenada original do ZPL
  zplY: number; // Coordenada original do ZPL
  fdLineIndex: number; // Índice da linha ^FD no ZPL
  hasEncoding: boolean;
}

interface VisualZplEditorProps {
  previewUrl: string;
  originalZpl: string;
  textPositions: TextPosition[];
  onApplyChanges: (modifiedZpl: string) => void;
}

export const VisualZplEditor: React.FC<VisualZplEditorProps> = ({
  previewUrl,
  originalZpl,
  textPositions,
  onApplyChanges
}) => {
  console.log('🎨 VisualZplEditor iniciado:', {
    textPositions: textPositions.length,
    previewUrl: previewUrl ? 'OK' : 'ERRO',
    originalZpl: originalZpl.length
  });

  const [editablePositions, setEditablePositions] = useState<TextPosition[]>(textPositions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const imageRef = useRef<HTMLDivElement>(null);
  const [imageScale, setImageScale] = useState(1);

  // Atualiza posições quando props mudam
  useEffect(() => {
    setEditablePositions(textPositions);
  }, [textPositions]);

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditValue(editablePositions[index].content);
  };

  const saveEdit = () => {
    if (editingIndex !== null) {
      const newPositions = [...editablePositions];
      newPositions[editingIndex].content = editValue;
      setEditablePositions(newPositions);
      setEditingIndex(null);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const applyChangesToZpl = () => {
    const lines = originalZpl.split('\n');
    
    editablePositions.forEach(pos => {
      if (pos.fdLineIndex < lines.length) {
        const encodedValue = pos.hasEncoding ? fhEncode(pos.content) : pos.content;
        lines[pos.fdLineIndex] = lines[pos.fdLineIndex].replace(
          /(\^FD).*?(\^FS|$)/,
          `$1${encodedValue}$2`
        );
      }
    });

    const modifiedZpl = lines.join('\n');
    onApplyChanges(modifiedZpl);
  };

  const resetToOriginal = () => {
    setEditablePositions(textPositions);
    setEditingIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Área da pré-visualização com overlay */}
      <div className="relative inline-block border rounded-lg overflow-hidden">
        <div 
          ref={imageRef}
          className="relative"
          style={{ maxWidth: '420px' }}
        >
          <Image
            src={previewUrl}
            alt="Pré-visualização ZPL"
            width={420}
            height={630}
            className="block w-full h-auto"
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              setImageScale(img.clientWidth / 420);
            }}
          />
          
          {/* Campos editáveis sobrepostos */}
          {editablePositions.map((pos, index) => (
            <div
              key={index}
              className="absolute group"
              style={{ 
                left: `${pos.x * imageScale}px`, 
                top: `${pos.y * imageScale}px`,
                maxWidth: `${300 * imageScale}px`,
                transform: `scale(${imageScale})`,
                transformOrigin: 'top left'
              }}
            >
              {editingIndex === index ? (
                // Modo de edição
                <div className="flex items-center gap-1 bg-blue-50 border-2 border-blue-400 rounded p-1 shadow-lg z-10">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-6 text-xs min-w-[180px] bg-white"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={saveEdit} className="h-6 w-6 p-0">
                    <Save size={10} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 w-6 p-0">
                    <X size={10} />
                  </Button>
                </div>
              ) : (
                // Modo de visualização
                <div 
                  className="relative bg-yellow-200 bg-opacity-0 hover:bg-opacity-60 transition-all cursor-pointer rounded px-1 py-0.5 border border-transparent hover:border-blue-400"
                  onClick={() => startEditing(index)}
                  title={`Clique para editar: ${pos.content}`}
                >
                  <span className="text-xs font-mono text-gray-900 block break-words leading-tight">
                    {pos.content}
                  </span>
                  
                  {/* Botão de edição */}
                  <Button
                    size="sm"
                    variant="secondary" 
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(index);
                    }}
                  >
                    <Edit size={8} />
                  </Button>
                </div>
              )}
            </div>
          ))}
          
          {/* Indicador de ajuda */}
          <div className="absolute bottom-2 left-2 text-xs text-white bg-black bg-opacity-60 px-2 py-1 rounded">
            {editablePositions.length} campos editáveis • Clique para editar
          </div>
        </div>
      </div>

      {/* Controles principais */}
      <div className="flex gap-3">
        <Button 
          onClick={applyChangesToZpl} 
          className="flex items-center gap-2"
          disabled={editingIndex !== null}
        >
          <Save size={16} />
          Aplicar Alterações ao ZPL
        </Button>
        
        <Button 
          variant="outline"
          onClick={resetToOriginal}
          disabled={editingIndex !== null}
        >
          <RotateCcw size={16} />
          Restaurar Original
        </Button>
      </div>

      {/* Lista de campos para referência */}
      <details className="mt-4">
        <summary className="font-semibold cursor-pointer">
          Campos Detectados ({editablePositions.length})
        </summary>
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto bg-gray-50 p-3 rounded text-sm">
          {editablePositions.map((pos, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="font-mono text-xs text-gray-700 flex-1">
                L{pos.fdLineIndex}: "{pos.content.substring(0, 50)}{pos.content.length > 50 ? '...' : ''}"
              </span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => startEditing(index)}
                className="h-6 px-2 ml-2"
                disabled={editingIndex !== null}
              >
                <Edit size={10} />
              </Button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

// Função auxiliar para encoding
function fhEncode(txt: string): string {
  const bytes = Buffer.from(txt, 'utf8');
  return Array.from(bytes).map(b => `_${b.toString(16).toUpperCase().padStart(2,'0')}`).join('');
}
