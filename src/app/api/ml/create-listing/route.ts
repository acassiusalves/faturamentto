// src/app/api/ml/create-listing/route.ts
import { NextResponse } from 'next/server';
import { getMlToken } from '@/services/mercadolivre';
import type { CreateListingPayload } from '@/lib/types';

const ML_API = "https://api.mercadolibre.com";

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

        // Montar o corpo da requisição para criar o anúncio, sem título, categoria ou atributos
        // A API infere isso a partir do catalog_product_id
        const itemPayload = {
            catalog_product_id,
            price,
            currency_id: 'BRL',
            available_quantity,
            buying_mode,
            condition,
            listing_type_id,
            // Title, pictures, and other attributes are inherited from the catalog product
        };

        // Fazer a requisição para criar o anúncio no endpoint /items
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
            const errorMessage = responseData.message || 'Erro desconhecido da API do ML.';
            // Extrai as causas do erro para uma mensagem mais detalhada
            const errorCause = responseData.cause?.map((c: any) => c.message).join(' ') || '';
            throw new Error(`${errorMessage} ${errorCause}`);
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
