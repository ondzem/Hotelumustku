// Transactional Email Service & Audit Log Store for Hotel u Můstku
import { BANK_ACCOUNT, BANK_NAME, generateSpaydQrUrl, formatCzechPrice, getVariableSymbol } from './pricing.js';

const LOCAL_STORAGE_EMAIL_LOGS_KEY = 'hotel_umustku_email_logs_v1';

/**
 * Adresa hotelu, kterou VIDÍ HOSTÉ.
 *
 * Píše se do textů e-mailů a do tiskových sestav jako kontakt na hotel.
 * Dřív byly v kódu rozeseté tři různé adresy — mimo jiné
 * info@hotelumustku.cz, která nikdy neexistovala, a přesto se posílala
 * hostům v e-mailu o vypršení lhůty pro úhradu zálohy.
 */
export const HOTEL_EMAIL = 'hotel@umustku.cz';
export const HOTEL_TELEFON = '+420 777 666 273';

/**
 * Kam CHODÍ UPOZORNĚNÍ pro recepci — nová žádost o rezervaci, zpráva
 * z kontaktního formuláře, nová recenze.
 *
 * Od 23. 8. 2026 je to tatáž adresa jako HOTEL_EMAIL. Dřív tu byla
 * soukromá schránka majitele, protože doména se teprve překlápěla
 * a upozornění by se ztrácela; soukromá adresa se sem vracet nemá —
 * hotelu chodí pošta na hotelovou adresu.
 *
 * Musí sedět s konstantou RECEPCE v netlify/functions/send-email.js —
 * mění se to na obou místech naráz. Hlídá to kontrola „Adresa recepce"
 * v ./zkontroluj.sh.
 */
export const RECEPCE_PRIJEMCE = HOTEL_EMAIL;

export function getEmailLogs() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EMAIL_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logSentEmail(emailRecord) {
  const logs = getEmailLogs();
  const newRecord = {
    id: 'email-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    ...emailRecord
  };
  logs.unshift(newRecord);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_EMAIL_LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
    } catch (err) {
      console.error('Failed to log email:', err);
    }
  }
  return newRecord;
}

export async function sendEmail({ to, subject, html, type, reservationCode }) {
  console.log(`📧 [EMAIL INITIATED] Type: ${type} | To: ${to} | Subject: ${subject}`);

  // Klíč k Resendu už NENÍ v prohlížeči. Odesílání obstarává serverová
  // funkce netlify/functions/send-email.js, která klíč čte z proměnné
  // RESEND_API_KEY v prostředí Netlify. Dřív byl klíč natvrdo v tomto
  // souboru a skončil v dist/assets/main-*.js u každého návštěvníka.
  let finalStatus = 'pending';
  let liveResendId = null;
  let deliveryNote = '';

  try {
    const response = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html, type })
    });

    if (response.status === 404) {
      // Místní vývoj přes `npm run dev` serverové funkce nezná.
      // Pro skutečné odeslání spusť `netlify dev`.
      console.warn('✉️ Serverová funkce není dostupná (běží vývojový server). E-mail se neodeslal, jen zaznamenal.');
      deliveryNote = 'Neodesláno — vývojový režim bez serverových funkcí';
    } else {
      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) data = await response.json();

      if (data && data.id) {
        liveResendId = data.id;
        finalStatus = data.status || 'delivered';
        deliveryNote = data.note || '';
        console.log(`✅ E-mail odeslán na [${to}] (ID: ${data.id})`);
      } else {
        console.warn('⚠️ Odeslání e-mailu selhalo:', data);
        deliveryNote = (data && data.error) ? data.error : 'Odeslání selhalo';
      }
    }
  } catch (err) {
    console.error('❌ Chyba při volání serverové funkce pro e-mail:', err);
    deliveryNote = 'Server neodpověděl';
  }

  const record = logSentEmail({
    to,
    subject,
    html,
    type,
    reservation_code: reservationCode,
    status: finalStatus,
    resend_id: liveResendId,
    note: deliveryNote
  });

  return { success: finalStatus.startsWith('delivered'), record };
}

// -------------------------------------------------------------
// EMAIL TEMPLATES (Stručné, úderné, přehledné a reprezentativní)
// -------------------------------------------------------------

