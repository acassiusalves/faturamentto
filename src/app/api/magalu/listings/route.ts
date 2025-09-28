// src/app/api/magalu/listings/route.ts
import { NextResponse } from "next/server";
import { listSellerSkus, getSkuPrice, getSkuStock } from "@/services/magalu";
import { getMagaluTokens } from "@/services/firestore";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId"); // This is the UUID
    if (!accountId) return NextResponse.json({ error: "accountId (UUID) obrigatório" }, { status: 400 });

    const page  = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "50");

    // Recupera Access/Refresh Token do seu storage
    const tokens = await getMagaluTokens(accountId);
    if (!tokens || !tokens.accessToken) {
        throw new Error(`Credenciais ou token de acesso não encontrados para a conta ${accountId}.`);
    }
    const accessToken = tokens.accessToken;

    // Pass the accountId (seller_id) to the service function
    const { items = [], ...meta } = await listSellerSkus(accessToken, accountId, page, limit);

    const enriched = await Promise.all(items.map(async (sku) => {
      const [price, stock] = await Promise.allSettled([
        getSkuPrice(accessToken, accountId, sku.sku),
        getSkuStock(accessToken, accountId, sku.sku),
      ]);
      return {
        ...sku,
        price:  price.status === "fulfilled" ? price.value : null,
        stock:  stock.status === "fulfilled" ? stock.value : null,
      };
    }));

    return NextResponse.json({ items: enriched, meta: { page, limit, ...meta } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro desconhecido" }, { status: 500 });
  }
}
