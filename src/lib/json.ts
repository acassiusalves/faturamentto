
export function extractJson<T = any>(s: string): T {
  // tenta achar o primeiro bloco {...} ou [...]
  const match = s.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  const raw = match ? match[1] : s;
  return JSON.parse(raw) as T;
}
