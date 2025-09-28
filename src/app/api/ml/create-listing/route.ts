// src/app/api/ml/create-listing/route.ts
import { NextResponse } from 'next/server';

// This route is no longer called directly from the client-side action.
// The logic has been moved into the server action itself to avoid CORS and fetch issues.
// This file is kept for potential future use or direct API access if needed, but is currently unused.

export async function POST(req: Request) {
    try {
        // Since the logic is moved, this endpoint is effectively disabled.
        // We return an error to indicate it should not be used.
        return NextResponse.json(
            { error: "This API route is deprecated. Use the 'createCatalogListingAction' server action instead." },
            { status: 410 } // 410 Gone
        );

    } catch (e: any) {
        console.error("[POST /api/ml/create-listing] Error:", e);
        return NextResponse.json({ error: e.message || "Erro interno do servidor." }, { status: 500 });
    }
}
