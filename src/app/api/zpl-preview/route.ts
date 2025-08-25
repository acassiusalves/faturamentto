
export const runtime = 'nodejs'; // garante Node

export async function POST(req: Request) {
  const zpl = await req.text();
  if (!zpl || !zpl.trim()) {
    return new Response('ZPL vazio', { status: 400 });
  }

  // chame o Labelary via HTTPS do servidor
  const upstream = await fetch(
    'https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/',
    {
      method: 'POST',
      headers: { Accept: 'image/png' }, // queremos PNG
      body: zpl,                        // ZPL cru, sem url-encode
    }
  );

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(JSON.stringify({ error: text || upstream.statusText }), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Encaminha o stream direto para o cliente
  return new Response(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'image/png',
      'cache-control': 'no-store',
    },
  });
}
