import { NextResponse } from "next/server";
import { generateNewAccessToken as getMlToken } from "@/services/mercadolivre";

const ML_API = "https://api.mercadolibre.com";

async function fetchMaybeAuth(url: string) {
  let r = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (r.status === 401 || r.status === 403) {
    try {
      const token = await getMlToken();
      r = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
    } catch {}
  }
  return r;
}

async function getHighlights(site: string, category: string) {
  // ✅ endpoint correto
  const url = `${ML_API}/highlights/${site}/category/${category}`;
  const r = await fetchMaybeAuth(url);
  if (!r.ok) return null;
  const data = await r.json();
  const content = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
  const items = content
    .map((row: any) => ({ id: row?.id || row?.item_id, position: row?.position ?? null }))
    .filter((x: any) => x?.id);
  return items.length ? items : null;
}

async function getSearchSorted(site: string, category: string, limit: number) {
  const url = new URL(`${ML_API}/sites/${site}/search`);
  url.searchParams.set("category", category);
  url.searchParams.set("sort", "sold_quantity_desc");
  url.searchParams.set("limit", String(limit));
  const r = await fetchMaybeAuth(url.toString());
  if (!r.ok) return null;
  const data = await r.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((r: any, i: number) => ({ id: r.id, position: i + 1 }));
}

async function enrichItems(ids: string[]) {
  const out: Record<string, any> = {};
  const CHUNK = 20;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = ids.slice(i, i + CHUNK);
    const r = await fetchMaybeAuth(`${ML_API}/items?ids=${batch.join(",")}`);
    if (!r.ok) continue;
    const rows = await r.json();
    for (const row of rows || []) {
      const it = row?.body;
      if (!it?.id) continue;
      out[it.id] = {
        id: it.id,
        title: it.title,
        price: it.price,
        thumbnail: it.thumbnail || it.pictures?.[0]?.url || "",
        permalink: it.permalink || `https://produto.mercadolivre.com.br/${it.id.replace("MLB", "MLB-")}`,
      };
    }
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const site = (searchParams.get("site") || "MLB").toUpperCase();
    const limit = Math.min(Number(searchParams.get("limit") || 24), 50);

    if (!category) {
      return NextResponse.json({ error: "category é obrigatório" }, { status: 400 });
    }

    // 1) tenta highlights corretos
    let base = await getHighlights(site, category);

    // 2) fallback para busca ordenada por vendidos
    if (!base || base.length === 0) base = await getSearchSorted(site, category, limit);

    if (!base || base.length === 0) return NextResponse.json({ site, category, items: [] });

    // 3) enriquecer com título/preço/thumb/permalink
    const ids = base.slice(0, limit).map((b: any) => b.id);
    const map = await enrichItems(ids);
    const items = base
      .slice(0, limit)
      .map((b: any) => ({ position: b.position, ...map[b.id] }))
      .filter((x: any) => x?.id);

    return NextResponse.json({ site, category, items });
  } catch (e: any) {
    console.error("GET /api/ml/bestsellers error:", e);
    return NextResponse.json({ error: e?.message || "Erro inesperado" }, { status: 500 });
  }
}