// src/app/api/magalu/listings/route.ts
import { NextResponse } from "next/server";
import { listSellerSkus, getSkuPrice, getSkuStock } from "@/services/magalu";
import { getMagaluTokens } from "@/services/firestore";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId"); // só para buscar tokens
    if (!accountId) return NextResponse.json({ error: "accountId (UUID) obrigatório" }, { status: 400 });

    const page  = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "50");

    const tokens = await getMagaluTokens(accountId);
    if (!tokens?.accessToken) throw new Error(`Sem access token para a conta ${accountId}`);

    const { items = [] } = await listSellerSkus(tokens.accessToken, page, limit);

    const enriched = await Promise.all(items.map(async (it) => {
      const [price, stock] = await Promise.allSettled([
        getSkuPrice(tokens.accessToken, it.sku),
        getSkuStock(tokens.accessToken, it.sku),
      ]);
      return {
        ...it,
        price: price.status === "fulfilled" ? price.value : null,
        stock: stock.status === "fulfilled" ? stock.value : null,
      };
    }));

    return NextResponse.json({ items: enriched, meta: { page, limit } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro desconhecido" }, { status: 500 });
  }
}
