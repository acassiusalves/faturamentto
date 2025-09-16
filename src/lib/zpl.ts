
// === ZPL utils: decode/encode, parse, update ===

// Decodifica ^FH (substitui _xx por bytes UTF-8)
export function decodeFH(fdRaw: string): string {
  // Remove prefixos especiais de QR se quiser mostrar só o payload
  const fd = fdRaw.startsWith("QA,") || fdRaw.startsWith("LA,")
    ? fdRaw.slice(3)
    : fdRaw;

  // Trata escapes simples do ZPL quando ^FH está ativo
  const unescaped = fd.replace(/\\_/g, "_").replace(/\\\^/g, "^").replace(/\\~/g, "~").replace(/\\&/g, "&");

  // Converte sequências _xx em bytes
  const bytes: number[] = [];
  for (let i = 0; i < unescaped.length; i++) {
    if (unescaped[i] === "_" && /^[0-9A-Fa-f]{2}$/.test(unescaped.slice(i + 1, i + 3))) {
      bytes.push(parseInt(unescaped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      // caractere ASCII puro (quase nunca usado quando ^FH é aplicado em tudo)
      bytes.push(unescaped.charCodeAt(i));
    }
  }
  try {
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    // fallback “best effort”
    return String.fromCharCode(...bytes);
  }
}

// Codifica texto em formato ^FH (UTF-8 → _xx_UPPERCASE)
export function encodeFH(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes)
    .map(b => "_" + b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export type ZplField = {
  x: number;
  y: number;
  start: number;   // índice do começo do ^FD no template
  end: number;     // índice do ^FS no template (exclusivo)
  fdRaw: string;   // exatamente o que estava entre ^FD e ^FS
  value: string;   // decodificado (se ^FH presente no bloco)
  block: string;   // conteúdo entre ^FO...^FS (pra debug)
  kind: "text" | "barcode" | "qrcode" | "other";
};

// Ache campos ^FO ... ^FD ... ^FS
export function parseZplFields(zpl: string): ZplField[] {
  const fields: ZplField[] = [];
  // Divide por blocos iniciados em ^FOx,y (não guloso até o próximo ^FS)
  const re = /\^FO\s*(\d+)\s*,\s*(\d+)([\s\S]*?)\^FS/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(zpl))) {
    const [full, sx, sy, inner] = m;
    const x = parseInt(sx, 10);
    const y = parseInt(sy, 10);

    // Procura ^FD ... ^FS DENTRO do bloco ^FO atual
    const fdMatch = /\^FD([\s\S]*?)\^FS/.exec(full);
    if (!fdMatch) continue;

    // Índices absolutos do ^FD e do ^FS
    const absStart = m.index + full.indexOf("^FD") + 3;
    const absEnd = m.index + full.lastIndexOf("^FS"); // posição do '^' do ^FS (exclusivo na substituição)

    const fdRaw = fdMatch[1];

    // Detecta tipo pelo que veio antes do ^FD
    const pre = inner.split("^FD")[0];
    let kind: ZplField["kind"] = "text";
    if (/\^B3|\^BC/i.test(pre)) kind = "barcode";
    else if (/\^BQN/i.test(pre)) kind = "qrcode";

    // Se o bloco tem ^FH ativo, decodifica; senão usa texto cru
    const value = /\^FH/i.test(pre) || kind !== "text" ? decodeFH(fdRaw) : fdRaw;

    fields.push({
      x, y, start: absStart, end: absEnd, fdRaw, value, block: full, kind,
    });
  }
  return fields;
}

// Atualiza o conteúdo de um campo identificado por coordenadas ^FO(x,y)
// Se 'prefix' for passado (ex.: "Pedido: "), ele é mantido e só o sufixo é trocado.
export function updateFieldAt(
  zpl: string,
  loc: { x: number; y: number; prefix?: string },
  newValue: string,
  startHint: number // Pass the original field's start position as a hint
): string {
  const fields = parseZplFields(zpl);
  // Find a field that matches both coordinates and its original start position
  const target = fields.find(f => f.x === loc.x && f.y === loc.y && f.start === startHint);
  if (!target) {
     // Fallback to find the first field at the given coordinates if the hint fails
     const fallbackTarget = fields.find(f => f.x === loc.x && f.y === loc.y);
     if (!fallbackTarget) return zpl; // Still nothing, return original
      
     console.warn("Could not find ZPL field with startHint, using fallback coordinate match.");
     const encoded = encodeFH(newValue);
     return zpl.slice(0, fallbackTarget.start) + encoded + zpl.slice(fallbackTarget.end);
  }

  let toEncode = newValue;
  if (loc.prefix) {
    // mantém prefixo (ex.: "Pedido: ") e troca só o conteúdo após o prefixo
    const current = target.value;
    const keep = loc.prefix;
    if (current.startsWith(keep)) {
      toEncode = keep + newValue;
    } else {
      // se não tinha prefixo no rótulo atual, força o prefixo
      toEncode = keep + newValue;
    }
  }

  // Regrava ^FD com ^FH em UTF-8, preservando todo o resto do bloco
  const encoded = encodeFH(toEncode);
  return zpl.slice(0, target.start) + encoded + zpl.slice(target.end);
}
