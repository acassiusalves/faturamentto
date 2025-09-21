
import { NextResponse } from "next/server";
import { getMlToken } from "@/services/mercadolivre";

const ML_API = "https://api.mercadolibre.com";

async function fetchMaybeAuth(url: string) {
  // tenta sem token e, se 401/403, tenta com token
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
  // endpoint correto: /highlights/{SITE}/category/{CATEGORY_ID}
  const url = `${ML_API}/highlights/${site}/category/${category}`;
  const r = await fetchMaybeAuth(url);
  if (!r.ok) {
    console.error("ML highlights error:", r.status, r.statusText);
    return [];
  }
  const j = await r.json();
  const content = Array.isArray(j?.content) ? j.content : Array.isArray(j) ? j : [];
  return content
    .map((row: any) => ({
      id: row?.id || row?.item_id,
      type: row?.type || null, // "ITEM" | "PRODUCT"
      position: row?.position ?? null,
    }))
    .filter((x: any) => x.id);
}

async function enrichItemsByType(base: Array<{ id: string; type: string; position: number | null }>, site: string, limit: number) {
  const out: Record<string, any> = {};
  const items = base.filter(b => b.type === "ITEM").map(b => b.id);
  const products = base.filter(b => b.type === "PRODUCT").map(b => b.id);

  // --- ITEM: /items?ids=... (em lote)
  if (items.length) {
    const CHUNK = 20;
    const ATTRS = "id,title,price,secure_thumbnail,thumbnail,permalink,pictures,attributes";
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = items.slice(i, i + CHUNK);
      const r = await fetchMaybeAuth(`${ML_API}/items?ids=${batch.join(",")}&attributes=${encodeURIComponent(ATTRS)}`);
      if (!r.ok) continue;
      const rows = await r.json();
      for (const row of rows || []) {
        const it = row?.body;
        if (!it?.id) continue;
        const thumb =
          it.secure_thumbnail ||
          it.thumbnail ||
          (Array.isArray(it.pictures) && (it.pictures[0]?.secure_url || it.pictures[0]?.url)) ||
          null;
        
        const model = it.attributes?.find((a: any) => a.id === "MODEL")?.value_name || "";

        out[it.id] = {
          id: it.id,
          title: it.title ?? "",
          price: Number.isFinite(it.price) ? it.price : 0,
          thumbnail: thumb,
          permalink: it.permalink || `https://produto.mercadolivre.com.br/${it.id.replace("MLB", "MLB-")}`,
          model: model
        };
      }
    }
  }

  // --- PRODUCT: /products/{id} + /products/{id}/items?limit=1
  if (products.length) {
    const CONC = 8;
    for (let i = 0; i < products.length; i += CONC) {
      const batch = products.slice(i, i + CONC);
      await Promise.all(
        batch.map(async (pid) => {
          // detalhes do produto (nome + fotos + atributos)
          const pR = await fetchMaybeAuth(`${ML_API}/products/${pid}?attributes=name,pictures,attributes`);
          // um item “winner” para pegar o preço
          const iR = await fetchMaybeAuth(`${ML_API}/products/${pid}/items?limit=1`);

          let title = "";
          let thumbnail: string | null = null;
          let price = 0;
          let model = "";

          if (pR.ok) {
            const p = await pR.json();
            title = p?.name ?? "";
            const pic = p?.pictures?.[0];
            thumbnail = pic?.secure_url || pic?.url || null;
            model = p?.attributes?.find((a: any) => a.id === 'MODEL')?.value_name || '';
          }

          if (iR.ok) {
            const j = await iR.json();
            // resposta costuma vir como { results: [ { id, price, ... } ] }
            const winner = j?.results?.[0] || (Array.isArray(j) ? j[0] : null);
            if (winner) {
              if (Number.isFinite(winner.price)) price = winner.price;
            }
          }

          out[pid] = {
            id: pid,
            title,
            price,
            thumbnail,
            model,
            // na planilha você linka para a página de catálogo (p/PRODUCT)
            permalink: `https://www.mercadolivre.com.br/p/${pid}`,
          };
        })
      );
    }
  }

  // devolve na ordem e com a posição
  return base
    .slice(0, limit)
    .map((b) => ({ position: b.position, ...out[b.id] }))
    .filter((x) => x?.id);
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

    const base = await getHighlights(site, category);
    if (!base.length) return NextResponse.json({ site, category, items: [] });

    const items = await enrichItemsByType(base, site, limit);
    return NextResponse.json({ site, category, items });
  } catch (e: any) {
    console.error("GET /api/ml/bestsellers error:", e);
    return NextResponse.json({ error: e?.message || "Erro inesperado" }, { status: 500 });
  }
}
