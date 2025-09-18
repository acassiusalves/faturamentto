

// src/lib/matching.ts
import { deburr } from "lodash"; // se não usar lodash, cria um deburr simples ou remove acentos via normalize

export type DbItem = {
  sku: string;            // "#06P"
  name: string;           // "Xiaomi Redmi 14C 128GB 4GB Preto 4G"
  brand: "Xiaomi" | "Realme" | "Motorola" | "Samsung";
  modelBase: string;      // "redmi 14c" | "c61" | "note 13 pro" | "poco x6" ...
  storage: number;        // 128 | 256 | 512
  ram: number;            // 4 | 6 | 8 | 12 | 16
  color?: string;         // "preto" | "azul" etc (sem acento, lower)
  network: "4g" | "5g";
};

export type StdLine = {
  raw: string;            // linha padronizada inteira ("Realme C61 256GB Global 8GB Dourado 4G 725")
  brand?: DbItem["brand"];
  modelBase: string;
  storage: number;
  ram: number;
  color?: string;
  network?: "4g" | "5g";  // default 4g se vazio
  priceDigits: string;    // "725"
};

export type MatchResult = {
  sku: string;          // código ou "SEM CÓDIGO"
  name: string;         // nome oficial do banco ou a linha do usuário
  costPrice: string;    // dígitos do preço
  _score?: number;      // debug (opcional)
};

const BRAND_ORDER = ["Xiaomi","Realme","Motorola","Samsung"] as const;

const colorMap: Record<string,string> = {
  "preto":"preto","black":"preto","negro":"preto",
  "azul":"azul","blue":"azul","starblue":"azul",
  "verde":"verde","green":"verde",
  "dourado":"dourado","gold":"dourado",
  "prata":"prata","silver":"prata",
  "roxo":"roxo","purple":"roxo","violet":"roxo","lilas":"roxo",
  "branco":"branco","white":"branco",
  "cinza":"cinza","gray":"cinza","grey":"cinza",
  "rosa":"rosa","pink":"rosa","red":"vermelho","vermelho":"vermelho","yellow":"amarelo","amarelo":"amarelo"
};

// ADD: helpers
function stripTrailingPrice(s: string) {
    // remove: "1530", "1.530,00", "R$ 1.530", "545.00" etc no final
    return s.replace(/\s*(?:R\$\s*)?[\d.,]+\s*$/u, "").trim();
}

function applyColorSynonyms(s: string) {
  // mapeia cores em inglês para o canônico PT antes de comparar
  return norm(
    s
      .replace(/\bsilver\b/gi, "prata")
      .replace(/\bgold\b/gi, "dourado")
      .replace(/\bpurple\b/gi, "roxo")
      .replace(/\bwhite\b/gi, "branco")
      .replace(/\bblack\b/gi, "preto")
      .replace(/\bblue\b/gi, "azul")
      .replace(/\bgreen\b/gi, "verde")
      .replace(/\bpink\b/gi, "rosa")
      .replace(/\bgray|grey\b/gi, "cinza")
  );
}

function normalizeNameForCompare(s: string) {
  // 1) tira preço final; 2) deburra/lower; 3) limpa pontuação; 4) sinônimos;
  // 5) remove “ram” literal; 6) normaliza “pro +5g”, NOT->NOTE, etc
  let t = stripTrailingPrice(s);
  t = applyColorSynonyms(t);
  t = t.replace(/\bram\b/gi, "");
  t = t.replace(/\bglobal\b/gi, "global");

  // mesmas correções do normalizeModel aplicadas no nome inteiro
  t = t.replace(/\bnot\b/gi, "note")
       .replace(/\bnot(\s*)14/gi, "note 14")
       .replace(/\bnot(\s*)13/gi, "note 13")
       .replace(/pro\s*\+\s*5g/gi, "pro plus 5g")
       .replace(/\bpro\+\b/gi, "pro plus");

  // reduzir espaços e pontuação
  return norm(t);
}


function norm(s:string) {
  return deburr(s).toLowerCase().replace(/[^\p{L}\p{N}\s+]/gu," ").replace(/\s+/g," ").trim();
}

// mapeia variações de modelo para forma canônica
function normalizeModel(brand: DbItem["brand"], modelRaw: string) {
  let m = norm(modelRaw);

  // Limpar palavras comuns primeiro
  m = m.replace(/\b(global|chines|chinesa|chine|versao|version)\b/g,"").trim();
  
  // CORREÇÃO ESPECÍFICA: "Redmi Note 14" vs "Note 14"
  if (brand === "Xiaomi") {
    // Se tem "note" mas não tem "redmi", adiciona
    if (m.includes("note") && !m.includes("redmi")) {
      m = "redmi " + m;
    }
    // Se começa com número, assume Redmi
    if (/^\d/.test(m)) {
      m = `redmi ${m}`;
    }
  }

  // Outras correções
  m = m.replace(/\bnot\b/g, "note");
  m = m.replace(/\bnot(\s*)14/,"note 14");
  m = m.replace(/\bnot(\s*)13/,"note 13");
  m = m.replace(/pro\s*\+\s*5g/g, "pro plus 5g");
  m = m.replace(/\bpro\+\b/g, "pro plus");

  // Realme específico
  if (brand === "Realme") {
    m = m.replace(/realme?c?(\s*)75x/g,"c75");
    m = m.replace(/realmec?75/g,"c75");
  }

  return m.replace(/\s+/g," ").trim();
}

