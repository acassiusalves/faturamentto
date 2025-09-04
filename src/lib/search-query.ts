// src/lib/search-query.ts
const STOPWORDS_PT = new Set([
  "de","da","do","das","dos","para","por","com","sem","e","ou","em","no","na","nos","nas","a","o","as","os",
  "duo","kit","cx","un","pcs"
]);

const CATEGORY_HINTS = new Set([
  "mouse","teclado","headset","fone","caixa","som","speaker","webcam","hub","adaptador",
  "carregador","cabo","suporte","smartwatch","relogio","gamer","rgb","bluetooth","usb"
]);

function normalize(s = "") {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\s-]/g, " ") // tira pontuação
    .replace(/\s+/g, " ")
    .trim();
}

function toTokens(s = "") {
  return normalize(s).split(" ").filter(Boolean);
}

function dedupe<T>(arr: T[]) {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
}

function removeStop(toks: string[]) {
  return toks.filter(t => t.length > 2 && !STOPWORDS_PT.has(t.toLowerCase()));
}

/**
 * Usa nome + descrição para extrair palavras-chave,
 * elimina duplicatas/stopwords e remove tokens idênticos à marca e ao modelo.
 */
export function buildSearchQuery(
  { name, description, model, brand }: { name?: string; description?: string; model?: string; brand?: string },
  maxLen = 90
) {
  const brandTokens = toTokens(brand || "").map(t => t.toLowerCase());
  const modelTokens = toTokens(model || "").map(t => t.toLowerCase());

  const nameTokens = removeStop(toTokens(name || ""));
  const descTokens = removeStop(toTokens(description || ""));

  // preferir tokens do nome, depois completar com descrição
  let keywords = dedupe([...nameTokens, ...descTokens])
    .filter(t => !brandTokens.includes(t.toLowerCase()) && !modelTokens.includes(t.toLowerCase()));

  // se não sobrou nenhuma “palavra de categoria”, tenta achar uma
  if (!keywords.some(t => CATEGORY_HINTS.has(t.toLowerCase()))) {
    const candidate = [...nameTokens, ...descTokens].find(t => CATEGORY_HINTS.has(t.toLowerCase()));
    if (candidate) keywords.unshift(candidate);
  }

  // limitar quantidade (mantém 4~6 funciona bem)
  keywords = keywords.slice(0, 6);

  // monta: "<marca> <modelo> <keywords...>"
  const parts = [brand?.trim(), model?.trim(), ...keywords].filter(Boolean);

  // dedupe por palavra final
  const seen = new Set<string>();
  const final: string[] = [];
  for (const p of parts.join(" ").split(" ").filter(Boolean)) {
    const k = p.toLowerCase();
    if (!seen.has(k)) { seen.add(k); final.push(p); }
  }

  let out = final.join(" ").trim();
  if (out.length > maxLen) out = out.slice(0, maxLen).trim();
  return out;
}
