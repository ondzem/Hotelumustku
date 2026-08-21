// ---------------------------------------------------------------------
//  EXPORT REZERVACÍ A KONTAKTŮ DO TABULKY
//
//  Majitel chce z rezervací občas vytáhnout adresář hostů a poslat jim
//  novinku. Tenhle modul je čistá matematika nad polem rezervací —
//  žádná síť, žádný DOM — takže se dá spustit v Node a protestovat.
//
//  Dvě podoby výstupu, protože slouží dvěma různým věcem:
//
//  - REZERVACE: jeden řádek na rezervaci. Účetní pohled — kdo, kdy,
//    za kolik. Jeden host se tu objeví tolikrát, kolikrát u nás byl.
//  - KONTAKTY: jeden řádek na hosta, s pobyty sečtenými dohromady.
//    Tohle je ten „zlatý důl" na newsletter; posílat jednomu člověku
//    tři maily jen proto, že u nás byl třikrát, je způsob, jak si
//    vysloužit stížnost místo rezervace.
// ---------------------------------------------------------------------

/**
 * Oddělovač je STŘEDNÍK, ne čárka.
 *
 * Excel v české (a vůbec evropské) lokalizaci čte čárku jako desetinnou
 * značku, takže soubor oddělený čárkami naskládá celý řádek do jedné
 * buňky. Středník je to, co Excel v těchhle zemích čeká.
 */
const ODDELOVAC = ';';

/**
 * Značka na začátku souboru (BOM).
 *
 * Bez ní Excel nepozná, že je soubor v UTF-8, a přečte ho v systémovém
 * kódování — z „Němec" se stane „NÄ›mec" a z celého adresáře nepoužitelná
 * změť. Tohle je nejčastější důvod, proč „export nefunguje".
 */
const BOM = '﻿';

/** Rozsahy, které si obsluha vybírá tlačítkem. `null` = bez omezení. */
export const OBDOBI = [
  { id: 'den', popis: 'Dnes', dnu: 1 },
  { id: 'tyden', popis: 'Posledních 7 dní', dnu: 7 },
  { id: 'mesic', popis: 'Posledních 30 dní', dnu: 30 },
  { id: 'kvartal', popis: 'Posledních 90 dní', dnu: 90 },
  { id: 'rok', popis: 'Poslední rok', dnu: 365 },
  { id: 'vse', popis: 'Celá historie', dnu: null },
  { id: 'vlastni', popis: 'Vlastní rozsah', dnu: undefined },
];

/** Datum ve tvaru YYYY-MM-DD, posunuté o daný počet dní zpět. */
export function odectiDny(dnesStr, dnu) {
  const d = new Date(`${dnesStr}T12:00:00`);
  d.setDate(d.getDate() - dnu);
  return d.toISOString().slice(0, 10);
}

/**
 * Podle kterého data se vybírá.
 *
 * Není to jedno a nejde to uhodnout za obsluhu: „kdo si u nás objednal
 * v posledním měsíci" je datum vzniku rezervace, kdežto „kdo u nás
 * v létě bydlel" je datum příjezdu. Na newsletter po sezóně se hodí
 * druhé, na přehled poptávky první.
 */
export const PODLE_DATA = {
  vytvoreni: { klic: 'created_at', popis: 'data vytvoření rezervace' },
  prijezd: { klic: 'date_from', popis: 'data příjezdu' },
};

/** Z „2026-08-21T10:43:00+00:00" i z „2026-08-21" udělá „2026-08-21". */
function jenDatum(hodnota) {
  if (!hodnota) return '';
  return String(hodnota).slice(0, 10);
}

/**
 * Rozdělí „Jan Novák" na jméno a příjmení.
 *
 * Hostům se v celém systému ukládá jedno políčko, ale hromadná pošta
 * potřebuje oslovení („Dobrý den, pane Nováku"), takže se to musí
 * rozdělit tady. Poslední slovo je příjmení, zbytek jméno — u „Jan
 * Novák" i u „Jana Marie Nováková" to vyjde správně.
 */
export function rozdelJmeno(cele) {
  const casti = String(cele || '').trim().split(/\s+/).filter(Boolean);
  if (casti.length === 0) return { jmeno: '', prijmeni: '' };
  if (casti.length === 1) return { jmeno: '', prijmeni: casti[0] };
  return { jmeno: casti.slice(0, -1).join(' '), prijmeni: casti[casti.length - 1] };
}

/** Počet nocí; záporný nebo nulový rozsah vrací 0. */
function pocetNoci(od, doo) {
  if (!od || !doo) return 0;
  const rozdil = (new Date(doo) - new Date(od)) / 86400000;
  return rozdil > 0 ? Math.round(rozdil) : 0;
}

const jeStorno = (r) => Boolean(r.status && (String(r.status).startsWith('cancelled') || r.status === 'stornováno'));
const jeArchiv = (r) => Boolean(r.is_archived || r.isArchived);

