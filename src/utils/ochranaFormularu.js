/**
 * OCHRANA VEŘEJNÝCH FORMULÁŘŮ PROTI ROBOTŮM
 *
 * Cloudflare Turnstile vykreslí do formuláře widget a vrátí jednorázový
 * token. Token se pošle spolu s daty do `netlify/functions/zapis-formulare.js`,
 * kde se ověří u Cloudflare — teprve potom se zapisuje do databáze.
 *
 * Proč Turnstile a ne reCAPTCHA: nenastavuje cookies, takže nespadá do
 * cookie lišty ani do souhlasu. reCAPTCHA by souhlas potřebovala a bez
 * něj by se nesměla načíst — formulář by tedy šlo odeslat jen po
 * odkliknutí analytických cookies, což je pro hosta nesmysl.
 *
 * Zásadní je, že token **neověřuje prohlížeč**. Kdyby se kontrolovalo
 * tady, robot ji obejde tím, že pošle požadavek rovnou a stránku vůbec
 * neotevře. Tenhle soubor token jen obstará a přepošle dál.
 */

/**
 * Klíč je veřejný a patří do zdrojáku stránky — chrání až tajný klíč na
 * serveru.
 *
 * Testovací klíč Cloudflare (vždycky projde) se dosazuje JEN ve vývoji.
 * Na produkci schválně ne: kdyby se tam propašoval spolu s testovacím
 * tajným klíčem, všechno by prošlo, formuláře by vypadaly v pořádku
 * a ochrana by přitom nebyla žádná. Takhle se chybějící klíč pozná hned
 * — v konzoli je hláška a widget se nevykreslí.
 *
 * Proměnná se zapéká při SESTAVENÍ, takže musí být v Netlify nastavená
 * dřív, než se web postaví. Přidat ji až potom nestačí, musí se nasadit
 * znovu.
 */
const TESTOVACI_KLIC = '1x00000000000000000000AA';

// `import.meta.env` zná jen Vite. Kontroly v `kontrola/` pouštějí tenhle
// modul v holém Node (přes řetěz importů z printReservationService), kde
// je to undefined a přímý přístup by celý test shodil.
const PROSTREDI = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const SITE_KEY = PROSTREDI.VITE_TURNSTILE_SITE_KEY
  || (PROSTREDI.DEV ? TESTOVACI_KLIC : '');

const ADRESA_SKRIPTU = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let nacitani = null;

/** Načte skript Turnstile jednou za celou relaci. */
function nactiSkript() {
  if (window.turnstile) return Promise.resolve();
  if (nacitani) return nacitani;

  nacitani = new Promise((splneno, selhalo) => {
    const znacka = document.createElement('script');
    znacka.src = ADRESA_SKRIPTU;
    znacka.async = true;
    znacka.defer = true;
    znacka.onload = () => splneno();
    znacka.onerror = () => {
      nacitani = null;
      selhalo(new Error('Turnstile se nepodařilo načíst.'));
    };
    document.head.appendChild(znacka);
  });
  return nacitani;
}

/**
 * Vykreslí widget do zadaného prvku a začne shánět token.
 *
 * Token se ukládá na samotný prvek, ne do proměnné modulu — formulářů
 * je na webu víc a stránky se překreslují, takže by se jedna sdílená
 * proměnná rozešla s tím, co je zrovna na obrazovce.
 *
 * Volá se opakovaně bez obav: už vykreslený widget se přeskočí.
 */
export async function pripravOchranu(prvek) {
  if (!prvek || prvek.dataset.ochranaHotova === '1') return;
  prvek.dataset.ochranaHotova = '1';

  if (!SITE_KEY) {
    console.error('Chybí VITE_TURNSTILE_SITE_KEY — ochrana formulářů se nevykreslí a server zápis odmítne.');
    prvek.dataset.ochranaHotova = '';
    return;
  }

  try {
    await nactiSkript();
  } catch (e) {
    // Když Cloudflare nejede, formulář se nesmí zaseknout — server
    // zápis stejně odmítne a host dostane srozumitelnou hlášku.
    console.error('Ochrana formuláře se nenačetla:', e);
    prvek.dataset.ochranaHotova = '';
    return;
  }

  const id = window.turnstile.render(prvek, {
    sitekey: SITE_KEY,
    language: 'cs',
    action: prvek.dataset.akce || 'formular',
    callback: (token) => { prvek.dataset.token = token; },
    'expired-callback': () => { prvek.dataset.token = ''; },
    'error-callback': () => { prvek.dataset.token = ''; },
  });
  prvek.dataset.widgetId = id;
}

/**
 * Počká na token. Turnstile v režimu Managed obvykle projde sám a bez
 * kliknutí, ale chvíli to trvá — proto se čeká, místo aby se hostovi
 * hned hlásila chyba.
 */
export async function tokenZOchrany(prvek, cekatMs = 15000) {
  if (!prvek) return '';
  // Widget se vůbec nevykreslil (chybí klíč, Cloudflare nejede). Čekat
  // patnáct vteřin na token, který nemá jak vzniknout, by znamenalo, že
  // hostovi po odeslání nic nedělá — chyba se má ukázat hned.
  if (!prvek.dataset.widgetId) return '';
  const konec = Date.now() + cekatMs;
  while (Date.now() < konec) {
    if (prvek.dataset.token) return prvek.dataset.token;
    await new Promise(r => setTimeout(r, 200));
  }
  return '';
}

/**
 * Zahodí použitý token a nechá vygenerovat nový.
 *
 * Token je JEDNORÁZOVÝ — po odeslání ho Cloudflare podruhé neuzná.
 * Bez resetu by druhý pokus (třeba po chybě ve vyplnění) skončil
 * hláškou, že se nepodařilo ověřit, že formulář odeslal člověk.
 */
export function resetOchrany(prvek) {
  if (!prvek || !window.turnstile) return;
  prvek.dataset.token = '';
  try {
    window.turnstile.reset(prvek.dataset.widgetId);
  } catch (e) {
    // Widget mezitím zmizel z DOM (překreslení stránky) — nevadí,
    // při dalším vykreslení se připraví znovu.
  }
}

/**
 * Odešle formulář přes serverovou funkci.
 *
 * @param typ 'rezervace' | 'recenze' | 'zprava'
 * @returns { ok: true } nebo { ok: false, chyba: '…' }
 */
export async function odesliFormular(typ, data, token) {
  try {
    const r = await fetch('/.netlify/functions/zapis-formulare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typ, turnstileToken: token, data }),
    });

    // Tělo odpovědi se vrací celé — u rezervace v něm přijde kód, který
    // právě přidělila databáze (`kod`).
    if (r.ok) {
      const telo = await r.json().catch(() => ({}));
      return { ok: true, ...telo };
    }

    const telo = await r.json().catch(() => ({}));
    return { ok: false, chyba: telo.error || 'Odeslání se nezdařilo.' };
  } catch (e) {
    console.error('Odeslání formuláře selhalo:', e);
    return { ok: false, chyba: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení.' };
  }
}
