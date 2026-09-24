/**
 * Zápis veřejných formulářů — běží NA SERVERU.
 *
 * Proč to nemůže dělat prohlížeč sám:
 * rezervace, recenze i kontaktní zpráva se do Supabase zapisovaly přímo
 * z prohlížeče anonymním klíčem. Ten klíč je vidět ve zdrojáku stránky,
 * takže si ho robot přečte a posílá zápisy rovnou do Supabase REST API —
 * stránku vůbec neotevře. Honeypot ani captcha ve formuláři na to nemají
 * jak dosáhnout, protože se nikdy nevykreslí.
 *
 * Proto vede jediná cesta zápisu přes tuhle funkci: ověří token
 * z Cloudflare Turnstile, teprve pak zapíše servisním klíčem. Anonymnímu
 * klíči se právo zapisovat odebírá (supabase-OCHRANA-BOTU.sql) — bez
 * toho by byla captcha jen ozdoba a zadní vrátka by zůstala otevřená.
 *
 * Proměnné v Netlify → Environment variables (BEZ předpony VITE_):
 *   TURNSTILE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

/** Co všechno jde tímhle vchodem zapsat. */
const POVOLENE_TYPY = new Set(['rezervace', 'recenze', 'zprava']);

const TABULKA = {
  rezervace: 'reservations',
  recenze: 'reviews',
  zprava: 'contact_messages',
};

/**
 * Sloupce, které smí přijít z formuláře.
 *
 * Seznam je tu schválně znovu a nesdílí se s `ALLOWED_SUPABASE_COLUMNS`
 * v `src/lib/supabaseClient.js` — ten filtruje, co posílá NAŠE stránka,
 * kdežto sem chodí i to, co si vymyslí útočník. Kdyby se sdílel, stačilo
 * by ho jednou rozšířit kvůli administraci a otevřel by se i tenhle vchod.
 */
const POVOLENE_SLOUPCE = {
  rezervace: new Set([
    'id', 'code', 'manage_token', 'room_id', 'room_name', 'date_from', 'date_to',
    'adults_count', 'children_count', 'guest_name', 'guest_email', 'guest_phone',
    'guest_note', 'guest_street', 'guest_city', 'guest_zip', 'guest_country', 'guests',
    'has_dog', 'has_ebike', 'ebike_count', 'has_half_board', 'half_board_count',
    'total_price', 'deposit_price', 'remaining_price', 'accommodation_price',
    'city_tax', 'addons_price', 'created_at',
    'has_winter_parking', 'parking_cars_count', 'winter_parking_price_total',
  ]),
  recenze: new Set(['id', 'full_name', 'author_name', 'text', 'date', 'created_at']),
  zprava: new Set(['name', 'surname', 'email', 'phone', 'message']),
};

/**
 * Hodnoty, které NASTAVUJE SERVER, ať si volající poslal cokoli.
 *
 * Tohle je druhá půlka ochrany. I kdyby někdo token obešel, nesmí si
 * zvolit stav: rezervace vždycky čeká na schválení recepcí a recenze na
 * schválení před zveřejněním. Dřív to hlídala jen pravidla v databázi
 * (supabase-ZABEZPECENI-2.sql) — teď to platí na obou místech.
 */
const VYNUCENE = {
  rezervace: { status: 'pending_approval', is_archived: false },
  recenze: { status: 'pending_approval' },
  zprava: { status: 'new' },
};

