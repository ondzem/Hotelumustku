import { MOCK_ROOMS, getStoredCenik } from '../lib/supabaseClient.js';
import { calculateReservationPrice, formatCzechPrice, getVariableSymbol, procentoZalohy, VYCHOZI_NASTAVENI } from './pricing.js';

/**
 * Escapování pro tiskovou sestavu.
 *
 * Sestava se skládá do řetězce a sype do `printWindow.document.write()`.
 * Tiskové okno se otevírá přes `window.open('')`, takže dědí původ webu —
 * značka ve jméně nebo v poznámce hosta by se v něm spustila jako skript
 * s platnou relací recepce.
 */
const escapujTisk = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function formatCzechDateStr(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    // parseInt kvůli nulám zleva: zbytek webu píše „3. 9. 2026", tisk
    // jako jediný „03. 09. 2026".
    return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
  }
  return dateStr;
}

function formatCzechDateTimeNow() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return {
    dateStr: `${day}. ${month}. ${year}`,
    timeStr: `${hours}:${minutes}`
  };
}

/**
 * Počet nocí pobytu — POČÍTÁ SE Z DAT, ne z uloženého sloupce.
 *
 * Tisk bral `reservation.nights_count`, jenže takový sloupec v databázi
 * není (chybí i v ALLOWED_SUPABASE_COLUMNS), takže vycházel vždycky
 * `undefined`. Výpočet ceny z něj pak udělal jednu noc a rezervační list
 * tiskl „1 nocí" a cenu za jedinou noc — ať si host vybral jakýkoli termín.
 * Jediná spolehlivá pravda je rozdíl `date_from` a `date_to`.
 */
export function pocetNociZTerminu(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return 0;
  const od = Date.parse(`${dateFrom}T00:00:00Z`);
  const doo = Date.parse(`${dateTo}T00:00:00Z`);
  if (!Number.isFinite(od) || !Number.isFinite(doo)) return 0;
  return Math.max(0, Math.round((doo - od) / 86400000));
}

/** České skloňování po číslovce: 1 noc, 2–4 noci, 5+ nocí. */
export function sklonuj(pocet, jedna, dveAzCtyri, petAVic) {
  const n = Math.abs(Math.round(Number(pocet) || 0));
  if (n === 1) return `${pocet} ${jedna}`;
  if (n >= 2 && n <= 4) return `${pocet} ${dveAzCtyri}`;
  return `${pocet} ${petAVic}`;
}

/**
 * Údaje, které se tisknou na rezervační list.
 *
 * **Částky se berou z ULOŽENÉ rezervace, nepočítají se znovu.** Host
 * dostal potvrzení na konkrétní částku a ta platí; kdyby si list sáhl do
 * aktuálního ceníku, po každé změně cen by tiskl něco jiného, než co má
 * host v e-mailu a než co je v databázi. Přepočet z ceníku slouží jen
 * jako záchrana u starých záznamů, kde částky chybí.
 *
 * Čistá funkce bez DOM, aby šla protestovat v Node (`kontrola/tisk.mjs`).
 */
