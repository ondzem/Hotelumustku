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
### Dotyková plocha na mobilu (nesmazat)
Tlačítka zůstávají vizuálně 36 px vysoká, ale na mobilu (max-width: 767px) mají přes pseudo-element ::after neviditelně zvětšenou dotykovou plochu na 44 px (top: -4px; bottom: -4px). Je to kvůli cílové skupině 60+ a doporučení Google i Apple na minimálně 44 px pro dotyk.
Pravidlo je v src/style.css kolem řádku 8039. NEODSTRAŇOVAT.

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

## 🚫 Pravidlo pro prohlížeč a vizuální kontrolu

* **STRIKTNÍ ZÁKAZ BROWSER_SUBAGENT**: NIKDY nepoužívat automatizovaný nástroj `browser_subagent` k otevírání prohlížeče. Je nefunkční a uživatelem zakázaný.

## 💬 Pravidlo pro komunikaci
Odpovídat vždy stručně, věcně a přímo k věci. Bez zbytečných omáček, rekapitulací a zdlouhavých popisů kroků. Uvádět pouze podstatné informace.

## 🖼️ ZÁKAZ BAREVNÝCH RÁMEČKŮ A POZADÍ SEKCE (NO CONTAINER BOXES RULE)

* **STRIKTNÍ ZÁKAZ BAREVNÝCH RÁMEČKŮ OSOBITÝCH SEKCÍ**: NIKDY nevkládat formulářové bloky, sekce adresy, upozornění ani doplňkové texty do barevných pozadí/boxů s rámečky (`background-color`, `border` rámečky okolo podsekcí).

## 🔍 Pravidlo pro diagnostiku a ověřování databázových chyb (Database Debugging Rule)

* **ZÁKAZ PŘEDČASNÉHO PROHLÁŠENÍ ZA OPRAVENÉ**: Při jakémkoliv problému s ukládáním do databáze NIKDY neprohlašovat úkol za hotový pouze na základě syntaktické opravy nebo mock testu.
* **POVINNÉ SELEKTOVÁNÍ REÁLNÉHO ZÁZNAMU**: Vždy nejprve provést přímý databázový dotaz (`SELECT * FROM table WHERE ...`) na konkrétní uživatelem vytvořené řádky v živé databázi a ověřit přesnou chybovou hlášku z databázového engine (např. typové chyby UUID vs TEXT v SQL).
* **VERIFIKACE PODLE UŽIVATELSKÉHO KÓDU**: Před hlášením hotovo fyzicky ověřit přes databázový CLI/API dotaz, že se `used_count` a `max_uses` u konkrétního uživatelského kódového řetězce zvedly na očekávanou hodnotu.

## 🏰 Pravidlo pro Hero sekce napříč zařízeními (Hero Section System)

Všechny Hero sekce (Úvodní, Stravování, Pokoje, Přízemí, Výhled) MUSÍ striktně dodržovat následující responzivní rozdělení na 3 samostatné verze:

