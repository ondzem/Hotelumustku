/**
 * QR platba zálohy — IBAN, který se hostovi natiskne do kódu.
 *
 * Tohle je jediné místo v projektu, kde chyba znamená, že hostovy peníze
 * odejdou na cizí účet. Kontrola je tu proto, že IBAN se počítá ručně:
 * kdo sáhne na skladbu řetězce, nemá jak si všimnout, že ji rozbil —
 * kontrolní číslice se dopočítají z čehokoli a mod 97 pak vyjde i nad
 * úplně nesmyslným základem.
 */
import { BANK_ACCOUNT, BANK_NAME, ibanZUctu, rozlozUcet, generateSpaydQrUrl } from '../src/utils/pricing.js';
import { readFileSync } from 'node:fs';

let chyb = 0;
const overit = (popis, skutecnost, ocekavani) => {
  if (JSON.stringify(skutecnost) !== JSON.stringify(ocekavani)) {
    chyb++; console.log(`    ✗ ${popis}: je ${JSON.stringify(skutecnost)}, má být ${JSON.stringify(ocekavani)}`);
  }
};
const overitPravda = (popis, podminka) => {
  if (!podminka) { chyb++; console.log(`    ✗ ${popis}`); }
};

/** Kontrola podle normy: IBAN přesunutý o čtyři znaky dává modulo 97 zbytek 1. */
const ibanSedi = (iban) =>
  (iban.slice(4) + '1235' + iban.slice(2, 4)).split('')
    .reduce((a, c) => (a * 10n + BigInt(c)) % 97n, 0n) === 1n;

// --- rozklad čísla účtu ----------------------------------------------
overit('bez předčíslí', rozlozUcet('1234567890/3030'), { predcisli: '', cislo: '1234567890', kodBanky: '3030' });
overit('s předčíslím', rozlozUcet('19-2000145399/0800'), { predcisli: '19', cislo: '2000145399', kodBanky: '0800' });
overit('mezery se ignorují', rozlozUcet(' 123 456 789 / 300 '), { predcisli: '', cislo: '123456789', kodBanky: '0300' });

// --- IBAN --------------------------------------------------------------
// Český IBAN má PŘESNĚ 24 znaků. Předčíslí se do něj vejde na vlastních
// šest míst; dokud se slévalo s číslem účtu, vycházel IBAN 26znakový.
for (const ucet of [BANK_ACCOUNT, '1234567890/3030', '19-2000145399/0800', '35-1234567/0100']) {
  const iban = ibanZUctu(ucet);
  overit(`délka IBANu pro ${ucet}`, iban.length, 24);
  overitPravda(`kontrolní číslice IBANu pro ${ucet}`, ibanSedi(iban));
}
overit('předčíslí sedí na svém místě', ibanZUctu('19-2000145399/0800').slice(8, 14), '000019');
overit('číslo účtu sedí na svém místě', ibanZUctu('19-2000145399/0800').slice(14), '2000145399');
overit('kód banky sedí na svém místě', ibanZUctu('1234567890/3030').slice(4, 8), '3030');

// --- celý QR řetězec ---------------------------------------------------
const spayd = decodeURIComponent(generateSpaydQrUrl({ amount: 1440, vs: '20260143' }).split('data=')[1]);
overitPravda('QR nese IBAN hotelového účtu', spayd.includes(`ACC:${ibanZUctu(BANK_ACCOUNT)}`));
overitPravda('QR nese částku na dvě desetinná místa', spayd.includes('AM:1440.00'));
overitPravda('QR nese variabilní symbol', spayd.includes('X-VS:20260143'));
overitPravda('QR je v korunách', spayd.includes('CC:CZK'));

// --- účet na webu musí sedět s účtem v kódu ----------------------------
// Číslo účtu je v Podmínkách napsané textem, a to na DVOU místech —
// ve statické stránce i v šabloně v main.js (viz oddíl 1 v CLAUDE.md).
// Když se změní jen jedno, host uvidí podle cesty na stránku jiný účet,
// než na jaký mu přijde QR kód.
for (const soubor of ['podminky.html', 'src/main.js']) {
  const text = readFileSync(new URL(`../${soubor}`, import.meta.url), 'utf8');
  overitPravda(`${soubor}: číslo účtu sedí s BANK_ACCOUNT`, text.includes(BANK_ACCOUNT));
  overitPravda(`${soubor}: název banky sedí s BANK_NAME`, text.includes(BANK_NAME));
}

process.exit(chyb ? 1 : 0);