function getEmailHeader(title) {
  return `
    <!DOCTYPE html>
    <html lang="cs" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>${title}</title>
      <style>
        :root {
          color-scheme: light;
          supported-color-schemes: light;
        }
        body, table, td, p, a, li, blockquote {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          background-color: #ffffff !important;
          color: #1a1a1a !important;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .email-outer-wrapper {
          width: 100% !important;
          background-color: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .email-card {
          width: 100% !important;
          max-width: 680px !important;
          margin: 0 auto !important;
          background-color: #ffffff !important;
          border: 1px solid #e0e4d6;
        }
        .email-header {
          background-color: #697947 !important;
          color: #ffffff !important;
          padding: 32px 24px !important;
          text-align: center !important;
        }
        .email-header h1 {
          margin: 0 !important;
          font-size: 24px !important;
          font-weight: 700 !important;
          color: #ffffff !important;
          letter-spacing: 0.5px;
        }
        .email-header p {
          margin: 8px 0 0 0 !important;
          font-size: 15px !important;
          color: #ffffff !important;
          opacity: 0.95;
        }
        .email-body {
          padding: 32px 28px !important;
          font-size: 15.5px !important;
          line-height: 1.65 !important;
          color: #1a1a1a !important;
          background-color: #ffffff !important;
        }
        .alert-box {
          background-color: #fff9ed !important;
          border-left: 4px solid #f39c12 !important;
          padding: 18px !important;
          margin: 24px 0 !important;
          border-radius: 2px;
          font-size: 14.5px !important;
          color: #333333 !important;
        }
        .alert-box-success {
          background-color: #f2f8f2 !important;
          border-left: 4px solid #27ae60 !important;
          padding: 18px !important;
          margin: 24px 0 !important;
          border-radius: 2px;
          font-size: 14.5px !important;
          color: #1a1a1a !important;
        }
        .info-table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 24px 0 !important;
          font-size: 15px !important;
          background-color: #ffffff !important;
        }
        .info-table td {
          padding: 12px 14px !important;
          border-bottom: 1px solid #eef2e6 !important;
          color: #1a1a1a !important;
          background-color: #ffffff !important;
        }
        .info-table tr:nth-child(even) td {
          background-color: #fafcf8 !important;
        }
        .info-table td:first-child {
          color: #555555 !important;
          font-weight: 500 !important;
          width: 42% !important;
        }
        .info-table td:last-child {
          font-weight: 700 !important;
          color: #1a1a1a !important;
          text-align: right !important;
        }
        .qr-section {
          text-align: center !important;
          background-color: #f9faf7 !important;
          padding: 24px !important;
          border-radius: 4px;
          border: 1px dashed #cccccc !important;
          margin: 28px 0 !important;
        }
        .qr-img {
          width: 200px !important;
          height: 200px !important;
          margin: 14px auto !important;
          display: block !important;
        }
        .btn-link {
          display: inline-block !important;
          background-color: #697947 !important;
          color: #ffffff !important;
          text-decoration: none !important;
          padding: 14px 28px !important;
          border-radius: 2px !important;
          font-weight: 600 !important;
          margin: 18px 0 !important;
        }
        .email-footer {
          background-color: #fafbf8 !important;
          padding: 24px 28px !important;
          border-top: 1px solid #e0e4d6 !important;
          font-size: 13.5px !important;
          color: #555555 !important;
          text-align: center !important;
        }
        .email-footer strong {
          color: #1a1a1a !important;
        }
        .email-footer a {
          color: #697947 !important;
          text-decoration: none !important;
        }
        .perks-list {
          margin: 18px 0 !important;
          padding-left: 20px !important;
          color: #2e7d32 !important;
          font-weight: 500 !important;
        }
        .perks-list li {
          margin-bottom: 8px !important;
        }
      </style>
    </head>
    <body style="background-color: #ffffff !important; color: #1a1a1a !important; margin: 0; padding: 0;">
      <table role="presentation" class="email-outer-wrapper" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff !important; width: 100% !important;">
        <tr>
          <td align="center" style="background-color: #ffffff !important; padding: 0;">
            <div class="email-card" style="width: 100% !important; max-width: 680px !important; background-color: #ffffff !important;">
              <div class="email-header" style="background-color: #697947 !important; color: #ffffff !important; padding: 32px 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; color: #ffffff !important;">Hotel u Můstku</h1>
                <p style="margin: 8px 0 0 0; font-size: 15px; color: #ffffff !important; opacity: 0.95;">${title}</p>
              </div>
              <div class="email-body" style="padding: 32px 28px; background-color: #ffffff !important; color: #1a1a1a !important;">
  `;
}

