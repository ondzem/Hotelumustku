// ---------------------------------------------------------------------
//  PŘEHLED DOSTUPNOSTI
//
//  Když se hosta zeptá na volný termín, když je majitel zrovna pryč,
//  musel dřív hledat v tabulce u počítače. Tohle okno odpoví z mobilu:
//  kalendář, kde je vidět obsazenost celého hotelu nebo jednoho pokoje,
//  a rovnou z něj jde termín zapsat nebo zablokovat.
//
//  Kalendář je schválně stejný jako v rezervaci na webu — sdílí s ním
//  třídy, takže barvy i legenda znamenají totéž. Rozdíl je jen v tom,
//  co se počítá: u celého hotelu kolik pokojů je zabraných, u jednoho
//  pokoje jestli je zabraný právě on.
//
//  Blokace se zapisuje do `blocked_dates` úplně stejně jako v okně
//  Blokovat termíny, tedy s VÝLUČNÝM date_to (den odjezdu je volný).
//  Ostatní nástroje na zavírání provozu tím zůstávají beze změny —
//  tohle okno je jen pohodlnější cesta k těm, které už existují.
// ---------------------------------------------------------------------

import { MOCK_ROOMS } from '../lib/supabaseClient.js';
import { renderPlachta, bindPlachta } from './AdminPlachta.js';
import { obsazenostPulek, stavPulky, tridaPulek } from '../utils/obsazenost.js';
import { adminPotvrzeni } from './AdminPotvrzeni.js';

export const MESICE = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

const S = {
  input: 'width: 100%; height: 42px; font-size: 14.5px; padding: 0 11px; border-radius: 5px; border: 1.5px solid #c9c8bd; box-sizing: border-box; background: #fff; color: #1c1c19;',
  popisek: 'display: block; font-size: 12.5px; font-weight: 700; color: #55554e; margin-bottom: 5px;',
  blok: 'background: #fff; border: 1.5px solid #e0dfd5; border-radius: 8px; padding: 16px 18px; margin-bottom: 14px;',
};

export const escapuj = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function formatCzechDateStr(isoStr) {
  if (!isoStr) return '';
  const [rok, mesic, den] = String(isoStr).split('-');
  if (!den) return isoStr;
  return `${parseInt(den, 10)}. ${parseInt(mesic, 10)}. ${rok}`;
}

export const dnesStr = () => new Date().toISOString().split('T')[0];

export function posunDatum(datum, oDnu) {
  const d = new Date(datum + 'T12:00:00');
  d.setDate(d.getDate() + oDnu);
  return d.toISOString().split('T')[0];
}

/**
 * Rozsah blokace pro člověka — VČETNĚ posledního dne.
 *
 * `date_to` je v databázi výlučné (první volný den), ale obsluze se ukazuje
 * poslední zavřený den, jinak by to vypadalo, že blokace končí o den dřív.
 */
function zobrazRozsahBlokace(dateFrom, dateTo) {
  if (!dateFrom) return '';
  const posledni = dateTo ? posunDatum(dateTo, -1) : dateFrom;
  if (posledni === dateFrom) return `${formatCzechDateStr(dateFrom)} (1 den)`;
  const pocet = Math.round((new Date(posledni) - new Date(dateFrom)) / 86400000) + 1;
  return `${formatCzechDateStr(dateFrom)} – ${formatCzechDateStr(posledni)} (${pocet} dnů)`;
}

function pocetNoci(od, doo) {
  if (!od || !doo) return 0;
  const r = (new Date(doo) - new Date(od)) / 86400000;
  return r > 0 ? Math.round(r) : 0;
}

export function prazdnyPrehled() {
  return {
    roomId: 'all',      // 'all' = celý hotel
    // Výchozí je plachta — správce s hostem na telefonu potřebuje vidět
    // všechny pokoje naráz, ne proklikávat jeden po druhém.
    pohled: 'plachta',  // 'plachta' | 'kalendar'
    rokMesic: null,
    od: null,
    doo: null,
    duvod: '',          // proč se blokuje — Booking.com, telefonát, uzávěrka
  };
}

/** Je pokoj v daný den zabraný? Vrací důvod, nebo null. */
/*
 * Archivovaná rezervace obsazuje dál. Dřív se tu `is_archived` vynechávalo,
 * jenže web ani ruční zápis ho nevynechávají — archivovaný pobyt tak byl
 * v Dostupnosti volný a na webu obsazený, a majitel hlásil, že „volné
 * datum je zabrané". Archiv je jen odklizení z hlavního seznamu, ne
 * storno; a v minulých měsících má být vidět, kdo tam byl, i po
 * archivaci.
 */
