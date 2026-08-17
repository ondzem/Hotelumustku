/**
 * Nahrání fotky aktuality do Supabase Storage — běží NA SERVERU.
 *
 * Proč ne rovnou z prohlížeče: administrace má k dispozici jen veřejný
 * anon klíč. Aby s ním šlo do úložiště zapisovat, muselo by se právo
 * zápisu (a mazání) dát roli `public` — tedy komukoli, kdo si klíč
 * přečte ze zdrojáku stránky. Kdokoli by pak mohl do koše nahrát
 * cokoli nebo smazat hotelu fotky.
 *
 * Zápis proto obstará server servisním klíčem, který se do prohlížeče
 * nikdy nedostane. Návštěvníkům stačí čtení, to koš umožňuje sám tím,
 * že je veřejný.
 *
 * Proměnné se nastavují v Netlify → Site settings → Environment
 * variables: SUPABASE_SERVICE_ROLE_KEY (BEZ předpony VITE_, jinak by ji
 * Vite zabalil do klientského balíčku) a VITE_SUPABASE_URL.
 */

const KOS = 'aktuality-images';
const POVOLENE_TYPY = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BAJTU = 5 * 1024 * 1024; // 5 MB

function odpoved(status, telo) {
  return new Response(JSON.stringify(telo), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return odpoved(405, { error: 'Použijte POST.' });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const klic = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !klic) {
    console.error('Chybí VITE_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY.');
    return odpoved(500, { error: 'Úložiště není nastavené.' });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return odpoved(400, { error: 'Neplatný požadavek.' });
  }

  const contentType = String(data.contentType || 'image/jpeg');
  if (!POVOLENE_TYPY.has(contentType)) {
    return odpoved(400, { error: 'Povolené jsou jen obrázky JPEG, PNG a WebP.' });
  }

  const base64 = String(data.base64 || '').split(',').pop();
  if (!base64) {
    return odpoved(400, { error: 'Chybí obsah fotky.' });
  }

  let bajty;
  try {
    bajty = Buffer.from(base64, 'base64');
  } catch {
    return odpoved(400, { error: 'Fotku se nepodařilo přečíst.' });
  }

  if (bajty.length === 0) return odpoved(400, { error: 'Fotka je prázdná.' });
  if (bajty.length > MAX_BAJTU) {
    return odpoved(413, { error: 'Fotka je větší než 5 MB.' });
  }

  // Jméno souboru si určuje server. Kdyby ho posílal prohlížeč, dalo by
  // se lomítky v názvu zapisovat mimo určený koš.
  const pripona = contentType === 'image/png' ? 'png' : (contentType === 'image/webp' ? 'webp' : 'jpg');
  const nazev = `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${pripona}`;

  try {
    const res = await fetch(`${url}/storage/v1/object/${KOS}/${nazev}`, {
      method: 'POST',
      headers: {
        apikey: klic,
        Authorization: `Bearer ${klic}`,
        'Content-Type': contentType,
        'cache-control': 'public, max-age=31536000, immutable'
      },
      body: bajty
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('Nahrání do úložiště selhalo:', res.status, detail);
      return odpoved(502, { error: 'Fotku se nepodařilo uložit do úložiště.' });
    }

    return odpoved(200, {
      url: `${url}/storage/v1/object/public/${KOS}/${nazev}`
    });
  } catch (err) {
    console.error('Výjimka při nahrávání fotky:', err);
    return odpoved(500, { error: 'Fotku se nepodařilo uložit.' });
  }
}
