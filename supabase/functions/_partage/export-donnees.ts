const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTETES_PRIVEES = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

export async function servirExport(
  requete: Request,
  lire: (jeton: string) => Promise<string | null>,
): Promise<Response> {
  if (requete.method !== 'GET') {
    return new Response(null, {
      status: 405,
      headers: { ...ENTETES_PRIVEES, Allow: 'GET' },
    });
  }

  const jeton = new URL(requete.url).searchParams.get('jeton');
  if (!jeton || !UUID.test(jeton)) {
    return new Response(null, { status: 404, headers: ENTETES_PRIVEES });
  }

  try {
    const fichier = await lire(jeton);
    if (fichier === null) return new Response(null, { status: 404, headers: ENTETES_PRIVEES });
    return new Response(fichier, {
      headers: {
        ...ENTETES_PRIVEES,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="myfavcoach-donnees.json"',
      },
    });
  } catch {
    return new Response(null, { status: 503, headers: ENTETES_PRIVEES });
  }
}
