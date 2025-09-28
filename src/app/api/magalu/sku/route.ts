// src/app/api/magalu/sku/route.ts
import { NextResponse } from "next/server";
import { getSkuDetails, getSkuPrice, getSkuStock } from "@/services/magalu";
import { getMagaluTokens } from "@/services/firestore";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const sku = searchParams.get("sku");

    if (!accountId) return NextResponse.json({ error: "accountId (UUID) obrigatório" }, { status: 400 });
    if (!sku) return NextResponse.json({ error: "sku obrigatório" }, { status: 400 });

    const tokens = await getMagaluTokens(accountId);
    if (!tokens?.accessToken) throw new Error(`Sem access token para a conta ${accountId}`);

    const [details, price, stock] = await Promise.allSettled([
      getSkuDetails(tokens.accessToken, sku),
      getSkuPrice(tokens.accessToken, sku),
      getSkuStock(tokens.accessToken, sku),
    ]);

    const enrichedDetails = {
      ... (details.status === "fulfilled" ? details.value : { error: (details.reason as Error).message }),
      price: price.status === "fulfilled" ? price.value : { error: (price.reason as Error).message },
      stock: stock.status === "fulfilled" ? stock.value : { error: (stock.reason as Error).message },
    };

    return NextResponse.json({ sku, details: enrichedDetails });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro desconhecido" }, { status: 500 });
  }
}
