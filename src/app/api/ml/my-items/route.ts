
import { NextResponse } from "next/server";
import { getMlToken } from "@/services/mercadolivre";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

async function getUserId(token: string, accountId: string): Promise<number | null> {
    try {
        const data = await fetchWithToken(`${ML_API}/users/me`, token);
        if (data.id) return data.id;

        const accountDocRef = doc(db, 'mercadoLivreAccounts', accountId);
        const docSnap = await getDoc(accountDocRef);
        if (docSnap.exists()) {
            const accountData = docSnap.data();
            return accountData.sellerId || accountData.userId || null;
        }

        return null;
    } catch(e) {
        console.error("Erro ao buscar ID do usuário do ML", e);
        return null;
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const accountId = searchParams.get('account'); 

        if (!accountId) {
            return NextResponse.json({ error: "O parâmetro 'account' (ID da conta) é obrigatório." }, { status: 400 });
        }

        const token = await getMlToken(accountId);
        const userId = await getUserId(token, accountId);
        
        if (!userId) {
            const accountDocRef = doc(db, 'mercadoLivreAccounts', accountId);
            const docSnap = await getDoc(accountDocRef);
            const nickname = docSnap.exists() ? docSnap.data().nickname : accountId;
            throw new Error(`Não foi possível obter o ID de usuário do Mercado Livre para a conta "${nickname}". Verifique as credenciais ou o campo 'sellerId'/'userId' no documento.`);
        }


        let allItemIds: string[] = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;

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

        let allItems: any[] = [];
        const batchSize = 20;
        const attributes = "id,title,price,status,permalink,thumbnail,catalog_product_id,currency_id,sale_terms,warranty,accepts_mercadopago,available_quantity,sold_quantity,shipping,category_id,pictures";
        for (let i = 0; i < allItemIds.length; i += batchSize) {
            const batchIds = allItemIds.slice(i, i + batchSize).join(',');
            const itemDetailsUrl = `${ML_API}/items?ids=${batchIds}&attributes=${attributes}`;
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