function parseColor(token?: string) {
  if (!token) return undefined;
  const k = token.replace(/\s+/g,"").toLowerCase();
  return colorMap[k] ?? colorMap[norm(token)] ?? undefined;
}

function extractLastDigits(line: string): string {
  // pega o último grupo de dígitos da linha, que pode ter pontos/vírgulas
  const matches = line.match(/(\d[\d.,]*)\s*$/);
  if (!matches) return "0";

  // Transforma em formato numérico padrão (ex: "1.250,50" -> "1250.50")
  let numericString = matches[1];
  if (numericString.includes(',')) {
    numericString = numericString.replace(/\./g, '').replace(',', '.');
  }
  return numericString;
}


// 1. CORREÇÃO: Melhorar detecção de marca
export function parseStdLine(line: string): StdLine | null {
  const priceDigits = extractLastDigits(line);
  const lineNoPrice = stripTrailingPrice(line);

  // MELHORAMENTO: Detecção mais robusta de marca
  let brand: DbItem["brand"] | undefined;
  const lineNorm = lineNoPrice.toLowerCase();
  
  if (lineNorm.includes('xiaomi') || lineNorm.includes('redmi') || lineNorm.includes('poco')) {
    brand = "Xiaomi";
  } else if (lineNorm.includes('realme')) {
    brand = "Realme";
  } else if (lineNorm.includes('motorola') || lineNorm.includes('moto')) {
    brand = "Motorola";
  } else if (lineNorm.includes('samsung') || lineNorm.includes('galaxy')) {
    brand = "Samsung";
  }
  
  const storageMatch = lineNoPrice.match(/(\d+)\s*GB/i);
  const storage = storageMatch ? parseInt(storageMatch[1],10) : NaN;

  const allGb = lineNoPrice.match(/\b(\d+)\s*GB\b/gi) || [];
  let ram = NaN;
  if (allGb.length >= 2) {
    const nums = allGb.map(x => parseInt(x.replace(/\D/g,""),10));
    ram = Math.min(...nums) !== storage ? Math.min(...nums) : Math.max(...nums);
  }

  let network: "4g" | "5g" | undefined;
  if (/\b5G\b/i.test(lineNoPrice)) network = "5g";
  else if (/\b4G\b/i.test(lineNoPrice)) network = "4g";

  const colorTok = lineNoPrice.match(/\b(Preto|Azul|Verde|Dourado|Gold|Prata|Silver|Roxo|Purple|Branco|White|Cinza|Gray|Grey|Rosa|Pink)\b(?!.*\b(Preto|Azul|Verde|Dourado|Gold|Prata|Silver|Roxo|Purple|Branco|White|Cinza|Gray|Grey|Rosa|Pink)\b)/i)?.[0];
  const color = parseColor(colorTok);

  const parts = lineNoPrice.split(/\b\d+\s*GB\b/i);
  const left = parts[0] || "";
  const afterBrand = brand ? left.replace(new RegExp(`\\b(xiaomi|redmi|poco|realme|motorola|moto|samsung|galaxy)\\b`, "i"),"").trim() : left.trim();
  const modelBase = normalizeModel(brand || "Xiaomi", afterBrand);

  return {
    raw: lineNoPrice,
    brand,
    modelBase,
    storage: isNaN(storage) ? 0 : storage,
    ram: isNaN(ram) ? 0 : ram,
    color,
    network,
    priceDigits
  };
}


export function parseDb(databaseList: string): DbItem[] {
  const lines = databaseList.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: DbItem[] = [];
  for (const line of lines) {
    const [rawName, sku] = line.split("\t").map(s => s?.trim());
    if (!rawName || !sku) continue;

    const name = stripTrailingPrice(rawName);
    const brandMatch = name.match(/^(Xiaomi|Realme|Motorola|Samsung)\b/i);
    if (!brandMatch) continue;
    const brand = (brandMatch[1][0].toUpperCase() + brandMatch[1].slice(1).toLowerCase()) as DbItem["brand"];

    const storageMatch = name.match(/\b(\d+)\s*GB\b/i);
    const storage = storageMatch ? parseInt(storageMatch[1],10) : 0;

    const allGb = name.match(/\b(\d+)\s*GB\b/gi) || [];
    let ram = 0;
    if (allGb.length >= 2) {
      const nums = allGb.map(x => parseInt(x.replace(/\D/g,""),10));
      ram = Math.min(...nums) !== storage ? Math.min(...nums) : Math.max(...nums);
    }

    const network = /\b5G\b/i.test(name) ? "5g" : "4g";
    const colorTok = name.match(/\b(Preto|Azul|Verde|Dourado|Gold|Prata|Silver|Roxo|Purple|Branco|White|Cinza|Gray|Grey|Rosa|Pink)\b/i)?.[0];
    const color = parseColor(colorTok || "");

    const left = name.split(/\b\d+\s*GB\b/i)[0] || "";
    const afterBrand = left.replace(/\b(Xiaomi|Realme|Motorola|Samsung)\b/i,"").trim();
    const modelBase = normalizeModel(brand, afterBrand);

    items.push({
      sku, name: rawName,
      brand, modelBase, storage, ram, color, network
    });
  }
  return items;
}

