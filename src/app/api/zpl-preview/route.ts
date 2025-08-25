export const runtime = 'nodejs';

export async function POST(req: Request) {
  const zpl = await req.text();
  if (!zpl || !zpl.trim()) {
    return new Response('ZPL vazio', { status: 400 });
  }

  const upstream = await fetch(
    'https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/',
    {
      method: 'POST',
      headers: {
        Accept: 'image/png',
        // 👉 este header é o que falta
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      // Corpo é o ZPL cru mesmo (sem JSON, sem chave/valor)
      body: zpl,
    }
  );

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return new Response(
      JSON.stringify({ error: text || upstream.statusText }),
      { status: upstream.status, headers: { 'content-type': 'application/json' } }
    );
  }

  // retorna a imagem para o cliente
  const buf = Buffer.from(await upstream.arrayBuffer());
  return new Response(buf, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'no-store',
    },
  });
}
