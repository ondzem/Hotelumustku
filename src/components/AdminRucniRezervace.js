// ---------------------------------------------------------------------
//  RUČNÍ ZALOŽENÍ REZERVACE
//
//  Recepční často domluví pobyt po telefonu nebo přímo na místě. Dřív
//  musel takovou rezervaci naklikat ve veřejném formuláři jako host,
//  což znamenalo vyplňovat souhlasy a čekat, až si žádost sám schválí.
//  Tohle okno zapíše rezervaci rovnou v té podobě, v jaké ji ukládá
//  rezervační formulář — stejné sloupce, stejný tvar ceny.
//
//  Cena se počítá ze stejného ceníku jako na webu, ale poslední slovo
//  má obsluha: pole „Celkem zaplaceno" jde přepsat a záloha s doplatkem
//  se z něj dopočítají. Dohodnutá cena po telefonu nemusí sedět na ceník.
//
//  E-maily se odsud schválně neposílají. Host, který volal na recepci,
//  nečeká potvrzovací e-mail od systému, a rozesílat mu ho bez vyzvání
//  by bylo překvapení.
// ---------------------------------------------------------------------

import { MOCK_ROOMS, saveStoredReservation } from '../lib/supabaseClient.js';
import { calculateReservationPrice, generateReservationCode, generateManageToken, formatCzechPrice } from '../utils/pricing.js';
import { obsazenostPulek, stavPulky, tridaPulek } from '../utils/obsazenost.js';
import { maxOsobNaPokoji } from '../utils/cenik.js';
import { adminPotvrzeni } from './AdminPotvrzeni.js';

const S = {
  input: 'width: 100%; height: 42px; font-size: 14.5px; padding: 0 11px; border-radius: 5px; border: 1.5px solid #c9c8bd; box-sizing: border-box; background: #fff; color: #1c1c19;',
  popisek: 'display: block; font-size: 12.5px; font-weight: 700; color: #55554e; margin-bottom: 5px;',
  blok: 'background: #fff; border: 1.5px solid #e0dfd5; border-radius: 8px; padding: 16px 18px; margin-bottom: 14px;',
  nadpisBloku: 'display: block; font-size: 14px; font-weight: 800; color: #1c1c19; margin-bottom: 14px;',
  mrizka: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px 14px;',
};

/** Datum v českém tvaru — stejně jako v BookingSystem a na tištěném lístku. */
function formatCzechDateStr(isoStr) {
  if (!isoStr) return '';
  const parts = String(isoStr).split('-');
  if (parts.length !== 3) return isoStr;
  const [rok, mesic, den] = parts;
  return `${parseInt(den, 10)}. ${parseInt(mesic, 10)}. ${rok}`;
}

const escapuj = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Prázdný formulář.
 *
 * Termín schválně nevyplněný: předvyplněné „dnes → zítra" vypadalo jako
 * volba, kterou obsluha udělala, a snadno se odeslalo omylem.
 */
export function prazdnaRucniRezervace() {
  return {
    date_from: '',
    date_to: '',
    // Prázdné schválně. Předvyplněný pokoj obsluha přehlédla a zapsala
    // rezervaci na jiný, než chtěla — formulář si o něj musí říct sám.
    room_id: '',
    adults_count: 2,
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    guest_street: '',
    guest_city: '',
    guest_zip: '',
    guest_note: '',
    has_half_board: false,
    half_board_count: 2,
    has_dog: false,
    has_ebike: false,
    ebike_count: 1,
    has_winter_parking: false,
    parking_cars_count: 1,
    status: 'confirmed',
    total_price: '',      // prázdné = vzít cenu z ceníku
    zaplaceno: false,
    // Rozbalený seznam pokojů s dostupností
    pokojOtevreny: false,
    // Obsluha vědomě potvrdila zápis na obsazený pokoj (výměna, chystané
    // storno). Bez toho uložení na obsazený pokoj neprojde.
    povolitKolizi: false,
    // Kalendář — stejný jako na webu, jen se otevírá uvnitř tohoto okna
    calOtevreny: false,
    calRokMesic: null,
    tempFrom: null,
    tempTo: null,
  };
}

/** Identifikátor „celý hotel" ve výběru pokoje. Stejný jako u blokací. */
export const CELY_HOTEL = 'all';

/** Pokoje, které se dají prodat — vyřazené z provozu do skupiny nepatří. */
function pokojeHotelu() {
  return MOCK_ROOMS.filter(r => !r.isDisabled);
}

/**
 * Rozdělí skupinu po pokojích.
 *
 * Skupina, která si kupuje celý hotel, si lidi rozmístí sama; pro ceník ale
 * musí být jasné, kolik osob spí kde, protože cena je za osobu a noc. Plní se
 * postupně do kapacity. Pokoj, na který se nedostane, se pořád rezervuje —
 * skupina ho má zaplacený jako součást hotelu — ale počítá se jako jedna
 * osoba, protože nula osob by v ceníku nedala žádnou sazbu.
 */
function rozdelOsobyPoPokojich(celkemOsob) {
  const pokoje = pokojeHotelu();
  let zbyva = Math.max(1, celkemOsob);
  return pokoje.map(rm => {
    const kapacita = maxOsobNaPokoji(rm);
    const osob = Math.min(kapacita, Math.max(1, zbyva));
    zbyva = Math.max(0, zbyva - osob);
    return { pokoj: rm, osob };
  });
}

/** Kolik lidí se do hotelu vejde dohromady. */
export function kapacitaHotelu() {
  return pokojeHotelu().reduce((soucet, rm) => soucet + maxOsobNaPokoji(rm), 0);
}

/** Počet nocí mezi dvěma daty; záporný nebo nulový rozsah vrací 0. */
function pocetNoci(od, doo) {
  if (!od || !doo) return 0;
  const rozdil = (new Date(doo) - new Date(od)) / 86400000;
  return rozdil > 0 ? Math.round(rozdil) : 0;
}

/**
 * Rozpis ceny pro rozepsaný formulář.
 *
 * Používá stejnou funkci jako rezervační formulář na webu, takže ručně
 * založená rezervace stojí přesně tolik, kolik by stála přes web.
 */
