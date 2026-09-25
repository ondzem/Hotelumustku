/**
 * MĚŘENÍ POPTÁVEK
 *
 * Běžná analytika řekne, kolik lidí na web přišlo. Neřekne, kolik z nich
 * se ozvalo. Měří se proto jen tři okamžiky, kdy z návštěvníka bude
 * poptávka: odeslaný formulář, klik na telefon, klik na e-mail. Nic
 * dalšího — scrolly a zobrazení sekcí nikdo nikdy neotevře.
 *
 * Všechno vede přes `posliUdalost()`. Kdyby se GA4 vyměnilo za něco
 * jiného, mění se jedno místo, ne deset volání roztroušených po kódu.
 *
 * Osobní údaje se do analytiky NEPOSÍLAJÍ. Jméno, e-mail, telefon ani
 * text zprávy tu nemají co dělat — do GA4 jde jen to, co se stalo.
 */

/**
 * Musí sedět s `COOKIE_CONSENT_KEY` v `main.js`.
 *
 * Schválně se to nesdílí importem: `main.js` je vstupní soubor, který si
 * tenhle modul načítá, a kruhový import by v balíčku znamenal, že je
 * konstanta při prvním volání ještě nedefinovaná.
 */
const KLIC_SOUHLASU = 'hotel_cookie_consent_v1';

/** Délka hodnoty zdroje. Ať se do pole nedá propašovat stránka textu. */
const MAX_DELKA_ZDROJE = 60;

const KLIC_ZDROJE = 'hotel_zdroj_navstevy_v1';

/**
 * Smí se teď měřit?
 *
 * Ptá se při KAŽDÉ události, ne jen jednou při startu. GA4 se sice
 * načítá až po souhlasu, ale `window.gtag` po odvolání souhlasu
 * v paměti stránky zůstane — bez téhle kontroly by se měřilo dál,
 * dokud host stránku neobnoví.
 */
function smiSeMerit() {
  try {
    const ulozeno = localStorage.getItem(KLIC_SOUHLASU);
    return Boolean(ulozeno && JSON.parse(ulozeno).analytics);
  } catch (e) {
    return false;
  }
}

/**
 * Odešle událost do analytiky, pokud je k dispozici a je souhlas.
 *
 * Když analytika není, neudělá se nic — žádná výjimka, žádný zápis do
 * konzole. Web se musí chovat úplně stejně jako bez měření.
 */
