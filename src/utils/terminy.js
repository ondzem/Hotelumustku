// ---------------------------------------------------------------------
//  ZVLÁŠTNÍ OBDOBÍ V ROCE
//
//  Dvě období, která se opakují KAŽDÝ ROK a řídí se jen dnem a měsícem,
//  ne konkrétním rokem. Proto se tu nikde neporovnávají celá data —
//  všechno jde přes „MM-DD".
//
//  1. SVÁTKY (26. 12. – 2. 1.) — pobyt nejméně na tři noci. Přechází
//     přes Nový rok, takže se rozsah testuje obráceně (viz vMM_DD).
//  2. MIMO PROVOZ (5. 10. – 25. 12.) — hotel bývá zavřený, ale při
//     větší skupině se dá po domluvě otevřít.
//
//  Modul je čistý: žádná síť, žádný DOM. Dá se spustit v Node a
//  protestovat, což taky dělá kontrola/terminy.mjs.
// ---------------------------------------------------------------------

/** Svátky kolem Silvestra — nejméně tři noci. */
export const SVATKY = { od: '12-26', doo: '01-02', minNoci: 3 };

/** Zimní přestávka, kdy hotel běžně nejede. */
export const MIMO_PROVOZ = { od: '10-05', doo: '12-25' };

/** Kolik nocí je potřeba mimo svátky. */
export const MIN_NOCI = 2;

/** „2026-12-31" → „12-31". Prázdný vstup vrací prázdno. */
export function naMM_DD(datum) {
  const t = String(datum || '');
  return t.length >= 10 ? t.slice(5, 10) : '';
}

/**
 * Leží „MM-DD" v rozsahu, který se opakuje každý rok?
 *
 * Rozsah smí přecházet přes Nový rok — pak je `od` větší než `doo`
 * (12-26 → 01-02) a test se obrací na „nebo". Bez toho by svátky
 * vycházely jako prázdný rozsah a 31. 12. by nepatřilo nikam.
 */
export function vRozsahuMM_DD(mmdd, od, doo) {
  if (!mmdd) return false;
  return od <= doo
    ? (mmdd >= od && mmdd <= doo)
    : (mmdd >= od || mmdd <= doo);
}

/** Spadá konkrétní den do svátečního období? */
export function jeSvatecniDen(datum) {
  return vRozsahuMM_DD(naMM_DD(datum), SVATKY.od, SVATKY.doo);
}

/** Je to 31. 12.? Kvůli zvláštnímu vybarvení v kalendáři. */
export function jeSilvestr(datum) {
  return naMM_DD(datum) === '12-31';
}

/** Spadá konkrétní den do zimní přestávky? */
export function jeMimoProvoz(datum) {
  return vRozsahuMM_DD(naMM_DD(datum), MIMO_PROVOZ.od, MIMO_PROVOZ.doo);
}

/** Posun data o dny; vrací „YYYY-MM-DD". */
function posun(datum, dnu) {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + dnu);
  return d.toISOString().slice(0, 10);
}

/** Počet nocí mezi příjezdem a odjezdem. */
export function pocetNoci(od, doo) {
  if (!od || !doo) return 0;
  const rozdil = (new Date(doo) - new Date(od)) / 86400000;
  return rozdil > 0 ? Math.round(rozdil) : 0;
}

/**
 * Projde NOCI pobytu, ne krajní dny.
 *
 * Noc patří ke dni příjezdu, takže se jde od `od` po `doo` bez posledního
 * dne — den odjezdu se už nepřespává. Kdyby se testovaly jen krajní dny,
 * pobyt, který svátky celé přeskočí (28. 12. → 3. 1.), by se posoudil
 * podle 3. ledna a vyšel jako obyčejný.
 */
function nociPobytu(od, doo) {
  const noci = [];
  const n = pocetNoci(od, doo);
  for (let i = 0; i < n; i++) noci.push(posun(od, i));
  return noci;
}

/** Zasahuje pobyt do svátků? */
export function zasahujeDoSvatku(od, doo) {
  return nociPobytu(od, doo).some(jeSvatecniDen);
}

/** Je 31. 12. jednou z nocí pobytu? */
export function zahrnujeSilvestr(od, doo) {
  return nociPobytu(od, doo).some(jeSilvestr);
}

/** Zasahuje pobyt do zimní přestávky? */
export function zasahujeMimoProvoz(od, doo) {
  return nociPobytu(od, doo).some(jeMimoProvoz);
}

/**
 * Kolik nocí je u tohohle termínu nejméně potřeba.
 *
 * Rozhoduje se podle DNE PŘÍJEZDU, ne podle celého pobytu. Kdyby se
 * ptalo na celý pobyt, host by uvízl v kruhu: vybere dvě noci, systém
 * řekne „potřebujete tři", on přidá noc — a teprve tím se do svátků
 * dostane. Takhle je pravidlo vidět hned u prvního kliknutí.
 */
export function minimumNoci(datumPrijezdu) {
  return jeSvatecniDen(datumPrijezdu) ? SVATKY.minNoci : MIN_NOCI;
}

/** Text „2 noci" / „3 noci" pro popisky. */
export function popisNoci(pocet) {
  if (pocet === 1) return '1 noc';
  return `${pocet} ${pocet < 5 ? 'noci' : 'nocí'}`;
}

/**
 * Protíná zobrazený měsíc zimní přestávku?
 *
 * Používá se v kalendáři: host, který listuje říjnem a vidí všechno
 * červené, potřebuje vědět PROČ. Podle výběru by se to říct nedalo —
 * na zavřené dny se kliknout nedá, takže by upozornění nikdy nenaskočilo.
 */
export function mesicZasahujeMimoProvoz(rok, mesic) {
  const dnu = new Date(rok, mesic, 0).getDate();
  for (let d = 1; d <= dnu; d++) {
    const mmdd = `${String(mesic).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (vRozsahuMM_DD(mmdd, MIMO_PROVOZ.od, MIMO_PROVOZ.doo)) return true;
  }
  return false;
}

/** Totéž pro svátky — kvůli upozornění na tři noci už při listování. */
export function mesicZasahujeSvatky(rok, mesic) {
  const dnu = new Date(rok, mesic, 0).getDate();
  for (let d = 1; d <= dnu; d++) {
    const mmdd = `${String(mesic).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (vRozsahuMM_DD(mmdd, SVATKY.od, SVATKY.doo)) return true;
  }
  return false;
}

/** Lidsky zapsaný rozsah, ať se datumy nepíšou v textech ručně. */
export function popisRozsahu({ od, doo }) {
  const cti = (mmdd) => {
    const [m, d] = mmdd.split('-').map(Number);
    return `${d}. ${m}.`;
  };
  return `${cti(od)} – ${cti(doo)}`;
}
