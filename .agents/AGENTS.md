# Pravidla a pokyny pro tlačítka a responzivitu v projektu Hotel u Můstku

## 🔘 Pravidlo pro tlačítka ve všech sekcích (Button Design System)

Všechna tlačítka napříč celým webem (Hero, Zázemí/O nás, Sleva sekce, Nabídka pokojů, Služby atd.) MUSÍ přísně dodržovat stejný systém proporcí:

### 1. Rozměry a typografie
* **Výška**:
  * Mobil (pod 768px): `36px`
  * Tablet (768px - 1028px): `40px`
  * Standardní desktop (1440px): `45px`
  * Velký desktop (1750px+): `48px`
  * Ultra-wide 4K (2200px+): `52px`
* **Typografie**:
  * Font-size: `14.5px` (Mobil < 768px), `15.5px` (Tablet 768px-1028px), `17px` (1440px), `18px` (1750px+), `19.5px` (2200px+)
  * Font-weight: `500` (Medium)
  * Radius: `1px` (`border-radius: 1px`)

### 2. Konzistentní boční padding (Postranní odsazení)
* Šířka všech tlačítek se vypočítává z délky textu + stejného bočního paddingu:
  * Mobil (pod 768px): `padding: 0 20px;`
  * Tablet (768px - 1028px): `padding: 0 24px;`
  * Standardní desktop (1440px): `padding: 0 28px;`
  * Velký desktop (1750px+): `padding: 0 32px;`
  * Ultra-wide 4K (2200px+): `padding: 0 36px;`
* Pravidlo: `width: fit-content` / `display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;`

## 📐 Pravidlo pro responzivitu kontejnerů a sekcí (Fluid Grid System 1025px - 1500px+)

Všechny vnitřní kontejnery sekcí (`.hero-inner`, `.about-inner`, `.promo-inner`, `.rooms-inner`, `.services-inner`, `.reviews-inner`, `.features-inner`, `.surroundings-inner`, `.cta-inner`, `.footer-inner`) MUSÍ dodržovat tato pravidla:

1. **Fluidní šířka kontejnerů**:
   - Používat výhradně `width: 100%; max-width: 1440px; margin: 0 auto; box-sizing: border-box;` (nikdy statické `width: 1440px;` bez `max-width: 100%`).
2. **Symetrické a čisté odsazení sekcí (Padding)**:
   - Horní i spodní padding sekce musí být rovnocenný a symetrický (`padding: Npx 0 Npx 0;`).
   - Prvky uvnitř sekce nesmí mít zbytečné vysoké statické odsazení (`top`), které by v kombinaci s paddingem sekce vytvářelo asymetrii (např. 3× větší horní mezeru než spodní).
3. **Plynulé přizpůsobení obsahu a responzivní padding (1028px – 1500px)**:
   - Šířky prvků, obrázků a mřížek musí používat responzivní jednotky (`%`, `vw`, `clamp()`).
   - Kdykoliv se v sekci nachází obrázky, které se responzivně zvětšují/zmenšují, MUSÍ se výška kontejneru (`min-height: clamp(...vw...)`) i padding sekce (`padding: clamp(...) 0`) zvětšovat v odpovídajícím poměru (`vw`), aby rozměry sekce reagovaly na růst obrázků a spodní i horní odsazení zůstávalo v každém okamžiku 100% symetrické a stejné.
   - Obrázky se musí zmenšovat/zvětšovat plynule bez přetékání mimo kontejner.
   - Šířka a výška sekcí musí být dynamická (`height: auto;`), aby nedocházelo k překrývání se sousedními sekcemi.
   - Pro absolutně poziciované prvky (např. překrývající se dekorace nebo fotky) vždy použít `left: auto !important;` / `right` offsety tak, aby lícovaly k okraji obsahu a nepřetékaly mimo viditelnou plochu obrazovky.

## 📱 Pravidlo pro Mobilní (<768px) a Tabletové (768px-1028px) verze

1. **Mobilní verze (<768px)**:
   - Strictní 1:1 replika dle SVG předlohy / reference (zarovnání, typografie, odsazení).
   - Všechny hlavní nadpisy sekcí na mobilu (kromě Hero sekce, např. `.about-title`, `.promo-title`, `.rooms-title`, `.services-title` atd.) MUSÍ mít font-weight o stupeň tenčí: `font-weight: 600` (Semi-Bold), stejně jako v sekci Sleva.
   - Zachování rozměrů tlačítek dle Button Design System.
   - Symetrické horní a spodní paddingy sekce.
2. **Tabletová verze (768px-1028px)**:
   - Plynulý bridge mezi mobilem a desktopem.
   - Pravý kraj překrývajících se prvků/fotek musí přísně lícovat k pravému okrajovému paddingu kontejneru (`right: 32px; left: auto !important;`).
   - Výška sekcí a pozicování prvků musí využívat `clamp()` / `%`, aby při zvětšování tabletu směrem k 1028px nevnikaly neestetické mezery ani přetékání.

## 💬 Pravidlo pro komunikaci
Odpovídat vždy stručně, věcně a přímo k věci. Bez zbytečných omáček, rekapitulací a zdlouhavých popisů kroků. Uvádět pouze podstatné informace.
