// src/app/api/ml/bestsellers/route.ts
import { NextResponse } from 'next/server';

const ML_API = 'https://api.mercadolibre.com';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    if (!category) {
      return NextResponse.json({ error: 'category é obrigatório' }, { status: 400 });
    }

    // O endpoint de highlights retorna os mais vendidos de uma categoria
    const url = `${ML_API}/sites/MLB/highlights/items?category=${category}`;

    const res = await fetch(url, {
      cache: 'no-store', // Sempre buscar dados frescos
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MarketFlowApp/1.0 (+https://marketflow.app)',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`ML bestsellers error (${category}): ${res.status}`, errorText);
      return NextResponse.json({ error: `Erro na API do ML: ${res.statusText}`, details: errorText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data.content || []);

  } catch (e: any) {
    console.error('GET /api/ml/bestsellers error:', e);
    return NextResponse.json({ error: e?.message || 'Erro inesperado no servidor' }, { status: 500 });
  }
}
