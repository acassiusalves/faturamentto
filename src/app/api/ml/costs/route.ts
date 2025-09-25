
import { NextResponse } from "next/server";
import { getMlToken } from "@/services/mercadolivre";
import type { SaleCost, SaleCosts } from "@/lib/types";

const ML_API = "https://api.mercadolibre.com";
const SITE_ID = "MLB"; // Brazil

// Helper to fetch data with token
async function fetchWithToken(url: string, token: string) {
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
    });
    if (!response.ok) {
        const errorData = await response.text();
        console.error(`ML API Error (${url}):`, errorData);
        throw new Error(`Erro na API do Mercado Livre: ${response.statusText}`);
    }
    return response.json();
}

async function getListingTypes(token: string) {
    const url = `${ML_API}/sites/${SITE_ID}/listing_types`;
    const data = await fetchWithToken(url, token);
    return data.map((lt: any) => ({ id: lt.id, name: lt.name }));
}

async function calculateCostForItem(
    listingId: string,
    token: string,
    listingTypes: { id: string; name: string }[]
): Promise<SaleCosts | null> {
    
    // 1. Get item details
    const itemDetailsUrl = `${ML_API}/items/${listingId}?attributes=id,title,price,category_id,shipping`;
    const item = await fetchWithToken(itemDetailsUrl, token);

    if (!item.price || !item.category_id) {
        console.error(`Item ${listingId} não tem preço ou categoria.`);
        return null;
    }

    // 2. Calculate costs for each listing type
    const costPromises = listingTypes.map(async (lt) => {
        const price = item.price;
        const shippingCost = item.shipping?.cost || 0; // Assume free shipping if cost is not present

        const listingPriceUrl = `${ML_API}/sites/${SITE_ID}/listing_prices?price=${price}&listing_type_id=${lt.id}&category_id=${item.category_id}`;
        const feeData = await fetchWithToken(listingPriceUrl, token);
        
        const sale_fee_amount = feeData.sale_fee_amount ?? 0;
        const fixed_fee = (feeData.listing_type_id === 'free' || sale_fee_amount === 0) ? 0 : 6;
        const net_amount = price - sale_fee_amount - fixed_fee - shippingCost;

        return {
            listing_type_id: lt.id,
            listing_type_name: lt.name,
            price: price,
            sale_fee_rate: (sale_fee_amount / price) * 100,
            sale_fee: sale_fee_amount,
            fixed_fee: fixed_fee,
            shipping_cost: shippingCost,
            net_amount: net_amount,
        } as SaleCost;
    });

    const costs = await Promise.all(costPromises);

    return {
        id: item.id,
        title: item.title,
        category_id: item.category_id,
        costs: costs.filter(Boolean),
    };
}


export async function POST(req: Request) {
  try {
    const { listingIds } = await req.json();
    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: "O campo 'listingIds' é obrigatório e deve ser um array." }, { status: 400 });
    }

    const token = await getMlToken();
    const listingTypes = await getListingTypes(token);

    const results = await Promise.all(
        listingIds.map(id => calculateCostForItem(id, token, listingTypes).catch(e => {
            console.error(`Falha ao processar anúncio ${id}:`, e);
            return { id, error: e.message }; // Return error object for failed items
        }))
    );
    
    const successfulItems = results.filter(r => r && !r.error);

    return NextResponse.json({ items: successfulItems });

  } catch (e: any) {
    console.error("POST /api/ml/costs error:", e);
    return NextResponse.json({ error: e?.message || "Erro inesperado" }, { status: 500 });
  }
}
