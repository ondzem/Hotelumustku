// SPAYD Czech QR Payment Generator
import QRCode from 'qrcode';

export const BANK_ACCOUNT = '123456789/0800'; // Default hotel bank account

/**
 * Converts bank account to IBAN format if needed
 */
export function formatIban(accountString = BANK_ACCOUNT) {
  // Simple CZ IBAN generator fallback for CZ Bank Accounts
  const [prefixAndAcc, bankCode] = accountString.split('/');
  const accParts = prefixAndAcc.split('-');
  const prefix = accParts.length > 1 ? accParts[0].padStart(6, '0') : '000000';
  const number = (accParts.length > 1 ? accParts[1] : accParts[0]).padStart(10, '0');
  const code = (bankCode || '0800').padStart(4, '0');
  
  // Basic CZ IBAN string
  return `CZ79${code}${prefix}${number}`;
}

/**
 * Builds SPAYD string for Czech Banking Applications
 */
export function buildSpaydString({
  iban = formatIban(BANK_ACCOUNT),
  amount = 0,
  variableSymbol = '0000',
  message = 'Rezervace Hotel u Mustku',
}) {
  const cleanAmount = Number(amount).toFixed(2);
  const cleanVs = String(variableSymbol).replace(/[^0-9]/g, '').substring(0, 10);
  const cleanMsg = String(message).substring(0, 60).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return `SPD*1.0*ACC:${iban}*AM:${cleanAmount}*CC:CZK*VS:${cleanVs}*MSG:${cleanMsg}*`;
}

/**
 * Generates Data URL Image of Czech Payment QR Code
 */
export async function generateQrCodeDataUrl(params) {
  try {
    const spaydText = buildSpaydString(params);
    return await QRCode.toDataURL(spaydText, {
      width: 260,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return null;
  }
}
