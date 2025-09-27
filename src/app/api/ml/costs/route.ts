
import { NextResponse } from "next/server";
import { getMlToken } from "@/services/mercadolivre";
import type { SaleCost, SaleCosts } from "@/lib/types";

const ML_API = "https://api.mercadolibre.com";
const SITE_ID = "MLB"; // Brazil

// Helper to fetch data with token
async function fetchWithToken(url: string, token: string, accountId?: string) {
    const effectiveToken = await getMlToken(accountId);
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
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
    listingTypes: { id: string; name: string }[],
    accountId?: string,
): Promise<SaleCosts | null> {
    
    // 1. Get item details
    const itemDetailsUrl = `${ML_API}/items/${listingId}?attributes=id,title,price,category_id,shipping`;
    const item = await fetchWithToken(itemDetailsUrl, token, accountId);

    if (!item.price || !item.category_id) {
        console.error(`Item ${listingId} não tem preço ou categoria.`);
        return null;
    }
    
    const shippingCost = item.shipping?.cost || 0;

    // 2. Calculate costs for each listing type
    const costPromises = listingTypes.map(async (lt) => {
        const price = item.price;
        
        const listingPriceUrl = `${ML_API}/sites/${SITE_ID}/listing_prices?price=${price}&listing_type_id=${lt.id}&category_id=${item.category_id}`;
        
        let feeData;
        try {
            feeData = await fetchWithToken(listingPriceUrl, token, accountId);
        } catch (e) {
            console.warn(`Could not fetch fee for listing type ${lt.id} for item ${listingId}. Skipping.`, e);
            return null; // Skip if fee calculation fails for one type
        }
        
        // ML API returns an array, we need to find the correct one if so.
        if(Array.isArray(feeData)) {
            feeData = feeData.find(f => f.listing_type_id === lt.id);
        }

        if(!feeData) return null;
        
        const sale_fee_amount = feeData.sale_fee_amount ?? 0;
        
        // A taxa fixa agora é R$ 7,90 para Clássico e Premium. Gratuito não tem.
        const isFreeListing = lt.id === 'free' || sale_fee_amount === 0;
        const fixed_fee = isFreeListing ? 0 : 7.90;

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

    const costs = (await Promise.all(costPromises)).filter((c): c is SaleCost => c !== null);

    return {
        id: item.id,
        title: item.title,
        category_id: item.category_id,
        costs: costs,
    };
}


export async function POST(req: Request) {
  try {
    const { listingIds, accountId } = await req.json(); // accountId is now expected
    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: "O campo 'listingIds' é obrigatório e deve ser um array." }, { status: 400 });
    }

    const token = await getMlToken(accountId);
    const listingTypes = await getListingTypes(token);

    const results = await Promise.all(
        listingIds.map(id => calculateCostForItem(id, token, listingTypes, accountId).catch(e => {
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