export function zabranyDuvod(ad, den, roomId) {
  const rezervace = (ad.reservations || []).find(r =>
    r.room_id === roomId
    && !(r.status && (String(r.status).startsWith('cancelled') || r.status === 'stornováno'))
    && den >= r.date_from && den < r.date_to);
  if (rezervace) return { typ: 'rezervace', popis: rezervace.guest_name || 'Rezervace', zaznam: rezervace };

  const blokace = (ad.blockedDates || []).find(b =>
    (b.room_id === 'all' || b.room_id === roomId)
    && den >= b.date_from && den < b.date_to);
  if (blokace) return { typ: 'blokace', popis: blokace.reason || 'Blokace', zaznam: blokace };

  return null;
}

/**
 * Přestupní den — dopoledne se odjíždí, odpoledne může přijet někdo jiný.
 *
 * Pozná se podle toho, že `date_to` nějakého záznamu padne přesně na tenhle
 * den. Protože je date_to výlučné, pokoj v ten den obsazený UŽ NENÍ, ale do
 * 10:00 v něm ještě někdo je. Vrací, kdo odjíždí, nebo null.
 */
export function odjezdVDen(ad, den, roomId) {
  const rezervace = (ad.reservations || []).find(r =>
    r.room_id === roomId
    && !(r.status && (String(r.status).startsWith('cancelled') || r.status === 'stornováno'))
    && r.date_to === den);
  if (rezervace) return { typ: 'rezervace', popis: rezervace.guest_name || 'Rezervace' };

  const blokace = (ad.blockedDates || []).find(b =>
    (b.room_id === 'all' || b.room_id === roomId) && b.date_to === den);
  if (blokace) return { typ: 'blokace', popis: blokace.reason || 'Blokace' };

  return null;
}

/**
 * Příjezdový den — dopoledne je ještě volno, od 15:00 už je obsazeno.
 *
 * Zrcadlo k `odjezdVDen`: pozná se podle `date_from`. Ten den pokoj obsazený
 * JE (date_from je včetně), ale až od odpoledne.
 */
export function prijezdVDen(ad, den, roomId) {
  const rezervace = (ad.reservations || []).find(r =>
    r.room_id === roomId
    && !(r.status && (String(r.status).startsWith('cancelled') || r.status === 'stornováno'))
    && r.date_from === den);
  if (rezervace) return { typ: 'rezervace', popis: rezervace.guest_name || 'Rezervace' };

  const blokace = (ad.blockedDates || []).find(b =>
    (b.room_id === 'all' || b.room_id === roomId) && b.date_from === den);
  if (blokace) return { typ: 'blokace', popis: blokace.reason || 'Blokace' };

  return null;
}

/** Prodejné pokoje — vyřazené z provozu se do dostupnosti nepočítají. */
export function prodejnePokoje(ad) {
  const vypnute = new Set((ad.disabledRooms || []).filter(d => d.is_disabled).map(d => d.room_id));
  return MOCK_ROOMS.filter(r => !r.isDisabled && !vypnute.has(r.id));
}

/**
 * Obsazenost obou polovin dne — společné pravidlo s rezervačním
 * formulářem, viz src/utils/obsazenost.js.
 *
 * Nepočítají se přestupy. Dřív ano, a lhalo to při překryvu termínů:
 * když jednomu pokoji blokace 25. ráno skončila, ale jiný pokoj byl
 * 25. obsazený celý, vycházel den půlený, přestože hotel dopoledne
 * prázdný nebyl.
 */
function pulkyProDen(ad, den, roomId) {
  const pokoje = roomId === 'all' ? prodejnePokoje(ad).map(r => r.id) : [roomId];
  return obsazenostPulek(pokoje, {
    obsazeno: (id) => Boolean(zabranyDuvod(ad, den, id)),
    zacina: (id) => Boolean(prijezdVDen(ad, den, id)),
    konci: (id) => Boolean(odjezdVDen(ad, den, id)),
  });
}

