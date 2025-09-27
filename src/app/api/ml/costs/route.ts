
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    return NextResponse.json({ error: "This endpoint is disabled." }, { status: 410 });
}
