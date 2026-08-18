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
import { maxOsobNaPokoji } from '../utils/cenik.js';

const S = {
  input: 'width: 100%; height: 42px; font-size: 14.5px; padding: 0 11px; border-radius: 5px; border: 1.5px solid #c9c8bd; box-sizing: border-box; background: #fff; color: #1c1c19;',
  popisek: 'display: block; font-size: 12.5px; font-weight: 700; color: #55554e; margin-bottom: 5px;',
  blok: 'background: #fff; border: 1.5px solid #e0dfd5; border-radius: 8px; padding: 16px 18px; margin-bottom: 14px;',
  nadpisBloku: 'display: block; font-size: 14px; font-weight: 800; color: #1c1c19; margin-bottom: 14px;',
  mrizka: 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px;',
};

const escapuj = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Prázdný formulář — výchozí termín je dnes → zítra, ať jde rovnou uložit. */
export function prazdnaRucniRezervace() {
  const dnes = new Date();
  const zitra = new Date(dnes.getTime() + 86400000);
  const naDatum = (d) => d.toISOString().split('T')[0];
  return {
    date_from: naDatum(dnes),
    date_to: naDatum(zitra),
    room_id: (MOCK_ROOMS.find(r => !r.isDisabled) || MOCK_ROOMS[0]).id,
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
  };
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
  const pokoj = MOCK_ROOMS.find(r => r.id === f.room_id) || MOCK_ROOMS[0];
  const noci = pocetNoci(f.date_from, f.date_to);
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

export function renderRucniRezervaceModal(ad) {
  const f = ad.rucniRezervace || prazdnaRucniRezervace();
  const cena = spoctiRucniCenu(f, ad.cenik);
  const noci = pocetNoci(f.date_from, f.date_to);
  const pokoj = MOCK_ROOMS.find(r => r.id === f.room_id) || MOCK_ROOMS[0];
  const maxOsob = maxOsobNaPokoji(pokoj);

  // Ručně zadaná částka přebíjí ceník; záloha a doplatek se z ní dopočítají
  // stejným procentem, jaké platí v nastavení.
  const rucni = parseFloat(String(f.total_price).replace(/\s/g, '').replace(',', '.'));
  const celkem = Number.isFinite(rucni) && rucni >= 0 ? rucni : cena.totalPrice;
  const procento = cena.depositPercentage || 30;
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
            <div>
              <label style="${S.popisek}">Příjezd</label>
              <input type="date" class="rucni-pole" data-pole="date_from" value="${escapuj(f.date_from)}" style="${S.input}">
            </div>
            <div>
              <label style="${S.popisek}">Odjezd</label>
              <input type="date" class="rucni-pole" data-pole="date_to" value="${escapuj(f.date_to)}" style="${S.input}">
            </div>
            <div>
              <label style="${S.popisek}">Pokoj</label>
              <select class="rucni-pole" data-pole="room_id" style="${S.input}">
                ${MOCK_ROOMS.map(rm => `
                  <option value="${rm.id}" ${rm.id === f.room_id ? 'selected' : ''}>${escapuj(rm.name)}${rm.isDisabled ? ' — mimo provoz' : ''}</option>
                `).join('')}
              </select>
            </div>
            <div>
              <label style="${S.popisek}">Počet osob (max ${maxOsob})</label>
              <input type="number" min="1" max="${maxOsob}" class="rucni-pole" data-pole="adults_count" value="${escapuj(f.adults_count)}" style="${S.input}">
            </div>
          </div>
          <p style="margin: 12px 0 0 0; font-size: 13px; color: #6b6b60;">
            ${noci > 0 ? `${noci} ${noci === 1 ? 'noc' : (noci < 5 ? 'noci' : 'nocí')}` : '<strong style="color: #c62828;">Odjezd musí být po příjezdu.</strong>'}
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
            ${cena.isWinterSeason ? `
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
            <div style="display: flex; justify-content: space-between;"><span>Ubytování se snídaní${cena.nightBreakdownLabel ? ` (${escapuj(cena.nightBreakdownLabel)})` : ''}</span><strong style="color: #1c1c19;">${formatCzechPrice(cena.accommodationPrice)}</strong></div>
            ${cena.addonsPrice > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Doplňkové služby</span><strong style="color: #1c1c19;">${formatCzechPrice(cena.addonsPrice)}</strong></div>` : ''}
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #e4e2d8; margin-top: 6px; padding-top: 6px;"><span>Podle ceníku celkem</span><strong style="color: #1c1c19;">${formatCzechPrice(cena.totalPrice)}</strong></div>
          </div>

          <div style="${S.mrizka}">
            <div>
              <label style="${S.popisek}">Celkem zaplatí (Kč)</label>
              <input type="number" min="0" step="10" class="rucni-pole" data-pole="total_price" value="${escapuj(f.total_price)}" placeholder="${Math.round(cena.totalPrice)}" style="${S.input}">
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
          <span style="font-size: 15px; font-weight: 800; color: #1c1c19;">Celkem ${formatCzechPrice(celkem)}</span>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn-close-rucni" style="height: 44px; padding: 0 18px; font-size: 14px; font-weight: 700; border-radius: 4px; border: 1.5px solid #c9c8bd; background: #fff; color: #444; cursor: pointer;">Zrušit</button>
            <button type="button" class="btn-ulozit-rucni" style="height: 44px; padding: 0 22px; font-size: 14.5px; font-weight: 800; border-radius: 4px; border: none; background: #697947; color: #fff; cursor: pointer;">Založit rezervaci</button>
          </div>
        </div>
      </div>
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
  if (noci < 1) return { chyba: 'Datum odjezdu musí být pozdější než datum příjezdu.' };

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

  ad.container.querySelectorAll('.rucni-pole').forEach(el => {
    // change, ne input: po každém úhozu se okno překresluje kvůli ceně
    // a průběžné překreslování by z políčka vyhazovalo kurzor.
    const udalost = (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'blur';
    el.addEventListener(udalost, () => {
      const pole = el.dataset.pole;
      ad.rucniRezervace[pole] = el.type === 'checkbox' ? el.checked : el.value;
      ad.rucniChyba = '';
      ad.zkontrolujKoliziRucni();
      ad.render();
    });
  });

  const ulozit = ad.container.querySelector('.btn-ulozit-rucni');
  if (ulozit) {
    ulozit.addEventListener('click', async () => {
      // Rozepsaná políčka, ze kterých obsluha neodešla, by se jinak
      // ztratila — blur se u nich ještě nestihl spustit.
      ad.container.querySelectorAll('.rucni-pole').forEach(el => {
        ad.rucniRezervace[el.dataset.pole] = el.type === 'checkbox' ? el.checked : el.value;
      });

      const { chyba, rezervace } = sestavRucniRezervaci(ad.rucniRezervace, ad.cenik);
      if (chyba) {
        ad.rucniChyba = chyba;
        ad.render();
        return;
      }

      ulozit.disabled = true;
      ulozit.textContent = 'Ukládám…';

      saveStoredReservation(rezervace);
      ad.reservations = [rezervace, ...(ad.reservations || [])];
      ad.showRucniModal = false;
      ad.rucniChyba = '';
      ad.showAdminToast(`Rezervace ${rezervace.code} pro hosta ${rezervace.guest_name} byla založena.`);
      ad.render();

      // Zápis do databáze běží uvnitř saveStoredReservation na pozadí;
      // po chvíli se seznam načte znovu, ať je vidět, co je opravdu uložené.
      setTimeout(() => {
        ad.fetchReservations().then(() => ad.render()).catch(() => {});
      }, 1200);
    });
  }
}
