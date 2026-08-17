import { MOCK_ROOMS, getStoredCenik } from '../lib/supabaseClient.js';
import { calculateReservationPrice, formatCzechPrice, getVariableSymbol } from './pricing.js';

function formatCzechDateStr(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}. ${parts[1]}. ${parts[0]}`;
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
    const name = g.name || (isMain ? reservation.guest_name : '');
    const birthDate = g.birth_date ? formatCzechDateStr(g.birth_date) : '';
    const idNumber = g.id_number || '';
    const phone = g.phone || (isMain ? reservation.guest_phone : '');
    const email = g.email || (isMain ? reservation.guest_email : '');
    
    let addressParts = [];
    if (g.street || reservation.guest_street) addressParts.push(g.street || reservation.guest_street);
    if (g.city || reservation.guest_city) addressParts.push(g.city || reservation.guest_city);
    if (g.zip) addressParts.push(g.zip);
    if (g.country) addressParts.push(g.country);
    const addressStr = addressParts.join(', ') || '';

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
    name: reservation.room_name || 'Pokoj Hotel u Můstku'
  };

  const cenikProTisk = getStoredCenik();

  const pricing = calculateReservationPrice({
    // Dřív se sem posílalo room_id místo kategorie pokoje, takže
    // se cena počítala vždy podle standardu.
    roomType: room.type || 'standard',
    roomId: room.id,
    nights: reservation.nights_count || null,
    persons: reservation.adults_count || 1,
    adults: reservation.adults_count || 1,
    dateFrom: reservation.date_from,
    dateTo: reservation.date_to,
    hasDog: reservation.has_dog,
    hasEbike: reservation.has_ebike,
    ebikeCount: reservation.ebike_count,
    hasHalfBoard: reservation.has_half_board,
    halfBoardCount: reservation.half_board_count,
    hasWinterParking: reservation.has_winter_parking,
    parkingCarsCount: reservation.parking_cars_count,
    cenik: cenikProTisk,
    nastaveni: cenikProTisk.nastaveni
  });

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
  <title>Rezervační list - ${reservation.code} - Hotel u Můstku</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 20mm 15mm 20mm;
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
    }
  </style>
</head>
<body>
  <!-- Controls for screen view before printing -->
  <div class="no-print" style="background: #1c1c19; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-radius: 4px;">
    <div style="font-weight: 700; font-size: 14px;">Tisk rezervačního listu (${reservation.code})</div>
    <div>
      <button onclick="window.print()" style="background: #ece8dd; color: #1c1c19; border: none; padding: 8px 18px; font-weight: 700; font-size: 13.5px; border-radius: 2px; cursor: pointer; margin-right: 10px;">Tisk / Uložit PDF</button>
      <button onclick="window.close()" style="background: #555; color: #fff; border: none; padding: 8px 14px; font-weight: 600; font-size: 13.5px; border-radius: 2px; cursor: pointer;">Zavřít</button>
    </div>
  </div>

  <div class="print-header">
    <div class="hotel-brand">
      <h1>Hotel u Můstku</h1>
      <p>Hutní 660, 468 61 Desná v Jizerských horách</p>
      <p>Tel: +420 777 666 273 | E-mail: info@hotelumustku.cz | Web: umustku.cz</p>
      <p>IČO: 76366052 | DIČ: CZ8905052738</p>
    </div>
    <div class="doc-meta">
      <h2>REZERVAČNÍ LIST</h2>
      <div class="doc-code">Kód: ${reservation.code}</div>
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
      <tr><td class="label">Počet nocí:</td><td class="value">${pricing.nights} nocí</td></tr>
    </table>
    <table class="info-table">
      <tr><td class="label">Příjezd (Check-in):</td><td class="value">od 14:00 hod.</td></tr>
      <tr><td class="label">Odjezd (Check-out):</td><td class="value">do 10:00 hod.</td></tr>
      <tr><td class="label">Počet osob:</td><td class="value">${reservation.adults_count || 1} dospělí ${reservation.children_count > 0 ? `, ${reservation.children_count} dětí` : ''}</td></tr>
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
    <tr><td class="label" style="width: 25%;">Polopenze:</td><td class="value">${reservation.has_half_board ? `${reservation.half_board_count || reservation.adults_count || 1} osob` : 'Ne'}</td></tr>
    <tr><td class="label" style="width: 25%;">Pobyt s pejskem:</td><td class="value">${reservation.has_dog ? 'Ano (150 Kč/den)' : 'Ne'}</td></tr>
    <tr><td class="label" style="width: 25%;">Elektrokolo:</td><td class="value">${reservation.has_ebike ? `${reservation.ebike_count || 1}x ks` : 'Ne'}</td></tr>
    <tr><td class="label" style="width: 25%;">Zimní parkování:</td><td class="value">${reservation.has_winter_parking ? `${reservation.parking_cars_count || 1}x auto (${(reservation.parking_cars_count || 1) * 50} Kč/noc)` : 'Ne (0 Kč)'}</td></tr>
    <tr><td class="label" style="width: 25%;">Poznámka hosta:</td><td class="value">${reservation.guest_note || 'Bez poznámky'}</td></tr>
  </table>

  <!-- SEKCIE 4: FINANČNÍ PŘEHLED POBYTU -->
  <div class="section-title">4. Finanční přehled a rozpis úhrady</div>
  <div class="financial-box">
    <div class="financial-row">
      <span>Celková cena pobytu (vč. DPH):</span>
      <strong>${formatCzechPrice(pricing.totalPrice)} Kč</strong>
    </div>
    <div class="financial-row">
      <span>Uhrazená záloha (${pricing.depositPercentage} % bankovním převodem, VS ${vsCode}):</span>
      <strong>${formatCzechPrice(pricing.depositPriceTotal)} Kč ${reservation.status === 'confirmed' ? '(UHRAZENO)' : ''}</strong>
    </div>
    <div class="financial-row total">
      <span>Zbývající doplatek k úhradě na místě (70 %):</span>
      <span>${formatCzechPrice(pricing.remainingPriceTotal)} Kč</span>
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
