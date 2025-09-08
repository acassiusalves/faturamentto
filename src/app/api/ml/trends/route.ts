// src/app/api/ml/trends/route.ts
import { NextResponse } from 'next/server';
import { getCategoryAncestors, getCategoryTrends } from '@/lib/ml';

/**
 * GET /api/ml/trends?category=MLBxxxxx&climb=1
 * - category: obrigatório
 * - climb: se "1", sobe nos ancestrais se a categoria não tiver trends
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const climb = searchParams.get('climb') === '1';

    if (!category) {
      return NextResponse.json({ error: 'category é obrigatório' }, { status: 400 });
    }

    // 1) tenta na própria categoria
    let trends = await getCategoryTrends(category);

    // 2) se vazio e climb=1, sobe a árvore até achar algo
    if (climb && trends.length === 0) {
      const ancestors = await getCategoryAncestors(category); // do root ao atual
      for (let i = ancestors.length - 2; i >= 0; i--) {
        trends = await getCategoryTrends(ancestors[i].id);
        if (trends.length > 0) break;
      }
    }

    return NextResponse.json({ category, trends });
  } catch (e: any) {
    console.error('GET /api/ml/trends error:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
