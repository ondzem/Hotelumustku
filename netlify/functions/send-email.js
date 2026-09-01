/**
 * Odesílání e-mailů přes Resend — běží NA SERVERU.
 *
 * Důvod: API klíč nesmí být v kódu, který se posílá do prohlížeče.
 * Dřív byl klíč natvrdo v src/utils/emailService.js a skončil
 * v souboru dist/assets/main-*.js, tedy u každého návštěvníka.
 *
 * Klíč se nastavuje v Netlify → Site settings → Environment variables
 * pod názvem RESEND_API_KEY (BEZ předpony VITE_, jinak by se opět
 * zabalil do klientského balíčku).
 */

/**
 * Skutečné hodnoty, které aplikace posílá — vytaženo z volání sendEmail
 * v src/. Když sem přidáš nový typ zprávy, musí přibýt i do tohoto
 * seznamu, jinak ji funkce odmítne se stavem 400.
 */
const POVOLENE_TYPY = new Set([
  'email_1_request_received',
  'email_1_reception_notification',
  'email_2_approval_payment_request',
  'email_3_final_confirmation',
  'email_cancellation',
  'email_cancellation_refund',
  'email_payment_expired',
  'contact_form_message',
  'new_review_notification',
  'test'
]);

/**
 * Komu který typ zprávy smí odejít.
 *
 * Tohle je jádro zabezpečení. Příjemce, předmět i HTML se berou
 * z požadavku, takže bez tohohle rozdělení je funkce otevřená pošta:
 * kdokoli, kdo projde kontrolou původu, může poslat komukoli cokoli
 * z ověřené domény hotelu. Origin se přitom dá z jiného než
 * prohlížečového klienta nastavit libovolně — spoléhat se na něj samotný
 * nejde.
 *
 * - HOTELU: příjemce se PŘEPÍŠE na recepci, ať si volající napsal cokoli.
 * - HOSTOVI: musí přijít kód rezervace a adresa musí sedět s tou, která
 *   je u rezervace v databázi. Poslat spam cizímu člověku by tedy
 *   znamenalo, že si ten člověk u hotelu nejdřív zarezervoval pobyt.
 */
const PRIJEMCE_HOTEL = new Set([
  'email_1_reception_notification',
  'contact_form_message',
  'new_review_notification',
]);

const PRIJEMCE_HOST = new Set([
  'email_1_request_received',
  'email_2_approval_payment_request',
  'email_3_final_confirmation',
  'email_cancellation',
  'email_cancellation_refund',
  'email_payment_expired',
]);

const ODESILATELE = [
  'Hotel u Můstku <hotel@umustku.cz>',
  'Hotel u Můstku <onboarding@resend.dev>'
];

// Kam chodí upozornění pro recepci a kam se pošta přesměruje, když ji
// Resend nepustí na cizí adresu. Musí sedět s RECEPCE_PRIJEMCE
// v src/utils/emailService.js — mění se to na obou místech naráz.
const RECEPCE = 'hotel@umustku.cz';

/**
 * Netlify Functions v2 vyžaduje vrácení standardního objektu Response,
 * NE staršího tvaru { statusCode, body }. Při záměně vrátí server chybu.
 */
