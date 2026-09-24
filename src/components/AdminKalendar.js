/**
 * MĚSÍČNÍ KALENDÁŘ NAD SEZNAMEM REZERVACÍ
 *
 * Rychlá odpověď na otázku „co mám dvacátého šestého". Recepční klepne
 * na den a seznam pod kalendářem se zúží na rezervace, kterých se ten
 * den týká — příjezdy, probíhající pobyty i odjezdy.
 *
 * Proč vedle Dostupnosti a blokací, která kalendář taky má: tam se
 * plánuje (vybírá se rozsah, zapisuje rezervace, zavírá termín) a je to
 * samostatné okno. Tohle je jen filtr seznamu na jedno klepnutí, bez
 * otevírání okna a bez rizika, že se něco omylem přepíše. Obsazenost si
 * proto nepočítá po pokojích — od toho je plachta v Dostupnosti.
 *
 * Barvy teček jsou semafor fází z `booking.css` (`--faze1/2/3`), tedy
 * totéž, co nese proužek karty a pruh v plachtě. Čtvrtá, šedá, je
 * storno. Nikdy tu nepiš odstín natvrdo.
 */
import { MESICE, dnesStr } from './AdminDostupnost.js';
import { mrizkaMesice, shrnutiDne, rezervaceNaDen, vztahKeDni } from '../utils/kalendarRezervaci.js';

const DNY = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];

/**
 * Šipky jsou KRESLENÉ, ne znaky „‹" a „›".
 *
 * Znak se v tlačítku nikdy nevycentruje spolehlivě: písmo mu přidává
 * vlastní mezeru nahoře a dole a ta je v každém řezu jiná, takže se
 * šipka o pár pixelů posune — a po každé změně písma znovu. Čára v SVG
 * se kreslí do vlastní soustavy a `viewBox` ji drží přesně uprostřed.
 */
const sipka = (smer) => `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="${smer === 'vlevo' ? '15 5 8 12 15 19' : '9 5 16 12 9 19'}"></polyline>
  </svg>`;
const SIPKA_VLEVO = sipka('vlevo');
const SIPKA_VPRAVO = sipka('vpravo');

const POPIS_TECKY = {
  pending_approval: 'Ke schválení',
  awaiting_deposit: 'Čeká na zálohu',
  confirmed: 'Závazně potvrzeno',
  cancelled: 'Stornováno',
};

/** Výchozí stav: žádný vybraný den, zobrazený měsíc je ten dnešní. */
export function prazdnyKalendar() {
  const [rok, mesic] = dnesStr().split('-').map(Number);
  return { rok, mesic: mesic - 1, vybranyDen: null };
}

/** Rezervace, které se počítají do teček — včetně archivu, ten obsazuje dál. */
function vsechnyRezervace(ad) {
  return ad.reservations || [];
}

export function renderKalendarRezervaci(ad) {
  const k = ad.kalendar || (ad.kalendar = prazdnyKalendar());
  const dnes = dnesStr();
  const rezervace = vsechnyRezervace(ad);
  const blokace = ad.blockedDates || [];

  const bunky = mrizkaMesice(k.rok, k.mesic).map(({ datum, vMesici }) => {
    const s = shrnutiDne(rezervace, blokace, datum);
    const cislo = Number(datum.slice(8, 10));

    const tridy = ['kal-rez-den'];
    if (!vMesici) tridy.push('je-cizi-mesic');
    if (datum === dnes) tridy.push('je-dnes');
    if (datum === k.vybranyDen) tridy.push('je-vybrany');
    if (datum < dnes) tridy.push('je-minulost');
    if (s.blokovano) tridy.push('je-blokovany');

    const popis = [
      `${cislo}. ${MESICE[k.mesic].toLowerCase()}`,
      s.obsazeno ? `obsazeno ${s.obsazeno}` : 'bez rezervací',
      s.blokovano ? 'zavřeno' : '',
    ].filter(Boolean).join(', ');

    return `
      <button type="button" class="${tridy.join(' ')}" data-den="${datum}"
              aria-pressed="${datum === k.vybranyDen}" title="${popis}">
        <span class="kal-rez-cislo">${cislo}</span>
        <span class="kal-rez-tecky" aria-hidden="true">
          ${s.tecky.map(t => `<span class="kal-rez-tecka tecka-${t}"></span>`).join('')}
        </span>
      </button>`;
  }).join('');

  // Souhrn se ukazuje jen u vybraného dne. Bez výběru by tu visel
  // řádek s nulami a bral místo hned nad seznamem.
  let souhrn = '';
  if (k.vybranyDen) {
    const s = shrnutiDne(rezervace, blokace, k.vybranyDen);
    const [r, m, d] = k.vybranyDen.split('-').map(Number);
    souhrn = `
      <div class="kal-rez-souhrn">
        <div class="kal-rez-souhrn-datum">
          <strong>${d}. ${MESICE[m - 1].toLowerCase()} ${r}</strong>
          ${s.blokovano ? '<span class="kal-rez-znacka-zavreno">zavřeno</span>' : ''}
        </div>
        <div class="kal-rez-souhrn-cisla">
          <span><strong>${s.prijezdy}</strong> příjezd${s.prijezdy === 1 ? '' : s.prijezdy >= 2 && s.prijezdy <= 4 ? 'y' : 'ů'}</span>
          <span><strong>${s.pobyty}</strong> probíhající</span>
          <span><strong>${s.odjezdy}</strong> odjezd${s.odjezdy === 1 ? '' : s.odjezdy >= 2 && s.odjezdy <= 4 ? 'y' : 'ů'}</span>
          ${s.storna ? `<span class="kal-rez-souhrn-storno"><strong>${s.storna}</strong> stornovan${s.storna === 1 ? 'á' : s.storna >= 2 && s.storna <= 4 ? 'é' : 'ých'}</span>` : ''}
        </div>
        <button type="button" class="kal-rez-zrusit">Zrušit výběr dne</button>
      </div>`;
  }

  return `
    <section class="kal-rez" aria-label="Kalendář rezervací">
      <div class="kal-rez-hlavicka">
        <button type="button" class="kal-rez-sipka" data-posun="-1" aria-label="Předchozí měsíc">${SIPKA_VLEVO}</button>
        <div class="kal-rez-mesic">${MESICE[k.mesic]} ${k.rok}</div>
        <button type="button" class="kal-rez-sipka" data-posun="1" aria-label="Další měsíc">${SIPKA_VPRAVO}</button>
        <button type="button" class="kal-rez-dnes">Dnes</button>
      </div>

      <div class="kal-rez-mrizka" role="grid">
        ${DNY.map(d => `<div class="kal-rez-nazev-dne">${d}</div>`).join('')}
        ${bunky}
      </div>

      ${souhrn}

      <div class="kal-rez-legenda">
        ${Object.entries(POPIS_TECKY).map(([stav, popis]) =>
          `<span class="kal-rez-legenda-polozka"><span class="kal-rez-tecka tecka-${stav}"></span>${popis}</span>`).join('')}
        <span class="kal-rez-legenda-polozka"><span class="kal-rez-vzorek-zavreno"></span>Zavřeno</span>
      </div>
    </section>`;
}

