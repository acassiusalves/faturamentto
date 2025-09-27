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

        // O payload para o endpoint de criação de anúncio de catálogo.
        // Não inclui título, categoria ou atributos, pois são herdados do catálogo.
        const itemPayload = {
            catalog_product_id,
            price,
            currency_id: 'BRL', // Campo obrigatório
            available_quantity,
            buying_mode,
            condition,
            listing_type_id,
        };

        // **CORREÇÃO: Usar o endpoint correto para criação de anúncios de catálogo.**
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
            // Log detalhado do erro para depuração
            console.error('ML API Error Response:', JSON.stringify(responseData, null, 2));
            
            const errorMessage = responseData.message || 'Erro desconhecido da API do ML.';
            // Extrai as causas do erro para uma mensagem mais detalhada
            const errorCause = responseData.cause?.map((c: any) => c.message).join(' ') || '';
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
