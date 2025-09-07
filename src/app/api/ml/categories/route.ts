
import { NextResponse } from 'next/server';
import { getRootCategories, getCategoryChildren, getCategoryAncestors } from '@/lib/ml';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parent = searchParams.get('parent'); // se vazio → topo

    if (!parent) {
      const root = await getRootCategories('MLB');
      return NextResponse.json({ level: 'root', categories: root });
    }

    const [ancestors, children] = await Promise.all([
      getCategoryAncestors(parent),
      getCategoryChildren(parent),
    ]);

    return NextResponse.json({
      level: 'children',
      parent,
      ancestors,     // breadcrumb
      categories: children,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