export function posliUdalost(nazev, parametry = {}) {
  try {
    if (!smiSeMerit()) return false;
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return false;
    window.gtag('event', nazev, parametry);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Kde na stránce ten odkaz je.
 *
 * Kvůli tomu se to celé měří: jestli lidé volají z lišty nahoře, nebo
 * až když text dočtou. Pozná se to z toho, v čem je odkaz vnořený —
 * ruční značky u jednotlivých odkazů by se vždycky někde zapomněly.
 */
export function mistoOdkazu(prvek) {
  if (!prvek || !prvek.closest) return 'obsah';
  if (prvek.closest('header, .site-header, .mobile-menu, .mobile-nav')) return 'hlavicka';
  if (prvek.closest('footer, .site-footer')) return 'paticka';
  if (prvek.closest('.floating-contact, .sticky-contact, .kontakt-plovouci')) return 'plovouci';
  if (prvek.closest('#kontakt, .contact-section, .contact-info')) return 'sekce-kontakt';
  return 'obsah';
}

/**
 * Jeden posluchač na celý dokument.
 *
 * Odkazy se poznají samy podle `tel:` a `mailto:`, takže měření chytí
 * i ty, které teprve vzniknou — v obsahu z administrace, v šabloně
 * vykreslené při přechodu mezi stránkami i v patičce, která se
 * překresluje.
 */
export function initMereniKontaktu() {
  if (typeof document === 'undefined' || window.__mereniKontaktuNavazano) return;
  window.__mereniKontaktuNavazano = true;

  document.addEventListener('click', (e) => {
    const odkaz = e.target && e.target.closest ? e.target.closest('a[href^="tel:"], a[href^="mailto:"]') : null;
    if (!odkaz) return;

    const jeTelefon = odkaz.getAttribute('href').startsWith('tel:');
    posliUdalost(jeTelefon ? 'klik_telefon' : 'klik_email', {
      misto: mistoOdkazu(odkaz),
      // Zdroj se přikládá i ke kliku, jinak by u telefonátů nešlo
      // poznat, co člověka na web přivedlo — a to je většina poptávek.
      zdroj: zdrojNavstevy() || 'primy',
    });
  }, true);
}

/**
 * Převodník na lidský název. „l.facebook.com" nikomu nic neřekne.
 *
 * Co tu není, projde beze změny — ať je v e-mailu vidět aspoň doména.
 */
// Vzory sedí na obojí: na doménu z referreru (`l.facebook.com`) i na
// holý název z `utm_source` (`facebook`), protože do odkazů na letáky
// a profily se píše to druhé.
const NAZVY_ZDROJU = [
  [/^facebook$|facebook\.com$/, 'Facebook'],
  [/^instagram$|instagram\.com$/, 'Instagram'],
  [/^gemini$|gemini\.google\.com$/, 'Gemini'],
  [/^google$|(^|\.)google\./, 'Google'],
  [/^seznam$|seznam\.cz$/, 'Seznam'],
  [/^bing$|bing\.com$/, 'Bing'],
  [/^duckduckgo$|duckduckgo\.com$/, 'DuckDuckGo'],
  [/^youtube$|youtube\.com$|youtu\.be$/, 'YouTube'],
  [/^booking$|booking\.com$/, 'Booking.com'],
  [/^firmy$|firmy\.cz$/, 'Firmy.cz'],
  [/^mapy$|mapy\.cz$/, 'Mapy.cz'],
  [/^tripadvisor$|tripadvisor\./, 'TripAdvisor'],
  [/^chatgpt$|chatgpt\.com$|openai\.com$/, 'ChatGPT'],
  [/^perplexity$|perplexity\.ai$/, 'Perplexity'],
  [/^claude$|claude\.ai$/, 'Claude'],
];

function lidskyNazev(zdroj) {
  const cisty = String(zdroj || '').trim().toLowerCase().replace(/^www\./, '');
  if (!cisty) return '';
  const nalez = NAZVY_ZDROJU.find(([vzor]) => vzor.test(cisty));
  return (nalez ? nalez[1] : zdroj).slice(0, MAX_DELKA_ZDROJE);
}

/**
 * Odkud host přišel. Platí PRVNÍ dotek, ne poslední stránka.
 *
 * Uloží se na dobu návštěvy (`sessionStorage`) a při dalším prokliku po
 * webu se nepřepisuje — jinak by u každé poptávky stálo, že přišla
 * z našeho vlastního webu.
 *
 * Ukládání může selhat (soukromé okno, zablokované úložiště), proto se
 * hodnota vrací i tak a formulář se odešle i bez zdroje.
 */
export function zapamatujZdroj() {
  try {
    const ulozeny = sessionStorage.getItem(KLIC_ZDROJE);
    if (ulozeny) return ulozeny;
  } catch (e) { /* úložiště nejde číst — pokračuje se bez paměti */ }

  let zdroj = '';
  try {
    const adresa = new URL(window.location.href);
    const utmZdroj = adresa.searchParams.get('utm_source');
    const utmKampan = adresa.searchParams.get('utm_campaign');
    if (utmZdroj) {
      zdroj = lidskyNazev(utmZdroj) + (utmKampan ? ` (${String(utmKampan).slice(0, 30)})` : '');
    } else if (document.referrer) {
      const odkud = new URL(document.referrer).hostname;
      // Proklik uvnitř webu není zdroj návštěvy.
      if (odkud && odkud !== window.location.hostname) zdroj = lidskyNazev(odkud);
    }
  } catch (e) { /* rozbitá adresa nebo referrer — zdroj zůstane prázdný */ }

  zdroj = String(zdroj).slice(0, MAX_DELKA_ZDROJE);
  try { sessionStorage.setItem(KLIC_ZDROJE, zdroj); } catch (e) { /* nevadí */ }
  return zdroj;
}

/** Zapamatovaný zdroj návštěvy; prázdný řetězec, když se nezjistil. */
export function zdrojNavstevy() {
  try {
    const ulozeny = sessionStorage.getItem(KLIC_ZDROJE);
    if (ulozeny !== null) return ulozeny;
  } catch (e) { /* čte se znovu níž */ }
  return zapamatujZdroj();
}

/**
 * Odeslaný formulář. Volá se až tam, kde je jisté, že zápis PROŠEL —
 * ne na kliknutí na tlačítko, jinak by se počítaly i nepovedené pokusy.
 *
 * `tema` říká, o co v poptávce šlo (pokoj, důvod zprávy). Když takový
 * údaj není, pošle se neutrální hodnota, ať se s tím dá v přehledu
 * pracovat.
 */
export function merFormular(formular, tema = 'neuvedeno') {
  return posliUdalost('odeslani_formulare', {
    formular,
    tema: String(tema || 'neuvedeno').slice(0, MAX_DELKA_ZDROJE),
    zdroj: zdrojNavstevy() || 'primy',
  });
}
