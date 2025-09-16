

// === ZPL utils: decode/encode, parse, update ===

import type { RemixableField } from "./types";

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

// Considera campos “iguais” se estiverem muito próximos (sombra/negrito)
function isNear(a: ZplField, b: ZplField, tol = 2) {
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol && a.kind === b.kind;
}

// Gera clusters de campos próximos e escolhe um “representante” para exibir no formulário
export function clusterizeFields(all: ZplField[]) {
  // 1) só texto e não-vazio
  const textOnly = all.filter(f => f.kind === "text" && (f.value ?? "").trim().length > 0);

  // 2) monta clusters por proximidade
  const clusters: ZplField[][] = [];
  for (const f of textOnly) {
    const grp = clusters.find(g => isNear(g[0], f));
    if (grp) grp.push(f);
    else clusters.push([f]);
  }

  // 3) escolhe representante (preferir quem NÃO tem ^FR)
  const visible = clusters.map(list => {
    const sorted = [...list].sort((a, b) => {
      const afr = a.block.includes("^FR") ? 1 : 0;
      const bfr = b.block.includes("^FR") ? 1 : 0;
      if (afr !== bfr) return afr - bfr; // não-FR primeiro
      return a.start - b.start;          // estável
    });
    return sorted[0];
  });

  // 4) chave estável por coord (já que deduplicamos)
  const byKey: Record<string, ZplField[]> = {};
  clusters.forEach(list => {
    const rep = visible.find(v => isNear(v, list[0]))!;
    const key = `${rep.x},${rep.y}`;
    byKey[key] = list;
  });

  // Ordena visualmente
  visible.sort((a,b) => a.y - b.y || a.x - b.x);

  return { visible, byKey };
}

// Atualiza todas as camadas do grupo daquele campo (direita->esquerda para não mexer nos índices)
export function updateCluster(
  zpl: string,
  group: ZplField[],
  newValue: string,
  opts?: { preservePrefixFrom?: ZplField }
) {
  let toWrite = newValue;
  if (opts?.preservePrefixFrom) {
    const curr = opts.preservePrefixFrom.value ?? "";
    const idx = curr.indexOf(": ");
    if (idx > -1) {
      toWrite = curr.slice(0, idx + 2) + newValue; // mantém “Pedido: ” / “Nota Fiscal: ”
    }
  }
  const encoded = encodeFH(toWrite);

  // Atualiza do maior start para o menor
  const parts = [...group].sort((a, b) => b.start - a.start);
  let out = zpl;
  for (const f of parts) {
    out = out.slice(0, f.start) + encoded + out.slice(f.end);
  }
  return out;
}

// Remove acentos e deixa minúsculo (p/ achar "DESTINATÁRIO" mesmo sem acento)
export function norm(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// Tenta achar o Y do título (ex.: "destinatario" ou "remetente")
function findTitleY(fields: ZplField[], label: "destinatario" | "remetente") {
  const target = fields
    .filter(f => f.kind === "text")
    .filter(f => {
      const v = norm(f.value);
      return v.includes(label);
    })
    // quando tem duplicado (sombra), pega o menor Y (primeira ocorrência)
    .sort((a, b) => a.y - b.y)[0];
  return target?.y ?? null;
}

// Define as zonas com base nos títulos encontrados
export type Zones = {
  recipient: { yMin: number; yMax: number; xMin: number; xMax: number };
  sender: { yMin: number; yMax: number; xMin: number; xMax: number };
};

export function computeZones(visible: ZplField[]): Zones | null {
  // coluna "central" desses textos normalmente é x ~ 370
  const xs = visible.map(f => f.x).sort((a,b)=>a-b);
  const medianX = xs.length ? xs[Math.floor(xs.length/2)] : 370;

  const yDest = findTitleY(visible, "destinatario");
  const yRem  = findTitleY(visible, "remetente");

  if (yDest == null || yRem == null) return null;

  // margens de segurança (px)
  const M = 14;
  const XW = 80; // largura da coluna onde ficam os textos (ajuste fino se quiser)

  return {
    recipient: {
      yMin: yDest + M,
      yMax: yRem - M,
      xMin: medianX - XW,
      xMax: medianX + XW,
    },
    sender: {
      yMin: yRem + M,
      yMax: Number.POSITIVE_INFINITY,
      xMin: medianX - XW,
      xMax: medianX + XW,
    },
  };
}

export function isInZone(f: ZplField, z?: {yMin:number;yMax:number;xMin:number;xMax:number}) {
  if (!z) return false;
  return f.y >= z.yMin && f.y <= z.yMax && f.x >= z.xMin && f.x <= z.xMax;
}


// Whitelist for IA-editable fields
type Allowed = { type: RemixableField; x: number; y: number; tolX?: number; tolY?: number };

export const IA_ALLOWED_FIELDS: Allowed[] = [
  { type: "trackingNumber", x: 22,  y: 512, tolX: 3, tolY: 6 },  // Tag/etiqueta (texto rotacionado)
  { type: "orderNumber",    x: 370, y: 563, tolX: 3, tolY: 6 },  // Pedido: ...
  { type: "invoiceNumber",  x: 370, y: 596, tolX: 3, tolY: 6 },  // Nota Fiscal: ...
  { type: "senderName",     x: 370, y: 992, tolX: 3, tolY: 6 },  // Nome do remetente
  { type: "senderAddress",  x: 370, y: 1047,tolX: 3, tolY: 6 },  // Endereço do remetente
];

export function matchIAAllowed(field: ZplField): RemixableField | null {
  for (const a of IA_ALLOWED_FIELDS) {
    const tx = a.tolX ?? 2;
    const ty = a.tolY ?? 4;
    if (Math.abs(field.x - a.x) <= tx && Math.abs(field.y - a.y) <= ty) {
      return a.type;
    }
  }
  return null;
}

export const sanitizeValue = (fieldType: RemixableField | null, v: string) => {
  if (!v) return v;
  if (fieldType === "orderNumber")   return v.replace(/^\s*pedido\s*:?\s*/i, "").trim();
  if (fieldType === "invoiceNumber") return v.replace(/^\s*nota\s*fiscal\s*:?\s*/i, "").trim();
  return v.trim();
};