### 📱 1. Mobilní verze (<768px)
* **Struktura prvků**:
  - **Hlavní nadpis + podnadpis (nebo tlačítko)**: Blok `.room-detail-hero-center` má posun `transform: translateY(50px) !important;` od středu dolů.
  - **Prvky v bloku**: Mezera mezi nadpisem a tlačítkem/podnadpisem je přísně `gap: 16px;`. Při skrytí podnadpisu (`display: none !important`) MUSÍ mít nadpis i obal tlačítka `margin: 0 !important;`, aby se zamezilo sčítání mezer a vniknutí nepřirozeně velké vzdálenosti mezi nadpisem a tlačítkem.
  - **Relativní pozicování tlačítka**: Primární tlačítko v Hero sekci (`.room-detail-hero-btn`, `.btn-dining-read-more`, `.btn-events-read-more`) MUSÍ mít na mobilu i tabletu relativní flexboxové pozicování (`position: relative !important; top: auto !important; transform: none !important; margin: 16px 0 0 0 !important;`), STRIKTNĚ ZÁKAZ absoltního pozicování (`position: absolute !important; top: calc(...)`), které by tlačítko odsunulo daleko dolů ke spodní šipce.
  - **Pouze 1 tlačítko**: Primární tlačítko (např. *Nejsem ubytovaný* / *Rezervovat pobyt*) s rozměry dle Button Design System (`height: 36px !important; padding: 0 20px !important; font-size: 14.5px !important; border-radius: 1px !important; background-color: #ece8dd !important; color: #1c1c19 !important;`). Druhé tlačítko (např. *Přečíst více*) je skryté (`display: none !important`).
  - **Spodní odskrolovávací šipka**: ZOBRAZENÁ a VYCENTROVANÁ NA STŘED (`display: flex !important; margin: 15px auto 0 auto !important; align-self: center !important; transform: translateY(-25px) !important;`). Odsazení šipky od spodního okraje je striktně zachováno.
  - **Hover efekt tlačítka**: Plný neprahledný hover s jemným ztmavnutím podkladu (`background-color: #dcd7c5 !important; color: #1c1c19 !important; border: none !important;`).
* **Výška sekce**: `height: 100vh !important; min-height: 520px !important;`.

### 📱 2. Tabletová verze (768px - 1028.98px)
* **Struktura prvků**:
  - **Hlavní nadpis + podnadpis (nebo tlačítko)**: Blok `.room-detail-hero-center` má posun `transform: translateY(50px) !important;` od středu dolů.
  - **Prvky v bloku**: Mezera mezi nadpisem a tlačítkem/podnadpisem je přísně `gap: 16px;`. Při skrytí podnadpisu (`display: none !important`) MUSÍ mít nadpis i obal tlačítka `margin: 0 !important;`.
  - **Relativní pozicování tlačítka**: Primární tlačítko MUSÍ mít relativní flexboxové pozicování (`position: relative !important; top: auto !important; transform: none !important; margin: 16px 0 0 0 !important;`) pro přímé lícování těsně 16px pod nadpisem H1.
  - **Pouze 1 tlačítko**: Primární tlačítko s tabletovými rozměry dle Button Design System (`height: 40px !important; padding: 0 24px !important; font-size: 15.5px !important; border-radius: 1px !important; background-color: #ece8dd !important; color: #1c1c19 !important;`). Druhé tlačítko je skryté (`display: none !important`).
  - **Spodní odskrolovávací šipka**: ZOBRAZENÁ a 100% VYCENTROVANÁ NA STŘED (`display: flex !important; margin: 15px auto 0 auto !important; align-self: center !important; transform: translateY(-25px) !important;`).
  - **Hover efekt tlačítka**: Plný neprahledný hover s jemným ztmavnutím podkladu (`background-color: #dcd7c5 !important; color: #1c1c19 !important; border: none !important;`).
* **Výška sekce**: `height: 100vh !important; min-height: 600px !important;`.

### 💻 3. Desktopová verze (1029px+)
* **Struktura prvků**:
  - **Kompletní obsah**: Obsahuje Hlavní nadpis, Podtext a Tlačítka (1 nebo 2 tlačítka dle stránky).
  - **Mezery (Spacing)**:
    - Hlavní nadpis <-> Podtext: `margin-bottom: 12px;` / `margin-bottom: 16px;`.
    - Podtext <-> Tlačítka: `margin-bottom: 24px;` / `gap: 16px;`.
  - **Tlačítka**: Dle Button Design System: Standard Desktop (1440px): `45px` výška, `0 28px` padding, `17px` font. XXXL (1750px+): `48px` výška, `0 32px` padding, `18px` font. 4K (2200px+): `52px` výška, `0 36px` padding, `19.5px` font.
  - **Spodní odskrolovávací šipka**: Na desktopových podstránkách SKRYTÁ (zobrazuje se pouze na úvodní stránce).
* **Pozicování**: Čistý plynulý Flexbox layout bez statického absolutního překrývání.