function odpoved(status, telo) {
  return new Response(JSON.stringify(telo), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Adresa se vkládá do HTML e-mailu pro recepci, takže se musí escapovat.
 * Kontrola `jeEmail` zakazuje mezery, ale ne lomené závorky — adresa
 * jako `a<svg/onload=…>@b.cz` jí projde a skončila by recepčnímu
 * v poštovní schránce jako značka, ne jako text.
 */
function escapujText(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jeEmail(hodnota) {
  return typeof hodnota === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(hodnota.trim());
}

/**
 * Odkud smí volání přijít.
 *
 * Bez téhle kontroly byla funkce otevřená pošta pro kohokoli: příjemce,
 * předmět i HTML tělo se berou z požadavku, takže kdokoli mohl rozesílat
 * libovolné e-maily z ověřené domény hotelu. Kromě vyčerpaného limitu
 * Resendu je hlavní škoda pověst domény — jakmile se z ní rozešle spam,
 * začne veškerá pošta hotelu padat příjemcům do spamu.
 */
const POVOLENE_ZDROJE = [
  /^https:\/\/([a-z0-9-]+\.)*umustku\.cz$/i,
  // Jen tenhle web a jeho náhledy nasazení. Dřív tu bylo obecné
  // `[a-z0-9-]+\.netlify\.app`, jenže takovou adresu si zadarmo pořídí
  // kdokoli — stačilo nasadit vlastní stránku a rozesílat z domény hotelu.
  /^https:\/\/([a-z0-9-]+--)?papaya-travesseiro-6b341e\.netlify\.app$/i,
  /^http:\/\/localhost(:\d+)?$/i,
];

function zdrojJePovoleny(request) {
  const origin = request.headers.get('origin');
  // Chybějící Origin se DŘÍV pouštěl. Jenže hlavičku posílá jen
  // prohlížeč — curl a jakýkoli skript ji prostě vynechá, takže se tím
  // dala celá kontrola obejít jedním příkazem. Prohlížeč ji u požadavku
  // z našeho webu pošle vždycky, takže se o nic nepřijde.
  if (!origin) return false;
  return POVOLENE_ZDROJE.some(v => v.test(origin));
}

/**
 * Ověří, že adresa opravdu patří k té rezervaci.
 *
 * Čte se servisním klíčem, protože veřejný klíč e-maily hostů schválně
 * nevidí (viz oddíl o oprávněních na sloupce v CLAUDE.md).
 */
async function adresaPatriKRezervaci(kod, adresa) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const klic = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !klic) {
    console.error('Chybí VITE_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY — nelze ověřit rezervaci.');
    return false;
  }
  if (!kod || !/^[A-Za-z0-9-]{4,40}$/.test(String(kod))) return false;

  try {
    const r = await fetch(
      `${url}/rest/v1/reservations?select=guest_email&code=eq.${encodeURIComponent(kod)}`,
      { headers: { apikey: klic, Authorization: `Bearer ${klic}` } }
    );
    if (!r.ok) return false;
    const radky = await r.json();
    if (!Array.isArray(radky) || radky.length === 0) return false;
    const ulozena = String(radky[0].guest_email || '').trim().toLowerCase();
    return ulozena !== '' && ulozena === String(adresa).trim().toLowerCase();
  } catch (e) {
    console.error('Ověření rezervace selhalo:', e);
    return false;
  }
}

/**
 * Zkušební e-maily smí posílat jen přihlášená recepce.
 *
 * Typ `test` obchází obě pravidla výš (příjemce si volí odesílatel),
 * takže musí být za přihlášením — jinak by to byla ta samá díra.
 */
async function jePrihlasenaRecepce(request) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const hlavicka = request.headers.get('authorization') || '';
  const token = hlavicka.startsWith('Bearer ') ? hlavicka.slice(7).trim() : '';
  if (!url || !anon || !token) return false;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return false;
    const u = await r.json();
    return Boolean(u && u.id);
  } catch (e) {
    return false;
  }
}

/**
 * Hrubé omezení počtu zpráv. Paměť funkce se sdílí jen v rámci jedné
 * instance, takže to není neprůstřelné — ale zastaví to hromadnou
 * rozesílku z jednoho místa, což je ten reálný scénář.
 */
const historie = new Map();
const OKNO_MS = 60 * 1000;
const MAX_ZA_OKNO = 5;

