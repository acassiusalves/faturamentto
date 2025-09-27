
// src/app/api/ml/create-listing/route.ts
import { NextResponse } from 'next/server';
import { getMlToken } from '@/services/mercadolivre';

const ML_API = "https://api.mercadolibre.com";

interface CreateListingPayload {
    title: string;
    category_id: string;
    catalog_product_id: string;
    price: number;
    available_quantity: number;
    listing_type_id: string;
    accountId: string; // ID da conta do Firestore
    buying_mode: 'buy_it_now' | 'classified';
    condition: 'new' | 'used' | 'not_specified';
}

export async function createListingFromCatalog(payload: CreateListingPayload) {
    try {
        const { 
            title,
            category_id,
            catalog_product_id, 
            price, 
            available_quantity, 
            listing_type_id, 
            accountId,
            buying_mode,
            condition,
        } = payload;
        
        const token = await getMlToken(accountId);

        // Montar o corpo da requisição para criar o anúncio
        const itemPayload = {
            title: title,
            catalog_product_id: catalog_product_id,
            category_id: category_id,
            price: price,
            currency_id: 'BRL',
            available_quantity: available_quantity,
            buying_mode: buying_mode,
            condition: condition,
            listing_type_id: listing_type_id,
            pictures: [], // O catálogo fornecerá as fotos
            attributes: [], // O catálogo fornecerá os atributos
        };

        // Fazer a requisição para criar o anúncio
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
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
        
        return NextResponse.json(result.data);

    } catch (e: any) {
        console.error("[POST /api/ml/create-listing] Error:", e);
        return NextResponse.json({ error: e.message || "Erro interno do servidor." }, { status: 500 });
    }
}
