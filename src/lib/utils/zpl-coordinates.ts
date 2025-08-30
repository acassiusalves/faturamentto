
// Converte coordenadas ZPL para coordenadas de imagem
export function convertZplToImageCoordinates(
  zplX: number, 
  zplY: number, 
  imageWidth = 420, 
  imageHeight = 630
): { x: number; y: number } {
  // Assuming ZPL coordinate system:
  // - Origin at top-left
  // - Standard label size ~4"x6" (1200x1800 dots at 300 DPI)
  
  const ZPL_WIDTH = 1200;  // dots
  const ZPL_HEIGHT = 1800; // dots
  
  const x = Math.round((zplX / ZPL_WIDTH) * imageWidth);
  const y = Math.round((zplY / ZPL_HEIGHT) * imageHeight);
  
  return { x, y };
}

// Extrai posições editáveis do ZPL
export function extractEditablePositions(zpl: string): Array<{
  x: number;
  y: number;
  content: string;
  zplX: number;
  zplY: number;
  fdLineIndex: number;
  hasEncoding: boolean;
}> {
  console.log('🧩 Iniciando extração ZPL:', zpl.length, 'caracteres');
  
  const lines = zpl.split(/\r?\n/);
  const positions = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detecta posicionamento ^FO ou ^FT
    const posMatch = line.match(/^\^(FO|FT)\s*(\d+)\s*,\s*(\d+)/i);
    if (!posMatch) continue;
    
    const zplX = parseInt(posMatch[2]);
    const zplY = parseInt(posMatch[3]);
    
    // Procura bloco até ^FS
    let hasBarcode = false;
    let hasQrCode = false;
    let hasEncoding = false;
    let fdLineIndex = -1;
    let content = '';
    let j = i; // Initialize j here
    
    for (j = i; j < lines.length; j++) {
      const blockLine = lines[j].trim();
      
      if (/^\^B[A-Z]/i.test(blockLine)) hasBarcode = true;
      if (/^\^BQ/i.test(blockLine)) hasQrCode = true;
      if (/^\^FH/i.test(blockLine)) hasEncoding = true;
      
      if (blockLine.includes('^FD')) {
        fdLineIndex = j;
        const fdMatch = blockLine.match(/\^FD(.*)$/i);
        if (fdMatch) {
          content = fdMatch[1].replace(/\^FS$/, '');
          if (hasEncoding) {
            content = fhDecode(content);
          }
        }
      }
      
      if (/\^FS/.test(blockLine)) break;
    }
    
    // Só adiciona campos de texto (não códigos)
    if (!hasBarcode && !hasQrCode && content && fdLineIndex !== -1) {
      const imageCoords = convertZplToImageCoordinates(zplX, zplY);
      positions.push({
        x: imageCoords.x,
        y: imageCoords.y,
        content,
        zplX,
        zplY,
        fdLineIndex,
        hasEncoding
      });
    }
    
    i = j; // Pula para após o bloco
  }
  
  console.log('📊 Extração concluída:', positions.length, 'posições encontradas');
  if (positions.length > 0) {
    console.log('📍 Exemplos:', positions.slice(0, 2));
  }
  
  return positions;
}

function fhDecode(payload: string): string {
  return payload.replace(/(?:_[0-9A-Fa-f]{2})+/g, (seq) => {
    try {
      const bytes = seq.split('_').filter(Boolean).map(x => parseInt(x, 16));
      return Buffer.from(Uint8Array.from(bytes)).toString('utf8');
    } catch (e) {
      return seq;
    }
  });
}
