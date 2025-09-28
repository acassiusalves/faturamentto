// src/app/api/ml/create-listing/route.ts
import { NextResponse } from 'next/server';
import { createListingFromCatalog } from '@/services/mercadolivre';
import type { CreateListingPayload } from '@/lib/types';


// This route is no longer called directly from the client-side action.
// The logic has been moved into the server action itself to avoid CORS and fetch issues.
// This file is kept for potential future use or direct API access if needed, but is currently unused.

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