export function udajeProTisk(reservation, cenik = { nastaveni: {} }, pokoj = null) {
  const r = reservation || {};
  const noci = pocetNociZTerminu(r.date_from, r.date_to);
  const osob = Math.max(1, parseInt(r.adults_count, 10) || 1);
  const nastaveni = (cenik && cenik.nastaveni) || {};

  const cislo = (hodnota) => {
    const v = Number(hodnota);
    return Number.isFinite(v) ? v : null;
  };

  let celkem = cislo(r.total_price);
  let zaloha = cislo(r.deposit_price);
  let doplatek = cislo(r.remaining_price);
  let ubytovani = cislo(r.accommodation_price);
  let sluzby = cislo(r.addons_price);
  let zPolozek = false;

  // Záchrana pro staré záznamy bez uložených částek.
  if (celkem === null) {
    const p = calculateReservationPrice({
      roomType: (pokoj && pokoj.type) || 'standard',
      roomId: r.room_id,
      nights: noci || 1,
      persons: osob,
      adults: osob,
      dateFrom: r.date_from,
      dateTo: r.date_to,
      hasDog: r.has_dog,
      hasEbike: r.has_ebike,
      ebikeCount: r.ebike_count,
      hasHalfBoard: r.has_half_board,
      halfBoardCount: r.half_board_count,
      hasWinterParking: r.has_winter_parking,
      parkingCarsCount: r.parking_cars_count,
      cenik,
      nastaveni,
    });
    celkem = p.totalPrice;
    zaloha = p.depositPriceTotal;
    doplatek = p.remainingPriceTotal;
    ubytovani = p.accommodationPrice;
    sluzby = p.addonsPrice;
    zPolozek = true;
  }

  if (zaloha === null) zaloha = 0;
  if (doplatek === null) doplatek = Math.max(0, celkem - zaloha);

  // Procento zálohy se dopočítá z toho, co host opravdu zaplatil —
  // změna nastavení nesmí zpětně přepsat popisek u staré rezervace.
  const procento = procentoZalohy({ total_price: celkem, deposit_price: zaloha });

  const castka = (klic) => {
    const v = Number(nastaveni[klic]);
    return Number.isFinite(v) ? v : VYCHOZI_NASTAVENI[klic];
  };

  return {
    noci,
    popisNoci: noci > 0 ? sklonuj(noci, 'noc', 'noci', 'nocí') : 'neuvedeno',
    osob,
    popisOsob: sklonuj(osob, 'dospělý', 'dospělí', 'dospělých'),
    deti: Math.max(0, parseInt(r.children_count, 10) || 0),
    popisDeti: sklonuj(Math.max(0, parseInt(r.children_count, 10) || 0), 'dítě', 'děti', 'dětí'),
    celkem,
    zaloha,
    doplatek,
    ubytovani,
    sluzby,
    procentoZalohy: procento,
    procentoDoplatku: 100 - procento,
    zPolozek,
    polopenzeOsob: r.has_half_board
      ? Math.max(1, parseInt(r.half_board_count, 10) || osob) : 0,
    cenaPolopenze: castka('polopenze'),
    cenaPes: castka('pes'),
    cenaElektrokolo: castka('elektrokolo'),
  };
}

function getStatusLabel(status) {
  switch (status) {
    case 'confirmed':
      return 'ZÁVAZNĚ POTVRZENO (ZÁLOHA UHRAZENA)';
    case 'awaiting_deposit':
      return 'ČEKÁ NA ÚHRADU ZÁLOHY';
    case 'pending_approval':
      return 'KE SCHVÁLENÍ RECEPCÍ';
    case 'cancelled':
    case 'cancelled_unpaid':
    case 'stornováno':
      return 'STORNOVÁNO';
    default:
      return status || 'REZERVACE';
  }
}

function renderGuestRowsHTML(reservation) {
  const guests = reservation.guests || [];
  const expectedTotal = Math.max(1, reservation.adults_count || 1);
  const rows = [];

  for (let i = 0; i < Math.max(guests.length, expectedTotal); i++) {
    const g = guests[i] || {};
    const isMain = i === 0;
    // Escapuje se hned tady, u zdroje — dál už se s hodnotami jen skládá
    // řetězec a bylo by snadné na některou zapomenout.
    const name = escapujTisk(g.name || (isMain ? reservation.guest_name : ''));
    const birthDate = g.birth_date ? escapujTisk(formatCzechDateStr(g.birth_date)) : '';
    const idNumber = escapujTisk(g.id_number || '');
    const phone = escapujTisk(g.phone || (isMain ? reservation.guest_phone : ''));
    const email = escapujTisk(g.email || (isMain ? reservation.guest_email : ''));

    let addressParts = [];
    if (g.street || reservation.guest_street) addressParts.push(g.street || reservation.guest_street);
    if (g.city || reservation.guest_city) addressParts.push(g.city || reservation.guest_city);
    if (g.zip) addressParts.push(g.zip);
    if (g.country) addressParts.push(g.country);
    const addressStr = escapujTisk(addressParts.join(', ')) || '';

    rows.push(`
      <tr>
        <td style="text-align: center; font-weight: 700;">${i + 1}.</td>
        <td>
          <strong>${name || '________________________'}</strong>
          ${isMain ? '<br><span style="font-size: 8pt; color: #555;">(Hlavní ubytovaný kontakt)</span>' : ''}
        </td>
        <td>${birthDate || '___ . ___ . ______'}</td>
        <td>${idNumber || '________________'}</td>
        <td style="font-size: 8.5pt;">
          ${addressStr || '_____________________________________________'}
          ${phone ? `<br>Tel: ${phone}` : ''}
        </td>
        <td style="height: 36px; vertical-align: bottom; text-align: center; font-size: 8pt; color: #555;">
          ${name ? '________________' : '________________'}
        </td>
      </tr>
    `);
  }

  return rows.join('');
}

