/**
 * Měření poptávek — co se smí odeslat a co se nesmí.
 *
 * Dvě věci, na kterých to stojí: bez souhlasu s cookies se neodesílá
 * nic (a to i poté, co host souhlas odvolá se stránkou už načtenou),
 * a do analytiky nesmí osobní údaje.
 */
const ulozky = { local: new Map(), session: new Map() };
const uloziste = (mapa) => ({
  getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
  setItem: (k, v) => mapa.set(k, String(v)),
  removeItem: (k) => mapa.delete(k),
});

globalThis.localStorage = uloziste(ulozky.local);
globalThis.sessionStorage = uloziste(ulozky.session);
globalThis.document = { referrer: '', addEventListener() {} };
globalThis.window = {
  location: { href: 'https://umustku.cz/', hostname: 'umustku.cz' },
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
};

const { posliUdalost, merFormular, zapamatujZdroj, mistoOdkazu } =
  await import('../src/utils/mereni.js');

let chyb = 0;
const overit = (popis, skutecnost, ocekavani) => {
  if (JSON.stringify(skutecnost) !== JSON.stringify(ocekavani)) {
    chyb++; console.log(`    ✗ ${popis}: je ${JSON.stringify(skutecnost)}, má být ${JSON.stringify(ocekavani)}`);
  }
};

const odchycene = [];
globalThis.window.gtag = (typ, nazev, parametry) => odchycene.push({ typ, nazev, parametry });

const souhlas = (ano) =>
  localStorage.setItem('hotel_cookie_consent_v1', JSON.stringify({ analytics: ano }));

// --- bez souhlasu se neodesílá nic ------------------------------------
overit('bez uloženého souhlasu', posliUdalost('klik_telefon', {}), false);
souhlas(false);
overit('odmítnutý souhlas', posliUdalost('klik_telefon', {}), false);
overit('nic se neodeslalo', odchycene.length, 0);

// Souhlas odvolaný za běhu: `window.gtag` v paměti stránky zůstává,
// takže se stav musí číst při KAŽDÉ události, ne jednou při startu.
souhlas(true);
overit('se souhlasem projde', posliUdalost('klik_telefon', { misto: 'paticka' }), true);
souhlas(false);
overit('po odvolání hned přestane', posliUdalost('klik_telefon', {}), false);
overit('odeslala se jen jedna událost', odchycene.length, 1);
overit('název události', odchycene[0].nazev, 'klik_telefon');
overit('místo se posílá jako parametr', odchycene[0].parametry.misto, 'paticka');

// --- zdroj návštěvy ----------------------------------------------------
const zjistiZdroj = (adresa, referrer) => {
  ulozky.session.clear();
  globalThis.window.location = { href: adresa, hostname: 'umustku.cz' };
  globalThis.document.referrer = referrer || '';
  return zapamatujZdroj();
};

overit('utm_source', zjistiZdroj('https://umustku.cz/?utm_source=leták', ''), 'leták');
overit('utm s kampaní', zjistiZdroj('https://umustku.cz/?utm_source=facebook&utm_campaign=zima', ''), 'Facebook (zima)');
overit('odkaz z Facebooku', zjistiZdroj('https://umustku.cz/', 'https://l.facebook.com/x'), 'Facebook');
overit('odkaz z Googlu', zjistiZdroj('https://umustku.cz/', 'https://www.google.com/search?q=hotel'), 'Google');
overit('neznámý web zůstane doménou', zjistiZdroj('https://umustku.cz/', 'https://jizerky-info.cz/a'), 'jizerky-info.cz');
// Proklik uvnitř webu není zdroj návštěvy — jinak by u každé poptávky
// stálo, že přišla z našeho vlastního webu.
overit('vlastní web se nepočítá', zjistiZdroj('https://umustku.cz/kontakt', 'https://umustku.cz/'), '');
overit('přímá návštěva', zjistiZdroj('https://umustku.cz/', ''), '');
// První dotyk platí i po prokliku dál po webu.
zjistiZdroj('https://umustku.cz/?utm_source=instagram', '');
globalThis.window.location = { href: 'https://umustku.cz/kontakt', hostname: 'umustku.cz' };
globalThis.document.referrer = 'https://umustku.cz/';
overit('zdroj se při prokliku nepřepíše', zapamatujZdroj(), 'Instagram');

// Dlouhá hodnota se ořízne, ať se do pole nedá propašovat stránka textu.
overit('délka zdroje', zjistiZdroj(`https://umustku.cz/?utm_source=${'a'.repeat(300)}`, '').length, 60);

// --- formulář ----------------------------------------------------------
odchycene.length = 0;
souhlas(true);
zjistiZdroj('https://umustku.cz/?utm_source=seznam', '');
merFormular('kontakt', 'zprava');
overit('událost formuláře', odchycene[0].nazev, 'odeslani_formulare');
overit('parametry formuláře', odchycene[0].parametry, { formular: 'kontakt', tema: 'zprava', zdroj: 'Seznam' });
merFormular('rezervace');
overit('bez tématu jde neutrální hodnota', odchycene[1].parametry.tema, 'neuvedeno');

// Do analytiky nesmí osobní údaje — parametry nesou jen to, co se stalo.
const vsechnyHodnoty = odchycene.flatMap(u => Object.values(u.parametry || {})).join(' ');
overit('žádný zavináč v parametrech', /@/.test(vsechnyHodnoty), false);
overit('žádné telefonní číslo v parametrech', /\+?\d{9}/.test(vsechnyHodnoty), false);

// --- místo odkazu ------------------------------------------------------
const prvek = (predci) => ({ closest: (vyber) => (predci.some(p => vyber.includes(p)) ? {} : null) });
overit('odkaz v patičce', mistoOdkazu(prvek(['footer'])), 'paticka');
overit('odkaz v hlavičce', mistoOdkazu(prvek(['header'])), 'hlavicka');
overit('odkaz v textu', mistoOdkazu(prvek(['article'])), 'obsah');
overit('bez prvku', mistoOdkazu(null), 'obsah');

process.exit(chyb ? 1 : 0);