export function bindKalendarRezervaci(ad) {
  const k = ad.kalendar || (ad.kalendar = prazdnyKalendar());

  ad.container.querySelectorAll('.kal-rez-sipka').forEach(btn => {
    btn.addEventListener('click', () => {
      const o = Number(btn.dataset.posun);
      let m = k.mesic + o;
      let r = k.rok;
      if (m < 0) { m = 11; r--; }
      if (m > 11) { m = 0; r++; }
      // Do minulosti se v administraci listovat SMÍ — majitel se do
      // starých měsíců dívá schválně, když dohledává, kdo tam byl.
      k.mesic = m; k.rok = r;
      ad.render();
    });
  });

  const dnesBtn = ad.container.querySelector('.kal-rez-dnes');
  if (dnesBtn) {
    dnesBtn.addEventListener('click', () => {
      const [r, m] = dnesStr().split('-').map(Number);
      k.rok = r; k.mesic = m - 1;
      ad.render();
    });
  }

  ad.container.querySelectorAll('.kal-rez-den').forEach(btn => {
    btn.addEventListener('click', () => {
      const den = btn.dataset.den;
      // Druhé klepnutí na tentýž den výběr zruší. Jinak by se recepční
      // musel trefovat do malého křížku v souhrnu.
      k.vybranyDen = k.vybranyDen === den ? null : den;
      // Klepnutí na den ze sousedního měsíce na něj rovnou přepne,
      // jinak by vybraný den zmizel z mřížky.
      if (k.vybranyDen && k.vybranyDen.slice(0, 7) !== `${k.rok}-${String(k.mesic + 1).padStart(2, '0')}`) {
        const [r, m] = k.vybranyDen.split('-').map(Number);
        k.rok = r; k.mesic = m - 1;
      }
      ad.render();
    });
  });

  const zrusit = ad.container.querySelector('.kal-rez-zrusit');
  if (zrusit) {
    zrusit.addEventListener('click', () => {
      k.vybranyDen = null;
      ad.render();
    });
  }
}

/**
 * Proč je karta ve vyfiltrovaném seznamu.
 *
 * Bez tohohle popisku to vypadá jako chyba: klepnutím na 22. září
 * vyjedou pobyty s termínem 13.–24. 9. a majitel v nich dvaadvacátého
 * nikde nevidí, i když jím prochází. Odznak to řekne natvrdo.
 */
export function popisVztahuKeDni(ad, rezervace) {
  const den = ad.kalendar && ad.kalendar.vybranyDen;
  if (!den) return '';
  const vztah = vztahKeDni(rezervace, den);
  if (!vztah) return '';
  const [, m, d] = den.split('-').map(Number);
  const datum = `${d}. ${m}.`;
  if (vztah === 'prijezd') return `příjezd ${datum}`;
  if (vztah === 'odjezd') return `odjezd ${datum}`;
  return `probíhá ${datum}`;
}

/** Filtr seznamu podle vybraného dne. Bez výběru vrací vše. */
export function filtrPodleDne(ad, rezervace) {
  const den = ad.kalendar && ad.kalendar.vybranyDen;
  return den ? rezervaceNaDen(rezervace, den) : rezervace;
}