const POPIS_STAVU = {
  pending_approval: 'Ke schválení',
  awaiting_deposit: 'Čeká na zálohu',
  confirmed: 'Závazně potvrzeno',
  cancelled: 'Stornováno',
};

/**
 * Vybere rezervace, které do exportu patří.
 *
 * @param {object[]} rezervace celý seznam z administrace
 * @param {object} volby
 * @param {string} volby.od        YYYY-MM-DD včetně, prázdné = bez omezení
 * @param {string} volby.doo       YYYY-MM-DD VČETNĚ (viz níž)
 * @param {string} volby.podleData klíč z PODLE_DATA
 * @param {boolean} volby.zahrnoutArchiv
 * @param {boolean} volby.zahrnoutStorna
 */
export function vyberRezervace(rezervace, { od, doo, podleData = 'vytvoreni', zahrnoutArchiv = true, zahrnoutStorna = false }) {
  const klic = (PODLE_DATA[podleData] || PODLE_DATA.vytvoreni).klic;
  return (rezervace || []).filter((r) => {
    if (!zahrnoutArchiv && jeArchiv(r)) return false;
    if (!zahrnoutStorna && jeStorno(r)) return false;
    const datum = jenDatum(r[klic]);
    if (!datum) return false;
    // Horní mez je tu VČETNĚ, na rozdíl od date_to u rezervací. Obsluha
    // vybírá „od 1. do 31. srpna" a čeká, že jednatřicátý bude uvnitř.
    if (od && datum < od) return false;
    if (doo && datum > doo) return false;
    return true;
  });
}

/** Jeden řádek na rezervaci — účetní pohled. */
export const SLOUPCE_REZERVACE = [
  ['Kód rezervace', (r) => r.code || ''],
  ['Vytvořeno', (r) => jenDatum(r.created_at)],
  ['Jméno', (r) => rozdelJmeno(r.guest_name).jmeno],
  ['Příjmení', (r) => rozdelJmeno(r.guest_name).prijmeni],
  ['Jméno a příjmení', (r) => r.guest_name || ''],
  ['E-mail', (r) => r.guest_email || ''],
  ['Telefon', (r) => r.guest_phone || ''],
  ['Ulice', (r) => r.guest_street || ''],
  ['Město', (r) => r.guest_city || ''],
  ['PSČ', (r) => r.guest_zip || ''],
  ['Země', (r) => r.guest_country || ''],
  ['Pokoj', (r) => r.room_name || r.room_id || ''],
  ['Příjezd', (r) => jenDatum(r.date_from)],
  ['Odjezd', (r) => jenDatum(r.date_to)],
  ['Nocí', (r) => pocetNoci(r.date_from, r.date_to)],
  ['Osob', (r) => Number(r.adults_count) || 0],
  ['Stav', (r) => POPIS_STAVU[r.status] || r.status || ''],
  ['V archivu', (r) => (jeArchiv(r) ? 'ano' : 'ne')],
  ['Celkem Kč', (r) => Number(r.total_price) || 0],
  ['Záloha Kč', (r) => Number(r.deposit_price) || 0],
  ['Doplatek Kč', (r) => Number(r.remaining_price) || 0],
  ['Polopenze', (r) => (r.has_half_board ? 'ano' : 'ne')],
  ['Pes', (r) => (r.has_dog ? 'ano' : 'ne')],
  ['Elektrokolo', (r) => (r.has_ebike ? 'ano' : 'ne')],
  ['Zimní parkování', (r) => (r.has_winter_parking ? 'ano' : 'ne')],
  ['Poznámka', (r) => r.guest_note || ''],
];

/**
 * Sloučí rezervace na jednoho hosta.
 *
 * Klíčem je e-mail (malými písmeny), protože podle něj se rozesílá. Když
 * host e-mail nemá — takové rezervace zakládá recepce po telefonu —
 * použije se jméno a telefon, ať se ručně zapsaní hosté neslijí do
 * jednoho řádku jen proto, že jim chybí adresa.
 */
