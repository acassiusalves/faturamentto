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
  brand: DbItem["brand"];
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
  return s.replace(
    /\s*(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:[,.]\d{2})?\s*$/u,
    ""
  ).trim();
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

  // tirar ruído
  m = m.replace(/\bglobal\b/g,"");
  m = m.replace(/\bchines|chinesa|chine(s)?\b/g,"").trim();
  m = m.replace(/\s+/g," ");

  // correções comuns
  m = m.replace(/\bnot\b/g, "note");        // "NOT14" -> "note14"
  m = m.replace(/\bnot(\s*)14/,"note 14");
  m = m.replace(/\bnot(\s*)13/,"note 13");

  // "pro +5g" -> "pro plus 5g"
  m = m.replace(/pro\s*\+\s*5g/g, "pro plus 5g");
  m = m.replace(/\bpro\+\b/g, "pro plus");

  // Realme: "realmec75" -> "c75" ; "c75x" -> "c75"
  m = m.replace(/realme?c?(\s*)75x/g,"c75");
  m = m.replace(/realmec?75/g,"c75");

  // Xiaomi sem "Redmi" mas começando por número -> assume Redmi
  if (brand === "Xiaomi" && /^\d/.test(m)) {
    m = `redmi ${m}`;
  }

  // reduzir múltiplos espaços
  m = m.replace(/\s+/g," ").trim();
  return m;
}

function parseColor(token?: string) {
  if (!token) return undefined;
  const k = token.replace(/\s+/g,"").toLowerCase();
  return colorMap[k] ?? colorMap[norm(token)] ?? undefined;
}

function extractLastDigits(line: string): string {
  // pega o último número, remove separadores
  const matches = line.match(/(\d[\d.,]*)\s*$/);
  if (!matches) return "0";
  const digits = matches[1].replace(/[^\d]/g,"");
  return digits || "0";
}

// CHANGE: parseStdLine
export function parseStdLine(line: string): StdLine | null {
  const priceDigits = extractLastDigits(line);
  const lineNoPrice = stripTrailingPrice(line); // <- usa essa versão para parsing

  const brandMatch = lineNoPrice.match(/\b(Xiaomi|Realme|Motorola|Samsung)\b/i);
  if (!brandMatch) return null;
  const brand = (brandMatch[1][0].toUpperCase() + brandMatch[1].slice(1).toLowerCase()) as DbItem["brand"];

  const storageMatch = lineNoPrice.match(/(\d+)\s*GB/i);
  const storage = storageMatch ? parseInt(storageMatch[1],10) : NaN;

  const allGb = lineNoPrice.match(/\b(\d+)\s*GB\b/gi) || [];
  let ram = NaN;
  if (allGb.length >= 2) {
    const nums = allGb.map(x => parseInt(x.replace(/\D/g,""),10));
    // heurística: o menor costuma ser RAM (12 vs 512)
    ram = Math.min(...nums) !== storage ? Math.min(...nums) : Math.max(...nums);
  }

  let network: "4g" | "5g" | undefined;
  if (/\b5G\b/i.test(lineNoPrice)) network = "5g";
  else if (/\b4G\b/i.test(lineNoPrice)) network = "4g";

  const colorTok = lineNoPrice.match(/\b(Preto|Azul|Verde|Dourado|Gold|Prata|Silver|Roxo|Purple|Branco|White|Cinza|Gray|Grey|Rosa|Pink)\b(?!.*\b(Preto|Azul|Verde|Dourado|Gold|Prata|Silver|Roxo|Purple|Branco|White|Cinza|Gray|Grey|Rosa|Pink)\b)/i)?.[0];
  const color = parseColor(colorTok);

  const parts = lineNoPrice.split(/\b\d+\s*GB\b/i);
  const left = parts[0] || "";
  const afterBrand = left.replace(/\b(Xiaomi|Realme|Motorola|Samsung)\b/i,"").trim();
  const modelBase = normalizeModel(brand, afterBrand);

  return {
    raw: lineNoPrice,              // <- guarda SEM preço para não poluir name
    brand,
    modelBase,
    storage: isNaN(storage) ? 0 : storage,
    ram: isNaN(ram) ? 0 : ram,
    color,
    network,
    priceDigits
  };
}

// CHANGE: parseDb
export function parseDb(databaseList: string): DbItem[] {
  const lines = databaseList.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: DbItem[] = [];
  for (const line of lines) {
    const [rawName, sku] = line.split("\t").map(s => s?.trim());
    if (!rawName || !sku) continue;

    const name = stripTrailingPrice(rawName);           // <- limpa preço do nome
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
      sku, name: rawName, // mantém o nome original para exibir
      brand, modelBase, storage, ram, color, network
    });
  }
  return items;
}

function brandEq(a: string, b: string) { return a.toLowerCase() === b.toLowerCase(); }
function modelEq(a: string, b: string) {
  const clean = (s:string)=> s.replace(/\s+/g,"").toLowerCase();
  return clean(a) === clean(b);
}

function colorEq(a?: string, b?: string) {
  if (!a || !b) return true; // cor é fraca
  return a === b;
}

// scoring
function scoreMatch(std: StdLine, db: DbItem) {
  if (!brandEq(std.brand, db.brand)) return -999;

  let s = 0;
  if (modelEq(std.modelBase, db.modelBase)) s += 5;
  if (std.storage && std.storage === db.storage) s += 2;
  if (std.ram && std.ram === db.ram) s += 2;

  // rede: default 4G se não informado
  const desired = std.network ?? "4g";
  if (desired === db.network) s += 1;
  else if (desired === "4g" && db.network === "5g") s -= 2; // penaliza 5G quando não pediu

  if (colorEq(std.color, db.color)) s += 0.5;

  return s;
}

export function deterministicLookup(standardizedLines: string[], databaseList: string): {
  details: MatchResult[];
  withCode: MatchResult[];
  noCode: MatchResult[];
} {
  const db = parseDb(databaseList);

  // índice por nome normalizado (sem preço + sinônimos)
  const dbByNorm = new Map<string, typeof db[number]>();
  for (const item of db) {
    dbByNorm.set(normalizeNameForCompare(item.name), item);
  }

  const stdParsed = standardizedLines
    .map(parseStdLine)
    .filter((x): x is StdLine => !!x);

  const results: MatchResult[] = stdParsed.map(std => {
    const normStdFull = normalizeNameForCompare(std.raw);

    // 1) MATCH DIRETO POR NOME (ultra forte)
    const direct = dbByNorm.get(normStdFull);
    if (direct) {
      return { sku: direct.sku, name: direct.name, costPrice: std.priceDigits, _score: 999 };
    }

    // 2) Fallback: score
    let best: {item: DbItem; score: number} | null = null;
    for (const item of db) {
      const sc = scoreMatch(std, item);
      if (!best || sc > best.score) best = { item, score: sc };
    }

    const THRESHOLD = 6.5; 
    if (best && best.score >= THRESHOLD) {
      return { sku: best.item.sku, name: best.item.name, costPrice: std.priceDigits, _score: best.score };
    }

    // SEM CÓDIGO: agora o name vem SEM o preço grudado
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