export function spoctiRucniCenu(f, cenik) {
  // Bez zvoleného pokoje není z čeho počítat — formulář ukáže prázdno,
  // ne cenu prvního pokoje v seznamu.
  if (!f.room_id) return null;

  // Celý hotel: každý pokoj se ocení zvlášť a částky se sečtou. Sazba je za
  // osobu a noc, takže jeden společný výpočet by dal nesmysl.
  if (f.room_id === CELY_HOTEL) {
    const noci = pocetNoci(f.date_from, f.date_to);
    if (noci < 1) return null;
    const rozpis = rozdelOsobyPoPokojich(parseInt(f.adults_count, 10) || 1);
    // Příplatky (polopenze, pes, elektrokola, parkování) si skupina objednává
    // jednou za celou akci, ne za každý pokoj. Kdyby se předaly do každého
    // výpočtu, sečetly by se devětkrát.
    const bezPriplatku = {
      has_half_board: false, has_dog: false, has_ebike: false, has_winter_parking: false,
    };
    const casti = rozpis.map(({ pokoj, osob }, i) =>
      spoctiRucniCenu({
        ...f,
        ...(i === 0 ? {} : bezPriplatku),
        room_id: pokoj.id,
        adults_count: osob,
      }, cenik)).filter(Boolean);
    if (casti.length === 0) return null;
    const soucet = (klic) => casti.reduce((a, c) => a + (c[klic] || 0), 0);
    return {
      ...casti[0],
      accommodationPrice: soucet('accommodationPrice'),
      ubytovaniBezPriplatku: soucet('ubytovaniBezPriplatku'),
      soloPriplatekCelkem: soucet('soloPriplatekCelkem'),
      addonsPrice: soucet('addonsPrice'),
      cityTax: soucet('cityTax'),
      winterParkingPriceTotal: soucet('winterParkingPriceTotal'),
      totalPrice: soucet('totalPrice'),
      depositPercentage: casti[0].depositPercentage,
    };
  }

  const pokoj = MOCK_ROOMS.find(r => r.id === f.room_id) || MOCK_ROOMS[0];
  const noci = pocetNoci(f.date_from, f.date_to);
  // Bez termínu nemá cena co počítat — jinak by výpočet sáhl po sazbě
  // pro dnešek a formulář by ukazoval částku za pobyt, který není zadaný.
  if (noci < 1) return null;
  return calculateReservationPrice({
    roomType: pokoj.type,
    roomId: pokoj.id,
    nights: Math.max(1, noci),
    persons: Math.max(1, parseInt(f.adults_count, 10) || 1),
    adults: Math.max(1, parseInt(f.adults_count, 10) || 1),
    children: 0,
    dateFrom: f.date_from,
    dateTo: f.date_to,
    hasDog: Boolean(f.has_dog),
    hasEbike: Boolean(f.has_ebike),
    ebikeCount: parseInt(f.ebike_count, 10) || 1,
    hasHalfBoard: Boolean(f.has_half_board),
    halfBoardCount: parseInt(f.half_board_count, 10) || 1,
    hasWinterParking: Boolean(f.has_winter_parking),
    parkingCarsCount: parseInt(f.parking_cars_count, 10) || 1,
    cenik,
    nastaveni: cenik && cenik.nastaveni,
  });
}


const MESICE = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

const dnesStr = () => new Date().toISOString().split('T')[0];

/**
 * Obsazenost dne pro kalendář v administraci.
 *
 * Vrací dvě čísla: jestli je zabraný právě vybíraný pokoj a kolik
 * prodejných pokojů je zabraných celkem. Recepční tak vidí totéž, co
 * host na webu (žluté částečně obsazeno), a navíc červeně dny, kdy je
 * obsazený konkrétně ten pokoj, který právě zapisuje.
 */
function obsazenostDne(ad, den, roomId) {
  const prodejne = MOCK_ROOMS.filter(r => !r.isDisabled);
  const jeAktivni = (x) => !(x.status && (String(x.status).startsWith('cancelled') || x.status === 'stornováno'));

  // Půlené dny: date_from znamená obsazeno až od 15:00, date_to zase jen
  // do 10:00. Bez toho vypadá den výměny hostů jako celý zabraný a recepční
  // do něj nezapíše příjezd, i když by mohla.
  const cb = {
    obsazeno: (id) =>
      (ad.reservations || []).some(x => x.room_id === id && jeAktivni(x) && den >= x.date_from && den < x.date_to)
      || (ad.blockedDates || []).some(b => (b.room_id === 'all' || b.room_id === id) && den >= b.date_from && den < b.date_to),
    zacina: (id) =>
      (ad.reservations || []).some(x => x.room_id === id && jeAktivni(x) && x.date_from === den)
      || (ad.blockedDates || []).some(b => (b.room_id === 'all' || b.room_id === id) && b.date_from === den),
    konci: (id) =>
      (ad.reservations || []).some(x => x.room_id === id && jeAktivni(x) && x.date_to === den)
      || (ad.blockedDates || []).some(b => (b.room_id === 'all' || b.room_id === id) && b.date_to === den),
  };

  const vsechny = prodejne.map(r => r.id);
  const pulkyVybrane = obsazenostPulek(roomId ? [roomId] : vsechny, cb);
  const pulkyHotel = roomId ? obsazenostPulek(vsechny, cb) : pulkyVybrane;

  return {
    dopoledne: stavPulky(pulkyVybrane.dopoledne, pulkyVybrane.celkem, pulkyHotel.dopoledne),
    odpoledne: stavPulky(pulkyVybrane.odpoledne, pulkyVybrane.celkem, pulkyHotel.odpoledne),
    obsazeno: pulkyHotel.odpoledne,
    celkem: prodejne.length,
  };
}

/**
 * Je pokoj v zadaném termínu volný — a když ne, čím?
 *
 * Odpovídá na přesně tu otázku, kterou má obsluha před sebou: „můžu sem
 * teď někoho zapsat?". Bere v úvahu obojí, rezervace i blokace, protože
 * zavřený pokoj se prodat nesmí zrovna tak jako obsazený.
 *
 * Konvence date_to je výlučná (viz CLAUDE.md), takže dva pobyty se
 * překrývají teprve tehdy, když `a.od < b.doo && a.doo > b.od`. Den
 * odjezdu se s dnem příjezdu dalšího hosta nebije.
 */
export function dostupnostPokoje(ad, rm, od, doo) {
  if (rm.isDisabled) {
    return { stav: 'mimo', popis: 'Mimo provoz — pokoj se neprodává' };
  }
  if (!od || !doo || doo <= od) {
    return { stav: 'nezname', popis: 'Nejdřív vyberte termín' };
  }

  const jeStorno = (r) => r.status && (String(r.status).startsWith('cancelled') || r.status === 'stornováno');

  const kolizniRezervace = (ad.reservations || []).filter(r =>
    r.room_id === rm.id && !jeStorno(r) && r.date_from < doo && r.date_to > od);

  if (kolizniRezervace.length > 0) {
    const r = kolizniRezervace[0];
    const kdo = String(r.guest_name || '').trim() || 'host';
    const dalsi = kolizniRezervace.length > 1 ? ` (+ ${kolizniRezervace.length - 1} další)` : '';
    return {
      stav: 'obsazeno',
      popis: `Obsazeno: ${kdo}, ${formatCzechDateStr(r.date_from)} – ${formatCzechDateStr(r.date_to)}${dalsi}`,
      kolize: kolizniRezervace,
    };
  }

  // Blokace celého hotelu (room_id 'all') platí i na tenhle pokoj — jinak
  // by vypadal volný, přestože je zavřený.
  const kolizniBlokace = (ad.blockedDates || []).filter(b =>
    (b.room_id === 'all' || b.room_id === rm.id) && b.date_from < doo && b.date_to > od);

  if (kolizniBlokace.length > 0) {
    const b = kolizniBlokace[0];
    const duvod = String(b.reason || b.duvod || '').trim() || 'Uzávěrka recepce';
    return { stav: 'blokace', popis: `Zavřeno: ${duvod}`, kolize: kolizniBlokace };
  }

  return { stav: 'volno', popis: 'Volný v celém termínu' };
}

