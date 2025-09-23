
import { NextResponse } from "next/server";
import { getMlToken } from "@/services/mercadolivre";

const ML_API = "https://api.mercadolibre.com";

type FeeResp = Array<{
  listing_type_id: string;
  sale_fee_amount?: number; // comissão estimada
}>;

async function getItemMeta(id: string, token: string) {
  const r = await fetch(`${ML_API}/items/${id}?attributes=id,category_id,listing_type_id,price`, { 
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`items/${id} ${r.status}`);
  return r.json() as Promise<{ id: string; category_id: string; listing_type_id: string; price: number }>;
}

async function getSaleFee(siteId: string, price: number, categoryId: string, listingTypeId: string, token: string) {
  const url = new URL(`${ML_API}/sites/${siteId}/listing_prices`);
  url.searchParams.set("price", String(price));
  url.searchParams.set("category_id", categoryId);
  url.searchParams.set("listing_type_id", listingTypeId);
  
  const r = await fetch(url, { 
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` }
   });

  if (!r.ok) {
      console.warn(`Could not get listing price for ${categoryId}/${listingTypeId} at price ${price}. Status: ${r.status}`);
      return 0;
  };
  const data = (await r.json()) as FeeResp;
  const match = data.find(d => d.listing_type_id === listingTypeId) ?? data[0];
  return match?.sale_fee_amount ?? 0;
}

async function getShippingEstimate(itemId: string, zip: string, token: string) {
  if (!zip) return null;
  const r = await fetch(`${ML_API}/items/${itemId}/shipping_options?zip_code=${encodeURIComponent(zip)}`, { 
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  const j = await r.json();
  const options = j?.options ?? [];
  if (!options.length) return null;
  const cheapest = options.reduce((a: any, b: any) => (a.cost < b.cost ? a : b));
  return { service: cheapest.name, cost: Number(cheapest.cost) ?? 0 };
}

export async function POST(req: Request) {
  try {
    const { siteId = "MLB", results, zipCode } = await req.json() as {
      siteId?: string;
      results: Array<{ id: string; price?: number, category_id?: string, listing_type_id?: string }>;
      zipCode?: string;
    };
    
    const token = await getMlToken();

    const enriched = await Promise.all(results.map(async (it) => {
      try {
        const meta = (it.category_id && it.listing_type_id && it.price) ? it : await getItemMeta(it.id, token);
        const price = meta.price ?? it.price ?? 0;
        
        if (price === 0) { // Skip fee/shipping calculation for inactive items
          return {
            id: it.id,
            price: 0,
            category_id: meta.category_id,
            listing_type_id: meta.listing_type_id,
            sale_fee_amount: 0,
            shipping_estimate: null,
            net_estimated: 0,
          };
        }

        const saleFee = await getSaleFee(siteId, price, meta.category_id, meta.listing_type_id, token);
        const shipping = await getShippingEstimate(meta.id, zipCode || "", token);
        const shippingCost = shipping?.cost ?? 0;

        const net = price - saleFee - shippingCost;

        return {
          id: meta.id,
          price: price,
          category_id: meta.category_id,
          listing_type_id: meta.listing_type_id,
          sale_fee_amount: saleFee,
          shipping_estimate: shipping,
          net_estimated: Number.isFinite(net) ? Number(net.toFixed(2)) : null,
        };
      } catch (e) {
          console.error(`Failed to enrich item ${it.id}:`, e);
          return { ...it, error: e instanceof Error ? e.message : 'Unknown error' };
      }
    }));

    return NextResponse.json({ items: enriched });
  } catch (e: any) {
    console.error("POST /api/ml/costs error:", e);
    return NextResponse.json({ error: e.message || "Erro inesperado no servidor." }, { status: 500 });
  }
}
