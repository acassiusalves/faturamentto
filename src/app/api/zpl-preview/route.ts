
export const runtime = 'nodejs'; // garante fetch server-side

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
    const textIfError = await upstream.text();
    return new Response(
      JSON.stringify({ error: textIfError || upstream.statusText }),
      { status: upstream.status, headers: { 'content-type': 'application/json' } }
    );
  }

  // reenvia a imagem para o cliente
  const buf = Buffer.from(await upstream.arrayBuffer());
  return new Response(buf, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'no-store',
    },
  });
}
