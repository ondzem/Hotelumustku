/**
 * MĚSÍČNÍ KALENDÁŘ NAD SEZNAMEM REZERVACÍ — čistá matematika.
 *
 * Slouží rychlému dotazu „co mám na dvacátého šestého": recepční klepne
 * na den a seznam pod kalendářem se na ten den zúží.
 *
 * Modul je bez sítě a bez DOM, aby se dal spustit v Node
 * (`kontrola/kalendar.mjs`). Vykreslování je v `AdminKalendar.js`.
 *
 * Datum je všude řetězec `YYYY-MM-DD`, stejně jako v databázi. Počítat
 * s `Date` a místním časem by na přelomu letního času posunulo den.
 */

/** Pondělí = 0, neděle = 6. Kalendář v ČR začíná pondělím. */
function denVTydnu(datum) {
  const [r, m, d] = datum.split('-').map(Number);
  return (new Date(Date.UTC(r, m - 1, d)).getUTCDay() + 6) % 7;
}

export function posunDen(datum, oDnu) {
  const [r, m, d] = datum.split('-').map(Number);
  const t = new Date(Date.UTC(r, m - 1, d));
  t.setUTCDate(t.getUTCDate() + oDnu);
  return t.toISOString().split('T')[0];
}

/** První den měsíce jako `YYYY-MM-01`. */
export function zacatekMesice(rok, mesic) {
  return `${rok}-${String(mesic + 1).padStart(2, '0')}-01`;
}

/**
 * Mřížka měsíce: vždy celé týdny od pondělí, aby sloupce seděly
 * s hlavičkou po–ne. Dny ze sousedních měsíců zůstávají v mřížce
 * (`vMesici: false`) — bez nich by řádky měly díry a čísla by se
 * rozjela pod jiný název dne.
 */
export function mrizkaMesice(rok, mesic) {
  const prvni = zacatekMesice(rok, mesic);
  const posledni = posunDen(zacatekMesice(mesic === 11 ? rok + 1 : rok, (mesic + 1) % 12), -1);

  const dny = [];
  let den = posunDen(prvni, -denVTydnu(prvni));
  const konec = posunDen(posledni, 6 - denVTydnu(posledni));
  while (den <= konec) {
    dny.push({ datum: den, vMesici: den.slice(0, 7) === prvni.slice(0, 7) });
    den = posunDen(den, 1);
  }
  return dny;
}

/**
 * Čím je rezervace pro daný den.
 *
 * `date_to` je VÝLUČNÉ (den odjezdu), takže poslední noc se spí den
 * předtím. Recepční ale potřebuje v seznamu vidět i toho, kdo ten den
 * odjíždí — proto se odjezd hlásí zvlášť, ne jako „nic".
 */
export function vztahKeDni(rezervace, den) {
  const od = rezervace.date_from;
  const doo = rezervace.date_to;
  if (!od || !doo) return null;
  if (den === od) return 'prijezd';
  if (den === doo) return 'odjezd';
  if (den > od && den < doo) return 'pobyt';
  return null;
}

/** Rezervace, které se daného dne týkají (příjezd, pobyt i odjezd). */
export function rezervaceNaDen(rezervace, den) {
  if (!den) return rezervace;
  return rezervace.filter(r => vztahKeDni(r, den) !== null);
}

/** Je na ten den zavřeno? Blokace mají `date_to` výlučné stejně jako rezervace. */
export function jeBlokovano(blokace, den) {
  return (blokace || []).some(b => b.date_from && b.date_to && den >= b.date_from && den < b.date_to);
}

/**
 * Pořadí teček v buňce. Drží se semaforu fází z `booking.css`, aby
 * tečka v kalendáři znamenala totéž co proužek na kartě a pruh
 * v plachtě dostupnosti. Storno je poslední a šedé — den, kde je jen
 * ono, není obsazený.
 */
export const FAZE_TECEK = ['pending_approval', 'awaiting_deposit', 'confirmed', 'cancelled'];

/**
 * Souhrn jednoho dne pro vykreslení buňky.
 *
 * Do počtů se stornované rezervace NEPOČÍTAJÍ — den, kde všechno
 * odpadlo, je volný a tvářit se jako obsazený nesmí. Archivované se
 * počítají, protože pobyt proběhl nebo proběhne; archiv je jen
 * odklizení ze seznamu (viz CLAUDE.md).
 */
export function shrnutiDne(rezervace, blokace, den) {
  const faze = new Set();
  let prijezdy = 0;
  let pobyty = 0;
  let odjezdy = 0;
  let storna = 0;

  for (const r of rezervace) {
    const vztah = vztahKeDni(r, den);
    if (!vztah) continue;
    faze.add(r.status || 'pending_approval');
    if (r.status === 'cancelled') { storna++; continue; }
    if (vztah === 'prijezd') prijezdy++;
    else if (vztah === 'odjezd') odjezdy++;
    else pobyty++;
  }

  return {
    den,
    prijezdy,
    pobyty,
    odjezdy,
    // Storna se vypisují zvlášť. Do seznamu pod kalendářem spadnou
    // (jsou to pořád rezervace na ten den), takže bez nich by souhrn
    // nesouhlasil s počtem karet a vypadal by jako chyba.
    storna,
    // Pobyt, který ten den začíná, na něm i probíhá — proto se příjezdy
    // přičítají. Bez toho by den s jedním příjezdem vypadal prázdně.
    obsazeno: prijezdy + pobyty,
    tecky: FAZE_TECEK.filter(s => faze.has(s)),
    blokovano: jeBlokovano(blokace, den),
  };
}