function odpoved(status, telo) {
  return new Response(JSON.stringify(telo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Odkud smí volání přijít. Stejný seznam jako u send-email — chybějící
 * Origin se NEPOUŠTÍ, protože hlavičku posílá jen prohlížeč a skript ji
 * prostě vynechá.
 */
const POVOLENE_ZDROJE = [
  /^https:\/\/([a-z0-9-]+\.)*umustku\.cz$/i,
  /^https:\/\/([a-z0-9-]+--)?papaya-travesseiro-6b341e\.netlify\.app$/i,
  /^http:\/\/localhost(:\d+)?$/i,
];

function zdrojJePovoleny(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return POVOLENE_ZDROJE.some(v => v.test(origin));
}

function klientskaIP(request) {
  return request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('x-forwarded-for')
    || 'neznamy';
}

/**
 * Hrubé omezení počtu zápisů z jedné adresy. Paměť se sdílí jen v rámci
 * jedné instance funkce, takže to není neprůstřelné — ale zastaví to
 * hromadné vyplňování z jednoho místa, což je ten reálný scénář.
 */
const historie = new Map();
const OKNO_MS = 60 * 1000;
const MAX_ZA_OKNO = 5;

function prekrocilLimit(request) {
  const ip = klientskaIP(request);
  const ted = Date.now();
  const casy = (historie.get(ip) || []).filter(t => ted - t < OKNO_MS);
  casy.push(ted);
  historie.set(ip, casy);
  if (historie.size > 500) {
    for (const [k, v] of historie) if (!v.some(t => ted - t < OKNO_MS)) historie.delete(k);
  }
  return casy.length > MAX_ZA_OKNO;
}

/**
 * Ověří token u Cloudflare.
 *
 * Token je jednorázový a vázaný na jedno vykreslení widgetu, takže se
 * nedá poslat podruhé. `remoteip` se přikládá schválně — Cloudflare tím
 * pozná token přehraný z jiné sítě.
 */
async function tokenJePlatny(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('Chybí TURNSTILE_SECRET_KEY — zápis se odmítá.');
    return false;
  }
  if (!token || typeof token !== 'string') return false;

  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const v = await r.json();
    if (!v.success) console.warn('Turnstile odmítl token:', v['error-codes']);
    return v.success === true;
  } catch (e) {
    console.error('Turnstile nedostupný:', e);
    return false;
  }
}

/**
 * Vyzvedne pořadové číslo rezervace z databáze.
 *
 * Číslo NESMÍ přidělovat prohlížeč: dva hosté odesílající formulář ve
 * stejnou chvíli by dostali tentýž kód a s ním i tentýž variabilní
 * symbol, takže by na účet přišly dvě platby k jedné rezervaci.
 * Posloupnost v Postgresu vydá každému volajícímu jiné číslo.
 */
async function dalsiCisloRezervace(url, klic) {
  const r = await fetch(`${url}/rest/v1/rpc/dalsi_cislo_rezervace`, {
    method: 'POST',
    headers: {
      apikey: klic,
      Authorization: `Bearer ${klic}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!r.ok) {
    console.error('Číslo rezervace se nepodařilo vyzvednout:', r.status, await r.text());
    return null;
  }
  return Number(await r.json());
}

/** Propustí jen povolené sloupce a dosadí hodnoty, které určuje server. */
function ocistiData(typ, data) {
  const zdroj = (data && typeof data === 'object') ? data : {};
  const povolene = POVOLENE_SLOUPCE[typ];
  const radek = {};
  for (const klic of Object.keys(zdroj)) {
    if (povolene.has(klic) && zdroj[klic] !== undefined) radek[klic] = zdroj[klic];
  }
  return { ...radek, ...VYNUCENE[typ] };
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return odpoved(405, { error: 'Povolena je jen metoda POST.' });
  }
  if (!zdrojJePovoleny(request)) {
    return odpoved(403, { error: 'Nepovolený původ požadavku.' });
  }
  if (prekrocilLimit(request)) {
    return odpoved(429, { error: 'Příliš mnoho pokusů. Zkuste to prosím za minutu.' });
  }

  let telo;
  try {
    telo = await request.json();
  } catch (e) {
    return odpoved(400, { error: 'Neplatné tělo požadavku.' });
  }

  const { typ, turnstileToken, data } = telo || {};
  if (!POVOLENE_TYPY.has(typ)) {
    return odpoved(400, { error: 'Neznámý typ formuláře.' });
  }

  if (!(await tokenJePlatny(turnstileToken, klientskaIP(request)))) {
    return odpoved(403, { error: 'Nepodařilo se ověřit, že formulář odeslal člověk. Načtěte stránku znovu a zkuste to prosím ještě jednou.' });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const klic = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !klic) {
    console.error('Chybí VITE_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY.');
    return odpoved(500, { error: 'Server není správně nastavený.' });
  }

  // Rezervaci přiděluje číslo server, ať si volající poslal cokoli.
  let kod = null;
  const radek = ocistiData(typ, data);
  if (typ === 'rezervace') {
    const cislo = await dalsiCisloRezervace(url, klic);
    if (cislo) {
      kod = `HM-${new Date().getFullYear()}-${cislo}`;
      radek.cislo = cislo;
      radek.code = kod;
    }
    // Když posloupnost neodpoví (ještě neproběhla migrace, výpadek),
    // rezervace se přesto uloží s nouzovým kódem z prohlížeče. Odmítnout
    // hosta kvůli číslování by bylo horší než díra v řadě — a ta se
    // dorovná při dalším spuštění `supabase-CISLOVANI-REZERVACI.sql`.
  }

  try {
    const r = await fetch(`${url}/rest/v1/${TABULKA[typ]}`, {
      method: 'POST',
      headers: {
        apikey: klic,
        Authorization: `Bearer ${klic}`,
        'Content-Type': 'application/json',
        // Vložený řádek se schválně nevrací — volající ho nemá proč
        // vidět a u rezervací by to poslalo osobní údaje zpátky do
        // prohlížeče, kde už jednou byly, ale nemá smysl to opakovat.
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([radek]),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error(`Zápis do ${TABULKA[typ]} selhal (${r.status}):`, detail);
      return odpoved(502, { error: 'Zápis se nepodařilo uložit.' });
    }

    // Kód se vrací, protože ho prohlížeč ukazuje hostovi a posílá
    // v e-mailu. Kdyby si nechal ten svůj, četl by host jiné číslo, než
    // je v knize.
    return odpoved(200, kod ? { ok: true, kod } : { ok: true });
  } catch (e) {
    console.error('Výjimka při zápisu formuláře:', e);
    return odpoved(500, { error: 'Zápis se nepodařilo uložit.' });
  }
}
