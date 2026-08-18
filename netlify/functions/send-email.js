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
  'email_payment_expired',
  'contact_form_message',
  'new_review_notification',
  'test'
]);

const ODESILATELE = [
  'Hotel u Můstku <hotel@umustku.cz>',
  'Hotel u Můstku <onboarding@resend.dev>'
];

// Kam se pošta přesměruje, když ji Resend ještě nepustí na cizí adresu
// (doména se teprve ověřuje). Musí sedět s RECEPCE_PRIJEMCE
// v src/utils/emailService.js — až začne fungovat hotel@umustku.cz,
// přepíše se to na obou místech.
const RECEPCE = 'ondra.zeman05@gmail.com';

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
  /^https:\/\/([a-z0-9-]+--)?papaya-travesseiro-6b341e\.netlify\.app$/i,
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/i,   // náhledy nasazení
  /^http:\/\/localhost(:\d+)?$/i,
];

function zdrojJePovoleny(request) {
  const origin = request.headers.get('origin');
  // Volání ze stejného webu bez hlavičky Origin (např. serverové) pustíme,
  // cizí prohlížeč Origin vždycky posílá.
  if (!origin) return true;
  return POVOLENE_ZDROJE.some(v => v.test(origin));
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

  const { to, subject, html, type } = data || {};

  // Kontrola vstupů — funkce je veřejně dostupná, nesmí sloužit
  // k rozesílání libovolné pošty cizím lidem.
  if (!jeEmail(to)) return odpoved(400, { error: 'Neplatný příjemce.' });
  if (!subject || typeof subject !== 'string' || subject.length > 250) {
    return odpoved(400, { error: 'Neplatný předmět.' });
  }
  if (!html || typeof html !== 'string' || html.length > 200000) {
    return odpoved(400, { error: 'Neplatný obsah.' });
  }
  if (type && !POVOLENE_TYPY.has(type)) {
    return odpoved(400, { error: 'Neznámý typ zprávy.' });
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
      const v = await poslat(odesilatel, to, subject, html);
      if (v && v.id) {
        return odpoved(200, { id: v.id, status: 'delivered' });
      }
      const zprava = v && v.message ? String(v.message) : '';
      const jeOmezeniDomeny = zprava.includes('only send testing emails')
        || zprava.includes('validation_error')
        || zprava.includes('domain is not verified');

      // 2) Resend zatím nepustí e-mail na cizí adresu → přepošli na recepci
      if (jeOmezeniDomeny && to !== RECEPCE) {
        const upozorneni = `
          <div style="background:#fff3cd;color:#856404;padding:14px 18px;border:1px solid #ffeeba;margin-bottom:20px;font-family:sans-serif;font-size:14px;line-height:1.5;">
            ⚠️ <strong>Upozornění systému Hotel u Můstku:</strong> Tento e-mail byl doručen na recepci, protože adresa <strong>${to}</strong> zatím vyžaduje dokončení ověření domény v Resend.
          </div>${html}`;
        const zaloha = await poslat(
          'Hotel u Můstku <onboarding@resend.dev>',
          RECEPCE,
          `[Určeno pro: ${to}] ${subject}`,
          upozorneni
        );
        if (zaloha && zaloha.id) {
          return odpoved(200, {
            id: zaloha.id,
            status: 'delivered_to_reception',
            note: `Doručeno na recepci (cílový klient: ${to})`
          });
        }
      }
    } catch (err) {
      console.error('Chyba při odesílání přes Resend:', err && err.message);
    }
  }

  return odpoved(502, { error: 'E-mail se nepodařilo odeslat.' });
}
