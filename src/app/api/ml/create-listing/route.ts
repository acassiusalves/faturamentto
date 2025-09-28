// src/app/api/ml/create-listing/route.ts
import { NextResponse } from 'next/server';
import { getMlToken } from '@/services/mercadolivre';
import type { CreateListingPayload } from '@/lib/types';

const ML_API = "https://api.mercadolibre.com";

async function fetchProductDetails(catalogProductId: string, token: string) {
    const url = `${ML_API}/products/${catalogProductId}`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Falha ao buscar detalhes do produto de catálogo: ${errorData.message}`);
    }
    return response.json();
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

        // 1. Fetch product details from catalog to get correct category, variations, etc.
        const productDetails = await fetchProductDetails(catalog_product_id, token);

        const category_id = productDetails.category_id;
        if (!category_id) {
            throw new Error('Não foi possível determinar a categoria do produto a partir do catálogo.');
        }

        const itemPayload: Record<string, any> = {
            title: productDetails.name || `Anúncio para ${catalog_product_id}`,
            category_id: category_id,
            site_id: "MLB",
            catalog_product_id,
            price,
            currency_id: 'BRL',
            available_quantity,
            buying_mode,
            condition,
            listing_type_id,
            pictures: [], // Empty for catalog listings
            catalog_listing: true, // Ensure it's a catalog listing
            sale_terms: [
                { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
                { id: "WARRANTY_TIME", value_name: "3 meses" }
            ],
            attributes: [
                 { id: "ITEM_CONDITION", value_name: condition === 'new' ? 'Novo' : 'Usado' },
            ]
        };

        // 2. Check for variations and add if they exist
        if (productDetails.variations && productDetails.variations.length > 0) {
            const firstVariation = productDetails.variations[0];
            if (firstVariation.id) {
                itemPayload.catalog_product_variation_id = String(firstVariation.id);
            }
        }
        
        // 3. (Future enhancement) Check for required attributes like FAMILY_NAME if needed.
        // For now, the basic payload is robust enough for most cases.

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