/** Popis lůžek — stejná věta jako na webu, ať recepční vidí totéž co host. */
function popisLuzek(rm) {
  const luzka = Number(rm.zakladni_luzka ?? rm.capacity ?? 2);
  const pristylky = Number(rm.max_pristylek ?? rm.extraBeds ?? 0);
  const slovoL = luzka === 1 ? 'lůžko' : (luzka < 5 ? 'lůžka' : 'lůžek');
  if (!pristylky) return `${luzka} ${slovoL}`;
  const slovoP = pristylky === 1 ? 'přistýlka' : (pristylky < 5 ? 'přistýlky' : 'přistýlek');
  return `${luzka} ${slovoL} + ${pristylky} ${slovoP}`;
}

const TRIDY_STAVU = {
  volno:   { pill: 'status-available', dot: 'dot-available', text: 'Volno' },
  obsazeno:{ pill: 'status-occupied',  dot: 'dot-occupied',  text: 'Obsazeno' },
  blokace: { pill: 'status-occupied',  dot: 'dot-occupied',  text: 'Zavřeno' },
  mimo:    { pill: 'status-blocked',   dot: 'dot-blocked',   text: 'Mimo provoz' },
  nezname: { pill: 'status-blocked',   dot: 'dot-blocked',   text: 'Neznámo' },
};

/**
 * Výběr pokoje jako seznam s dostupností — ne prosté rozbalovátko.
 *
 * Prosté <select> ukazovalo jen názvy, takže obsluha zapsala hosta do
 * pokoje, který už byl na tentýž termín zabraný, a systém mlčel. Tady je
 * u každého pokoje vidět stav v tomhle termínu, cena za celý pobyt
 * a kapacita — přesně to, co ukazuje výběr pokoje na webu.
 *
 * Seznam se rozbaluje V TOKU, ne jako plovoucí panel nad obsahem. Panel
 * je uvnitř rolovacího okna administrace nespolehlivý: buď se ořízne,
 * nebo přeteče přes patičku s tlačítkem Založit rezervaci.
 */
