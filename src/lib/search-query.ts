// src/lib/search-query.ts
const STOPWORDS_PT = new Set([
  "de","da","do","das","dos","para","por","com","sem","e","ou","em","no","na","nos","nas","a","o","as","os",
  "duo","kit","cx","un","pcs" // opcionais, ajuste ao seu contexto
]);

function normalize(s = "") {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\s-]/g, " ") // tira pontuação
    .replace(/\s+/g, " ")
    .trim();
}

function pickKeywordsFromName(name: string, max = 4) {
  const tokens = normalize(name).split(" ").filter(Boolean);
  const keywords: string[] = [];
  for (const t of tokens) {
    const low = t.toLowerCase();
    if (low.length <= 2) continue;
    if (STOPWORDS_PT.has(low)) continue;
    if (!keywords.includes(t)) keywords.push(t);
    if (keywords.length >= max) break;
  }
  return keywords;
}

/**
 * Sempre retorna algo no formato:
 *   "<marca> <modelo> <palavras-chave-do-nome>"
 * (sem duplicar tokens e respeitando um limite de tamanho)
 */
export function buildSearchQuery(
  { name, model, brand }: { name?: string; model?: string; brand?: string },
  maxLen = 90
) {
  const parts = [
    (brand || "").trim(),
    (model || "").trim(),
    ...pickKeywordsFromName(name || "", 4),
  ].filter(Boolean);

  // dedup por palavra (case-insensitive)
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const p of parts.join(" ").split(" ").filter(Boolean)) {
    const k = p.toLowerCase();
    if (!seen.has(k)) { seen.add(k); deduped.push(p); }
  }

  let out = deduped.join(" ").trim();

  // garante presença explícita de brand/model se vieram
  if (brand && !new RegExp(`\\b${normalize(brand)}\\b`, "i").test(normalize(out))) {
    out = `${brand} ${out}`;
  }
  if (model && !new RegExp(`\\b${normalize(model)}\\b`, "i").test(normalize(out))) {
    out = `${brand ? "" : ""}${model} ${out}`.trim();
  }

  // limita tamanho
  if (out.length > maxLen) out = out.slice(0, maxLen).trim();

  return out;
}