function stavDne(ad, den, roomId) {
  // Každá polovina dne má vlastní stav — kvůli konci blokace, který
  // v celodenním pohledu obsazený není, ale do 10:00 pořád je.
  const pulkyVybrane = pulkyProDen(ad, den, roomId);
  const pulkyHotel = roomId === 'all' ? pulkyVybrane : pulkyProDen(ad, den, 'all');
  const dopoledne = stavPulky(pulkyVybrane.dopoledne, pulkyVybrane.celkem, pulkyHotel.dopoledne);
  const odpoledne = stavPulky(pulkyVybrane.odpoledne, pulkyVybrane.celkem, pulkyHotel.odpoledne);
  const odjezdovy = dopoledne !== 'volno' && odpoledne === 'volno';
  const prijezdovy = dopoledne === 'volno' && odpoledne !== 'volno';
  const vsechny = prodejnePokoje(ad);

  if (roomId !== 'all') {
    return {
      volno: odpoledne === 'plno' ? 0 : 1,
      celkem: 1,
      duvod: zabranyDuvod(ad, den, roomId),
      // Kolik pokojů je zabraných v CELÉM hotelu — kvůli oranžové. Recepční
      // (a na webu host) tak vidí, že se hotel plní, i když tenhle pokoj
      // zrovna volný je. Bez toho svítí kalendář jednoho pokoje celý zeleně.
      hotelObsazeno: pulkyHotel.odpoledne,
      hotelCelkem: vsechny.length,
      dopoledne,
      odpoledne,
      odjezd: odjezdVDen(ad, den, roomId),
      prijezd: prijezdVDen(ad, den, roomId),
    };
  }

  return {
    volno: vsechny.length - pulkyVybrane.odpoledne,
    celkem: vsechny.length,
    duvod: null,
    dopoledne,
    odpoledne,
    // Počty jsou jen pro popisek; o půlení rozhoduje stav obou polovin.
    odjezdy: odjezdovy ? vsechny.filter(r => odjezdVDen(ad, den, r.id)).length : 0,
    prijezdy: prijezdovy ? vsechny.filter(r => prijezdVDen(ad, den, r.id)).length : 0,
  };
}

