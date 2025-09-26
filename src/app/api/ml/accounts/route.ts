
// src/app/api/ml/accounts/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";

export async function GET(req: Request) {
  try {
    const accountsCol = collection(db, 'mercadoLivreAccounts');
    const q = query(accountsCol);
    const snapshot = await getDocs(q);
    const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ accounts });
  } catch (e: any) {
    console.error("GET /api/ml/accounts error:", e);
    return NextResponse.json({ error: e?.message || "Erro inesperado ao buscar contas" }, { status: 500 });
  }
}
