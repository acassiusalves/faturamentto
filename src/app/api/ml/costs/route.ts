
import { NextResponse } from "next/server";
import { getMlToken } from "@/services/mercadolivre";

const ML_API = "https://api.mercadolibre.com";

type FeeResp = Array<{ listing_type_id: string; sale_fee_amount?: number }>;

async function resolveItemIdFromCatalog(catalogProductId: string, token: string) {
  const r = await fetch(`${ML_API}/catalog_products/${catalogProductId}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`catalog_products/${catalogProductId} ${r.status}`);
  const data = await r.json();

  const winner = data?.buy_box_winner?.item_id || data?.buy_box_winner; 
  if (winner && typeof winner === "string") return winner;

  const items: string[] = data?.items || [];
  if (!items.length) throw new Error(`Sem items para catálogo ${catalogProductId}`);

  for (const itemId of items) {
    try {
      const meta = await getItemMeta(itemId, token);
      if (meta?.price && meta.price > 0) return itemId;
    } catch {
      // ignora e tenta o próximo
    }
  }
  return items[0];
}

async function getItemMeta(id: string, token: string) {
  const r = await fetch(
    `${ML_API}/items/${id}?attributes=id,site_id,status,category_id,listing_type_id,price`,
    { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) throw new Error(`items/${id} ${r.status}`);
  return r.json() as Promise<{
    id: string;
    site_id: string;
    status: string;
    category_id: string;
    listing_type_id: string;
    price: number;
  }>;
}

async function getSaleFee(siteId: string, price: number, categoryId: string, listingTypeId: string) {
  const url = new URL(`${ML_API}/sites/${siteId}/listing_prices`);
  url.searchParams.set("price", String(price));
  url.searchParams.set("category_id", categoryId);
  url.searchParams.set("listing_type_id", listingTypeId);

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    console.warn(`listing_prices falhou (${r.status}) for ${siteId}/${categoryId}/${listingTypeId}/${price}`);
    return 0;
  }
  const data = (await r.json()) as FeeResp;
  const match = data.find(d => d.listing_type_id === listingTypeId) ?? data[0];
  return match?.sale_fee_amount ?? 0;
}

async function getShippingEstimate(itemId: string, zip: string, token: string) {
  if (!zip) return null;
  const r = await fetch(
    `${ML_API}/items/${itemId}/shipping_options?zip_code=${encodeURIComponent(zip)}`,
    { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return null;
  const j = await r.json();
  const options = j?.options ?? [];
  if (!options.length) return null;
  const cheapest = options.reduce((a: any, b: any) => (a.cost < b.cost ? a : b));
  return { service: cheapest.name, cost: Number(cheapest.cost) ?? 0 };
}

export async function POST(req: Request) {
  try {
    const { siteId = "MLB", results, zipCode } = (await req.json()) as {
      siteId?: string;
      results: Array<
        {
          id?: string; 
          catalog_product_id?: string; 
          price?: number;
          category_id?: string;
          listing_type_id?: string;
          site_id?: string;
        }
      >;
      zipCode?: string;
    };

    if (!Array.isArray(results) || !results.length) {
      return NextResponse.json({ items: [] });
    }

    const token = await getMlToken();

    const enriched = await Promise.all(
      results.map(async (raw) => {
        try {
          let itemId = raw.id;
          if (!itemId && raw.catalog_product_id) {
            itemId = await resolveItemIdFromCatalog(raw.catalog_product_id, token);
          }
          if (!itemId) {
            throw new Error("Sem item_id ou catalog_product_id para resolver");
          }

          const meta = await getItemMeta(itemId, token);
          const price = (typeof raw.price === "number" && raw.price > 0) ? raw.price : (meta.price ?? 0);

          if (!price || price <= 0 || meta.status !== "active") {
            return {
              id: itemId,
              site_id: meta.site_id,
              price: 0,
              status: meta.status,
              category_id: meta.category_id,
              listing_type_id: meta.listing_type_id,
              sale_fee_amount: 0,
              shipping_estimate: null,
              net_estimated: 0,
            };
          }

          const saleFee = await getSaleFee(meta.site_id || siteId, price, meta.category_id, meta.listing_type_id);

          const shipping = await getShippingEstimate(itemId, zipCode || "", token);
          const shippingCost = shipping?.cost ?? 0;

          const net = price - saleFee - shippingCost;

          return {
            id: itemId,
            site_id: meta.site_id,
            price,
            status: meta.status,
            category_id: meta.category_id,
            listing_type_id: meta.listing_type_id,
            sale_fee_amount: saleFee,
            shipping_estimate: shipping,
            net_estimated: Number.isFinite(net) ? Number(net.toFixed(2)) : null,
          };
        } catch (e: any) {
          console.error("Enrichment error:", e?.message || e);
          return { ...raw, id: (raw as any).id || (raw as any).catalog_product_id, error: e?.message || "Erro ao enriquecer" };
        }
      })
    );

    return NextResponse.json({ items: enriched });
  } catch (e: any) {
    console.error("POST /api/ml/costs error:", e);
    return NextResponse.json({ error: e.message || "Erro inesperado" }, { status: 500 });
  }
}