function brandEq(a?: string, b?: string) {
    if (!a || !b) return false;
    return a.toLowerCase() === b.toLowerCase();
}

function modelEq(a: string, b: string) {
  const cleanA = a.replace(/\s+/g,"").toLowerCase();
  const cleanB = b.replace(/\s+/g,"").toLowerCase();
  return cleanA.includes(cleanB) || cleanB.includes(cleanA);
}


function colorEq(a?: string, b?: string) {
  if (!a || !b) return true;
  return a === b;
}

// scoring
function scoreMatch(std: StdLine, db: DbItem) {
  if (!brandEq(std.brand, db.brand)) return -999;

  let s = 0;
  if (modelEq(std.modelBase, db.modelBase)) s += 5;
  else return -999;

  if (std.storage && std.storage === db.storage) s += 2;
  if (std.ram && std.ram === db.ram) s += 2;

  const desired = std.network ?? "4g";
  if (desired === db.network) s += 1;
  else if (desired === "4g" && db.network === "5g") s -= 2;

  if (colorEq(std.color, db.color)) s += 0.5;

  return s;
}

export function deterministicLookup(standardizedLines: string[], databaseList: string): {
  details: MatchResult[];
  withCode: MatchResult[];
  noCode: MatchResult[];
} {
  const db = parseDb(databaseList);

  const stdParsed = standardizedLines
    .map(parseStdLine)
    .filter((x): x is StdLine => !!x);

  const results: MatchResult[] = stdParsed.map(std => {
    if (!std.brand) {
      return { sku: "SEM CÓDIGO", name: std.raw, costPrice: std.priceDigits, _score: 0 };
    }
      
    let best: {item: DbItem; score: number} | null = null;
    
    // CORREÇÃO: Filtro menos restritivo - só marca obrigatória
    const candidates = db.filter(dbItem => 
      brandEq(std.brand, dbItem.brand)
    );

    for (const item of candidates) {
      const sc = scoreMatch(std, item);
      if (sc > -999 && (!best || sc > best.score)) {
        best = { item, score: sc };
      }
    }

    // CORREÇÃO: Threshold mais baixo
    const THRESHOLD = 5.0; 
    if (best && best.score >= THRESHOLD) {
      // **A CORREÇÃO PRINCIPAL ESTÁ AQUI**
      // Usar `best.item.name` (do banco de dados) em vez de `std.raw` (da lista original).
      return { sku: best.item.sku, name: best.item.name, costPrice: std.priceDigits, _score: best.score };
    }

    return { sku: "SEM CÓDIGO", name: std.raw, costPrice: std.priceDigits, _score: best?.score ?? 0 };
  });

  const brandOf = (name:string) => {
    const m = name.match(/^(Xiaomi|Realme|Motorola|Samsung)\b/i)?.[1] ?? "ZZ";
    return BRAND_ORDER.indexOf(m as any);
  };

  const withCode = results.filter(r => r.sku !== "SEM CÓDIGO").sort((a,b)=>{
    const ba = brandOf(a.name), bb = brandOf(b.name);
    if (ba !== bb) return ba - bb;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const noCode = results.filter(r => r.sku === "SEM CÓDIGO");

  return { details: [...withCode, ...noCode], withCode, noCode };
}

export function debugMatch(productLine: string, databaseList: string) {
  const db = parseDb(databaseList);
  const std = parseStdLine(productLine);
  
  if (!std) {
    console.log("❌ Não conseguiu parsear a linha:", productLine);
    return;
  }
  
  console.log("🔍 Debug Match para:", productLine);
  console.log("📋 Parsed:", std);
  
  if (!std.brand) {
    console.log("❌ Marca não detectada");
    return;
  }
  
  const candidates = db.filter(dbItem => brandEq(std.brand, dbItem.brand));
  console.log(`🎯 Candidatos encontrados (${candidates.length}):`, candidates.map(c => c.name));
  
  const scores = candidates.map(item => ({
    item,
    score: scoreMatch(std, item),
    details: {
      brand: brandEq(std.brand, item.brand),
      model: modelEq(std.modelBase, item.modelBase),
      storage: std.storage === item.storage,
      ram: std.ram === item.ram,
      network: (std.network ?? "4g") === item.network,
      color: colorEq(std.color, item.color)
    }
  }));
  
  scores.sort((a, b) => b.score - a.score);
  console.table(scores.slice(0, 5));
  
  return scores[0];
}