function renderVyberPokoje(ad, f) {
  const maTermin = Boolean(f.date_from && f.date_to && f.date_to > f.date_from);
  const noci = pocetNoci(f.date_from, f.date_to);
  const celyHotel = f.room_id === CELY_HOTEL;
  const vybrany = MOCK_ROOMS.find(r => r.id === f.room_id) || null;

  const polozky = MOCK_ROOMS.map(rm => {
    const dostupnost = dostupnostPokoje(ad, rm, f.date_from, f.date_to);
    const maxOsob = maxOsobNaPokoji(rm);
    const osob = Math.max(1, Math.min(maxOsob, parseInt(f.adults_count, 10) || 1));
    // Cena se počítá pro tenhle pokoj, ne pro vybraný — obsluha si tak může
    // porovnat, o kolik vyjde jinak nadstandard.
    const cena = maTermin ? spoctiRucniCenu({ ...f, room_id: rm.id, adults_count: osob, total_price: '' }, ad.cenik) : null;
    return { rm, dostupnost, maxOsob, cena, maloMista: maxOsob < (parseInt(f.adults_count, 10) || 1) };
  });

  const volnych = polozky.filter(x => x.dostupnost.stav === 'volno').length;
  const prodejnych = polozky.filter(x => !x.rm.isDisabled).length;

  const stavVybraneho = vybrany ? dostupnostPokoje(ad, vybrany, f.date_from, f.date_to) : null;
  const t = stavVybraneho ? TRIDY_STAVU[stavVybraneho.stav] : null;

  const spousteciObsah = celyHotel
    ? `<span class="rucni-pokoj-nazev">🏨 Celý hotel — skupinová akce (${pokojeHotelu().length} pokojů)</span>`
    : (vybrany
      ? `<span class="rucni-pokoj-nazev">${escapuj(vybrany.name)}</span>
         <span class="room-status-pill ${t.pill}"><span class="status-dot ${t.dot}"></span>${t.text}</span>`
      : `<span class="rucni-pokoj-vyzva">— Vyberte pokoj —</span>`);

  return `
    <div style="grid-column: 1 / -1;">
      <label style="${S.popisek}">Pokoj</label>

      <div class="rucni-pokoj-vyber ${f.pokojOtevreny ? 'je-otevreny' : ''}">
        <button type="button" class="rucni-pokoj-spoust ${f.room_id ? 'ma-vyber' : ''}" aria-expanded="${f.pokojOtevreny ? 'true' : 'false'}">
          <span class="rucni-pokoj-spoust-text">${spousteciObsah}</span>
          <span class="rucni-pokoj-sipka">${f.pokojOtevreny ? '▲' : '▼'}</span>
        </button>

        ${f.pokojOtevreny ? `
          <div class="rucni-pokoj-panel">
            <div class="rucni-pokoj-hlavicka">
              ${maTermin
                ? `Dostupnost pro ${formatCzechDateStr(f.date_from)} – ${formatCzechDateStr(f.date_to)} · volných ${volnych} z ${prodejnych}`
                : 'Nejdřív vyberte termín — bez něj nejde dostupnost spočítat'}
            </div>

            <div class="rucni-pokoj-seznam">
              <div class="rucni-pokoj-polozka ${celyHotel ? 'je-vybrana' : ''}" data-pokoj="${CELY_HOTEL}" role="button" tabindex="0">
                <div class="rucni-pokoj-info">
                  <div class="rucni-pokoj-radek">
                    <span class="rucni-pokoj-jmeno">🏨 Celý hotel</span>
                    <span class="option-floor-tag">skupinová akce</span>
                  </div>
                  <div class="rucni-pokoj-radek-spodni">
                    <span class="option-capacity-tag">${pokojeHotelu().length} pokojů · až ${kapacitaHotelu()} osob</span>
                    ${maTermin && volnych < prodejnych ? `<span class="rucni-pokoj-duvod">Pozor: ${prodejnych - volnych} ${prodejnych - volnych === 1 ? 'pokoj není' : 'pokojů není'} volných</span>` : ''}
                  </div>
                </div>
                <div class="rucni-pokoj-stav">${celyHotel ? '<span class="option-checkmark">✓</span>' : ''}</div>
              </div>

              ${polozky.map(({ rm, dostupnost, maxOsob, cena, maloMista }) => {
                const tr = TRIDY_STAVU[dostupnost.stav];
                const vybrana = rm.id === f.room_id;
                const nelze = dostupnost.stav !== 'volno';
                return `
                  <div class="rucni-pokoj-polozka ${vybrana ? 'je-vybrana' : ''} ${nelze ? 'je-nedostupna' : ''}"
                       data-pokoj="${rm.id}" data-stav="${dostupnost.stav}" role="button" tabindex="0">
                    <div class="rucni-pokoj-info">
                      <div class="rucni-pokoj-radek">
                        <span class="rucni-pokoj-jmeno">${escapuj(rm.name)}</span>
                        <span class="option-floor-tag">${rm.floor === 'prizemi' ? 'Přízemí' : '1. patro'}</span>
                      </div>
                      <div class="rucni-pokoj-radek-spodni">
                        ${cena && dostupnost.stav !== 'mimo' ? `<span class="option-price-tag">${formatCzechPrice(cena.totalPrice)} <small>/ ${noci} ${noci === 1 ? 'noc' : (noci < 5 ? 'noci' : 'nocí')}</small></span>` : ''}
                        <span class="option-capacity-tag">${popisLuzek(rm)}</span>
                      </div>
                      ${nelze ? `<div class="rucni-pokoj-duvod">${escapuj(dostupnost.popis)}</div>` : ''}
                      ${maloMista && !nelze ? `<div class="rucni-pokoj-duvod">Pojme nejvýš ${maxOsob} ${maxOsob === 1 ? 'osobu' : 'osoby'} — pro ${parseInt(f.adults_count, 10) || 1} osob nestačí.</div>` : ''}
                    </div>
                    <div class="rucni-pokoj-stav">
                      <span class="room-status-pill ${tr.pill}"><span class="status-dot ${tr.dot}"></span>${tr.text}</span>
                      ${vybrana ? '<span class="option-checkmark">✓</span>' : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      ${stavVybraneho && stavVybraneho.stav !== 'volno' && stavVybraneho.stav !== 'nezname' ? `
        <div class="rucni-pokoj-varovani">
          ⚠️ ${escapuj(stavVybraneho.popis)}${f.povolitKolizi ? ' — zápis jste potvrdili, uloží se i tak.' : ''}
        </div>
      ` : ''}

      ${celyHotel ? (() => {
        const rozpis = rozdelOsobyPoPokojich(parseInt(f.adults_count, 10) || 1);
        const uctovano = rozpis.reduce((a, x) => a + x.osob, 0);
        const zadano = Math.max(1, parseInt(f.adults_count, 10) || 1);
        return `
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b6b60; line-height: 1.45;">
            Rozdělení po pokojích: ${rozpis.map(x => `${escapuj(x.pokoj.name.replace(/ - .*/, ''))} ${x.osob}`).join(', ')}.
            ${uctovano > zadano ? `<strong>Účtuje se ${uctovano} osob</strong> — cena je za osobu a noc, takže i pokoj, na který se nikdo nedostal, se počítá aspoň za jednu. Když to skupině nesedí, přepište částku dole.` : ''}
          </p>
        `;
      })() : ''}
    </div>
  `;
}

/**
 * Kalendář ve stejné podobě jako v rezervaci na webu — sdílí s ním
 * i třídy, takže i vybarvení a legenda vypadají stejně.
 *
 * Jediný rozdíl je v tom, co znamená červená: na webu den, kdy je plný
 * celý hotel, tady den, kdy je zabraný právě vybíraný pokoj. Recepční
 * potřebuje vidět tenhle pokoj, ne průměr přes hotel. Červený den jde
 * i tak vybrat — obsluha může vědět o výměně nebo o chystaném storně.
 */
function renderKalendar(ad, f) {
  const od = f.tempFrom !== undefined && f.tempFrom !== null ? f.tempFrom : f.date_from;
  const doo = f.tempTo !== undefined && f.tempTo !== null ? f.tempTo : (f.tempFrom ? null : f.date_to);

  const zaklad = od || dnesStr();
  const { year, month } = f.calRokMesic || (() => {
    const [y, m] = zaklad.split('-').map(Number);
    return { year: y, month: m };
  })();

  const prvniDen = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const dnuVMesici = new Date(year, month, 0).getDate();

  let dny = '';
  for (let i = 0; i < prvniDen; i++) dny += '<div class="cal-day cal-day-empty"></div>';

  for (let d = 1; d <= dnuVMesici; d++) {
    const den = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const { dopoledne, odpoledne, obsazeno, celkem } = obsazenostDne(ad, den, f.room_id);
    const vybranyZabrany = odpoledne === 'plno';
    const castecne = odpoledne === 'castecne';
    const jeVybrany = Boolean(den === od || den === doo || (od && doo && den > od && den < doo));

    let tridy = 'cal-day';
    // Ve vybraném rozsahu vyhrává podklad výběru, jinak se kreslí půlky.
    if (jeVybrany) {
      if (vybranyZabrany) tridy += ' is-full';
      else if (castecne) tridy += ' is-partial';
    } else {
      const trida = tridaPulek(dopoledne, odpoledne);
      if (trida) tridy += ' ' + trida;
    }
    if (den === od) tridy += ' is-from is-selected';
    if (den === doo) tridy += ' is-to is-selected';
    if (od && doo && den > od && den < doo) tridy += ' in-range';

    const popis = vybranyZabrany
      ? 'Tento pokoj je v tento den už obsazený'
      : (castecne ? `Obsazeno ${obsazeno} z ${celkem} pokojů` : 'Volno');

    dny += `<button type="button" class="${tridy}" data-den="${den}" title="${popis}">${d}</button>`;
  }

  const noci = pocetNoci(od, doo);

  return `
    <div class="cal-modal-overlay rucni-cal-overlay" style="z-index: 10090;">
      <div class="cal-modal-card">
        <div class="cal-modal-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span class="cal-month-title">${MESICE[month - 1]} ${year}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" class="btn btn-cal-nav cal-nav-btn rucni-cal-prev" title="Předchozí měsíc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button type="button" class="btn btn-cal-nav cal-nav-btn rucni-cal-next" title="Následující měsíc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button type="button" class="btn btn-cal-reset rucni-cal-reset" style="font-size: 13px; font-weight: 600; color: #4A5A24; background: none; border: none; cursor: pointer; padding: 4px 8px; text-decoration: underline;">Vynulovat výběr</button>
            <button type="button" class="btn btn-cal-close cal-close-btn rucni-cal-close" title="Zavřít kalendář">&times;</button>
          </div>
        </div>

        <div class="cal-week-days">
          <span>Po</span><span>Út</span><span>St</span><span>Čt</span><span>Pá</span><span>So</span><span>Ne</span>
        </div>

        <div class="cal-grid">${dny}</div>

        <div class="cal-modal-footer" style="padding: 16px; border-top: 1px solid #E7E5DC; display: flex; flex-direction: column; gap: 12px;">
          <div class="cal-legend" style="display:flex; flex-wrap:wrap; gap:14px; padding:4px 0 10px 0; border-bottom:1px solid #E7E5DC; margin-bottom:4px;">
            <span class="cal-legend-item"><i class="cal-legend-box" style="background:var(--kal-volno);"></i> Volno</span>
            <span class="cal-legend-item"><i class="cal-legend-box" style="background:var(--kal-vybrano);"></i> Vybraný termín</span>
            <span class="cal-legend-item"><i class="cal-legend-box" style="background:#f9d9d4;"></i> ${f.room_id ? 'Tento pokoj obsazený' : 'Plně obsazeno'}</span>
            <span class="cal-legend-item"><i class="cal-legend-box" style="background:#fcecc2;"></i> Částečně obsazeno</span>
          </div>

          <div class="cal-range-summary" style="display: flex; flex-direction: column; gap: 2px;">
            <span class="cal-summary-label" style="font-size: 14px; font-weight: 700; color: #1C1C19;">
              ${od && doo
                ? `Příjezd: ${formatCzechDateStr(od)} &nbsp;|&nbsp; Odjezd: ${formatCzechDateStr(doo)}`
                : (od ? `Příjezd: ${formatCzechDateStr(od)}` : 'Žádný termín není vybraný')}
            </span>
            <span class="cal-summary-sub" style="font-size: 13px; color: #666660; font-weight: 500;">
              ${od && doo
                ? `Délka pobytu: <strong>${noci} ${noci === 1 ? 'noc' : (noci < 5 ? 'noci' : 'nocí')}</strong>`
                : 'Klikněte na datum příjezdu, potom na datum odjezdu.'}
            </span>
          </div>

          <button type="button" class="btn rucni-cal-potvrd" ${od && !doo ? 'disabled' : ''} style="height: 42px; padding: 0 24px; font-size: 15px; font-weight: 700; color: ${od && !doo ? '#999990' : '#ffffff'}; background-color: ${od && !doo ? '#E7E5DC' : '#4A5A24'}; border: none; border-radius: 2px; cursor: ${od && !doo ? 'not-allowed' : 'pointer'}; width: 100%;">
            ${od && doo ? 'Potvrdit termín' : (od ? 'Vyberte ještě datum odjezdu' : 'Uložit bez termínu')}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderRucniRezervaceModal(ad) {
  const f = ad.rucniRezervace || prazdnaRucniRezervace();
  const cena = spoctiRucniCenu(f, ad.cenik);
  const noci = pocetNoci(f.date_from, f.date_to);
  const celyHotel = f.room_id === CELY_HOTEL;
  const pokoj = MOCK_ROOMS.find(r => r.id === f.room_id) || null;
  const maxOsob = celyHotel ? kapacitaHotelu() : (pokoj ? maxOsobNaPokoji(pokoj) : 4);

  // Ručně zadaná částka přebíjí ceník; záloha a doplatek se z ní dopočítají
  // stejným procentem, jaké platí v nastavení.
  const rucni = parseFloat(String(f.total_price).replace(/\s/g, '').replace(',', '.'));
  const celkem = Number.isFinite(rucni) && rucni >= 0 ? rucni : (cena ? cena.totalPrice : 0);
  const procento = (cena && cena.depositPercentage) || 30;
  const zaloha = Math.round(celkem * procento / 100);

  return `
    <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-rucni">
      <div class="admin-confirm-modal admin-block-modal" style="max-width: 700px; padding: 0 24px 24px 24px;">
        <div class="admin-modal-header-sticky">
          <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">➕ Nová rezervace ručně</h3>
          <button type="button" class="btn-close-rucni" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
        </div>

        <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 16px; font-size: 13.5px; color: #55554e;">
          Pro pobyt domluvený po telefonu nebo na místě. Zapíše se stejně jako rezervace z webu a objeví se v přehledu i v ubytovací knize. Hostovi se neposílá žádný e-mail.
        </p>

        ${ad.rucniChyba ? `
          <div style="background: #fdecea; border-left: 4px solid #c62828; color: #a5231f; padding: 12px 14px; border-radius: 4px; font-size: 13.5px; font-weight: 600; margin-bottom: 14px;">
            ${escapuj(ad.rucniChyba)}
          </div>
        ` : ''}

        <div style="${S.blok}">
          <strong style="${S.nadpisBloku}">Termín a pokoj</strong>
          <div style="${S.mrizka}">
            <div style="grid-column: 1 / -1;">
              <label style="${S.popisek}">Termín pobytu</label>
              <button type="button" class="rucni-otevri-kalendar" style="${S.input} text-align: left; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
                <span>${f.date_from && f.date_to ? `${formatCzechDateStr(f.date_from)} – ${formatCzechDateStr(f.date_to)}` : 'Vyberte termín v kalendáři'}</span>
                <span style="color: #697947; font-weight: 700;">Otevřít kalendář</span>
              </button>
            </div>
            ${renderVyberPokoje(ad, f)}
            <div>
              <label style="${S.popisek}">${celyHotel ? `Počet osob celkem (max ${maxOsob})` : `Počet osob (max ${maxOsob})`}</label>
              <input type="number" min="1" max="${maxOsob}" class="rucni-pole" data-pole="adults_count" value="${escapuj(f.adults_count)}" style="${S.input}">
            </div>
          </div>
          <p style="margin: 12px 0 0 0; font-size: 13px; color: #6b6b60;">
            ${noci > 0 ? `${noci} ${noci === 1 ? 'noc' : (noci < 5 ? 'noci' : 'nocí')}` : 'Termín zatím nevybraný'}
            ${ad.rucniKolize ? ` · <strong style="color: #c62828;">Pozor: pokoj je v tomto termínu už obsazený.</strong>` : ''}
          </p>
        </div>

        <div style="${S.blok}">
          <strong style="${S.nadpisBloku}">Host</strong>
          <div style="${S.mrizka}">
            <div style="grid-column: 1 / -1;">
              <label style="${S.popisek}">Jméno a příjmení *</label>
              <input type="text" class="rucni-pole" data-pole="guest_name" value="${escapuj(f.guest_name)}" placeholder="Jan Novák" style="${S.input}">
            </div>
            <div>
              <label style="${S.popisek}">E-mail</label>
              <input type="email" class="rucni-pole" data-pole="guest_email" value="${escapuj(f.guest_email)}" placeholder="jan@novak.cz" style="${S.input}">
            </div>
            <div>
              <label style="${S.popisek}">Telefon</label>
              <input type="tel" class="rucni-pole" data-pole="guest_phone" value="${escapuj(f.guest_phone)}" placeholder="+420 777 123 456" style="${S.input}">
            </div>
            <div>
              <label style="${S.popisek}">Ulice a číslo</label>
              <input type="text" class="rucni-pole" data-pole="guest_street" value="${escapuj(f.guest_street)}" style="${S.input}">
            </div>
            <div>
              <label style="${S.popisek}">Město</label>
              <input type="text" class="rucni-pole" data-pole="guest_city" value="${escapuj(f.guest_city)}" style="${S.input}">
            </div>
            <div>
              <label style="${S.popisek}">PSČ</label>
              <input type="text" class="rucni-pole" data-pole="guest_zip" value="${escapuj(f.guest_zip)}" style="${S.input}">
            </div>
            <div>
              <label style="${S.popisek}">Poznámka</label>
              <input type="text" class="rucni-pole" data-pole="guest_note" value="${escapuj(f.guest_note)}" placeholder="pozdní příjezd, dieta…" style="${S.input}">
            </div>
          </div>
        </div>

        <div style="${S.blok}">
          <strong style="${S.nadpisBloku}">Doplňkové služby</strong>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: #1c1c19; cursor: pointer;">
              <input type="checkbox" class="rucni-pole" data-pole="has_half_board" ${f.has_half_board ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #697947;">
              Polopenze
              ${f.has_half_board ? `<input type="number" min="1" class="rucni-pole" data-pole="half_board_count" value="${escapuj(f.half_board_count)}" style="width: 74px; height: 34px; text-align: right; padding: 0 8px; border-radius: 4px; border: 1.5px solid #c9c8bd;"> osob` : ''}
            </label>
            <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: #1c1c19; cursor: pointer;">
              <input type="checkbox" class="rucni-pole" data-pole="has_dog" ${f.has_dog ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #697947;">
              Pes
            </label>
            <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: #1c1c19; cursor: pointer;">
              <input type="checkbox" class="rucni-pole" data-pole="has_ebike" ${f.has_ebike ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #697947;">
              Nabíjení elektrokola
              ${f.has_ebike ? `<input type="number" min="1" class="rucni-pole" data-pole="ebike_count" value="${escapuj(f.ebike_count)}" style="width: 74px; height: 34px; text-align: right; padding: 0 8px; border-radius: 4px; border: 1.5px solid #c9c8bd;"> ks` : ''}
            </label>
            ${cena && cena.isWinterSeason ? `
              <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: #1c1c19; cursor: pointer;">
                <input type="checkbox" class="rucni-pole" data-pole="has_winter_parking" ${f.has_winter_parking ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #697947;">
                Zimní parkování
                ${f.has_winter_parking ? `<input type="number" min="1" class="rucni-pole" data-pole="parking_cars_count" value="${escapuj(f.parking_cars_count)}" style="width: 74px; height: 34px; text-align: right; padding: 0 8px; border-radius: 4px; border: 1.5px solid #c9c8bd;"> aut` : ''}
              </label>
            ` : ''}
          </div>
        </div>

        <div style="${S.blok}">
          <strong style="${S.nadpisBloku}">Cena a stav</strong>

          <div style="background: #faf9f5; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; font-size: 13.5px; color: #55554e; line-height: 1.9;">
            ${cena ? `
              <div style="display: flex; justify-content: space-between;"><span>Ubytování se snídaní${cena.nightBreakdownLabel ? ` (${escapuj(cena.nightBreakdownLabel)})` : ''}</span><strong style="color: #1c1c19;">${formatCzechPrice(cena.ubytovaniBezPriplatku ?? cena.accommodationPrice)}</strong></div>
              ${cena.soloPriplatekCelkem > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Příplatek za jednu osobu na pokoji</span><strong style="color: #1c1c19;">${formatCzechPrice(cena.soloPriplatekCelkem)}</strong></div>` : ''}
              ${cena.addonsPrice > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Doplňkové služby</span><strong style="color: #1c1c19;">${formatCzechPrice(cena.addonsPrice)}</strong></div>` : ''}
              <div style="display: flex; justify-content: space-between; border-top: 1px solid #e4e2d8; margin-top: 6px; padding-top: 6px;"><span>Podle ceníku celkem</span><strong style="color: #1c1c19;">${formatCzechPrice(cena.totalPrice)}</strong></div>
            ` : '<span>Cenu spočítáme, jakmile vyberete termín pobytu.</span>'}
          </div>

          <div style="${S.mrizka}">
            <div>
              <label style="${S.popisek}">Celkem zaplatí (Kč)</label>
              <input type="number" min="0" step="10" class="rucni-pole" data-pole="total_price" value="${escapuj(f.total_price)}" placeholder="${cena ? Math.round(cena.totalPrice) : ''}" style="${S.input}">
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #96958a;">Prázdné = cena z ceníku.</p>
            </div>
            <div>
              <label style="${S.popisek}">Stav rezervace</label>
              <select class="rucni-pole" data-pole="status" style="${S.input}">
                <option value="confirmed" ${f.status === 'confirmed' ? 'selected' : ''}>Závazně potvrzeno</option>
                <option value="awaiting_deposit" ${f.status === 'awaiting_deposit' ? 'selected' : ''}>Čeká na zálohu</option>
                <option value="pending_approval" ${f.status === 'pending_approval' ? 'selected' : ''}>Ke schválení</option>
              </select>
            </div>
          </div>

          <label style="display: flex; align-items: center; gap: 10px; margin-top: 14px; font-size: 14px; font-weight: 600; color: #1c1c19; cursor: pointer;">
            <input type="checkbox" class="rucni-pole" data-pole="zaplaceno" ${f.zaplaceno ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #697947;">
            Host už zaplatil celou částku (jinak se eviduje záloha ${formatCzechPrice(zaloha)} a doplatek na místě)
          </label>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <span style="font-size: 15px; font-weight: 800; color: #1c1c19;">${cena || Number.isFinite(rucni) ? `Celkem ${formatCzechPrice(celkem)}` : 'Zatím bez termínu'}</span>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn-close-rucni" style="height: 44px; padding: 0 18px; font-size: 14px; font-weight: 700; border-radius: 4px; border: 1.5px solid #c9c8bd; background: #fff; color: #444; cursor: pointer;">Zrušit</button>
            <button type="button" class="btn-ulozit-rucni" style="height: 44px; padding: 0 22px; font-size: 14.5px; font-weight: 800; border-radius: 4px; border: none; background: #697947; color: #fff; cursor: pointer;">Založit rezervaci</button>
          </div>
        </div>
      </div>

      ${f.calOtevreny ? renderKalendar(ad, f) : ''}
    </div>
  `;
}

/**
 * Sestaví rezervaci ve stejném tvaru, v jakém ji ukládá web.
 *
 * Vrací { chyba } při nevyplněných povinných údajích, jinak { rezervace }.
 */
export function sestavRucniRezervaci(f, cenik) {
  const jmeno = String(f.guest_name || '').trim();
  if (!jmeno) return { chyba: 'Vyplňte jméno a příjmení hosta.' };

  const noci = pocetNoci(f.date_from, f.date_to);
  if (!f.date_from || !f.date_to) return { chyba: 'Vyberte termín pobytu v kalendáři.' };
  if (noci < 1) return { chyba: 'Datum odjezdu musí být pozdější než datum příjezdu.' };

  // Celý hotel se do jednoho řádku nevejde — room_id je jeden sloupec. Zapíše
  // se proto rezervace na každý prodejný pokoj, se stejným hostem a termínem.
  // Díky tomu sedí obsazenost všude a nemusí se nic obcházet blokací.
  if (f.room_id === CELY_HOTEL) {
    const kapacita = kapacitaHotelu();
    const osobCelkem = Math.max(1, parseInt(f.adults_count, 10) || 1);
    if (osobCelkem > kapacita) {
      return { chyba: `Do celého hotelu se vejde nejvýš ${kapacita} osob.` };
    }
    const rozpis = rozdelOsobyPoPokojich(osobCelkem);
    const znacka = `Skupinová akce — celý hotel (${rozpis.length} pokojů), ${formatCzechDateStr(f.date_from)} – ${formatCzechDateStr(f.date_to)}`;

    const casti = [];
    for (let i = 0; i < rozpis.length; i++) {
      const { pokoj: rm, osob } = rozpis[i];
      const dil = sestavRucniRezervaci({
        ...f,
        // Příplatky nese první pokoj, jinak by se naúčtovaly za každý.
        ...(i === 0 ? {} : { has_half_board: false, has_dog: false, has_ebike: false, has_winter_parking: false }),
        room_id: rm.id,
        adults_count: osob,
        // Ručně zadaná částka platí za celou akci, ne za každý pokoj.
        total_price: '',
        guest_note: [znacka, String(f.guest_note || '').trim()].filter(Boolean).join(' · '),
      }, cenik);
      if (dil.chyba) return { chyba: dil.chyba };
      casti.push(dil.rezervace);
    }

    // Když obsluha přepsala cenu, rozpustí se poměrně podle ceníku, ať
    // součet rezervací odpovídá tomu, co se skupinou domluvila.
    const rucniCelkem = parseFloat(String(f.total_price).replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(rucniCelkem) && rucniCelkem >= 0) {
      const dleCeniku = casti.reduce((a, r) => a + r.total_price, 0) || 1;
      let rozdano = 0;
      casti.forEach((r, i) => {
        const podil = i === casti.length - 1
          ? Math.round(rucniCelkem) - rozdano
          : Math.round(rucniCelkem * r.total_price / dleCeniku);
        rozdano += podil;
        const procento = f.zaplaceno ? 100 : ((spoctiRucniCenu(f, cenik) || {}).depositPercentage || 30);
        r.total_price = podil;
        r.deposit_price = Math.round(podil * procento / 100);
        r.remaining_price = podil - r.deposit_price;
      });
    }

    return { rezervace: casti[0], skupina: casti };
  }

  if (!f.room_id) return { chyba: 'Vyberte pokoj.' };
  const pokoj = MOCK_ROOMS.find(r => r.id === f.room_id);
  if (!pokoj) return { chyba: 'Vyberte pokoj.' };

  const osob = Math.max(1, parseInt(f.adults_count, 10) || 1);
  const maxOsob = maxOsobNaPokoji(pokoj);
  if (osob > maxOsob) {
    return { chyba: `${pokoj.name} pojme nejvýš ${maxOsob} ${maxOsob === 1 ? 'osobu' : 'osoby'}.` };
  }

  const cena = spoctiRucniCenu(f, cenik);
  const rucni = parseFloat(String(f.total_price).replace(/\s/g, '').replace(',', '.'));
  const celkem = Number.isFinite(rucni) && rucni >= 0 ? Math.round(rucni) : Math.round(cena.totalPrice);
  const procento = cena.depositPercentage || 30;
  const zaloha = f.zaplaceno ? celkem : Math.round(celkem * procento / 100);
  const doplatek = celkem - zaloha;

  const kod = generateReservationCode();

  return {
    rezervace: {
      id: 'res-' + Date.now() + '-' + Math.floor(Math.random() * 900 + 100),
      code: kod,
      manage_token: generateManageToken(),
      room_id: pokoj.id,
      room_name: pokoj.name,
      date_from: f.date_from,
      date_to: f.date_to,
      guest_name: jmeno,
      guest_email: String(f.guest_email || '').trim(),
      guest_phone: String(f.guest_phone || '').trim(),
      guest_note: String(f.guest_note || '').trim(),
      guest_street: String(f.guest_street || '').trim(),
      guest_city: String(f.guest_city || '').trim(),
      guest_zip: String(f.guest_zip || '').trim(),
      guest_country: 'Czechia',
      // Ubytovací kniha čeká pole hostů; u ručního zápisu známe jen
      // objednavatele, zbytek doplní recepce při příjezdu.
      guests: [{
        name: jmeno,
        email: String(f.guest_email || '').trim(),
        phone: String(f.guest_phone || '').trim(),
        street: String(f.guest_street || '').trim(),
        city: String(f.guest_city || '').trim(),
        zip: String(f.guest_zip || '').trim(),
        country: 'Czechia',
      }],
      adults_count: osob,
      children_count: 0,
      has_dog: Boolean(f.has_dog),
      has_ebike: Boolean(f.has_ebike),
      ebike_count: parseInt(f.ebike_count, 10) || 1,
      has_half_board: Boolean(f.has_half_board),
      half_board_count: parseInt(f.half_board_count, 10) || 1,
      has_winter_parking: Boolean(f.has_winter_parking),
      parking_cars_count: parseInt(f.parking_cars_count, 10) || 1,
      winter_parking_price_total: Math.round(cena.winterParkingPriceTotal || 0),
      accommodation_price: Math.round(cena.accommodationPrice),
      addons_price: Math.round(cena.addonsPrice),
      city_tax: Math.round(cena.cityTax || 0),
      total_price: celkem,
      deposit_price: zaloha,
      remaining_price: doplatek,
      status: f.status || 'confirmed',
      created_at: new Date().toISOString(),
      is_archived: false,
    },
  };
}

/** Napojení formuláře — volá se z AdminDashboard po každém vykreslení. */
export function bindRucniRezervaceModal(ad) {
  if (!ad.showRucniModal) return;

  const zavri = () => {
    ad.showRucniModal = false;
    ad.rucniChyba = '';
    ad.render();
  };

  ad.container.querySelectorAll('.btn-close-rucni').forEach(b => b.addEventListener('click', zavri));

  const prekryti = ad.container.querySelector('.admin-modal-overlay-rucni');
  if (prekryti) {
    prekryti.addEventListener('click', (e) => { if (e.target === prekryti) zavri(); });
  }

  // ---- výběr pokoje s dostupností ----
  const spoust = ad.container.querySelector('.rucni-pokoj-spoust');
  if (spoust) {
    spoust.addEventListener('click', () => {
      ad.rucniRezervace.pokojOtevreny = !ad.rucniRezervace.pokojOtevreny;
      ad.render();
    });
  }

  const vyberPokoj = async (polozka) => {
    const f = ad.rucniRezervace;
    const id = polozka.dataset.pokoj;
    const stav = polozka.dataset.stav || 'volno';

    // Obsazený pokoj jde vybrat jen vědomě. Bez téhle zábrany šlo zapsat
    // dva hosty do jednoho pokoje na tentýž termín a nic to neřeklo.
    if (stav !== 'volno' && id !== CELY_HOTEL) {
      const rm = MOCK_ROOMS.find(r => r.id === id);
      const d = dostupnostPokoje(ad, rm, f.date_from, f.date_to);
      const potvrzeno = await adminPotvrzeni({
        nadpis: stav === 'mimo' ? 'Tento pokoj je mimo provoz' : 'Tento pokoj není v termínu volný',
        text: `${rm ? rm.name : 'Pokoj'} — ${d.popis}.\n\n`
          + (stav === 'mimo'
            ? 'Pokoj je vyřazený z provozu v Blokování pokojů. Rezervaci na něj lze založit, ale na webu se neprodává.'
            : 'Zapsat sem další rezervaci znamená dva pobyty na jeden pokoj ve stejném termínu. Dělejte to jen tehdy, když víte o výměně pokoje nebo o rezervaci, která se má zrušit.'),
        potvrdit: 'Vím to, přesto vybrat',
        zrusit: 'Vybrat jiný pokoj',
        nebezpecne: true,
      });
      if (!potvrzeno) return;
      f.povolitKolizi = true;
    } else {
      f.povolitKolizi = false;
    }

    f.room_id = id;
    f.pokojOtevreny = false;
    ad.rucniChyba = '';

    // Počet osob se srazí na kapacitu pokoje, jinak by uložení spadlo na
    // hlášku o překročené kapacitě až po vyplnění celého formuláře.
    const rm = MOCK_ROOMS.find(r => r.id === id);
    if (rm) {
      const max = maxOsobNaPokoji(rm);
      if ((parseInt(f.adults_count, 10) || 1) > max) f.adults_count = max;
    }

    ad.zkontrolujKoliziRucni();
    ad.render();
  };

  ad.container.querySelectorAll('.rucni-pokoj-polozka').forEach(polozka => {
    polozka.addEventListener('click', () => vyberPokoj(polozka));
    polozka.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vyberPokoj(polozka); }
    });
  });

  // ---- kalendář ----
  const otevri = ad.container.querySelector('.rucni-otevri-kalendar');
  if (otevri) {
    otevri.addEventListener('click', () => {
      ad.rucniRezervace.calOtevreny = true;
      ad.rucniRezervace.tempFrom = ad.rucniRezervace.date_from || null;
      ad.rucniRezervace.tempTo = ad.rucniRezervace.date_to || null;
      ad.rucniRezervace.calRokMesic = null;
      ad.render();
    });
  }

  const zavriKalendar = () => {
    ad.rucniRezervace.calOtevreny = false;
    ad.rucniRezervace.tempFrom = null;
    ad.rucniRezervace.tempTo = null;
    ad.render();
  };

  ad.container.querySelectorAll('.rucni-cal-close').forEach(b => b.addEventListener('click', zavriKalendar));

  const calPrekryti = ad.container.querySelector('.rucni-cal-overlay');
  if (calPrekryti) {
    calPrekryti.addEventListener('click', (e) => { if (e.target === calPrekryti) zavriKalendar(); });
  }

  const posunMesic = (o) => {
    const f = ad.rucniRezervace;
    const zaklad = f.calRokMesic || (() => {
      const [y, m] = (f.tempFrom || f.date_from || dnesStr()).split('-').map(Number);
      return { year: y, month: m };
    })();
    const d = new Date(zaklad.year, zaklad.month - 1 + o, 1);
    f.calRokMesic = { year: d.getFullYear(), month: d.getMonth() + 1 };
    ad.render();
  };
  ad.container.querySelectorAll('.rucni-cal-prev').forEach(b => b.addEventListener('click', () => posunMesic(-1)));
  ad.container.querySelectorAll('.rucni-cal-next').forEach(b => b.addEventListener('click', () => posunMesic(1)));

  // Klikání na dny: první klik příjezd, druhý odjezd, třetí začíná znovu —
  // stejné chování jako v rezervaci na webu.
  ad.container.querySelectorAll('.rucni-cal-overlay .cal-day[data-den]').forEach(den => {
    den.addEventListener('click', () => {
      const f = ad.rucniRezervace;
      const vybrany = den.dataset.den;
      if (f.tempFrom && f.tempTo) {
        f.tempFrom = vybrany; f.tempTo = null;
      } else if (!f.tempFrom || vybrany <= f.tempFrom) {
        f.tempFrom = vybrany; f.tempTo = null;
      } else {
        f.tempTo = vybrany;
      }
      ad.render();
    });
  });

  // Vynulování vrátí kalendář do neutrálního stavu — bez příjezdu i odjezdu.
  ad.container.querySelectorAll('.rucni-cal-reset').forEach(b => {
    b.addEventListener('click', () => {
      const f = ad.rucniRezervace;
      f.tempFrom = '';
      f.tempTo = '';
      ad.render();
    });
  });

  const potvrd = ad.container.querySelector('.rucni-cal-potvrd');
  if (potvrd) {
    potvrd.addEventListener('click', () => {
      const f = ad.rucniRezervace;
      // Rozdělaný výběr (jen příjezd) potvrdit nejde — tlačítko je vypnuté.
      if (f.tempFrom && !f.tempTo) return;
      f.date_from = f.tempFrom || '';
      f.date_to = f.tempTo || '';
      f.calOtevreny = false;
      // Souhlas s obsazeným pokojem platil pro starý termín. S novým se
      // dostupnost musí posoudit znovu, jinak by souhlas přenesl kolizi,
      // o které obsluha nikdy nevěděla.
      f.povolitKolizi = false;
      f.tempFrom = null;
      f.tempTo = null;
      ad.rucniChyba = '';
      ad.zkontrolujKoliziRucni();
      ad.render();
    });
  }

  // Políčka, která se do ceny ani do kolize nepromítnou. Jméno, telefon
  // a poznámka jen sedí ve stavu — překreslovat kvůli nim celé okno nemá
  // co ukázat a působí to škodu: blur při kliknutí na Založit rezervaci
  // vyměnil tlačítko v DOM dřív, než se stihl vyhodnotit click. Obsluze
  // to přišlo, že se nic nestalo, klikla znovu a měla dvě rezervace.
  const POLE_BEZ_PREKRESLENI = new Set([
    'guest_name', 'guest_email', 'guest_phone',
    'guest_street', 'guest_city', 'guest_zip', 'guest_note',
  ]);

  ad.container.querySelectorAll('.rucni-pole').forEach(el => {
    // change, ne input: po každém úhozu se okno překresluje kvůli ceně
    // a průběžné překreslování by z políčka vyhazovalo kurzor.
    const udalost = (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'blur';
    el.addEventListener(udalost, () => {
      const pole = el.dataset.pole;
      ad.rucniRezervace[pole] = el.type === 'checkbox' ? el.checked : el.value;
      ad.rucniChyba = '';
      if (POLE_BEZ_PREKRESLENI.has(pole)) return;
      ad.zkontrolujKoliziRucni();
      ad.render();
    });
  });

  const ulozit = ad.container.querySelector('.btn-ulozit-rucni');
  if (ulozit) {
    ulozit.addEventListener('click', async () => {
      // Druhá pojistka. Vypnuté tlačítko nestačí: okno se mezitím
      // překresluje, takže by se disabled ztratilo i s ním.
      if (ad.rucniOdesila) return;

      // Rozepsaná políčka, ze kterých obsluha neodešla, by se jinak
      // ztratila — blur se u nich ještě nestihl spustit.
      ad.container.querySelectorAll('.rucni-pole').forEach(el => {
        ad.rucniRezervace[el.dataset.pole] = el.type === 'checkbox' ? el.checked : el.value;
      });

      const { chyba, rezervace, skupina } = sestavRucniRezervaci(ad.rucniRezervace, ad.cenik);
      if (chyba) {
        ad.rucniChyba = chyba;
        ad.render();
        return;
      }

      // Poslední zábrana proti dvěma pobytům na jeden pokoj. Termín se dá
      // změnit i potom, co byl pokoj vybraný jako volný, takže se stav
      // musí ověřit znovu těsně před zápisem — ne jen při výběru.
      const f = ad.rucniRezervace;
      if (f.room_id !== CELY_HOTEL && !f.povolitKolizi) {
        const rm = MOCK_ROOMS.find(r => r.id === f.room_id);
        const d = rm ? dostupnostPokoje(ad, rm, f.date_from, f.date_to) : null;
        if (d && (d.stav === 'obsazeno' || d.stav === 'blokace')) {
          ad.rucniChyba = `${rm.name} v tomto termínu volný není — ${d.popis}. Vyberte jiný pokoj nebo jiný termín.`;
          ad.rucniRezervace.pokojOtevreny = true;
          ad.render();
          return;
        }
      }

      const zapisovane = skupina || [rezervace];

      ad.rucniOdesila = true;
      ulozit.disabled = true;
      ulozit.textContent = 'Ukládám…';

      zapisovane.forEach(r => saveStoredReservation(r));
      ad.reservations = [...zapisovane, ...(ad.reservations || [])];
      ad.showRucniModal = false;
      ad.rucniChyba = '';
      ad.showAdminToast(skupina
        ? `Celý hotel zarezervován pro ${rezervace.guest_name} — založeno ${skupina.length} rezervací, na každý pokoj jedna.`
        : `Rezervace ${rezervace.code} pro hosta ${rezervace.guest_name} byla založena.`);
      ad.render();

      // Zápis do databáze běží uvnitř saveStoredReservation na pozadí;
      // po chvíli se seznam načte znovu, ať je vidět, co je opravdu uložené.
      setTimeout(() => {
        ad.rucniOdesila = false;
        ad.fetchReservations().then(() => ad.render()).catch(() => {});
      }, 1200);
    });
  }
}
