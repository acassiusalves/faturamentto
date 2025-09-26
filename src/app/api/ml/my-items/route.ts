
import { NextResponse } from "next/server";
import { getMlToken } from "@/services/mercadolivre";

const ML_API = "https://api.mercadolibre.com";

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

async function getUserId(token: string): Promise<number> {
    const data = await fetchWithToken(`${ML_API}/users/me`, token);
    return data.id;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const account = searchParams.get('account') as 'primary' | 'secondary' | null;

        if (!account) {
            return NextResponse.json({ error: "O parâmetro 'account' é obrigatório (primary ou secondary)." }, { status: 400 });
        }

        const token = await getMlToken(account);
        const userId = await getUserId(token);

        let allItemIds: string[] = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        // 1. Fetch all item IDs first
        while (hasMore) {
            const searchUrl = `${ML_API}/users/${userId}/items/search?status=active&limit=${limit}&offset=${offset}`;
            const result = await fetchWithToken(searchUrl, token);
            const itemIds = result?.results || [];
            if (itemIds.length > 0) {
                allItemIds.push(...itemIds);
                offset += itemIds.length;
            } else {
                hasMore = false;
            }
        }
        
        if (allItemIds.length === 0) {
            return NextResponse.json({ items: [] });
        }

        // 2. Fetch item details in batches
        let allItems: any[] = [];
        const batchSize = 20; // ML API limit for /items?ids=
        for (let i = 0; i < allItemIds.length; i += batchSize) {
            const batchIds = allItemIds.slice(i, i + batchSize).join(',');
            const itemDetailsUrl = `${ML_API}/items?ids=${batchIds}&attributes=id,title,price,status,permalink,thumbnail,catalog_product_id`;
            const itemsData = await fetchWithToken(itemDetailsUrl, token);
            if (itemsData && Array.isArray(itemsData)) {
                 const batchItems = itemsData.map((item: any) => item.body);
                 allItems.push(...batchItems);
            }
        }

        return NextResponse.json({ items: allItems });

    } catch (e: any) {
        console.error("GET /api/ml/my-items error:", e);
        return NextResponse.json({ error: e?.message || "Erro inesperado" }, { status: 500 });
    }
}
