// src/app/api/ml/create-listing/route.ts
import { NextResponse } from 'next/server';
import { getMlToken } from '@/services/mercadolivre';
import type { CreateListingPayload } from '@/lib/types';

const ML_API = "https://api.mercadolibre.com";

async function getFirstVariationId(catalogProductId: string, token: string): Promise<string | null> {
    // Busca o produto de catálogo para descobrir variações
    const url = `${ML_API}/products/${catalogProductId}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const p = await r.json();
    // Alguns catálogos expõem variações em p.variations
    const v = Array.isArray(p?.variations) && p.variations.length ? p.variations[0] : null;
    // A chave costuma ser 'id' (o ID da variação do catálogo)
    return v?.id ? String(v.id) : null;
}


export async function createListingFromCatalog(payload: CreateListingPayload) {
    try {
        const { 
            catalog_product_id, 
            price, 
            available_quantity, 
            listing_type_id, 
            accountId,
            buying_mode,
            condition,
        } = payload;
        
        const token = await getMlToken(accountId);

        // Tente descobrir a variação do catálogo (se existir)
        const variationId = await getFirstVariationId(catalog_product_id, token);

        const itemPayload: Record<string, any> = {
            title: `Anúncio de Catálogo para ${catalog_product_id}`, // O ML vai sobrescrever isso, mas é bom ter
            category_id: 'MLB1055', // Categoria de fallback (Celulares e Smartphones), idealmente viria do produto
            site_id: "MLB",
            catalog_product_id,
            price,
            currency_id: 'BRL',
            available_quantity,
            buying_mode,
            condition,
            listing_type_id,
            pictures: [], // Vazio para catálogo
            catalog_listing: true, // Garante que é um anúncio de catálogo
            sale_terms: [
                { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
                { id: "WARRANTY_TIME", value_name: "3 meses" }
            ],
            attributes: [
                 { id: "ITEM_CONDITION", value_name: condition === 'new' ? 'Novo' : 'Usado' },
            ]
        };

        const createItemUrl = `${ML_API}/items`;

        const response = await fetch(createItemUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(itemPayload),
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('ML API Error Response:', JSON.stringify(responseData, null, 2));
            const errorMessage = responseData.message || 'Erro desconhecido da API do ML.';
            const errorCause = Array.isArray(responseData.cause) ? responseData.cause.map((c: any) => c.message).join(' ') : (responseData.cause?.message || '');
            throw new Error(`[${response.status}] ${errorMessage} ${errorCause}`);
        }

        return { data: responseData, error: null };
    } catch (e: any) {
        console.error("Error in createListingFromCatalog:", e);
        return { data: null, error: e.message || 'Erro inesperado ao criar o anúncio.' };
    }
}


export async function POST(req: Request) {
    try {
        const body: CreateListingPayload = await req.json();
        const result = await createListingFromCatalog(body);

        if(result.error) {
            return NextResponse.json({ error: result.error, data: result.data }, { status: 400 });
        }
        
        return NextResponse.json(result.data);

    } catch (e: any) {
        console.error("[POST /api/ml/create-listing] Error:", e);
        return NextResponse.json({ error: e.message || "Erro interno do servidor." }, { status: 500 });
    }
}
