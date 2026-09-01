// ---------------------------------------------------------------------
//  PLACHTA — pokoje v řádcích, dny měsíce ve sloupcích
//
//  Proč vedle kalendáře ještě tohle: správce na telefonu s hostem
//  nepotřebuje proklikat dvanáct pokojů. Potřebuje jeden pohled, ve
//  kterém uvidí celý měsíc naráz a hned řekne „šestnáctého mám volný
//  Mahagon a Pokoj 7". Tak to dělá každý hotelový systém a klient to
//  takhle zná z praxe.
//
//  Obsazenost se NEPOČÍTÁ ZNOVU. Bere se ze stejných funkcí jako
//  kalendář (`zabranyDuvod`, `odjezdVDen`, `prijezdVDen`), takže se
//  oba pohledy nemůžou rozejít. Kdyby si plachta počítala své, byla
//  by to druhá pravda o tomtéž — a ta se dřív nebo později rozchází.
//
//  Půlené dny tu nejsou úhlopříčkou, ale posunem pruhu o půl buňky:
//  pruh začíná uprostřed dne příjezdu a končí uprostřed dne odjezdu.
//  Říká to totéž (dopoledne se odjíždí, odpoledne přijíždí), jen to
//  jde přes celý pobyt přečíst na jeden pohled.
// ---------------------------------------------------------------------

import { MOCK_ROOMS } from '../lib/supabaseClient.js';
import {
  escapuj, formatCzechDateStr, dnesStr, posunDatum,
  zabranyDuvod, prodejnePokoje, MESICE,
} from './AdminDostupnost.js';

const DNY_ZKRATKY = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

/**
 * Fáze rezervace jako semafor — červená stůj, oranžová připrav se,
 * zelená jeď. Stejné barvy nese odznak na kartě rezervace, takže
 * recepční pozná stav rovnou z plachty a nemusí kvůli tomu proklikávat
 * jednotlivé karty. Paleta je v booking.css, oddíl SEMAFOR FÁZÍ.
 */
function fazePruhu(zaznam) {
  if (zaznam.status === 'confirmed') return { trida: 'je-faze3', popis: 'závazně potvrzeno, záloha zaplacena' };
  if (zaznam.status === 'awaiting_deposit') return { trida: 'je-faze2', popis: 'čeká na zálohu' };
  return { trida: 'je-faze1', popis: 'čeká na schválení' };
}

/**
 * Rozdělí „Pokoj 4 - Nadstandard Mahagon" na „Pokoj 4" a „Mahagon".
 *
 * Sloupec s názvy je na telefonu široký 88 px a celý název se do něj
 * nevejde — useknuté „Pokoj 10 - S…" nerozliší nic. Číslo a typ pod
 * sebou se přečtou i tam.
 */
function rozdelNazev(nazev) {
  const [prvni, ...zbytek] = String(nazev).split(' - ');
  const typ = zbytek.join(' - ').replace(/^Nadstandard\s*/i, '').trim();
  return [prvni.trim(), typ];
}