function prekrocilLimit(request) {
  const ip = request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('x-forwarded-for')
    || 'neznamy';
  const ted = Date.now();
  const casy = (historie.get(ip) || []).filter(t => ted - t < OKNO_MS);
  casy.push(ted);
  historie.set(ip, casy);
  if (historie.size > 500) {
    for (const [k, v] of historie) if (!v.some(t => ted - t < OKNO_MS)) historie.delete(k);
  }
  return casy.length > MAX_ZA_OKNO;
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return odpoved(405, { error: 'Povolena je jen metoda POST.' });
  }

  if (!zdrojJePovoleny(request)) {
    return odpoved(403, { error: 'Nepovolený zdroj požadavku.' });
  }

  if (prekrocilLimit(request)) {
    return odpoved(429, { error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' });
  }

  const klic = process.env.RESEND_API_KEY;
  if (!klic) {
    console.error('CHYBÍ proměnná RESEND_API_KEY v prostředí Netlify.');
    return odpoved(500, { error: 'Odesílání e-mailů není nastavené.' });
  }

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return odpoved(400, { error: 'Neplatný obsah požadavku.' });
  }

  const { to, subject, html, type, reservationCode } = data || {};

  // Kontrola vstupů — funkce je veřejně dostupná, nesmí sloužit
  // k rozesílání libovolné pošty cizím lidem.
  if (!jeEmail(to)) return odpoved(400, { error: 'Neplatný příjemce.' });
  if (!subject || typeof subject !== 'string' || subject.length > 250) {
    return odpoved(400, { error: 'Neplatný předmět.' });
  }
  if (!html || typeof html !== 'string' || html.length > 200000) {
    return odpoved(400, { error: 'Neplatný obsah.' });
  }
  // Typ je POVINNÝ. Dřív byl volitelný, jenže bez něj se nedá rozhodnout,
  // komu smí zpráva odejít — a právě to je jediná skutečná zábrana.
  if (!type || !POVOLENE_TYPY.has(type)) {
    return odpoved(400, { error: 'Neznámý typ zprávy.' });
  }

  // Komu to nakonec půjde. Volající si příjemce NEURČUJE.
  let prijemce;
  if (PRIJEMCE_HOTEL.has(type)) {
    // Zpráva pro hotel — adresa se přepíše, ať přišlo cokoli.
    prijemce = RECEPCE;
  } else if (PRIJEMCE_HOST.has(type)) {
    // Zpráva hostovi — musí sedět s rezervací, která opravdu existuje.
    if (!await adresaPatriKRezervaci(reservationCode, to)) {
      console.warn('Odmítnuto: adresa nesedí s rezervací', { type, reservationCode });
      return odpoved(403, { error: 'Adresu se nepodařilo ověřit proti rezervaci.' });
    }
    prijemce = to;
  } else {
    // Zbývá jen `test` — ten si příjemce volí, takže musí být za přihlášením.
    if (!await jePrihlasenaRecepce(request)) {
      return odpoved(401, { error: 'Zkušební e-maily může posílat jen přihlášená recepce.' });
    }
    prijemce = to;
  }

  const poslat = async (odesilatel, prijemce, predmet, telo) => {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${klic}`
      },
      body: JSON.stringify({ from: odesilatel, to: [prijemce], subject: predmet, html: telo })
    });
    let vysledek = null;
    const typObsahu = r.headers.get('content-type') || '';
    if (typObsahu.includes('application/json')) vysledek = await r.json();
    return vysledek;
  };

  // 1) běžné odeslání — zkusí ověřenou doménu, pak testovací
  for (const odesilatel of ODESILATELE) {
    try {
      const v = await poslat(odesilatel, prijemce, subject, html);
      if (v && v.id) {
        return odpoved(200, { id: v.id, status: 'delivered' });
      }
      const zprava = v && v.message ? String(v.message) : '';
      const jeOmezeniDomeny = zprava.includes('only send testing emails')
        || zprava.includes('validation_error')
        || zprava.includes('domain is not verified');

      // 2) Resend zatím nepustí e-mail na cizí adresu → přepošli na recepci
      if (jeOmezeniDomeny && prijemce !== RECEPCE) {
        const upozorneni = `
          <div style="background:#fff3cd;color:#856404;padding:14px 18px;border:1px solid #ffeeba;margin-bottom:20px;font-family:sans-serif;font-size:14px;line-height:1.5;">
            ⚠️ <strong>Upozornění systému Hotel u Můstku:</strong> Tento e-mail byl doručen na recepci, protože adresa <strong>${escapujText(prijemce)}</strong> zatím vyžaduje dokončení ověření domény v Resend.
          </div>${html}`;
        const zaloha = await poslat(
          'Hotel u Můstku <onboarding@resend.dev>',
          RECEPCE,
          `[Určeno pro: ${prijemce}] ${subject}`,
          upozorneni
        );
        if (zaloha && zaloha.id) {
          return odpoved(200, {
            id: zaloha.id,
            status: 'delivered_to_reception',
            note: `Doručeno na recepci (cílový klient: ${prijemce})`
          });
        }
      }
    } catch (err) {
      console.error('Chyba při odesílání přes Resend:', err && err.message);
    }
  }

  return odpoved(502, { error: 'E-mail se nepodařilo odeslat.' });
}
