
import { NextResponse } from "next/server";
import { getMlToken } from "@/services/mercadolivre";

// This file is temporarily disabled by reverting its content.
// The cost calculation logic will be revisited.

export async function POST(req: Request) {
  try {
    // Return an empty array to avoid breaking the client expecting a list of items.
    return NextResponse.json({ items: [] });
  } catch (e: any) {
    console.error("POST /api/ml/costs error:", e);
    return NextResponse.json({ error: "Endpoint temporariamente desativado." }, { status: 503 });
  }
}