const den = (year, month, d) =>
  `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Pondělí = 0, neděle = 6. `getDay()` má neděli jako nulu, což je matoucí. */
const denVTydnu = (isoStr) => (new Date(isoStr + 'T12:00:00').getDay() + 6) % 7;

/** Kolikátý den měsíce to je; 0 když datum do měsíce nespadá. */
function indexVMesici(isoStr, year, month) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return (y === year && m === month) ? d : 0;
}

/**
 * Pruhy pro jeden pokoj v jednom měsíci.
 *
 * Do řádku patří rezervace toho pokoje a blokace jeho i celého hotelu —
 * blokace s `room_id: 'all'` zavírá i tenhle pokoj, takže se v jeho
 * řádku musí objevit, jinak by vypadal volný.
 */
export function pruhyProPokoj(ad, roomId, year, month, dnuVMesici) {
  const prvni = den(year, month, 1);
  const zaPoslednim = posunDatum(den(year, month, dnuVMesici), 1);
  const pruhy = [];

  const pridej = (zaznam, typ, popis, kod) => {
    // Mimo zobrazený měsíc — `date_to` je výlučné, proto <=.
    if (zaznam.date_to <= prvni || zaznam.date_from >= zaPoslednim) return;

    const zacOrez = zaznam.date_from < prvni;
    const zacIdx = zacOrez ? 1 : indexVMesici(zaznam.date_from, year, month);
    const konIdx = indexVMesici(zaznam.date_to, year, month);   // 0 = až za měsícem
    const konOrez = konIdx === 0;

    pruhy.push({
      typ, popis, kod,
      faze: typ === 'rezervace' ? fazePruhu(zaznam) : null,
      // Sloupce mřížky se počítají od 1. Pruh sahá až za buňku dne odjezdu
      // a zpátky se stáhne okrajem o půl dne — proto konIdx + 1.
      zacLine: zacIdx,
      konLine: konOrez ? dnuVMesici + 1 : Math.min(konIdx + 1, dnuVMesici + 1),
      zacOrez, konOrez,
      zaznam,
    });
  };

  (ad.reservations || [])
    .filter(r => r.room_id === roomId
      && !r.is_archived
      && !(r.status && (String(r.status).startsWith('cancelled') || r.status === 'stornováno')))
    .forEach(r => pridej(r, 'rezervace', r.guest_name || 'Rezervace', r.code || ''));

  (ad.blockedDates || [])
    .filter(b => b.room_id === 'all' || b.room_id === roomId)
    .forEach(b => pridej(b, 'blokace', b.reason || 'Blokace', ''));

  return pruhy;
}

export function renderPlachta(ad, year, month) {
  const p = ad.prehled;
  const dnuVMesici = new Date(year, month, 0).getDate();
  const dnes = dnesStr();
  const prodejne = new Set(prodejnePokoje(ad).map(r => r.id));

  const dnyMesice = [];
  for (let d = 1; d <= dnuVMesici; d++) dnyMesice.push(den(year, month, d));

  // ---- záhlaví: den v týdnu a číslo dne
  const zahlavi = dnyMesice.map((dd, i) => {
    const dvt = denVTydnu(dd);
    let t = 'plachta-hlava-den';
    if (dvt >= 5) t += ' je-vikend';
    if (dd === dnes) t += ' je-dnes';
    if (p.od && p.doo && dd >= p.od && dd <= p.doo) t += ' v-rozsahu';
    return `<button type="button" class="${t}" data-den="${dd}" style="grid-column: ${i + 1};"
      title="${DNY_ZKRATKY[dvt]} ${formatCzechDateStr(dd)} — klepnutím se podíváte na tenhle jeden den">
      <span class="plachta-hlava-dvt">${DNY_ZKRATKY[dvt]}</span>
      <span class="plachta-hlava-cislo">${i + 1}</span>
    </button>`;
  }).join('');

  // ---- souhrnný řádek: kolik pokojů je ten den volných
  // Kvůli tomuhle jedinému číslu se správce na plachtu většinou dívá.
  const souhrn = dnyMesice.map((dd, i) => {
    const volno = [...prodejne].filter(id => !zabranyDuvod(ad, dd, id)).length;
    const celkem = prodejne.size;
    let t = 'plachta-souhrn-bunka';
    if (volno === 0) t += ' je-plno';
    else if (volno <= Math.max(1, Math.floor(celkem / 3))) t += ' je-skoro-plno';
    if (denVTydnu(dd) >= 5) t += ' je-vikend';
    if (dd < dnes) t += ' je-minulost';
    if (p.od && p.doo && dd >= p.od && dd <= p.doo) t += ' v-rozsahu';
    return `<button type="button" class="${t}" data-den="${dd}" data-room="all" style="grid-column: ${i + 1};"
      title="${formatCzechDateStr(dd)} — volných pokojů ${volno} z ${celkem}">${volno}</button>`;
  }).join('');

  // ---- řádky pokojů
  const radky = MOCK_ROOMS.map(rm => {
    const mimoProvoz = !prodejne.has(rm.id);

    const bunky = dnyMesice.map((dd, i) => {
      let t = 'plachta-bunka';
      if (denVTydnu(dd) >= 5) t += ' je-vikend';
      if (dd < dnes) t += ' je-minulost';
      if (dd === dnes) t += ' je-dnes';
      if (mimoProvoz) t += ' je-mimo-provoz';
      if (p.roomId === rm.id) {
        if (dd === p.od || dd === p.doo) t += ' je-kraj-vyberu';
        else if (p.od && p.doo && dd > p.od && dd < p.doo) t += ' v-rozsahu-vyberu';
      } else if (p.od && p.doo && dd >= p.od && dd <= p.doo) {
        t += ' v-rozsahu';
      }
      return `<button type="button" class="${t}" data-den="${dd}" data-room="${rm.id}" style="grid-column: ${i + 1};"></button>`;
    }).join('');

    const pruhy = pruhyProPokoj(ad, rm.id, year, month, dnuVMesici).map(pr => {
      const styl = `grid-column: ${pr.zacLine} / ${pr.konLine};`
        + (pr.zacOrez ? '' : ' margin-left: calc(var(--plachta-den) / 2);')
        + (pr.konOrez ? '' : ' margin-right: calc(var(--plachta-den) / 2);');
      const titulek = pr.typ === 'blokace'
        ? `Blokace: ${pr.popis} · ${formatCzechDateStr(pr.zaznam.date_from)} – ${formatCzechDateStr(posunDatum(pr.zaznam.date_to, -1))}`
        : `${pr.popis}${pr.kod ? ` (${pr.kod})` : ''} · ${pr.faze.popis} · příjezd ${formatCzechDateStr(pr.zaznam.date_from)}, odjezd ${formatCzechDateStr(pr.zaznam.date_to)}`;
      const tridaBarvy = pr.typ === 'blokace' ? 'je-blokace' : pr.faze.trida;
      return `<div class="plachta-pruh ${tridaBarvy}" style="${styl}" title="${escapuj(titulek)}"
        data-kod="${escapuj(pr.kod)}" data-typ="${pr.typ}">${escapuj(pr.popis)}</div>`;
    }).join('');

    const [cast1, cast2] = rozdelNazev(rm.name);
    return `
      <div class="plachta-radek${mimoProvoz ? ' je-mimo-provoz' : ''}${p.roomId === rm.id ? ' je-vybrany' : ''}">
        <div class="plachta-nazev" title="${escapuj(rm.name)}${mimoProvoz ? ' — mimo provoz' : ''}">
          <span class="plachta-nazev-text">
            <span class="plachta-nazev-hlavni">${escapuj(cast1)}</span>
            ${cast2 ? `<span class="plachta-nazev-typ">${escapuj(cast2)}</span>` : ''}
          </span>
          ${mimoProvoz ? '<span class="plachta-znacka-mimo">mimo provoz</span>' : ''}
        </div>
        <div class="plachta-dny" style="grid-template-columns: repeat(${dnuVMesici}, var(--plachta-den));">
          ${bunky}${pruhy}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="plachta" style="--plachta-dnu: ${dnuVMesici};">
      <div class="plachta-listaakci">
        <div class="plachta-mesic">
          <button type="button" class="plachta-nav prehled-prev" title="Předchozí měsíc" aria-label="Předchozí měsíc">‹</button>
          <span class="plachta-mesic-nazev">${MESICE[month - 1]} ${year}</span>
          <button type="button" class="plachta-nav prehled-next" title="Následující měsíc" aria-label="Následující měsíc">›</button>
        </div>
        <div class="plachta-listaakci-vpravo">
          <button type="button" class="plachta-odkaz plachta-dnes">Dnes</button>
          <button type="button" class="plachta-odkaz prehled-reset">Vynulovat výběr</button>
        </div>
      </div>

      <div class="plachta-posuv">
        <div class="plachta-mrizka">
          <div class="plachta-radek plachta-radek-hlava">
            <div class="plachta-nazev plachta-nazev-hlava">Pokoj</div>
            <div class="plachta-dny" style="grid-template-columns: repeat(${dnuVMesici}, var(--plachta-den));">${zahlavi}</div>
          </div>

          <div class="plachta-radek plachta-radek-souhrn">
            <div class="plachta-nazev plachta-nazev-souhrn">Volno celkem</div>
            <div class="plachta-dny" style="grid-template-columns: repeat(${dnuVMesici}, var(--plachta-den));">${souhrn}</div>
          </div>

          ${radky}
        </div>
      </div>

      <div class="plachta-legenda">
        <span class="plachta-legenda-polozka"><i class="plachta-vzorek je-faze1"></i> Čeká na schválení</span>
        <span class="plachta-legenda-polozka"><i class="plachta-vzorek je-faze2"></i> Čeká na zálohu</span>
        <span class="plachta-legenda-polozka"><i class="plachta-vzorek je-faze3"></i> Závazně potvrzeno</span>
        <span class="plachta-legenda-polozka"><i class="plachta-vzorek je-blokace"></i> Blokace</span>
        <span class="plachta-legenda-polozka"><i class="plachta-vzorek je-vikend"></i> Víkend</span>
        <span class="plachta-legenda-polozka"><i class="plachta-vzorek je-vyber"></i> Vybraný termín</span>
        <span class="plachta-legenda-poznamka">Pruh začíná v poledne dne příjezdu a končí v poledne dne odjezdu — proto přesahuje jen půl buňky.</span>
      </div>

      <p class="plachta-napoveda">
        Klepněte na den u pokoje = příjezd, druhé klepnutí ve stejném řádku = odjezd.
        Klepnutí na číslo dne nahoře ukáže jeden konkrétní den pro celý hotel.
      </p>
    </div>
  `;
}

export function bindPlachta(ad) {
  const koren = ad.container.querySelector('.plachta');
  if (!koren) return;

  // Výběr rozsahu. Klepnutí do jiného řádku přepne pokoj — obsluha
  // nemusí sahat na rozbalovátko nad plachtou.
  koren.querySelectorAll('.plachta-bunka[data-den], .plachta-souhrn-bunka[data-den]').forEach(el => {
    el.addEventListener('click', () => {
      const p = ad.prehled;
      const d = el.dataset.den;
      const pokoj = el.dataset.room || 'all';
      if (pokoj !== p.roomId) { p.roomId = pokoj; p.od = d; p.doo = null; ad.render(); return; }
      if (p.od && p.doo) { p.od = d; p.doo = null; }
      else if (!p.od || d <= p.od) { p.od = d; p.doo = null; }
      else { p.doo = d; }
      ad.render();
    });
  });

  // Číslo dne nahoře = „co mám volného zrovna tenhle den". Vybere jednu
  // noc pro celý hotel, což je přesně dotaz, se kterým volá host.
  koren.querySelectorAll('.plachta-hlava-den[data-den]').forEach(el => {
    el.addEventListener('click', () => {
      const p = ad.prehled;
      p.roomId = 'all';
      p.od = el.dataset.den;
      p.doo = posunDatum(el.dataset.den, 1);
      ad.render();
    });
  });

  // Proklik z pruhu na kartu rezervace — stejnou cestou jako z výpisu níž,
  // aby se storno dělalo tam, kde je vidět celý kontext.
  koren.querySelectorAll('.plachta-pruh[data-typ="rezervace"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const kod = el.dataset.kod;
      if (!kod) return;
      const cil = ad.container.querySelector(`.btn-prehled-rezervace[data-kod="${kod}"]`);
      if (cil) { cil.click(); return; }
      ad.showPrehledModal = false;
      ad.statusFilter = 'all';
      ad.selectedRoomFilter = 'all';
      ad.render();
      setTimeout(() => {
        const karta = [...ad.container.querySelectorAll('.admin-res-card')].find(k => k.textContent.includes(kod));
        if (!karta) return;
        karta.scrollIntoView({ block: 'center' });
        karta.style.transition = 'box-shadow 0.3s ease';
        karta.style.boxShadow = '0 0 0 3px rgba(105, 121, 71, 0.55)';
        setTimeout(() => { karta.style.boxShadow = ''; }, 2200);
      }, 120);
    });
  });

  const btnDnes = koren.querySelector('.plachta-dnes');
  if (btnDnes) btnDnes.addEventListener('click', () => {
    const [y, m] = dnesStr().split('-').map(Number);
    ad.prehled.rokMesic = { year: y, month: m };
    ad.render();
  });

  // Po vykreslení odrolovat na dnešek (nebo na vybraný termín), ať se
  // obsluha na telefonu nemusí prokousávat od prvního dne měsíce.
  const posuv = koren.querySelector('.plachta-posuv');
  if (posuv && !posuv.dataset.odrolovano) {
    posuv.dataset.odrolovano = '1';
    const cil = koren.querySelector('.plachta-hlava-den.je-dnes')
      || koren.querySelector('.plachta-hlava-den.v-rozsahu');
    if (cil) {
      const nazev = koren.querySelector('.plachta-nazev');
      const sirkaNazvu = nazev ? nazev.getBoundingClientRect().width : 0;
      posuv.scrollLeft = Math.max(0, cil.offsetLeft - sirkaNazvu - 40);
    }
  }
}