export function renderDostupnostModal(ad) {
  const p = ad.prehled || prazdnyPrehled();
  const zaklad = p.od || dnesStr();
  const { year, month } = p.rokMesic || (() => {
    const [y, m] = zaklad.split('-').map(Number);
    return { year: y, month: m };
  })();

  const prvniDen = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const dnuVMesici = new Date(year, month, 0).getDate();
  const dnes = dnesStr();

  let dny = '';
  for (let i = 0; i < prvniDen; i++) dny += '<div class="cal-day cal-day-empty"></div>';

  for (let d = 1; d <= dnuVMesici; d++) {
    const den = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const { volno, celkem, duvod, odjezd, prijezd, odjezdy, prijezdy, hotelObsazeno, hotelCelkem,
            dopoledne, odpoledne } = stavDne(ad, den, p.roomId);
    // Červená = tenhle pokoj (nebo celý hotel) je zabraný, oranžová = volný,
    // ale jinde v hotelu už rezervace je. Stejné pravidlo jako na webu.
    const plne = odpoledne === 'plno';
    const castecne = odpoledne === 'castecne';
    const jeOdjezdovy = dopoledne !== 'volno' && odpoledne === 'volno';
    const jePrijezdovy = dopoledne === 'volno' && odpoledne !== 'volno';

    // Ve vybraném rozsahu patří podklad výběru, ne obsazenosti — obsluha
    // potřebuje vidět, kam až výběr sahá. Půlka v barvě obsazenosti přes
    // něj kreslila oranžovou a prostřední den vypadal nevybraně.
    const jeVybrany = Boolean(den === p.od || den === p.doo || (p.od && p.doo && den > p.od && den < p.doo));

    let tridy = 'cal-day';
    if (jeVybrany) {
      if (plne) tridy += ' is-full';
      else if (castecne) tridy += ' is-partial';
    } else {
      const trida = tridaPulek(dopoledne, odpoledne);
      if (trida) tridy += ' ' + trida;
    }
    if (den === p.od) tridy += ' is-from is-selected';
    if (den === p.doo) tridy += ' is-to is-selected';
    if (p.od && p.doo && den > p.od && den < p.doo) tridy += ' in-range';
    if (den < dnes) tridy += ' je-minulost';

    const popisStavu = p.roomId === 'all'
      ? (plne ? 'Plně obsazeno' : `Volných pokojů: ${volno} z ${celkem}`)
      : (duvod
        ? (duvod.typ === 'blokace' ? `Blokace: ${duvod.popis}` : `Obsazeno — ${duvod.popis}`)
        : (castecne ? `Volno — v hotelu obsazeno ${hotelObsazeno} z ${hotelCelkem}` : 'Volno'));
    // Pozor: buňka se půlí i tehdy, když se ráno uvolní CIZÍ pokoj. U toho
    // vybraného pak žádný odjezd ani příjezd není a `odjezd` / `prijezd`
    // je null — proto se na ně musí sáhnout až po ověření.
    let popisPrestupu = '';
    if (jeOdjezdovy) {
      if (p.roomId === 'all') {
        popisPrestupu = ` · odjezd ${odjezdy} ${odjezdy === 1 ? 'pokoje' : 'pokojů'}`;
      } else if (odjezd) {
        popisPrestupu = ` · ${odjezd.typ === 'rezervace' ? odjezd.popis + ' odjíždí' : 'konec blokace'}`;
      }
    } else if (jePrijezdovy) {
      if (p.roomId === 'all') {
        popisPrestupu = ` · příjezd ${prijezdy} ${prijezdy === 1 ? 'pokoje' : 'pokojů'}`;
      } else if (prijezd) {
        popisPrestupu = ` · ${prijezd.typ === 'rezervace' ? prijezd.popis + ' přijíždí' : 'začátek blokace'}`;
      }
    }
    const popis = (den < dnes ? `${popisStavu} — tenhle den už je za námi` : popisStavu) + popisPrestupu;

    // U celého hotelu se pod číslem ukáže, kolik pokojů zbývá — hlavní
    // údaj, kvůli kterému se majitel na kalendář dívá.
    const cislo = p.roomId === 'all' && !plne
      ? `${d}<span class="dostupnost-pocet">${volno}</span>`
      : `${d}`;

    dny += `<button type="button" class="${tridy}" data-den="${den}" title="${escapuj(popis)}">${cislo}</button>`;
  }

  const noci = pocetNoci(p.od, p.doo);
  const pokojNazev = p.roomId === 'all'
    ? 'celý hotel'
    : ((MOCK_ROOMS.find(r => r.id === p.roomId) || {}).name || p.roomId);

  // Co je ve vybraném rozsahu obsazené — odpověď na „je tohle volné?"
  let vypisRozsahu = '';
  if (p.od && p.doo) {
    const pokoje = p.roomId === 'all' ? prodejnePokoje(ad) : MOCK_ROOMS.filter(r => r.id === p.roomId);
    const radky = pokoje.map(rm => {
      const kolize = [];
      for (let den = p.od; den < p.doo; den = posunDatum(den, 1)) {
        const d = zabranyDuvod(ad, den, rm.id);
        if (d && !kolize.some(k => k.popis === d.popis && k.typ === d.typ)) kolize.push(d);
      }
      return { rm, kolize };
    });
    const volne = radky.filter(r => r.kolize.length === 0);
    // Jen rezervace, ne blokace — blokaci přes blokaci nikomu nevadí,
    // kdežto host v termínu je důvod nejdřív zvednout telefon.
    const obsazene = radky.filter(r => r.kolize.some(k => k.typ === 'rezervace'));
    const dnuVcetne = noci + 1;
    vypisRozsahu = `
      <div style="${S.blok}">
        <strong style="display: block; font-size: 14px; font-weight: 800; color: #1c1c19; margin-bottom: 4px;">
          ${formatCzechDateStr(p.od)} – ${formatCzechDateStr(p.doo)} · ${noci} ${noci === 1 ? 'noc' : (noci < 5 ? 'noci' : 'nocí')}
        </strong>
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b6b60;">
          ${volne.length > 0
            ? `Volných pokojů v celém termínu: <strong style="color: #4a5a24;">${volne.length}</strong> z ${radky.length}`
            : '<strong style="color: #c62828;">V tomto termínu není volný žádný pokoj.</strong>'}
        </p>
        <div class="admin-vnitrni-seznam" style="display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto;">
          ${radky.map(({ rm, kolize }) => `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 5px; border: 1px solid #e4e2d8; border-left: 3px solid ${kolize.length ? '#c62828' : '#697947'}; background: #fff; flex-wrap: wrap;">
              <span style="font-size: 13.5px; font-weight: 700; color: #1c1c19;">${escapuj(rm.name)}</span>
              ${kolize.length === 0 ? `
                <span style="font-size: 12.5px; font-weight: 600; color: #4a5a24;">Volno</span>
              ` : `
                <span style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                  ${kolize.map(k => k.typ === 'blokace' ? `
                    <span style="font-size: 12.5px; font-weight: 600; color: #a5231f;">Blokace: ${escapuj(k.popis)}</span>
                    <button type="button" class="btn-prehled-odblokovat" data-id="${escapuj(k.zaznam.id)}" style="border: 1px solid #d9a3a1; background: #fff; color: #a5231f; border-radius: 4px; padding: 4px 10px; font-size: 12px; font-weight: 700; cursor: pointer;">Zrušit blokaci</button>
                  ` : `
                    <span style="font-size: 12.5px; font-weight: 600; color: #a5231f;">${escapuj(k.popis)}${k.zaznam.code ? ` (${escapuj(k.zaznam.code)})` : ''}</span>
                    <button type="button" class="btn-prehled-rezervace" data-kod="${escapuj(k.zaznam.code || '')}" style="border: 1px solid #c9c8bd; background: #fff; color: #1c1c19; border-radius: 4px; padding: 4px 10px; font-size: 12px; font-weight: 700; cursor: pointer;">Zobrazit rezervaci</button>
                  `).join('')}
                </span>
              `}
            </div>
          `).join('')}
        </div>

        ${obsazene.length > 0 ? `
          <div style="margin-top: 14px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; padding: 12px 14px; font-size: 13px; color: #795548; line-height: 1.5;">
            <strong>⚠️ V tomto termínu už máte ${obsazene.length === 1 ? 'rezervaci' : `rezervace (${obsazene.length})`}:</strong>
            <ul style="margin: 6px 0 0 0; padding-left: 18px;">
              ${obsazene.map(({ rm, kolize }) => `
                <li>
                  <strong>${escapuj(rm.name)}</strong> —
                  ${kolize.filter(k => k.typ === 'rezervace')
                    .map(k => escapuj(k.popis) + (k.zaznam && k.zaznam.code ? ` (${escapuj(k.zaznam.code)})` : ''))
                    .join(', ')}
                </li>
              `).join('')}
            </ul>
            <p style="margin: 8px 0 0 0;">
              Zablokovat termín <strong>jde</strong>, ale hosté tím nezmizí — pokoj jim zůstane obsazený.
              Napište jim nebo zavolejte a rezervaci stornujte, jinak přijedou na termín, který máte zavřený.
            </p>
          </div>
        ` : ''}

        <div style="margin-top: 14px;">
          <label style="${S.popisek}">Důvod blokace (uvidíte ho v seznamu níž)</label>
          <input type="text" class="prehled-duvod" style="${S.input}" placeholder="např. Booking.com, telefonát, uzávěrka" value="${escapuj(p.duvod)}">
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px;">
            ${['Booking.com', 'Telefonická rezervace', 'Dovolená správy', 'Uzávěrka'].map(d => `
              <button type="button" class="btn-prehled-duvod-predvolba" data-duvod="${escapuj(d)}" style="background:#f2f1ea; border:1px solid #d8d5c9; border-radius:4px; padding:4px 9px; font-size:12px; font-weight:600; cursor:pointer; color:#4a5a24;">+ ${escapuj(d)}</button>
            `).join('')}
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap;">
          <button type="button" class="btn btn-specs-secondary btn-prehled-rezervovat">
            ${p.roomId === 'all' ? '➕ Zarezervovat celý hotel' : '➕ Zapsat rezervaci'}
          </button>
          <button type="button" class="btn btn-specs-secondary btn-prehled-blokovat">
            🔒 Zablokovat termín
          </button>
        </div>
        <p style="margin: 8px 0 0 0; font-size: 12.5px; color: #6b6b60;">
          Blokace zavře <strong>${formatCzechDateStr(p.od)} – ${formatCzechDateStr(p.doo)}</strong>, tedy
          ${dnuVcetne} ${dnuVcetne === 1 ? 'den' : (dnuVcetne < 5 ? 'dny' : 'dnů')} včetně obou krajních.
          Rezervace se počítá jinak — ${noci} ${noci === 1 ? 'noc' : (noci < 5 ? 'noci' : 'nocí')}, protože ${formatCzechDateStr(p.doo)} je den odjezdu.
        </p>
        ${p.roomId === 'all' ? `
          <p style="margin: 8px 0 0 0; font-size: 12.5px; color: #6b6b60;">
            Skupinová akce: založí se rezervace na <strong>každý prodejný pokoj</strong> se stejným hostem
            a termínem, takže hotel bude celý obsazený. V seznamu se objeví ${prodejnePokoje(ad).length} karet
            označených jako skupinová akce. Cenu za celou akci můžete ve formuláři přepsat, rozpočítá se sama.
          </p>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-prehled">
      <div class="admin-confirm-modal admin-block-modal${p.pohled !== 'kalendar' ? ' je-plachta' : ''}" style="max-width: ${p.pohled !== 'kalendar' ? '1180px' : '640px'}; padding: 0 24px 24px 24px;">
        <div class="admin-modal-header-sticky">
          <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">📆 Přehled dostupnosti</h3>
          <button type="button" class="btn-close-prehled" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
        </div>

        <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 16px; font-size: 13.5px; color: #55554e;">
          Kdo se ptá po telefonu, jestli máte volno. Klepněte na příjezd a odjezd — a rovnou termín zapište nebo zablokujte.
        </p>

        ${p.pohled === 'kalendar' ? `
        <div style="${S.blok}">
          <label style="${S.popisek}">Co chcete vidět</label>
          <select class="prehled-pokoj" style="${S.input}">
            <option value="all" ${p.roomId === 'all' ? 'selected' : ''}>Celý hotel — kolik pokojů je volných</option>
            ${MOCK_ROOMS.map(rm => `
              <option value="${rm.id}" ${rm.id === p.roomId ? 'selected' : ''}>${escapuj(rm.name)}${rm.isDisabled ? ' — mimo provoz' : ''}</option>
            `).join('')}
          </select>
        </div>
        ` : ''}

        <div class="prehled-prepinac">
          <button type="button" class="prehled-prepinac-btn${p.pohled !== 'kalendar' ? ' je-aktivni' : ''}" data-pohled="plachta">Tabulka měsíce</button>
          <button type="button" class="prehled-prepinac-btn${p.pohled === 'kalendar' ? ' je-aktivni' : ''}" data-pohled="kalendar">Kalendář jednoho pokoje</button>
        </div>

        ${p.pohled !== 'kalendar' ? renderPlachta(ad, year, month) : `
        <div class="dostupnost-kalendar" style="${S.blok} padding: 8px 10px 14px 10px;">
          <div class="cal-modal-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 6px 10px 6px;">
            <span class="cal-month-title">${MESICE[month - 1]} ${year}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="btn btn-cal-nav cal-nav-btn prehled-prev" title="Předchozí měsíc">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <button type="button" class="btn btn-cal-nav cal-nav-btn prehled-next" title="Následující měsíc">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
              <button type="button" class="btn btn-cal-reset prehled-reset" style="font-size: 13px; font-weight: 600; color: #4A5A24; background: none; border: none; cursor: pointer; padding: 4px 8px; text-decoration: underline;">Vynulovat</button>
            </div>
          </div>

          <div class="cal-week-days">
            <span>Po</span><span>Út</span><span>St</span><span>Čt</span><span>Pá</span><span>So</span><span>Ne</span>
          </div>

          <div class="cal-grid">${dny}</div>

          <div class="cal-legend" style="display:flex; flex-wrap:wrap; gap:14px; padding:12px 6px 2px 6px; border-top:1px solid #E7E5DC; margin-top:8px;">
            <span class="cal-legend-item"><i class="cal-legend-box" style="background:var(--kal-volno);"></i> Volno</span>
            <span class="cal-legend-item"><i class="cal-legend-box" style="background:var(--kal-vybrano);"></i> Vybraný termín</span>
            <span class="cal-legend-item"><i class="cal-legend-box" style="background:#fcecc2;"></i> Částečně obsazeno</span>
            <span class="cal-legend-item"><i class="cal-legend-box" style="background:#f9d9d4;"></i> ${p.roomId === 'all' ? 'Plně obsazeno' : 'Obsazeno'}</span>
            <span class="cal-legend-item" style="opacity: 0.7;"><i class="cal-legend-box" style="background:#e8e6dd; filter: grayscale(0.35);"></i> Už proběhlo</span>
          </div>

          <p style="margin: 10px 6px 0 6px; font-size: 12.5px; color: #6b6b60;">
            ${p.od && !p.doo ? `Příjezd ${formatCzechDateStr(p.od)} — klepněte ještě na den odjezdu.`
              : (p.od && p.doo ? `Vybráno: ${pokojNazev}, ${formatCzechDateStr(p.od)} – ${formatCzechDateStr(p.doo)}`
              : 'Klepněte na den příjezdu, potom na den odjezdu.')}
          </p>
        </div>
        `}

        ${vypisRozsahu}

        ${(ad.blockedDates || []).length > 0 ? `
          <div style="${S.blok}">
            <strong style="display: block; font-size: 14px; font-weight: 800; color: #1c1c19; margin-bottom: 4px;">Zablokované termíny (${ad.blockedDates.length})</strong>
            <p style="margin: 0 0 12px 0; font-size: 12.5px; color: #6b6b60;">Vše, co je teď zavřené pro rezervace přes web — u kterého pokoje a na jak dlouho.</p>
            <div class="admin-vnitrni-seznam" style="display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto;">
              ${[...ad.blockedDates].sort((x, y) => String(x.date_from).localeCompare(String(y.date_from))).map(b => `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: 5px; border: 1px solid #e4e2d8; border-left: 3px solid #c62828; background: #fff; flex-wrap: wrap;">
                  <div style="min-width: 0;">
                    <div style="font-size: 13.5px; font-weight: 700; color: #1c1c19;">
                      ${b.room_id === 'all' ? 'Celý hotel — všechny pokoje' : escapuj((MOCK_ROOMS.find(m => m.id === b.room_id) || {}).name || b.room_id)}
                    </div>
                    <div style="font-size: 12.5px; font-weight: 600; color: #4a5a24; margin-top: 2px;">${zobrazRozsahBlokace(b.date_from, b.date_to)}</div>
                    ${b.reason ? `<div style="font-size: 12px; color: #777; margin-top: 2px;">${escapuj(b.reason)}</div>` : ''}
                  </div>
                  <button type="button" class="btn-prehled-odblokovat" data-id="${escapuj(b.id)}" style="flex-shrink: 0; border: 1px solid #d9a3a1; background: #fff; color: #a5231f; border-radius: 4px; padding: 6px 12px; font-size: 12.5px; font-weight: 700; cursor: pointer;">Zrušit blokaci</button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

export function bindDostupnostModal(ad) {
  if (!ad.showPrehledModal) return;

  const zavri = () => { ad.showPrehledModal = false; ad.render(); };
  ad.container.querySelectorAll('.btn-close-prehled').forEach(b => b.addEventListener('click', zavri));

  const prekryti = ad.container.querySelector('.admin-modal-overlay-prehled');
  if (prekryti) prekryti.addEventListener('click', (e) => { if (e.target === prekryti) zavri(); });

  ad.container.querySelectorAll('.prehled-prepinac-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ad.prehled.pohled = btn.dataset.pohled;
      ad.render();
    });
  });

  bindPlachta(ad);

  const vyber = ad.container.querySelector('.prehled-pokoj');
  if (vyber) {
    vyber.addEventListener('change', () => {
      ad.prehled.roomId = vyber.value;
      ad.render();
    });
  }

  const posun = (o) => {
    const p = ad.prehled;
    const zaklad = p.rokMesic || (() => {
      const [y, m] = (p.od || dnesStr()).split('-').map(Number);
      return { year: y, month: m };
    })();
    const d = new Date(zaklad.year, zaklad.month - 1 + o, 1);
    p.rokMesic = { year: d.getFullYear(), month: d.getMonth() + 1 };
    ad.render();
  };
  ad.container.querySelectorAll('.prehled-prev').forEach(b => b.addEventListener('click', () => posun(-1)));
  ad.container.querySelectorAll('.prehled-next').forEach(b => b.addEventListener('click', () => posun(1)));

  ad.container.querySelectorAll('.prehled-reset').forEach(b => {
    b.addEventListener('click', () => { ad.prehled.od = null; ad.prehled.doo = null; ad.render(); });
  });

  // Obsazený den jde vybrat taky — majitel se může ptát právě na něj,
  // nebo chce přes obsazený termín zablokovat celý rozsah.
  ad.container.querySelectorAll('.admin-modal-overlay-prehled .cal-day[data-den]').forEach(el => {
    el.addEventListener('click', () => {
      const p = ad.prehled;
      const den = el.dataset.den;
      if (p.od && p.doo) { p.od = den; p.doo = null; }
      else if (!p.od || den <= p.od) { p.od = den; p.doo = null; }
      else { p.doo = den; }
      ad.render();
    });
  });

  const poleDuvod = ad.container.querySelector('.prehled-duvod');
  if (poleDuvod) {
    poleDuvod.addEventListener('input', () => { ad.prehled.duvod = poleDuvod.value; });
  }

  ad.container.querySelectorAll('.btn-prehled-duvod-predvolba').forEach(chip => {
    chip.addEventListener('click', () => {
      ad.prehled.duvod = chip.dataset.duvod || '';
      if (poleDuvod) poleDuvod.value = ad.prehled.duvod;
    });
  });

  // Zapsat rezervaci — otevře ruční formulář s předvyplněným pokojem a termínem.
  const btnRez = ad.container.querySelector('.btn-prehled-rezervovat');
  if (btnRez) {
    btnRez.addEventListener('click', () => {
      const p = ad.prehled;
      if (!p.od || !p.doo) return;
      ad.otevriRucniRezervaci({ room_id: p.roomId, date_from: p.od, date_to: p.doo });
    });
  }

  // Zrušit blokaci — stejná cesta jako v okně Blokovat termíny, takže
  // se maže i v databázi, ne jen na obrazovce.
  ad.container.querySelectorAll('.btn-prehled-odblokovat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!id) return;
      btn.disabled = true;
      btn.textContent = 'Ruším…';
      await ad.removeBlockedDate(id);
    });
  });

  // Rezervaci nelze z přehledu rušit jedním klikem — storno posílá hostovi
  // e-mail, a to má zůstat u karty rezervace, kde je vidět celý kontext.
  ad.container.querySelectorAll('.btn-prehled-rezervace').forEach(btn => {
    btn.addEventListener('click', () => {
      const kod = btn.dataset.kod;
      ad.showPrehledModal = false;
      ad.statusFilter = 'all';
      ad.selectedRoomFilter = 'all';
      ad.render();
      // Po překreslení odrolovat ke kartě té rezervace a zvýraznit ji.
      setTimeout(() => {
        const karta = [...ad.container.querySelectorAll('.admin-res-card')]
          .find(el => el.textContent.includes(kod));
        if (!karta) return;
        karta.scrollIntoView({ block: 'center' });
        karta.style.transition = 'box-shadow 0.3s ease';
        karta.style.boxShadow = '0 0 0 3px rgba(105, 121, 71, 0.55)';
        setTimeout(() => { karta.style.boxShadow = ''; }, 2200);
      }, 120);
    });
  });

  // Zablokovat termín. Pozor na rozdíl proti rezervaci: klepnutí na 24. a 30.
  // znamená u rezervace „přijede 24., odjíždí 30.", tedy noci 24.–29., kdežto
  // u blokace „zavři mi 24. až 30.", tedy včetně třicátého. Do databáze proto
  // jde date_to o den dál — date_to je pořád výlučné, mění se jen to, co si
  // pod vybraným rozsahem představuje obsluha.
  const btnBlok = ad.container.querySelector('.btn-prehled-blokovat');
  if (btnBlok) {
    btnBlok.addEventListener('click', async () => {
      const p = ad.prehled;
      if (!p.od || !p.doo) return;
      // Blokace přes cizí rezervaci je nevratná v tom smyslu, že hostovi
      // zůstane potvrzený pobyt na termín, který je zavřený. Musí to projít
      // vědomím obsluhy, ne jedním kliknutím.
      const koliznich = prodejnePokoje(ad).filter(rm => {
        for (let den = p.od; den <= p.doo; den = posunDatum(den, 1)) {
          const d = zabranyDuvod(ad, den, rm.id);
          if (d && d.typ === 'rezervace') return true;
        }
        return false;
      });
      if (koliznich.length > 0) {
        const jmena = koliznich.map(rm => rm.name).join(', ');
        const potvrzeno = await adminPotvrzeni({
          nadpis: 'V tomto termínu už jsou rezervace',
          text: `V termínu ${formatCzechDateStr(p.od)} – ${formatCzechDateStr(p.doo)} jsou obsazené tyto pokoje: ${jmena}.\n\n`
            + 'Blokace je nezruší — hostům zůstane potvrzený pobyt na termín, který zavíráte. '
            + 'Budete jim muset napsat nebo zavolat a rezervaci stornovat.',
          potvrdit: 'Přesto zablokovat',
          zrusit: 'Nechat být',
          nebezpecne: true,
        });
        if (!potvrzeno) return;
      }

      btnBlok.disabled = true;
      btnBlok.textContent = 'Blokuji…';
      await ad.addBlockedDate(p.roomId, p.od, posunDatum(p.doo, 1), (p.duvod || '').trim() || 'Uzávěrka recepce');
      p.duvod = '';
      ad.render();
    });
  }
}
