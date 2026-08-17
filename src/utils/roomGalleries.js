/**
 * Fotky jednotlivých pokojů.
 *
 * Jediný zdroj pravdy pro obě místa, kde se galerie ukazuje — stránku
 * Ubytování i rozbalovací náhled v rezervačním formuláři. Dřív byl
 * seznam jen v `main.js`; rezervace by si musela držet vlastní kopii
 * a po přidání fotky by se obojí rozešlo.
 */
export const ROOM_GALLERIES = {
  p1: ['/balkony 1 copy.webp'],
  p2: ['/balkony 1 copy.webp'],
  p3: ['/balkony 1 copy.webp'],
  pa: [
    '/pokoje/mahagon/1.webp',
    '/pokoje/mahagon/2.webp',
    '/pokoje/mahagon/3.webp',
    '/pokoje/mahagon/4.webp',
    '/pokoje/mahagon/5.webp',
    '/pokoje/mahagon/7.webp',
    '/pokoje/mahagon/8.webp'
  ],
  p5: [
    '/pokoje/p5/1.webp',
    '/pokoje/p5/2.webp',
    '/pokoje/p5/3.webp',
    '/pokoje/p5/4.webp',
    '/pokoje/p5/5.webp',
    '/pokoje/p5/6.webp',
    '/pokoje/p5/7.webp',
    '/pokoje/p5/8.webp'
  ],
  p6: [
    '/pokoje/p6/1.webp',
    '/pokoje/p6/2.webp',
    '/pokoje/p6/3.webp',
    '/pokoje/p6/4.webp',
    '/pokoje/p6/5.webp',
    '/pokoje/p6/6.webp',
    '/pokoje/p6/7.webp'
  ],
  p7: [
    '/pokoje/p7/1.webp',
    '/pokoje/p7/2.webp',
    '/pokoje/p7/3.webp',
    '/pokoje/p7/4.webp',
    '/pokoje/p7/5.webp',
    '/pokoje/p7/6.webp',
    '/pokoje/p7/7.webp',
    '/pokoje/p7/8.webp',
    '/pokoje/p7/9.webp',
    '/pokoje/p7/10.webp'
  ],
  a1: [
    '/pokoje/motyl/1.webp',
    '/pokoje/motyl/2.webp',
    '/pokoje/motyl/3.webp',
    '/pokoje/motyl/4.webp',
    '/pokoje/motyl/5.webp',
    '/pokoje/motyl/6.webp',
    '/pokoje/motyl/7.webp'
  ],
  zen: [
    '/pokoje/zen/1.webp',
    '/pokoje/zen/2.webp',
    '/pokoje/zen/3.webp',
    '/pokoje/zen/4.webp',
    '/pokoje/zen/5.webp',
    '/pokoje/zen/6.webp',
    '/pokoje/zen/7.webp'
  ],
  p10: [
    '/pokoje/p10/1.webp',
    '/pokoje/p10/2.webp',
    '/pokoje/p10/3.webp',
    '/pokoje/p10/4.webp',
    '/pokoje/p10/6.webp',
    '/pokoje/p10/7.webp',
    '/pokoje/p10/8.webp',
    '/pokoje/p10/9.webp'
  ],
  p11: [
    '/pokoje/p11/1.webp',
    '/pokoje/p11/2.webp',
    '/pokoje/p11/3.webp',
    '/pokoje/p11/4.webp',
    '/pokoje/p11/5.webp',
    '/pokoje/p11/7.webp',
    '/pokoje/p11/8.webp',
    '/pokoje/p11/9.webp',
    '/pokoje/p11/10.webp'
  ],
  p12: [
    '/pokoje/p12/1.webp',
    '/pokoje/p12/2.webp',
    '/pokoje/p12/3.webp',
    '/pokoje/p12/4.webp',
    '/pokoje/p12/5.webp',
    '/pokoje/p12/6.webp',
    '/pokoje/p12/8.webp',
    '/pokoje/p12/9.webp',
    '/pokoje/p12/10.webp',
    '/pokoje/p12/11.webp'
  ]
};

/** Fotky pokoje, nebo náhradní obrázek, když pokoj vlastní galerii nemá. */
export function fotkyPokoje(roomId) {
  const f = ROOM_GALLERIES[roomId];
  return (Array.isArray(f) && f.length > 0) ? f : ['/hezky pokoj 1.webp'];
}
