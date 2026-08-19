/**
 * Geometrie pruhů v plachtě dostupnosti.
 *
 * Pruh musí začínat uprostřed dne příjezdu a končit uprostřed dne
 * odjezdu — to je celé sdělení o půlených dnech. Když pobyt přesahuje
 * přes okraj měsíce, půlka se na oříznuté straně vypustí, jinak by
 * pruh vypadal, že tam pobyt začíná nebo končí.
 */
import { pruhyProPokoj } from '../src/components/AdminPlachta.js';

let chyb = 0;
const overit = (popis, skutecnost, ocekavani) => {
  if (JSON.stringify(skutecnost) !== JSON.stringify(ocekavani)) {
    chyb++; console.log(`    ✗ ${popis}: je ${JSON.stringify(skutecnost)}, má být ${JSON.stringify(ocekavani)}`);
  }
};

const rez = (room_id, date_from, date_to, extra = {}) =>
  ({ room_id, date_from, date_to, guest_name: 'Host', code: 'HM-TEST', status: 'confirmed', ...extra });

const DNU_SRPEN = 31;
const plachta = (ad, roomId = 'p1') => pruhyProPokoj(ad, roomId, 2026, 8, DNU_SRPEN);
const tvar = (p) => ({ zac: p.zacLine, kon: p.konLine, zacOrez: p.zacOrez, konOrez: p.konOrez });

// Pobyt celý uvnitř měsíce: příjezd 26., odjezd 29.
// Sloupce 26 až 30, oběma stranami se stáhne o půl dne.
let v = plachta({ reservations: [rez('p1', '2026-08-26', '2026-08-29')], blockedDates: [] });
overit('pobyt uvnitř měsíce', v.length, 1);
overit('pobyt uvnitř měsíce — sloupce', tvar(v[0]), { zac: 26, kon: 30, zacOrez: false, konOrez: false });

// Pobyt začíná v minulém měsíci — vlevo se neořezává na půl dne.
v = plachta({ reservations: [rez('p1', '2026-07-30', '2026-08-03')], blockedDates: [] });
overit('pobyt z minulého měsíce', tvar(v[0]), { zac: 1, kon: 4, zacOrez: true, konOrez: false });

// Pobyt pokračuje do dalšího měsíce — vpravo dojede až na okraj.
v = plachta({ reservations: [rez('p1', '2026-08-29', '2026-09-02')], blockedDates: [] });
overit('pobyt do dalšího měsíce', tvar(v[0]), { zac: 29, kon: 32, zacOrez: false, konOrez: true });

// Pobyt přes celý měsíc — oříznutý z obou stran.
v = plachta({ reservations: [rez('p1', '2026-07-20', '2026-09-10')], blockedDates: [] });
overit('pobyt přes celý měsíc', tvar(v[0]), { zac: 1, kon: 32, zacOrez: true, konOrez: true });

// Mimo měsíc se nekreslí nic. `date_to` je výlučné, takže odjezd
// prvního srpna znamená, že v srpnu už pokoj obsazený není.
overit('pobyt před měsícem', plachta({ reservations: [rez('p1', '2026-07-10', '2026-08-01')], blockedDates: [] }).length, 0);
overit('pobyt po měsíci', plachta({ reservations: [rez('p1', '2026-09-01', '2026-09-05')], blockedDates: [] }).length, 0);

// Jednodenní blokace 16. srpna se ukládá jako 16 → 17.
v = plachta({ reservations: [], blockedDates: [{ room_id: 'p1', date_from: '2026-08-16', date_to: '2026-08-17', reason: 'Uzávěrka' }] });
overit('jednodenní blokace', tvar(v[0]), { zac: 16, kon: 18, zacOrez: false, konOrez: false });
overit('jednodenní blokace — typ', v[0].typ, 'blokace');

// Blokace celého hotelu se musí objevit v řádku KAŽDÉHO pokoje,
// jinak by pokoj vypadal volný.
const celyHotel = { reservations: [], blockedDates: [{ room_id: 'all', date_from: '2026-08-05', date_to: '2026-08-08', reason: 'Dovolená' }] };
overit('blokace celého hotelu u p1', plachta(celyHotel, 'p1').length, 1);
overit('blokace celého hotelu u p7', plachta(celyHotel, 'p7').length, 1);

// Cizí pokoj a stornované či archivované rezervace se nekreslí.
overit('cizí pokoj', plachta({ reservations: [rez('p2', '2026-08-10', '2026-08-12')], blockedDates: [] }, 'p1').length, 0);
overit('stornovaná rezervace', plachta({ reservations: [rez('p1', '2026-08-10', '2026-08-12', { status: 'cancelled' })], blockedDates: [] }).length, 0);
overit('archivovaná rezervace', plachta({ reservations: [rez('p1', '2026-08-10', '2026-08-12', { is_archived: true })], blockedDates: [] }).length, 0);

// Únor 2026 má 28 dnů — poslední sloupec nesmí přetéct.
v = pruhyProPokoj({ reservations: [rez('p1', '2026-02-27', '2026-03-02')], blockedDates: [] }, 'p1', 2026, 2, 28);
overit('konec kratšího měsíce', tvar(v[0]), { zac: 27, kon: 29, zacOrez: false, konOrez: true });

process.exit(chyb ? 1 : 0);