export function slucKontakty(rezervace) {
  const podleKlice = new Map();

  for (const r of rezervace) {
    const mail = String(r.guest_email || '').trim().toLowerCase();
    const klic = mail || `${String(r.guest_name || '').trim().toLowerCase()}|${String(r.guest_phone || '').trim()}`;
    if (!klic || klic === '|') continue;

    const stavajici = podleKlice.get(klic);
    if (!stavajici) {
      podleKlice.set(klic, {
        guest_name: r.guest_name || '',
        guest_email: r.guest_email || '',
        guest_phone: r.guest_phone || '',
        guest_street: r.guest_street || '',
        guest_city: r.guest_city || '',
        guest_zip: r.guest_zip || '',
        guest_country: r.guest_country || '',
        pobytu: 0,
        noci: 0,
        utraceno: 0,
        prvni: '',
        posledni: '',
        poslednPokoj: '',
      });
    }

    const k = podleKlice.get(klic);
    k.pobytu += 1;
    k.noci += pocetNoci(r.date_from, r.date_to);
    k.utraceno += Number(r.total_price) || 0;

    const prijezd = jenDatum(r.date_from);
    if (prijezd) {
      if (!k.prvni || prijezd < k.prvni) k.prvni = prijezd;
      if (!k.posledni || prijezd > k.posledni) {
        k.posledni = prijezd;
        k.poslednPokoj = r.room_name || r.room_id || '';
        // Novější rezervace nese aktuálnější adresu — host se mohl
        // přestěhovat a starý údaj by se posílal na místo, kde už nebydlí.
        if (r.guest_street) k.guest_street = r.guest_street;
        if (r.guest_city) k.guest_city = r.guest_city;
        if (r.guest_zip) k.guest_zip = r.guest_zip;
        if (r.guest_phone) k.guest_phone = r.guest_phone;
      }
    }
  }

  // Nejčastější hosté nahoře — komu psát nejdřív, je vidět na první pohled.
  return [...podleKlice.values()].sort((a, b) => b.pobytu - a.pobytu || b.utraceno - a.utraceno);
}

/** Jeden řádek na hosta — adresář pro hromadnou poštu. */
export const SLOUPCE_KONTAKT = [
  ['Jméno', (k) => rozdelJmeno(k.guest_name).jmeno],
  ['Příjmení', (k) => rozdelJmeno(k.guest_name).prijmeni],
  ['Jméno a příjmení', (k) => k.guest_name || ''],
  ['E-mail', (k) => k.guest_email || ''],
  ['Telefon', (k) => k.guest_phone || ''],
  ['Ulice', (k) => k.guest_street || ''],
  ['Město', (k) => k.guest_city || ''],
  ['PSČ', (k) => k.guest_zip || ''],
  ['Země', (k) => k.guest_country || ''],
  ['Počet pobytů', (k) => k.pobytu],
  ['Nocí celkem', (k) => k.noci],
  ['Utraceno Kč', (k) => k.utraceno],
  ['První pobyt', (k) => k.prvni],
  ['Poslední pobyt', (k) => k.posledni],
  ['Poslední pokoj', (k) => k.poslednPokoj],
];

/**
 * Uzavře hodnotu do uvozovek, když je potřeba.
 *
 * Escapuje se i případ, kdy text sám začíná uvozovkou, a zdvojují se
 * uvozovky uvnitř — jinak by jedna poznámka s uvozovkou rozhodila
 * všechny sloupce za sebou.
 *
 * Navíc: hodnota začínající na = + - @ se v Excelu vyhodnotí jako
 * VZOREC. Host, který se podepíše „=SUM(...)", tak může do cizího
 * počítače dostat něco, co tam nepatří. Před takovou hodnotu se proto
 * přidává apostrof, který z ní udělá obyčejný text.
 */
export function bunka(hodnota) {
  let text = hodnota === null || hodnota === undefined ? '' : String(hodnota);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/["\n\r;,]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Složí CSV ze seznamu sloupců a řádků. */
export function sestavCSV(sloupce, radky) {
  const hlavicka = sloupce.map(([nazev]) => bunka(nazev)).join(ODDELOVAC);
  const telo = radky.map((r) => sloupce.map(([, ziskej]) => bunka(ziskej(r))).join(ODDELOVAC));
  // CRLF, ne LF — Excel na Windows jiné zalomení v CSV nečeká.
  return BOM + [hlavicka, ...telo].join('\r\n') + '\r\n';
}

/** Název souboru, ať se ve stažených souborech dá vyznat. */
export function nazevSouboru(druh, od, doo) {
  const cast = od || doo ? `_${od || 'zacatek'}_az_${doo || 'dnes'}` : '_cela-historie';
  return `hotel-u-mustku_${druh === 'kontakty' ? 'kontakty' : 'rezervace'}${cast}.csv`;
}

/**
 * Celý export: z rezervací udělá obsah souboru a jeho název.
 *
 * @returns {{obsah: string, nazev: string, radku: number}}
 */
export function pripravExport(rezervace, volby) {
  const vybrane = vyberRezervace(rezervace, volby);
  if (volby.druh === 'kontakty') {
    const kontakty = slucKontakty(vybrane);
    return {
      obsah: sestavCSV(SLOUPCE_KONTAKT, kontakty),
      nazev: nazevSouboru('kontakty', volby.od, volby.doo),
      radku: kontakty.length,
    };
  }
  // Nejnovější nahoře — obsluha hledá to, co se stalo naposled.
  const serazene = [...vybrane].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return {
    obsah: sestavCSV(SLOUPCE_REZERVACE, serazene),
    nazev: nazevSouboru('rezervace', volby.od, volby.doo),
    radku: serazene.length,
  };
}