export function printReservationSheet(reservation) {
  if (!reservation) return;

  const room = MOCK_ROOMS.find(r => r.id === reservation.room_id) || {
    id: reservation.room_id,
    name: escapujTisk(reservation.room_name || 'Pokoj Hotel u Můstku')
  };

  const cenikProTisk = getStoredCenik();
  const udaje = udajeProTisk(reservation, cenikProTisk, room);

  const printWindow = window.open('', '_blank', 'width=920,height=1100,scrollbars=yes,resizable=yes');
  if (!printWindow) {
    // Vrací se false, aby si volající zobrazil hlášku svým způsobem —
    // v administraci toastem, ne nativním oknem prohlížeče.
    return false;
  }

  const vsCode = getVariableSymbol(reservation.code);
  const nowCzech = formatCzechDateTimeNow();

  const printHTML = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <title>Rezervační list - ${escapujTisk(reservation.code)} - Hotel u Můstku</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 14mm 10mm 14mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: #000000;
      background: #ffffff;
      margin: 0 auto;
      padding: 24px 32px;
      max-width: 960px;
    }
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000000;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .hotel-brand h1 {
      font-size: 17pt;
      font-weight: 800;
      margin: 0 0 3px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .hotel-brand p {
      margin: 0;
      font-size: 9pt;
      color: #222222;
      line-height: 1.35;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-meta h2 {
      font-size: 13.5pt;
      font-weight: 800;
      margin: 0 0 3px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-code {
      font-size: 11pt;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .doc-status {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      border: 1.5px solid #000000;
      padding: 3px 8px;
      display: inline-block;
      margin-top: 4px;
    }
    
    .section-title {
      font-size: 11pt;
      font-weight: 800;
      text-transform: uppercase;
      border-bottom: 1.5px solid #000000;
      padding-bottom: 4px;
      margin: 28px 0 14px 0;
      letter-spacing: 0.4px;
    }
    
    .grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 18px;
    }
    
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    .info-table td {
      padding: 5px 8px;
      font-size: 9.5pt;
      border-bottom: 1px solid #e0e0e0;
      vertical-align: top;
    }
    .info-table td.label {
      font-weight: 600;
      color: #333333;
      width: 42%;
    }
    .info-table td.value {
      font-weight: 700;
      color: #000000;
    }

    /* Guest Register Table for Ubytovací kniha */
    .guest-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 22px;
    }
    .guest-table th {
      background-color: #f2f2f2;
      border: 1px solid #000000;
      padding: 6px 8px;
      font-size: 8.5pt;
      font-weight: 700;
      text-align: left;
    }
    .guest-table td {
      border: 1px solid #000000;
      padding: 6px 8px;
      font-size: 9pt;
      vertical-align: middle;
    }
    
    .financial-box {
      border: 1.5px solid #000000;
      padding: 12px 18px;
      margin-top: 12px;
      margin-bottom: 24px;
      background: #fafafa;
    }
    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 9.5pt;
    }
    .financial-row.total {
      font-size: 11.5pt;
      font-weight: 800;
      border-top: 1.5px solid #000000;
      padding-top: 8px;
      margin-top: 6px;
    }

    .signature-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      margin-top: 36px;
      page-break-inside: avoid;
    }
    .signature-line {
      border-top: 1px dashed #000000;
      padding-top: 6px;
      text-align: center;
      font-size: 8.5pt;
      color: #222222;
      line-height: 1.35;
    }

    .footer-note {
      margin-top: 24px;
      text-align: center;
      font-size: 8pt;
      color: #555555;
      border-top: 1px solid #cccccc;
      padding-top: 8px;
    }

    @media print {
      body { width: 100%; margin: 0; padding: 0; }
      .no-print { display: none !important; }
      .financial-box { background: none !important; }

      /* JEDNA STRANA, VŽDY.
         Rezervační list přetékal na druhý list, kde bylo pár řádků —
         recepční pak měla u každé rezervace dva papíry. Sazba se proto
         při tisku stáhne a zalomení se zakáže. Kdyby někdy přibyl obsah
         a přestalo se to vejít, uber tady, ne v zobrazení na obrazovce. */
      html, body {
        font-size: 9pt;
        line-height: 1.3;
      }
      body > *:last-child { margin-bottom: 0 !important; }

      /* Nic se nesmí odlomit na další stranu. */
      table, tr, td, th,
      .financial-box, .section-block, .guests-table, .print-header, .print-footer {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      h1, h2, h3 { page-break-after: avoid !important; }

      /* Stáhnout mezery, které na obrazovce dávají smysl, na papíře ne. */
      .section-block { margin-bottom: 10px !important; }
      td, th { padding-top: 3px !important; padding-bottom: 3px !important; }
      h1 { font-size: 14pt !important; }
      h2 { font-size: 11pt !important; margin: 8px 0 5px 0 !important; }
      h3 { font-size: 10pt !important; margin: 6px 0 4px 0 !important; }

      /* Podpisové řádky nemusí být tak vysoké. */
      td[style*="height: 36px"] { height: 26px !important; }
    }
  </style>
</head>
<body>
  <!-- Controls for screen view before printing -->
  <div class="no-print" style="background: #1c1c19; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-radius: 4px;">
    <div style="font-weight: 700; font-size: 14px;">Tisk rezervačního listu (${escapujTisk(reservation.code)})</div>
    <div>
      <button onclick="window.print()" style="background: #ece8dd; color: #1c1c19; border: none; padding: 8px 18px; font-weight: 700; font-size: 13.5px; border-radius: 2px; cursor: pointer; margin-right: 10px;">Tisk / Uložit PDF</button>
      <button onclick="window.close()" style="background: #555; color: #fff; border: none; padding: 8px 14px; font-weight: 600; font-size: 13.5px; border-radius: 2px; cursor: pointer;">Zavřít</button>
    </div>
  </div>

  <div class="print-header">
    <div class="hotel-brand">
      <h1>Hotel U Můstků</h1>
      <p>Údolní 368, 468 61 Desná v Jizerských horách</p>
      <p>Tel: +420 777 666 273 | E-mail: hotel@umustku.cz | Web: umustku.cz</p>
      <!-- DIČ se sem SCHVÁLNĚ netiskne: obsahuje rodné číslo majitelky
           a rezervační list dostávají do ruky hosté. Patří jen na daňový
           doklad. Adresa i IČ byly navíc do 1. 9. 2026 chybné (Hutní 660,
           IČO 76366052) a nesouhlasily s tím, co uvádí obchodní podmínky
           a zásady ochrany údajů. -->
      <p>Lenka Bellingerová · IČ: 74349074 · plátce DPH</p>
    </div>
    <div class="doc-meta">
      <h2>REZERVAČNÍ LIST</h2>
      <div class="doc-code">Kód: ${escapujTisk(reservation.code)}</div>
      <div>Datum tisku: ${nowCzech.dateStr}</div>
      <div class="doc-status">${getStatusLabel(reservation.status)}</div>
    </div>
  </div>

  <!-- SEKCIE 1: ZÁKLADNÍ ÚDAJE O POBYTU -->
  <div class="section-title">1. Informace o ubytování a pobytu</div>
  <div class="grid-2col">
    <table class="info-table">
      <tr><td class="label">Pokoj:</td><td class="value">${room.name}</td></tr>
      <tr><td class="label">Termín pobytu:</td><td class="value">${formatCzechDateStr(reservation.date_from)} — ${formatCzechDateStr(reservation.date_to)}</td></tr>
      <tr><td class="label">Počet nocí:</td><td class="value">${udaje.popisNoci}</td></tr>
    </table>
    <table class="info-table">
      <tr><td class="label">Příjezd (Check-in):</td><td class="value">od 15:00 hod.</td></tr>
      <tr><td class="label">Odjezd (Check-out):</td><td class="value">do 10:00 hod.</td></tr>
      <tr><td class="label">Počet osob:</td><td class="value">${udaje.popisOsob}${udaje.deti > 0 ? `, ${udaje.popisDeti}` : ''}</td></tr>
    </table>
  </div>

  <!-- SEKCIE 2: SEZNAM UBYTOVANÝCH HOSTŮ PRO UBYTOVACÍ KNIHU -->
  <div class="section-title">2. Seznam ubytovaných hostů (pro Ubytovací knihu)</div>
  <table class="guest-table">
    <thead>
      <tr>
        <th style="width: 4%;">#</th>
        <th style="width: 25%;">Jméno a příjmení</th>
        <th style="width: 14%;">Datum nar.</th>
        <th style="width: 16%;">Číslo OP / Pasu</th>
        <th style="width: 27%;">Adresa trvalého bydliště</th>
        <th style="width: 14%;">Podpis hosta</th>
      </tr>
    </thead>
    <tbody>
      ${renderGuestRowsHTML(reservation)}
    </tbody>
  </table>

  <!-- SEKCIE 3: DOPLŇKOVÉ SLUŽBY -->
  <div class="section-title">3. Doplňkové služby & Poznámka</div>
  <table class="info-table">
    <tr><td class="label" style="width: 25%;">Polopenze:</td><td class="value">${reservation.has_half_board ? `${sklonuj(udaje.polopenzeOsob, 'osoba', 'osoby', 'osob')} (${udaje.cenaPolopenze} Kč / osoba a noc)` : 'Ne'}</td></tr>
    <tr><td class="label" style="width: 25%;">Pobyt s pejskem:</td><td class="value">${reservation.has_dog ? `Ano (${udaje.cenaPes} Kč / noc)` : 'Ne'}</td></tr>
    <tr><td class="label" style="width: 25%;">Elektrokolo:</td><td class="value">${reservation.has_ebike ? `${sklonuj(Math.max(1, parseInt(reservation.ebike_count, 10) || 1), 'kus', 'kusy', 'kusů')} (${udaje.cenaElektrokolo} Kč / kus a den)` : 'Ne'}</td></tr>
    <tr><td class="label" style="width: 25%;">Zimní parkování:</td><td class="value">${reservation.has_winter_parking ? `${sklonuj(Math.max(1, parseInt(reservation.parking_cars_count, 10) || 1), 'auto', 'auta', 'aut')} (${formatCzechPrice(reservation.winter_parking_price_total || 0)} za pobyt)` : 'Ne'}</td></tr>
    <tr><td class="label" style="width: 25%;">Poznámka hosta:</td><td class="value">${escapujTisk(reservation.guest_note || 'Bez poznámky')}</td></tr>
  </table>

  <!-- SEKCIE 4: FINANČNÍ PŘEHLED POBYTU -->
  <div class="section-title">4. Finanční přehled a rozpis úhrady</div>
  <div class="financial-box">
    <div class="financial-row">
      <span>Ubytování se snídaní${udaje.sluzby > 0 ? ' a doplňkové služby' : ''}:</span>
      <strong>${formatCzechPrice((udaje.ubytovani || 0) + (udaje.sluzby || 0))}</strong>
    </div>
    <div class="financial-row">
      <span>Celková cena pobytu (vč. DPH):</span>
      <strong>${formatCzechPrice(udaje.celkem)}</strong>
    </div>
    <div class="financial-row">
      <span>Záloha (${udaje.procentoZalohy} % bankovním převodem, VS ${vsCode}):</span>
      <strong>${formatCzechPrice(udaje.zaloha)} ${reservation.status === 'confirmed' ? '(UHRAZENO)' : '(zatím neuhrazeno)'}</strong>
    </div>
    <div class="financial-row total">
      <span>Zbývající doplatek k úhradě na místě (${udaje.procentoDoplatku} %):</span>
      <span>${formatCzechPrice(udaje.doplatek)}</span>
    </div>
  </div>

  <!-- PODPISY -->
  <div class="signature-block">
    <div class="signature-line">
      Podpis ubytovaného hosta (potvrzení Check-inu)<br>
      <em>Stvrzuji správnost údajů a souhlas s ubytovacím řádem.</em>
    </div>
    <div class="signature-line">
      Razítko hotelu a podpis recepčního<br>
      <em>Hotel u Můstku, Desná v Jiz. horách</em>
    </div>
  </div>

  <div class="footer-note">
    Dokument vytvořen ze systému Hotel u Můstku dnem ${nowCzech.dateStr} v ${nowCzech.timeStr} hod. Slouží jako oficiální podklad pro rezervační a ubytovací knihu hotelu.
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(printHTML);
  printWindow.document.close();
}
