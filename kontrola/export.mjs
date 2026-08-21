// Kontrola exportu kontaktů. Čistá matematika, bez prohlížeče.
import {
  vyberRezervace, slucKontakty, rozdelJmeno, bunka, sestavCSV,
  SLOUPCE_KONTAKT, pripravExport, odectiDny,
} from '../src/utils/exportKontaktu.js';

let chyb = 0;
const ok = (podminka, popis) => {
  if (!podminka) { chyb++; console.error('  ✗', popis); } else { console.log('  ✓', popis); }
};

const REZERVACE = [
  { code: 'A1', guest_name: 'Jan Novák', guest_email: 'JAN@example.com', guest_phone: '111',
    date_from: '2026-01-10', date_to: '2026-01-12', created_at: '2026-01-01T10:00:00+00:00',
    total_price: 2000, status: 'confirmed', room_name: 'Pokoj 1' },
  { code: 'A2', guest_name: 'Jan Novák', guest_email: 'jan@example.com', guest_phone: '111',
    date_from: '2026-06-10', date_to: '2026-06-15', created_at: '2026-06-01T10:00:00+00:00',
    total_price: 5000, status: 'confirmed', room_name: 'Pokoj 7', guest_city: 'Praha' },
  { code: 'A3', guest_name: 'Eva Černá', guest_email: 'eva@example.com',
    date_from: '2026-06-20', date_to: '2026-06-22', created_at: '2026-06-15T10:00:00+00:00',
    total_price: 3000, status: 'cancelled', room_name: 'Pokoj 2' },
  { code: 'A4', guest_name: 'Petr Malý', guest_email: 'petr@example.com',
    date_from: '2026-07-01', date_to: '2026-07-03', created_at: '2026-06-20T10:00:00+00:00',
    total_price: 4000, status: 'confirmed', room_name: 'Pokoj 3', is_archived: true },
];

console.log('\nSlučování kontaktů');
{
  const k = slucKontakty(REZERVACE);
  const novak = k.find(x => x.guest_name === 'Jan Novák');
  ok(k.length === 4 - 1, 'dvě rezervace téhož hosta se slily do jednoho řádku');
  ok(novak.pobytu === 2, 'počet pobytů se sečetl');
  ok(novak.utraceno === 7000, 'utracená částka se sečetla');
  ok(novak.noci === 2 + 5, 'noci se sečetly');
  ok(novak.prvni === '2026-01-10' && novak.posledni === '2026-06-10', 'první a poslední pobyt');
  ok(novak.poslednPokoj === 'Pokoj 7', 'poslední pokoj je z novější rezervace');
  ok(novak.guest_city === 'Praha', 'adresa se bere z novější rezervace');
}

console.log('\nVýběr podle období');
{
  const jenLeto = vyberRezervace(REZERVACE, { od: '2026-06-01', doo: '2026-06-30', podleData: 'vytvoreni' });
  // V červnu vznikly tři, ale A3 je stornovaná a ta se ve výchozím
  // nastavení nepočítá — zůstane A2 a A4 (archivovaná se počítá).
  ok(jenLeto.length === 2, 'podle data vytvoření: dvě v červnu (storno venku)');

  const podlePrijezdu = vyberRezervace(REZERVACE, { od: '2026-07-01', doo: '2026-07-31', podleData: 'prijezd' });
  ok(podlePrijezdu.length === 1 && podlePrijezdu[0].code === 'A4', 'podle data příjezdu vybere jinou množinu');

  const bezArchivu = vyberRezervace(REZERVACE, { od: '', doo: '', zahrnoutArchiv: false });
  ok(!bezArchivu.some(r => r.is_archived), 'archiv jde vynechat');

  const seStorny = vyberRezervace(REZERVACE, { od: '', doo: '', zahrnoutStorna: true });
  ok(seStorny.length === 4, 'se storny jsou všechny');

  const bezStorn = vyberRezervace(REZERVACE, { od: '', doo: '' });
  ok(bezStorn.length === 3, 'storna jsou ve výchozím stavu venku');

  // Horní mez je VČETNĚ — obsluha vybírá „do 30. června" a čeká, že tam bude.
  const doDne = vyberRezervace(REZERVACE, { od: '2026-06-15', doo: '2026-06-15', podleData: 'vytvoreni', zahrnoutStorna: true });
  ok(doDne.length === 1 && doDne[0].code === 'A3', 'horní mez je včetně toho dne');
}

console.log('\nRozdělení jména');
{
  ok(rozdelJmeno('Jan Novák').prijmeni === 'Novák', 'dvouslovné jméno');
  ok(rozdelJmeno('Jana Marie Nováková').jmeno === 'Jana Marie', 'tříslovné jméno');
  ok(rozdelJmeno('Madonna').prijmeni === 'Madonna', 'jednoslovné jméno je příjmení');
  ok(rozdelJmeno('').prijmeni === '', 'prázdné jméno nespadne');
}

console.log('\nCSV pro Excel');
{
  const csv = sestavCSV(SLOUPCE_KONTAKT, slucKontakty(REZERVACE));
  ok(csv.charCodeAt(0) === 0xFEFF, 'soubor začíná značkou UTF-8 (jinak Excel rozbije diakritiku)');
  ok(csv.split('\r\n')[0].includes(';'), 'sloupce odděluje středník');
  ok(csv.includes('\r\n'), 'řádky končí CRLF');
  ok(csv.includes('Černá'), 'diakritika je v souboru');

  ok(bunka('=SUM(A1)').startsWith("'"), 'hodnota vypadající jako vzorec se zneškodní');
  ok(bunka('a;b') === '"a;b"', 'středník v textu se uzavře do uvozovek');
  ok(bunka('řekl "ne"') === '"řekl ""ne"""', 'uvozovky se zdvojí');
  ok(bunka(null) === '', 'prázdná hodnota je prázdná buňka');
}

console.log('\nCelý export');
{
  const kontakty = pripravExport(REZERVACE, { od: '', doo: '', druh: 'kontakty' });
  // Bez storna zbudou A1, A2 (týž host) a A4 — tedy dva kontakty.
  ok(kontakty.radku === 2, 'adresář slije opakovaného hosta a vynechá storno');
  ok(kontakty.nazev.endsWith('.csv'), 'název souboru končí .csv');

  const rez = pripravExport(REZERVACE, { od: '', doo: '', druh: 'rezervace' });
  ok(rez.radku === 3, 'soupis rezervací má tři řádky');
  const radky = rez.obsah.split('\r\n');
  ok(radky[1].startsWith('A4'), 'rezervace jsou od nejnovější — první je ' + radky[1].slice(0, 2));

  const pocetStredniku = (t) => (t.match(/;/g) || []).length;
  ok(radky.slice(0, rez.radku + 1).every(r => pocetStredniku(r) === pocetStredniku(radky[0])),
     'každý řádek má stejný počet sloupců jako hlavička');
}

console.log('\nPosun data');
{
  ok(odectiDny('2026-03-01', 1) === '2026-02-28', 'přes konec měsíce');
  ok(odectiDny('2026-01-01', 1) === '2025-12-31', 'přes Nový rok');
  ok(odectiDny('2026-08-21', 0) === '2026-08-21', 'nula dní nic nemění');
}

console.log(chyb === 0 ? '\nExport: vše v pořádku\n' : `\nExport: ${chyb} chyb\n`);
process.exit(chyb === 0 ? 0 : 1);