function getEmailFooter() {
  return `
              </div>
              <div class="email-footer" style="background-color: #fafbf8 !important; padding: 24px 28px; border-top: 1px solid #e0e4d6; font-size: 13.5px; color: #555555; text-align: center;">
                <p style="margin: 0 0 6px 0; color: #1a1a1a !important;"><strong>Hotel u Můstku</strong> • Údolní 368, 468 61 Desná v Jizerských horách 1</p>
                <p style="margin: 0; color: #555555 !important;">📞 Telefon: <a href="tel:+420777666273" style="color: #697947 !important; text-decoration: none;">+420 777 666 273</a> | ✉️ E-mail: <a href="mailto:hotel@umustku.cz" style="color: #697947 !important; text-decoration: none;">hotel@umustku.cz</a></p>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// E-MAIL 1: Zákazníkovi při podání žádosti (Fáze 1)
export function generateEmail1RequestReceived({ reservation, room, pricing }) {
  const guestsSummary = (reservation.guests && reservation.guests.length > 0)
    ? reservation.guests.map((g, i) => `${i + 1}. ${g.name || 'Host'}`).join(', ')
    : `${reservation.adults_count} dospělí ${reservation.children_count > 0 ? `, ${reservation.children_count} dětí` : ''}`;

  const html = `
    ${getEmailHeader('Žádost o rezervaci přijata')}
    <p style="color: #1a1a1a !important;">Vážený/á <strong>${reservation.guest_name}</strong>,</p>
    <p style="color: #333333 !important;">děkujeme za zájem o ubytování v Hotelu u Můstku. Vaši žádost o rezervaci jsme v pořádku přijali.</p>
    
    <div class="alert-box" style="background-color: #fff9ed !important; color: #333333 !important;">
      Rezervaci nyní ověřuje recepce hotelu. Jakmile termín potvrdíme, zašleme vám e-mailem pokyny k úhradě <strong>${pricing.depositPercentage}% zálohy</strong>.
    </div>

    <table class="info-table" style="background-color: #ffffff !important;">
      <tr><td style="color: #555555 !important;">Kód žádosti:</td><td style="color: #1a1a1a !important;">${reservation.code}</td></tr>
      <tr><td style="color: #555555 !important;">Pokoj:</td><td style="color: #1a1a1a !important;">${room.name}</td></tr>
      <tr><td style="color: #555555 !important;">Termín:</td><td style="color: #1a1a1a !important;">${reservation.date_from} až ${reservation.date_to} (${pricing.nights} nocí)</td></tr>
      <tr><td style="color: #555555 !important;">Ubytovaní hosté:</td><td style="color: #1a1a1a !important;">${guestsSummary}</td></tr>
      <tr><td style="color: #555555 !important;">Celková cena pobytu:</td><td style="color: #1a1a1a !important;">${pricing.totalPrice} Kč</td></tr>
      <tr><td style="color: #555555 !important;">Záloha k úhradě po schválení (${pricing.depositPercentage} %):</td><td><strong style="color:#697947 !important;">${pricing.depositPriceTotal} Kč</strong></td></tr>
      <tr><td style="color: #555555 !important;">Doplatek na místě (${100 - pricing.depositPercentage} %):</td><td style="color: #1a1a1a !important;">${pricing.remainingPriceTotal} Kč</td></tr>
    </table>

    <p style="font-size:13.5px; color:#666666 !important;">O schválení vás budeme informovat v co nejkratším čase.</p>
    ${getEmailFooter()}
  `;
  return { subject: `Žádost o rezervaci ${reservation.code} byla přijata — Hotel u Můstku`, html };
}

// E-MAIL 1 (Pro recepci): Upozornění na novou žádost
export function generateEmail1ReceptionNotification({ reservation, room, pricing }) {
  const guestsCount = reservation.guests ? reservation.guests.length : (reservation.adults_count || 1);
  const guestsHtml = (reservation.guests && reservation.guests.length > 0)
    ? reservation.guests.map((g, i) => `<strong>${i + 1}. ${g.name}</strong> ${g.is_main ? '(Hlavní kontakt)' : ''} ${g.birth_date ? `• Nar: ${g.birth_date}` : ''}`).join('<br>')
    : `<strong>1. ${reservation.guest_name}</strong> (Hlavní kontakt)`;

  const html = `
    ${getEmailHeader('Nová žádost o rezervaci ke schválení')}
    <p style="color: #1a1a1a !important;">Na webu byla vytvořena nová žádost o rezervaci:</p>
    <table class="info-table" style="background-color: #ffffff !important;">
      <tr><td style="color: #555555 !important;">Hlavní kontakt:</td><td style="color: #1a1a1a !important;">${reservation.guest_name} (${reservation.guest_phone}, ${reservation.guest_email})</td></tr>
      <tr><td style="color: #555555 !important;">Seznam hostů (${guestsCount}):</td><td style="color: #1a1a1a !important;">${guestsHtml}</td></tr>
      <tr><td style="color: #555555 !important;">Pokoj:</td><td style="color: #1a1a1a !important;">${room.name}</td></tr>
      <tr><td style="color: #555555 !important;">Termín:</td><td style="color: #1a1a1a !important;">${reservation.date_from} až ${reservation.date_to} (${pricing.nights} nocí)</td></tr>
      <tr><td style="color: #555555 !important;">Celková cena:</td><td style="color: #1a1a1a !important;">${formatCzechPrice(pricing.totalPrice)} (Záloha ${pricing.depositPercentage} %: ${formatCzechPrice(pricing.depositPriceTotal)})</td></tr>
      ${reservation.guest_note ? `<tr><td style="color: #555555 !important;">Poznámka hosta:</td><td style="color: #1a1a1a !important;">${reservation.guest_note}</td></tr>` : ''}
    </table>
    ${getEmailFooter()}
  `;
  return { subject: `[RECEPCE] Nová žádost o rezervaci ${reservation.code} — ${room.name}`, html };
}

// E-MAIL 2: Zákazníkovi po schválení recepcí — Pokyny k platbě 30% zálohy (Fáze 2)
export function generateEmail2ApprovalAndPaymentRequest({ reservation, room, pricing }) {
  const vsClean = getVariableSymbol(reservation.code);
  const qrUrl = generateSpaydQrUrl({
    bankAccount: BANK_ACCOUNT,
    amount: pricing.depositPriceTotal,
    vs: vsClean,
    message: `Zaloha ${reservation.code}`
  });

  const html = `
    ${getEmailHeader(`Rezervace schválena — Pokyny k ${pricing.depositPercentage}% záloze`)}
    <p style="color: #1a1a1a !important;">Vážený/á <strong>${reservation.guest_name}</strong>,</p>
    <p style="color: #333333 !important;">s radostí vám oznamujeme, že vaši žádost o rezervaci pokoje <strong>${room.name}</strong> v termínu <strong>${reservation.date_from} až ${reservation.date_to}</strong> recepce schválila!</p>

    <div class="alert-box-success" style="background-color: #f2f8f2 !important; color: #1a1a1a !important;">
      <strong style="color: #27ae60 !important;">✅ Pokoj je pro vás rezervován.</strong> Pro dokončení závazné rezervace prosíme o úhradu ${pricing.depositPercentage}% zálohy <strong style="color: #1a1a1a !important; background-color: #dceada !important; padding: 2px 7px !important; border-radius: 3px !important; border: 1px solid #b2d8b2 !important; font-weight: 800 !important;">do 3 pracovních dnů</strong>.
    </div>

    <div class="qr-section" style="background-color: #f9faf7 !important;">
      <h3 style="margin:0 0 8px 0; color:#1a1a1a !important;">Rychlá úhrada QR kódem (${pricing.depositPercentage} % záloha)</h3>
      <p style="margin:0; font-size:13.5px; color:#666666 !important;">Naskenujte v aplikaci vaší mobilní banky:</p>
      <img src="${qrUrl}" alt="QR Kód pro ${pricing.depositPercentage}% zálohu" class="qr-img" style="display: block; margin: 16px auto; width: 220px; height: 220px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; background: #ffffff;">
      <p style="margin:4px 0 0 0; font-weight:bold; font-size:18px; color:#697947 !important;">Částka k úhradě: ${formatCzechPrice(pricing.depositPriceTotal)}</p>
    </div>

    <table class="info-table" style="background-color: #ffffff !important;">
      <tr><td style="color: #555555 !important;">Číslo bankovního účtu:</td><td style="color: #1a1a1a !important;"><strong>${BANK_ACCOUNT}</strong> (${BANK_NAME})</td></tr>
      <tr><td style="color: #555555 !important;">Variabilní symbol:</td><td style="color: #1a1a1a !important;"><strong>${vsClean}</strong></td></tr>
      <tr><td style="color: #555555 !important;">Částka zálohy (${pricing.depositPercentage} %):</td><td><strong style="color:#697947 !important;">${formatCzechPrice(pricing.depositPriceTotal)}</strong></td></tr>
      <tr><td style="color: #555555 !important;">Doplatek při příjezdu (${100 - pricing.depositPercentage} %):</td><td style="color: #1a1a1a !important;">${formatCzechPrice(pricing.remainingPriceTotal)}</td></tr>
      <tr><td style="color: #555555 !important;">Splatnost zálohy:</td><td><strong style="color: #d9534f !important; font-size: 15px !important; font-weight: 800 !important; text-decoration: underline !important;">Do 3 pracovních dnů</strong></td></tr>
    </table>

    <div style="margin: 20px 0 16px 0; background-color: #f9faf7 !important; border: 1px solid #e7e5dc !important; border-left: 4px solid #697947 !important; border-radius: 6px !important; padding: 14px 18px !important; font-size: 14px !important; color: #2c2c28 !important; line-height: 1.55 !important;">
      🧾 <strong>Informace k faktuře a daňovému dokladu:</strong><br>
      Faktura (daňový doklad) na celkovou částku pobytu i s potvrzením přijaté zálohy vám bude vystavena a předána na recepci při vašem příjezdu na hotel.
    </div>

    <p style="font-size:13.5px; color:#666666 !important;">Po připsání zálohy na náš účet vám ihned zašleme finální potvrzení rezervace.</p>
    ${getEmailFooter()}
  `;
  return { subject: `Vaše rezervace ${reservation.code} byla schválena! Pokyny k úhradě ${pricing.depositPercentage}% zálohy`, html };
}

// E-MAIL 3: Zákazníkovi po schválení přijetí zálohy recepcí — Závazné potvrzení (Fáze 3)
export function generateEmail3FinalConfirmation({ reservation, room, pricing }) {
  const guestsSummary = (reservation.guests && reservation.guests.length > 0)
    ? reservation.guests.map((g, i) => `${i + 1}. ${g.name || 'Host'}`).join(', ')
    : `${reservation.adults_count || 1} dospělí`;

  const html = `
    ${getEmailHeader('Závazné potvrzení rezervace')}
    <p style="color: #1a1a1a !important;">Vážený/á <strong>${reservation.guest_name}</strong>,</p>
    <p style="color: #333333 !important;">děkujeme! Vaše ${pricing.depositPercentage}% záloha ve výši <strong>${formatCzechPrice(pricing.depositPriceTotal)}</strong> byla úspěšně přijata. Vaše rezervace je nyní <strong>závazně potvrzena</strong>.</p>

    <div class="alert-box-success" style="background-color: #f2f8f2 !important; color: #1a1a1a !important;">
      <strong style="color: #27ae60 !important;">🎉 Těšíme se na vaši návštěvu!</strong> Ubytování máte plně garantováno.
    </div>

    <table class="info-table" style="background-color: #ffffff !important;">
      <tr><td style="color: #555555 !important;">Kód rezervace:</td><td style="color: #1a1a1a !important;"><strong>${reservation.code}</strong></td></tr>
      <tr><td style="color: #555555 !important;">Pokoj:</td><td style="color: #1a1a1a !important;">${room.name}</td></tr>
      <tr><td style="color: #555555 !important;">Termín:</td><td style="color: #1a1a1a !important;">${reservation.date_from} až ${reservation.date_to} (${pricing.nights} nocí)</td></tr>
      <tr><td style="color: #555555 !important;">Ubytovaní hosté:</td><td style="color: #1a1a1a !important;">${guestsSummary}</td></tr>
      <tr><td style="color: #555555 !important;">Zaplacená záloha (${pricing.depositPercentage} %):</td><td><span style="color:#27ae60 !important; font-weight:bold;">${formatCzechPrice(pricing.depositPriceTotal)} (Zaplaceno)</span></td></tr>
      <tr><td style="color: #555555 !important;">Doplatek na místě (${100 - pricing.depositPercentage} %):</td><td><strong style="color:#1a1a1a !important;">${formatCzechPrice(pricing.remainingPriceTotal)}</strong> (při příjezdu)</td></tr>
    </table>

    <div style="margin: 28px 0 24px 0; background-color: #F9FAF7 !important; border: 1px solid #E7E5DC !important; border-radius: 12px !important; padding: 20px 24px !important;">
      <h4 style="margin: 0 0 14px 0 !important; font-size: 16px !important; font-weight: 700 !important; color: #4A5A24 !important;">ℹ️ Důležité informace k příjezdu:</h4>
      <table style="width: 100% !important; border-collapse: collapse !important; font-size: 14.5px !important; color: #2C2C28 !important; line-height: 1.6 !important;">
        <tr>
          <td style="padding: 6px 0 !important; width: 28px !important; vertical-align: top !important;">⏰</td>
          <td style="padding: 6px 0 !important;"><strong style="color: #1A1A1A !important;">Check-in (Příjezd):</strong> od 15:00 hod.</td>
        </tr>
        <tr>
          <td style="padding: 6px 0 !important; width: 28px !important; vertical-align: top !important;">⏰</td>
          <td style="padding: 6px 0 !important;"><strong style="color: #1A1A1A !important;">Check-out (Odjezd):</strong> do 10:00 hod.</td>
        </tr>
        <tr>
          <td style="padding: 6px 0 !important; width: 28px !important; vertical-align: top !important;">🧾</td>
          <td style="padding: 6px 0 !important;"><strong style="color: #1A1A1A !important;">Faktura / Daňový doklad:</strong> Bude vám vystaven a předán na recepci při příjezdu na hotel.</td>
        </tr>
        <tr>
          <td style="padding: 6px 0 !important; width: 28px !important; vertical-align: top !important;">☕</td>
          <td style="padding: 6px 0 !important;"><strong style="color: #1A1A1A !important;">Snídaně:</strong> Formou bufetu v ceně pobytu</td>
        </tr>
        <tr>
          <td style="padding: 6px 0 !important; width: 28px !important; vertical-align: top !important;">🚗</td>
          <td style="padding: 6px 0 !important;"><strong style="color: #1A1A1A !important;">Parkování:</strong> Přímo u hotelu ZDARMA</td>
        </tr>
        <tr>
          <td style="padding: 6px 0 !important; width: 28px !important; vertical-align: top !important;">📶</td>
          <td style="padding: 6px 0 !important;"><strong style="color: #1A1A1A !important;">Wi-Fi:</strong> Bezdrátový internet v celém objektu ZDARMA</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13.5px; color:#666666 !important; text-align: center !important; margin-top: 20px !important;">Storno podmínky: Zrušení zdarma více než 3 dny před příjezdem. Po vzájemné dohodě lze termín pobytu flexibilně přesunout.</p>
    ${getEmailFooter()}
  `;
  return { subject: `Potvrzení zálohy & Závazná rezervace ${reservation.code} — Hotel u Můstku`, html };
}

// E-MAIL 4: Zákazníkovi po stornování / zamítnutí rezervace recepcí
export function generateEmailCancellation({ reservation, room, reasonNote }) {
  const html = `
    ${getEmailHeader('Informace k vaší žádosti o rezervaci')}
    <p style="color: #1a1a1a !important;">Vážený/á <strong>${reservation.guest_name}</strong>,</p>
    <p style="color: #333333 !important;">děkujeme za váš zájem o ubytování v Hotelu u Můstku. Velice nás to mrzí, ale po fyzické kontrole kapacity v rezervačním systému musíme vaši žádost o rezervaci <strong>${reservation.code}</strong> v požadovaném termínu zamítnout.</p>

    <div style="background-color: #fff8f8 !important; border: 1px solid #f5c6cb !important; border-radius: 12px !important; padding: 18px 22px !important; margin: 24px 0 !important; color: #721c24 !important;">
      <strong style="color: #721c24 !important;">⚠️ Důvod zamítnutí požadovaného termínu:</strong><br>
      <span style="font-size: 14.5px; color: #491217;">${reasonNote || 'Pokoj je v požadovaném termínu již plně obsazen nebo probíhá plánovaná údržba kapacity.'}</span>
    </div>

    <div style="background-color: #F9FAF7 !important; border: 1px solid #E7E5DC !important; border-radius: 12px !important; padding: 20px 24px !important; margin: 24px 0 !important;">
      <h4 style="margin: 0 0 12px 0 !important; font-size: 16px !important; font-weight: 700 !important; color: #4A5A24 !important;">💡 Co dělat dál? Rádi pro vás najdeme jiný termín!</h4>
      <p style="margin: 0 0 14px 0 !important; font-size: 14.5px !important; color: #333333 !important; line-height: 1.6 !important;">
        Při odeslání žádosti jste <strong>neplatili žádné peníze (0 Kč)</strong>, takže se žádná platba nestornuje ani se nemusí vracet.
      </p>
      <ul style="margin: 0 !important; padding-left: 20px !important; font-size: 14.5px !important; color: #2C2C28 !important; line-height: 1.6 !important;">
        <li style="margin-bottom: 8px !important;"><strong>Výběr jiného termínu:</strong> Rádi vám nabídneme volné návazné termíny. Stačí vytvořit novou žádost na našem webu <a href="https://umustku.cz/#rezervace" style="color: #697947 !important; font-weight: 700 !important;">umustku.cz</a>.</li>
        <li style="margin-bottom: 8px !important;"><strong>Osobní domluva na recepci:</strong> Zavolejte nám na <strong>+420 777 666 273</strong> a společně vybereme ideální termín.</li>
      </ul>
    </div>

    <table class="info-table" style="background-color: #ffffff !important;">
      <tr><td style="color: #555555 !important;">Kód žádosti:</td><td style="color: #1a1a1a !important;"><strong>${reservation.code}</strong></td></tr>
      <tr><td style="color: #555555 !important;">Požadovaný pokoj:</td><td style="color: #1a1a1a !important;">${room ? room.name : (reservation.room_name || 'Vybraný pokoj')}</td></tr>
      <tr><td style="color: #555555 !important;">Požadovaný termín:</td><td style="color: #1a1a1a !important;">${reservation.date_from} až ${reservation.date_to}</td></tr>
      <tr><td style="color: #555555 !important;">Stav žádosti:</td><td><strong style="color: #d9534f !important;">Stornováno / Zamítnuto</strong></td></tr>
    </table>

    <p style="font-size:13.5px; color:#666666 !important; text-align: center !important; margin-top: 24px !important;">Děkujeme za pochopení a těšíme se na vaši návštěvu v náhradním termínu.</p>
    ${getEmailFooter()}
  `;
  return { subject: `Informace k vaší žádosti o rezervaci ${reservation.code} — Hotel u Můstku`, html };
}

/**
 * E-MAIL 4b: storno rezervace, u které už host ZAPLATIL zálohu.
 *
 * Běžný storno e-mail hostu tvrdí, že „neplatil žádné peníze (0 Kč)".
 * U rezervace, kterou recepce posunula do stavu `confirmed`, je to ale
 * nepravda — záloha už je na účtu hotelu a host má nárok na její vrácení.
 * Rozlišuje se podle `maZaplacenouZalohu()`, ne podle úsudku obsluhy.
 *
 * Číslo účtu hosta v systému nemáme, a schválně ho ani nechceme sbírat
 * formulářem; host ho pošle prostou odpovědí na tento e-mail.
 */
export function generateEmailCancellationRefund({ reservation, room, reasonNote, pricing }) {
  const zaloha = Number(reservation && reservation.deposit_price) > 0
    ? Number(reservation.deposit_price)
    : Number((pricing && pricing.depositPriceTotal) || 0);
  const zalohaText = formatCzechPrice(zaloha);

  const html = `
    ${getEmailHeader('Storno rezervace a vrácení uhrazené zálohy')}
    <p style="color: #1a1a1a !important;">Vážený/á <strong>${reservation.guest_name}</strong>,</p>
    <p style="color: #333333 !important;">velice nás to mrzí, ale vaši potvrzenou rezervaci <strong>${reservation.code}</strong> v termínu <strong>${reservation.date_from} až ${reservation.date_to}</strong> jsme nuceni stornovat.</p>

    <div style="background-color: #fff8f8 !important; border: 1px solid #f5c6cb !important; border-radius: 12px !important; padding: 18px 22px !important; margin: 24px 0 !important; color: #721c24 !important;">
      <strong style="color: #721c24 !important;">⚠️ Důvod storna:</strong><br>
      <span style="font-size: 14.5px; color: #491217;">${reasonNote || 'Rezervaci bylo nutné z provozních důvodů zrušit.'}</span>
    </div>

    <div style="background-color: #F3F7EA !important; border: 2px solid #697947 !important; border-radius: 12px !important; padding: 20px 24px !important; margin: 24px 0 !important;">
      <h4 style="margin: 0 0 12px 0 !important; font-size: 16px !important; font-weight: 700 !important; color: #4A5A24 !important;">💰 Uhrazenou zálohu vám vrátíme v plné výši</h4>
      <p style="margin: 0 0 14px 0 !important; font-size: 14.5px !important; color: #333333 !important; line-height: 1.6 !important;">
        Na účet hotelu jste uhradil/a zálohu ve výši <strong style="color: #4A5A24 !important; font-size: 17px !important;">${zalohaText}</strong>. Tuto částku vám vracíme celou — storno jde za námi, nikoliv za vámi.
      </p>
      <p style="margin: 0 0 10px 0 !important; font-size: 14.5px !important; color: #333333 !important; line-height: 1.6 !important;">
        <strong>Prosíme, odpovězte přímo na tento e-mail</strong> a uveďte:
      </p>
      <ul style="margin: 0 0 14px 0 !important; padding-left: 20px !important; font-size: 14.5px !important; color: #2C2C28 !important; line-height: 1.6 !important;">
        <li style="margin-bottom: 6px !important;"><strong>číslo bankovního účtu</strong> pro vrácení peněz (například 123456789/0800),</li>
        <li style="margin-bottom: 6px !important;"><strong>jméno majitele účtu</strong>,</li>
        <li style="margin-bottom: 6px !important;">případně <strong>IBAN</strong>, pokud jde o zahraniční účet.</li>
      </ul>
      <p style="margin: 0 !important; font-size: 14.5px !important; color: #333333 !important; line-height: 1.6 !important;">
        Jakmile nám údaje pošlete, odešleme peníze zpět <strong>nejpozději do 14 dnů</strong> a potvrdíme vám to e-mailem. Raději si to vyřídíte telefonicky? Zavolejte na <strong>${HOTEL_TELEFON}</strong>.
      </p>
    </div>

    <div style="background-color: #F9FAF7 !important; border: 1px solid #E7E5DC !important; border-radius: 12px !important; padding: 20px 24px !important; margin: 24px 0 !important;">
      <h4 style="margin: 0 0 12px 0 !important; font-size: 16px !important; font-weight: 700 !important; color: #4A5A24 !important;">💡 Nebo pro vás rádi najdeme náhradní termín</h4>
      <p style="margin: 0 !important; font-size: 14.5px !important; color: #333333 !important; line-height: 1.6 !important;">
        Pokud máte o pobyt stále zájem, můžeme místo vrácení peněz <strong>převést zálohu na jiný termín</strong>. Napište nám to prosím v odpovědi nebo zavolejte na <strong>${HOTEL_TELEFON}</strong> a společně vybereme datum, které vám bude vyhovovat.
      </p>
    </div>

    <table class="info-table" style="background-color: #ffffff !important;">
      <tr><td style="color: #555555 !important;">Kód rezervace:</td><td style="color: #1a1a1a !important;"><strong>${reservation.code}</strong></td></tr>
      <tr><td style="color: #555555 !important;">Pokoj:</td><td style="color: #1a1a1a !important;">${room ? room.name : (reservation.room_name || 'Vybraný pokoj')}</td></tr>
      <tr><td style="color: #555555 !important;">Termín:</td><td style="color: #1a1a1a !important;">${reservation.date_from} až ${reservation.date_to}</td></tr>
      <tr><td style="color: #555555 !important;">Uhrazená záloha:</td><td style="color: #1a1a1a !important;"><strong>${zalohaText}</strong></td></tr>
      <tr><td style="color: #555555 !important;">Stav rezervace:</td><td><strong style="color: #d9534f !important;">Stornováno — záloha se vrací</strong></td></tr>
    </table>

    <p style="font-size:13.5px; color:#666666 !important; text-align: center !important; margin-top: 24px !important;">Omlouváme se za komplikace, které vám tím způsobujeme, a děkujeme za pochopení.</p>
    ${getEmailFooter()}
  `;
  return { subject: `Storno rezervace ${reservation.code} a vrácení zálohy — Hotel u Můstku`, html };
}

// E-MAIL 5 (Automatický): Zákazníkovi při vypršení 3denní lhůty na úhradu zálohy
export function generateEmailPaymentExpired({ reservation, room }) {
  const html = `
    ${getEmailHeader('Informace k vaší žádosti o rezervaci')}
    <p style="color: #1a1a1a !important;">Vážený/á <strong>${reservation.guest_name}</strong>,</p>
    <p style="color: #333333 !important;">ozýváme se vám ohledně vaší žádosti o rezervaci <strong>${reservation.code}</strong> na pobyt v termínu <strong>${reservation.date_from} až ${reservation.date_to}</strong> v Hotelu u Můstku.</p>

    <div style="background-color: #fff8f8 !important; border: 1px solid #f5c6cb !important; border-radius: 12px !important; padding: 18px 22px !important; margin: 24px 0 !important; color: #721c24 !important;">
      <strong style="color: #721c24 !important;">⚠️ Důvod uvolnění předběžné rezervace:</strong><br>
      <span style="font-size: 14.5px; color: #491217; line-height: 1.5; display: block; margin-top: 6px;">
        Ve stanovené lhůtě 3 kalendářních dnů od zaslání platebních podkladů s QR kódem nebyly na účet hotelu připsány finanční prostředky zálohy. Z tohoto důvodu byla vaše předběžná blokace termínu automaticky zrušena a termín byl uvolněn pro ostatní zájemce.
      </span>
    </div>

    <div style="background-color: #F9FAF7 !important; border: 1px solid #E7E5DC !important; border-radius: 12px !important; padding: 20px 24px !important; margin: 24px 0 !important;">
      <h4 style="margin: 0 0 12px 0 !important; font-size: 16px !important; font-weight: 700 !important; color: #4A5A24 !important;">💡 Co dělat dál? Máte o pobyt stále zájem?</h4>
      <p style="margin: 0 0 14px 0 !important; font-size: 14.5px !important; color: #333333 !important; line-height: 1.6 !important;">
        Pokud byla platba odeslána na poslední chvíli nebo máte o pobyt v našem hotelu stále zájem, rádi s vámi možnost ubytování prověříme:
      </p>
      <ul style="margin: 0 !important; padding-left: 20px !important; font-size: 14.5px !important; color: #2C2C28 !important; line-height: 1.6 !important;">
        <li style="margin-bottom: 8px !important;"><strong>Osobní domluva na recepci:</strong> Zavolejte nám na <strong>+420 777 666 273</strong> nebo napište na <strong>${HOTEL_EMAIL}</strong>. Pokud je pokoj stále volný, rezervaci vám rádi obnovíme.</li>
        <li style="margin-bottom: 8px !important;"><strong>Vytvořit novou rezervaci:</strong> Můžete si kdykoliv vybrat nový termín na našem webu <a href="https://umustku.cz/#rezervace" style="color: #697947 !important; font-weight: 700 !important;">umustku.cz</a>.</li>
      </ul>
    </div>

    <table class="info-table" style="background-color: #ffffff !important;">
      <tr><td style="color: #555555 !important;">Kód žádosti:</td><td style="color: #1a1a1a !important;"><strong>${reservation.code}</strong></td></tr>
      <tr><td style="color: #555555 !important;">Požadovaný pokoj:</td><td style="color: #1a1a1a !important;">${room ? room.name : (reservation.room_name || 'Vybraný pokoj')}</td></tr>
      <tr><td style="color: #555555 !important;">Požadovaný termín:</td><td style="color: #1a1a1a !important;">${reservation.date_from} až ${reservation.date_to}</td></tr>
      <tr><td style="color: #555555 !important;">Stav žádosti:</td><td><strong style="color: #d9534f !important;">Zrušeno – vypršení lhůty pro úhradu zálohy (3 dny)</strong></td></tr>
    </table>

    <p style="font-size:13.5px; color:#666666 !important; text-align: center !important; margin-top: 24px !important;">Těšíme se na vaši návštěvu při jiné příležitosti.</p>
    ${getEmailFooter()}
  `;
  return { subject: `Informace k vaší žádosti o rezervaci ${reservation.code} — Vypršení lhůty pro úhradu zálohy | Hotel u Můstku`, html };
}

export function sendAllTestEmailsTo(recipientEmail = RECEPCE_PRIJEMCE) {
  const mockReservation = {
    id: 'res-test-1',
    code: 'HM-2026-TEST',
    room_id: 'p5',
    room_name: 'Pokoj 5 - Standard',
    date_from: '2026-08-10',
    date_to: '2026-08-13',
    guest_name: 'Ondřej Zeman',
    guest_email: recipientEmail,
    guest_phone: '+420 777 666 273',
    guest_note: 'Testovací rezervace — prosím stůl u okna',
    guest_street: 'Údolní 368',
    guest_city: 'Desná v Jizerských horách',
    guest_zip: '468 61',
    guest_country: 'Česká republika',
    adults_count: 2,
    children_count: 0,
    has_dog: true,
    has_half_board: true,
    total_price: 3320,
    deposit_price: 996,
    remaining_price: 2324,
    status: 'pending_approval',
    created_at: new Date().toISOString()
  };

  const mockRoom = { id: 'p5', name: 'Pokoj 5 - Standard', type: 'standard' };
  const mockPricing = {
    nights: 3,
    totalGuests: 2,
    totalPrice: 3320,
    depositPriceTotal: 996,
    remainingPriceTotal: 2324
  };

  // E-mail 1 (Zákazníkovi): Žádost přijata
  const e1 = generateEmail1RequestReceived({ reservation: mockReservation, room: mockRoom, pricing: mockPricing });
  sendEmail({ to: recipientEmail, subject: e1.subject, html: e1.html, type: 'email_1_request_received', reservationCode: mockReservation.code });

  // E-mail 1b (Recepci): Upozornění na novou žádost ke schválení
  const e1Rec = generateEmail1ReceptionNotification({ reservation: mockReservation, room: mockRoom, pricing: mockPricing });
  sendEmail({ to: recipientEmail, subject: e1Rec.subject, html: e1Rec.html, type: 'email_1_reception_notification', reservationCode: mockReservation.code });

  // E-mail 2: Schváleno & Pokyny k 30% záloze s QR kódem
  const e2 = generateEmail2ApprovalAndPaymentRequest({ reservation: mockReservation, room: mockRoom, pricing: mockPricing });
  sendEmail({ to: recipientEmail, subject: e2.subject, html: e2.html, type: 'email_2_approval_payment_request', reservationCode: mockReservation.code });

  // E-mail 3: Potvrzení přijetí zálohy & Závazná rezervace
  const e3 = generateEmail3FinalConfirmation({ reservation: mockReservation, room: mockRoom, pricing: mockPricing });
  sendEmail({ to: recipientEmail, subject: e3.subject, html: e3.html, type: 'email_3_final_confirmation', reservationCode: mockReservation.code });

  // E-mail 4: Zamítnutí žádosti, u které host nic neplatil
  const e4 = generateEmailCancellation({ reservation: mockReservation, room: mockRoom });
  sendEmail({ to: recipientEmail, subject: e4.subject, html: e4.html, type: 'email_cancellation', reservationCode: mockReservation.code });

  // E-mail 4b: Storno potvrzené rezervace — záloha se vrací
  const e4b = generateEmailCancellationRefund({ reservation: { ...mockReservation, status: 'confirmed' }, room: mockRoom, pricing: mockPricing });
  sendEmail({ to: recipientEmail, subject: e4b.subject, html: e4b.html, type: 'email_cancellation_refund', reservationCode: mockReservation.code });

  return true;
}

// Generování šablony e-mailu pro zprávu z kontaktního formuláře (Design 1:1 dle rezervačních e-mailů)
export function generateEmailContactNotification({ name, surname, email, phone, message }) {
  const html = `
    ${getEmailHeader('Nová zpráva z kontaktního formuláře')}
    <p style="color: #1a1a1a !important; font-size: 15.5px; line-height: 1.5; margin-bottom: 20px;">Někdo vám odeslal novou zprávu přes kontaktní formulář na webu <strong>Hotel u Můstku</strong>:</p>
    
    <table class="info-table" style="background-color: #ffffff !important; margin: 20px 0; width: 100%; border-collapse: collapse;">
      <tr>
        <td style="color: #555555 !important; width: 140px; padding: 8px 12px; font-weight: 500; border-bottom: 1px solid #f0f0f0;">Jméno a příjmení:</td>
        <td style="color: #1a1a1a !important; padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #f0f0f0;">${name} ${surname}</td>
      </tr>
      <tr>
        <td style="color: #555555 !important; padding: 8px 12px; font-weight: 500; border-bottom: 1px solid #f0f0f0;">E-mail:</td>
        <td style="color: #1a1a1a !important; padding: 8px 12px; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${email}" style="color: #697947 !important; text-decoration: underline; font-weight: 600;">${email}</a></td>
      </tr>
      ${phone ? `
      <tr>
        <td style="color: #555555 !important; padding: 8px 12px; font-weight: 500; border-bottom: 1px solid #f0f0f0;">Telefon:</td>
        <td style="color: #1a1a1a !important; padding: 8px 12px; border-bottom: 1px solid #f0f0f0;"><a href="tel:${phone}" style="color: #1a1a1a !important; text-decoration: none;">${phone}</a></td>
      </tr>` : ''}
      <tr>
        <td style="color: #555555 !important; padding: 8px 12px; font-weight: 500; vertical-align: top;">Zpráva:</td>
        <td style="color: #1a1a1a !important; padding: 8px 12px; white-space: pre-wrap; line-height: 1.6;">${message || '<em>Bez textu zprávy</em>'}</td>
      </tr>
    </table>

    <div class="alert-box" style="background-color: #fff9ed !important; color: #333333 !important; border-left: 4px solid #697947 !important; padding: 14px 18px; margin-top: 24px; border-radius: 4px;">
      Na tuto zprávu můžete odpovědět přímo kliknutím na e-mail klienta: <a href="mailto:${email}" style="color: #697947 !important; font-weight: 600;">${email}</a>.
    </div>
    ${getEmailFooter()}
  `;
  return {
    subject: `[KONTAKT] Nová zpráva od ${name} ${surname}`,
    html
  };
}

// Generování šablony e-mailu pro novou žádost o recenzi ke schválení
export function generateEmailNewReviewNotification({ review }) {
  const authorName = review.author_name || review.author || 'Host';
  const fullName = review.full_name || authorName;

  const html = `
    ${getEmailHeader('Nová recenze ke schválení')}
    <p style="color: #1a1a1a !important; font-size: 15.5px; line-height: 1.6; margin-bottom: 24px;">
      Na webu <strong>Hotel u Můstku</strong> byla odeslána nová recenze hosta ke schválení:
    </p>

    <table class="info-table" style="background-color: #ffffff !important; margin: 20px 0; width: 100%; border-collapse: collapse;">
      <tr>
        <td style="color: #555555 !important; width: 150px; padding: 10px 12px; font-weight: 500; border-bottom: 1px solid #f0f0f0;">Jméno hosta:</td>
        <td style="color: #1a1a1a !important; padding: 10px 12px; font-weight: 700; border-bottom: 1px solid #f0f0f0;">
          ${fullName} <span style="color: #697947; font-weight: 600;">(Zobrazí se jako: ${authorName})</span>
        </td>
      </tr>
      <tr>
        <td style="color: #555555 !important; padding: 10px 12px; font-weight: 500; border-bottom: 1px solid #f0f0f0;">Datum odeslání:</td>
        <td style="color: #1a1a1a !important; padding: 10px 12px; border-bottom: 1px solid #f0f0f0;">${review.date || new Date().toLocaleDateString('cs-CZ')}</td>
      </tr>
      <tr>
        <td style="color: #555555 !important; padding: 10px 12px; font-weight: 500; vertical-align: top;">Text recenze:</td>
        <td style="color: #1a1a1a !important; padding: 12px; font-style: italic; background-color: #faf9f5; border-radius: 4px; line-height: 1.6; border: 1px solid #eae7dc;">
          "${review.text || 'Bez textu'}"
        </td>
      </tr>
    </table>

    <div class="alert-box" style="background-color: #edf2e4 !important; color: #4a5a24 !important; border-left: 4px solid #697947 !important; padding: 14px 18px; margin-top: 24px; border-radius: 4px; font-size: 13.5px;">
      💡 Pro schválení nebo smazání recenze přejděte do Recepčního portálu administrace.
    </div>
    ${getEmailFooter()}
  `;

  return {
    subject: `Nová recenze ke schválení od ${authorName} — Hotel u Můstku`,
    html
  };
}

