# SEO Roadmapa — Hotel u Můstku

Postup z dnešního stavu do 100% SEO optimalizace. Odškrtávej `[ ]` → `[x]`.

**Způsob provedení:** primárně prompty do Antigravity IDE (jsou připravené v každém kroku, stačí zkopírovat). Technické drobnosti může udělat Claude přímo ve složce.

**Jazyk:** zatím jen čeština. DE/PL až po dokončení všech fází.

---

## JAK POZNÁME, ŽE JE TO 100 %

Než začneme, musí být jasné, co měříme. Tohle je definice hotova:

| Metrika | Nástroj | Cílová hodnota |
|---|---|---|
| Lighthouse SEO skóre | Chrome DevTools / PageSpeed Insights | **100/100** na všech stránkách |
| Chyby strukturovaných dat | Google Rich Results Test | **0 chyb, 0 varování** |
| Indexované stránky | GSC → Indexování stránek | **100 % odeslaných URL** |
| Core Web Vitals | PageSpeed Insights (mobil) | LCP < 2,5 s · INP < 200 ms · CLS < 0,1 |
| Pokrytí klíčových dotazů | GSC → Výkon | hotel v TOP 3 na 15 cílových dotazů |
| Prokliky z vyhledávání | GSC | růst CTR měsíc po měsíci |
| Viditelnost v AI | ruční test v ChatGPT / Perplexity / Google AI Overview | hotel se objeví v odpovědi na „hotel v Desné Jizerské hory" |
| Přímé rezervace | Supabase / Netlify Analytics | podíl přímých rezervací vs. Booking.com |

**Bez Google Search Console se nedá měřit nic.** Proto je to úplně první úkol.

---

# FÁZE 0 — Přístupy a základna měření

Tohle udělej dřív, než sáhneš na jediný text. Bez toho pracuješ naslepo.

- [ ] **Vyžádat od klienta přístup do Google Search Console** pro `umustku.cz`
  - Klient tě přidá jako uživatele: GSC → Nastavení → Uživatelé a oprávnění → Přidat uživatele → tvůj e-mail → oprávnění „Úplné"
- [ ] **Vyexportovat současný stav ze starého webu** (GSC → Výkon → posledních 16 měsíců → Export)
  - Které dotazy přinášejí návštěvnost
  - Které konkrétní URL rankují nejvýš
  - Kolik je impressions a prokliků
  - **Tohle je poklad** — přesně tyhle dotazy musí nový web pokrýt ještě líp
- [ ] Vyžádat přístup do **Google Business Profile** (Firemní profil Google) pro hotel
- [ ] Vyžádat přístup do **Google Analytics** (pokud existuje) nebo založit GA4
- [ ] Ověřit, kdo vlastní doménu `umustku.cz` a kde běží DNS

**Výstup fáze:** víš, na čem starý web reálně stojí, a máš kde měřit dopad.

---

# FÁZE 1 — Migrace ze starého webu bez ztráty pozic

**Odpověď na tvoji otázku:** ano, jde to, a je to úplně standardní postup. Hodnota (pozice ve vyhledávání) nesedí na těch starých PHP stránkách — sedí na **doméně `umustku.cz`**. Když nový web nasadíš na tu samou doménu a správně nastavíš 301 přesměrování ze starých URL na nové, Google tu hodnotu převede. Nemusíš nic „nasazovat na ty staré stránky" — naopak, staré stránky nahradíš a řekneš Googlu, kam se posunuly.

Podmínky, aby to fungovalo:
1. Stejná doména
2. Každá stará URL má **301** (trvalé) přesměrování na nejbližší odpovídající novou URL
3. Nová stránka pokrývá **stejné téma** jako ta stará (proto je důležité, aby nový web měl stránku o výletech, ceníku, recenzích atd. — jinak není kam přesměrovat)
4. Staré URL nikdy nevrací 404

## 1.1 Opravit soubor `public/_redirects` — obsahuje chybu

Netlify **nematchuje query parametry uvnitř cesty**. Současný zápis `/cz/index.php?stranka=uvod` nefunguje — query string se musí uvést zvlášť za mezerou.

- [ ] Přepsat `public/_redirects` na správnou syntaxi
- [ ] Odstranit catch-all `/*  /index.html  200` — dělá ze všech neexistujících URL kopie homepage se stavem 200 (soft 404). Google to indexuje jako duplicity.
- [ ] Vytvořit stránku `404.html` (Netlify ji použije automaticky)
- [ ] Po nasazení otestovat každou starou URL v prohlížeči, že skutečně skočí na správnou novou

**Prompt do Antigravity:**

```
Přepiš soubor public/_redirects. Aktuální zápis přesměrování ze starého PHP webu
je pro Netlify neplatný — Netlify nematchuje query parametry uvnitř cesty, musí
být uvedené zvlášť za mezerou.

Správná syntaxe je: /cesta  parametr=hodnota  /cil  301!

Vytvoř přesměrování pro tyto staré URL (všechny s vykřičníkem pro vynucení):
/cz/index.php?stranka=uvod        -> /
/cz/index.php?stranka=novinky     -> /aktuality
/cz/index.php?stranka=ubytovani   -> /ubytovani
/cz/index.php?stranka=sluzby      -> /stravovani
/cz/index.php?stranka=fotogalerie -> /ubytovani
/cz/index.php?stranka=akce        -> /akce
/cz/index.php?stranka=cenik       -> /cenik
/cz/index.php?stranka=rezervace   -> /rezervace
/cz/index.php?stranka=kniha       -> /recenze
/cz/index.php?stranka=vylety      -> /okoli
/cz/index.php?stranka=mapy        -> /kontakt
/cz/index.php?stranka=kontakt     -> /kontakt
/cz/*  -> /   (301, fallback pro cokoliv dalšího)
/de/*  -> /   (301, německá verze zatím neexistuje)

Zachovej existující rewrites pro /ubytovani, /stravovani, /akce, /okoli,
/aktuality, /kontakt a proxy /api/resend/*.

ODSTRAŇ pravidlo /*  /index.html  200 — způsobuje soft 404. Nahraď ho
pravidlem, které neexistující URL vrátí skutečnou 404 stránku.
```

## 1.2 Napojit doménu

- [ ] Nasadit Netlify build na `umustku.cz` (Netlify → Domain management → Add custom domain)
- [ ] Nastavit `www.umustku.cz` → 301 na `umustku.cz` (nebo naopak, ale **jen jedna varianta** smí být hlavní)
- [ ] Vynutit HTTPS, ověřit platný certifikát
- [ ] Ověřit, že `http://` verze 301 přesměrovává na `https://`

## 1.3 Po nasazení

- [ ] V GSC odeslat novou `sitemap.xml` (vzniká ve Fázi 2)
- [ ] V GSC použít **Kontrola URL → Požádat o indexování** na všech 7+ hlavních stránek
- [ ] První 4 týdny sledovat GSC → Indexování stránek, jestli nepřibývají chyby
- [ ] Očekávej **dočasný propad pozic o 2–6 týdnů** — to je normální, Google si přerovnává index

---

# FÁZE 2 — Technický základ ✅ HOTOVO (31. 7. 2026)

> **Stav: provedeno.** Všechny body 2.1–2.6 jsou hotové, včetně opravy `_redirects`
> z Fáze 1.1. Zbývá bod 2.7 (ověření v Rich Results Test), který jde udělat až po
> nasazení na doménu. Detaily provedených změn viz sekce „Co bylo hotovo" na konci
> tohoto dokumentu.

Tohle jsou věci, které dnes na webu **úplně chybí** a bez kterých se o 100 % SEO nedá mluvit.

## 2.1 Canonical URL

Bez canonical Google nevím, která verze stránky je ta pravá (s `www`, bez, s parametry, s `#rezervace`...).

- [ ] Přidat `<link rel="canonical">` do `<head>` všech 7 stránek

**Prompt do Antigravity:**

```
Do <head> každé HTML stránky v kořeni projektu (index.html, ubytovani.html,
stravovani.html, akce.html, okoli.html, aktuality.html, kontakt.html) přidej
canonical odkaz na absolutní URL bez přípony .html:

index.html      -> https://umustku.cz/
ubytovani.html  -> https://umustku.cz/ubytovani
stravovani.html -> https://umustku.cz/stravovani
akce.html       -> https://umustku.cz/akce
okoli.html      -> https://umustku.cz/okoli
aktuality.html  -> https://umustku.cz/aktuality
kontakt.html    -> https://umustku.cz/kontakt

Umísti ho hned pod meta description.
```

## 2.2 robots.txt

- [ ] Vytvořit `public/robots.txt`

**Prompt do Antigravity:**

```
Vytvoř soubor public/robots.txt s tímto obsahem:

User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: https://umustku.cz/sitemap.xml

Nepřidávej žádná pravidla, která by blokovala AI crawlery (GPTBot,
ClaudeBot, PerplexityBot, Google-Extended) — chceme, aby web viděly.
```

## 2.3 sitemap.xml

- [ ] Vytvořit `public/sitemap.xml` se všemi stránkami
- [ ] Doplňovat ji vždy, když přibude nová stránka
- [ ] Odeslat v GSC

**Prompt do Antigravity:**

```
Vytvoř soubor public/sitemap.xml ve formátu XML sitemap protokolu 0.9.
Zahrň všechny existující stránky s absolutními URL na doméně
https://umustku.cz, každou s <lastmod> dnešního data a <priority>:

/            1.0
/ubytovani   0.9
/stravovani  0.8
/akce        0.8
/okoli       0.8
/kontakt     0.7
/aktuality   0.6

Použij changefreq weekly pro / a /aktuality, monthly pro ostatní.
```

## 2.4 llms.txt — pro AI vyhledávače

Novější standard. AI boti (ChatGPT, Perplexity, Claude) ho čtou, aby rychle pochopili, o čem web je. Nestojí to skoro nic a je to jeden z mála způsobů, jak je aktivně nasměrovat.

- [ ] Vytvořit `public/llms.txt`

**Prompt do Antigravity:**

```
Vytvoř soubor public/llms.txt ve formátu llms.txt standardu (markdown).
Obsah v češtině, strukturovaný takto:

# Hotel u Můstků

> Rodinný horský hotel v Desné v Jizerských horách. 12 nekuřáckých pokojů,
> 42 lůžek, poctivá domácí kuchyně, přímo u splavu řeky Bílé Desné s výhledem
> na skokanské můstky. Provozují Lenka a Jan Bellingerovi od roku 2015.

Pak sekce s odrážkovými odkazy na hlavní stránky s krátkým popisem u každé:
## Hlavní stránky
- [Ubytování a pokoje](https://umustku.cz/ubytovani): 6 bezbariérových pokojů
  Standard v přízemí a 6 pokojů Nadstandard v patře s balkónem a výhledem.
  Ceny od 700 Kč za osobu a noc včetně snídaně.
- [Stravování](https://umustku.cz/stravovani): ...
- [Skupinové akce](https://umustku.cz/akce): ...
- [Výlety a aktivity](https://umustku.cz/okoli): ...
- [Kontakt](https://umustku.cz/kontakt): ...

## Klíčové informace
Sem dej strukturovaně: adresu Údolní 368, Desná v Jizerských horách 1, 468 61;
telefon +420 777 666 273; e-mail hotel@umustku.cz; GPS 50.76215N, 15.30298E;
kapacitu 42 lůžek ve 12 pokojích; ceník 2026; polopenzi 195 Kč; psa 150 Kč/den;
parkování zdarma; upozornění na zimní uzavírku silnice II/290 Souš–Smědava.
```

## 2.5 Kompletní meta tagy

- [ ] Každá stránka má **vlastní** unikátní description (55–160 znaků)
- [ ] Smazat `meta keywords` — Google ji od roku 2009 ignoruje a na všech 7 stránkách je stejná
- [ ] Doplnit `og:url`, `og:locale`, `og:site_name`
- [ ] Doplnit Twitter Card tagy
- [ ] Každá stránka má **vlastní** OG obrázek (teď je všude ten samý hero)

**Prompt do Antigravity:**

```
Uprav <head> všech 7 HTML stránek v kořeni projektu:

1. ODSTRAŇ <meta name="keywords"> ze všech stránek. Google ji ignoruje a je
   navíc na všech stránkách identická.

2. DOPLŇ do každé stránky tyto Open Graph tagy:
   <meta property="og:url" content="[absolutní URL stránky]" />
   <meta property="og:locale" content="cs_CZ" />
   <meta property="og:site_name" content="Hotel u Můstků" />

3. ZMĚŇ og:image tak, aby každá stránka měla vlastní relevantní obrázek
   (absolutní URL, ne relativní):
   index.html      -> https://umustku.cz/uvodni_hero_sekce.webp
   ubytovani.html  -> https://umustku.cz/nabidka-pokoju.webp
   stravovani.html -> https://umustku.cz/Polopenze vecere.webp
   akce.html       -> https://umustku.cz/akce/hero_akce.webp
   okoli.html      -> https://umustku.cz/Aktivity v hotelu/vyhled na krajinu desktop.webp
   kontakt.html    -> https://umustku.cz/kontakt/vyhled-na-mustky.webp
   aktuality.html  -> https://umustku.cz/Fotky Aktivit/Aktulity hero sekce.webp
   Pozor: URL s mezerami musí být procentuálně zakódované (%20).

4. DOPLŇ Twitter Card tagy do každé stránky:
   <meta name="twitter:card" content="summary_large_image" />
   <meta name="twitter:title" content="[stejné jako og:title]" />
   <meta name="twitter:description" content="[stejné jako og:description]" />
   <meta name="twitter:image" content="[stejné jako og:image]" />

Nic jiného v head neměň.
```

## 2.6 Strukturovaná data (schema.org / JSON-LD) — NEJDŮLEŽITĚJŠÍ KROK

Tohle je jediný způsob, jak vyhledávači a AI botovi **explicitně řeknu**, co web je: že je to hotel, kde stojí, kolik stojí pokoj, jaké má hodnocení. Bez toho to musí hádat z textu. S tím se web může objevit v rich snippets (hvězdičky, ceny, FAQ rozbalovátka) a AI ho cituje s daleko vyšší pravděpodobností.

- [ ] `Hotel` schema na všech stránkách (globální, v `<head>`)
- [ ] `HotelRoom` + `Offer` pro každý typ pokoje na `/ubytovani`
- [ ] `Review` + `AggregateRating` z knihy návštěv
- [ ] `FAQPage` na stránkách, kde jsou dotazy
- [ ] `BreadcrumbList` na všech podstránkách
- [ ] `TouristAttraction` pro výlety na `/okoli`
- [ ] Ověřit vše v **Google Rich Results Test** — musí být 0 chyb

**Prompt do Antigravity (část 1 — globální Hotel schema):**

```
Do <head> každé z 7 HTML stránek přidej JSON-LD blok se schema.org typem Hotel.
Použij tato REÁLNÁ data, nic si nevymýšlej:

@type: Hotel
name: Hotel u Můstků
url: https://umustku.cz
telephone: +420777666273
email: hotel@umustku.cz
address (PostalAddress):
  streetAddress: Údolní 368
  addressLocality: Desná v Jizerských horách
  postalCode: 468 61
  addressRegion: Liberecký kraj
  addressCountry: CZ
geo (GeoCoordinates): latitude 50.762147, longitude 15.302983
priceRange: 700–890 Kč
currenciesAccepted: CZK
numberOfRooms: 12
petsAllowed: true
smokingAllowed: false
checkinTime: 14:00
checkoutTime: 10:00
starRating: nepřidávej (hotel nemá oficiální klasifikaci)
image: pole absolutních URL na 3-4 nejlepší fotky hotelu
description: Rodinný horský hotel v Desné v Jizerských horách u splavu řeky
  Bílé Desné s výhledem na skokanské můstky. 12 nekuřáckých pokojů, poctivá
  domácí kuchyně, hlídané parkoviště zdarma.

amenityFeature — pole objektů typu LocationFeatureSpecification s value: true
pro: Bezplatné Wi-Fi, Bezplatné parkování, Bezbariérové pokoje, Restaurace,
Zahrada, Terasa, Kolárna, Lyžárna, Dobíjení elektrokol, Domácí mazlíčci vítáni,
Dětský koutek, Kulečník, Stolní tenis, Stolní fotbal, Šipky, Ohniště, Gril,
Rodinné pokoje, Balkón

Blok umísti až za <title>. Na všech stránkách identický.
```

**Prompt do Antigravity (část 2 — pokoje a ceny):**

```
Do ubytovani.html přidej druhý JSON-LD blok. Použij @graph a v něm dva
objekty typu HotelRoom, každý s vlastní nabídkou (Offer):

Objekt 1:
  @type: HotelRoom
  name: Pokoj Standard (přízemí, bezbariérový)
  description: Bezbariérový pokoj v přízemí s vlastní koupelnou, předsíňkou
    a minibarem. Přímý přístup na terasu a k parkovišti, bez schodů. Vhodný
    pro seniory a rodiny s kočárkem.
  occupancy: QuantitativeValue, minValue 1, maxValue 4
  bed: BedDetails, typ dvoulůžko s možností až dvou přistýlek
  amenityFeature: vlastní koupelna, WC, minibar, Wi-Fi, TV na vyžádání
  offers: Offer, price 700, priceCurrency CZK,
    description "Cena za osobu a noc včetně snídaně při obsazení 4 osobami.
    Ceník 2026: 1 osoba 830 Kč, 2 osoby 740 Kč, 3 osoby 720 Kč, 4 osoby 700 Kč."
    availability InStock

Objekt 2:
  @type: HotelRoom
  name: Pokoj Nadstandard (patro, balkón s výhledem)
  description: Pokoj v prvním patře s balkónem v alpském stylu a přímým
    výhledem na splav řeky Bílé Desné a skokanské můstky. Vlastní koupelna,
    předsíňka, minibar.
  occupancy: QuantitativeValue, minValue 1, maxValue 4
  amenityFeature: balkón, výhled, vlastní koupelna, WC, minibar, Wi-Fi
  offers: Offer, price 890, priceCurrency CZK,
    description "Cena za osobu a noc včetně snídaně."
    availability InStock

Oba objekty propoj vlastností containedInPlace na Hotel u Můstků.
```

**Prompt do Antigravity (část 3 — recenze):**

```
Na index.html je sekce s recenzemi hostů. Přidej k ní JSON-LD blok s poli
objektů @type Review, které patří pod Hotel u Můstků.

Vezmi 10 nejsilnějších recenzí z existující sekce v HTML. Pro každou vytvoř:
  @type: Review
  itemReviewed: odkaz na Hotel u Můstků
  reviewBody: doslovný text recenze z HTML
  author: Person se jménem, pokud je v HTML uvedené, jinak vynech autora
    (nevymýšlej si jména)
  reviewRating: Rating s ratingValue 5, bestRating 5

DŮLEŽITÉ: nepřidávej AggregateRating, dokud nebudeme mít doložitelný počet
hodnocení z Google Business Profile. Vymyšlený agregát je porušení pravidel
Googlu a může vést k manuálnímu postihu.
```

**Prompt do Antigravity (část 4 — FAQ a drobečky):**

```
1. okoli.html už obsahuje sekci "Často kladené dotazy" se třemi otázkami.
   Přidej k ní JSON-LD blok @type FAQPage s mainEntity polem Question objektů.
   Text otázek i odpovědí vezmi DOSLOVA z existujícího HTML — nesmí se lišit,
   jinak to Google vyhodnotí jako klamavé.

2. Na každou podstránku (ubytovani, stravovani, akce, okoli, aktuality,
   kontakt) přidej JSON-LD @type BreadcrumbList se dvěma položkami:
   pozice 1 = Úvod (https://umustku.cz/), pozice 2 = název stránky.
```

## 2.7 Kontrola

- [ ] Každou stránku projet přes **Google Rich Results Test** (search.google.com/test/rich-results)
- [ ] Každou stránku projet přes **Schema Markup Validator** (validator.schema.org)
- [ ] 0 chyb, 0 varování

---

# FÁZE 3 — Obsahová architektura (nové stránky)

Dnes má web 7 stránek. To je na hotel v turistické oblasti málo — každá stránka může rankovat jen na omezený počet dotazů. Chybí stránky pro dotazy, které lidi reálně hledají.

## 3.1 Stránky, které MUSÍ vzniknout

- [ ] **`/cenik`** — samostatná stránka ceníku
  - Dotaz „ceník ubytování Jizerské hory", „kolik stojí hotel Desná" je transakční a vysoce konverzní
  - Dnes je ceník schovaný uvnitř `/ubytovani`
  - Starý web měl `stranka=cenik` — je kam přesměrovat
- [ ] **`/recenze`** — stránka s recenzemi hostů
  - Dnes je 55 recenzí duplikovaně na 4 stránkách → **duplicitní obsah, který si stránky navzájem kanibalizuje**
  - Řešení: jedna stránka `/recenze` s kompletním výpisem, na ostatních stránkách jen 3–5 vybraných
  - Starý web měl `stranka=kniha` — je kam přesměrovat
- [ ] **`/o-nas`** — příběh Lenky a Jana Bellingerových
  - Kritické pro **E-E-A-T** (zkušenost, odbornost, autorita, důvěryhodnost) — Google i AI hodnotí, kdo za obsahem stojí
  - Provozují od 2015, bydlí přímo v domě, pečou chleba, dělají domácí jogurty
  - Bez téhle stránky je web anonymní a AI ho nemá jak citovat jako důvěryhodný zdroj
- [ ] **`/rezervace`** — samostatná stránka rezervace
  - Dnes je rezervace jen kotva `#rezervace`
  - Starý web měl `stranka=rezervace`

## 3.2 Podstránky pokojů

Ve `public/pokoje/` leží fotky pro cca 10 pokojů (Zen, Motýl, Mahagon, Standard P5–P12), každý 7–10 fotek. Nikde na webu nejsou využité.

- [ ] `/ubytovani/pokoje-prizemi` — kategorie Standard (bezbariérové)
- [ ] `/ubytovani/pokoje-s-vyhledem` — kategorie Nadstandard
- [ ] `/pokoje/zen`, `/pokoje/motyl`, `/pokoje/mahagon` — detailní stránky 3 rekonstruovaných pokojů
- [ ] Každá stránka pokoje: vlastní title, description, H1, 300+ slov popisu, galerie s popisnými alt texty, `HotelRoom` schema, cena, CTA na rezervaci

**Proč to má smysl:** dotazy typu „pokoj s balkónem Jizerské hory", „bezbariérový pokoj Desná", „hotelový pokoj s výhledem na můstky" nemá dnes kde přistát.

## 3.3 Stránky výletů — největší nevyužitý potenciál

Ve složce `Aktivity popisky/` máš **35 kB hotových SEO textů** — turistika, cyklistika, zima, výlety autem. Každý výlet už má napsaný H1, Title, Meta description i alt text. **Na webu z toho není nic.**

- [ ] `/okoli/turistika` — rozcestník pěších tras
- [ ] `/okoli/cyklistika` — rozcestník cyklotras
- [ ] `/okoli/zimni-vylety` — běžky, sjezdovky
- [ ] `/okoli/vylety-autem` — výlety do 50 km
- [ ] Jednotlivé výlety jako samostatné stránky, např. `/okoli/protrzena-prehrada`, `/okoli/rozhledna-stepanka`, `/okoli/vodni-nadrz-sous`, `/okoli/vyhlidka-spicka`
  - Každá s `TouristAttraction` schema, vzdáleností od hotelu, časem chůze, obtížností
  - Cíl: „výlet k Protržené přehradě", „rozhledna Štěpánka jak se tam dostat" — informační dotazy, které přivedou návštěvníka, který si pak všimne, že píše hotel

**Toto je klasické budování tematické autority.** Google i AI hodnotí, jestli je web k tématu „Jizerské hory" skutečný odborník, nebo jen jedna vizitka.

**Prompt do Antigravity:**

```
Ve složce "Aktivity popisky" jsou 4 markdown soubory s hotovými SEO texty na
výlety (texty-turistika.md, texty-cyklistika.md, texty-zima.md,
texty-vylety-autem.md). Každý výlet v nich má už napsaný H1, Title, Meta
description, alt text a hotový copy.

Vytvoř podle nich nové HTML stránky. Použij ÚPLNĚ STEJNOU strukturu, hlavičku,
patičku, CSS třídy a design jako existující okoli.html — nový obsah, stejný
kabát. Nevymýšlej nový design.

Struktura:
1. Čtyři rozcestníkové stránky: okoli-turistika.html, okoli-cyklistika.html,
   okoli-zima.html, okoli-vylety-autem.html — každá s přehledem výletů
   v dané kategorii, kartami s fotkou, názvem, vzdáleností a odkazem na detail.
2. Pro každý jednotlivý výlet samostatná stránka s H1, Title a Meta description
   přesně podle markdownu.

Do každé detailní stránky přidej JSON-LD schema @type TouristAttraction
s názvem, popisem, geo souřadnicemi (pokud jsou v textu) a vlastností
containedInPlace odkazující na Jizerské hory.

Do vite.config.js doplň všechny nové stránky do rollupOptions.input.
Do public/_redirects doplň hezké URL (např. /okoli/turistika ->
/okoli-turistika.html 200).
Do public/sitemap.xml doplň všechny nové URL.
```

## 3.4 Vnitřní prolinkování

Nejpodceňovanější část SEO. Google (i AI) chodí po odkazech — když stránka nemá odkazy dovnitř, je pro ně skoro neviditelná.

- [ ] Každá nová stránka má **alespoň 3 odkazy z jiných stránek** webu
- [ ] Odkazy mají **popisný text** — ne „klikněte zde", ale „bezbariérové pokoje v přízemí"
- [ ] Z `/okoli` odkaz na každý výlet, z každého výletu zpátky na `/okoli` a na `/ubytovani`
- [ ] Z `/ubytovani` odkazy na jednotlivé pokoje
- [ ] Z homepage odkaz na `/o-nas`, `/cenik`, `/recenze`

---

# FÁZE 4 — Copywriting

Teprve tady se přepisují texty. Až po tom, co víme, které stránky existují a na co mají cílit.

## 4.1 Pravidla pro tenhle web

Primární cílová skupina jsou **senioři 60+**. To mění, jak se píše:

- Krátké věty. Jedna myšlenka na větu.
- Konkrétní čísla místo přídavných jmen. Ne „nedaleko", ale „1,5 km po rovině".
- Žádné anglicismy (wellness, buyout, packages, family-friendly).
- Žádné abstraktní sliby („zážitek na celý život"). Místo toho fakta, která si čtenář převede na svůj klid.
- Telefonní číslo viditelně na každé stránce — senior často radši zavolá, než vyplní formulář.
- Odpovídat na obavy dřív, než je člověk vysloví: Je tam ticho? Dostanu se tam bez auta? Jsou tam schody? Je to čisté? Kolik to celé bude stát?

## 4.2 Klíčová slova — kde se použijí

| Cílový dotaz | Stránka | Kde má být |
|---|---|---|
| ubytování Jizerské hory | `/` | H1, title, první odstavec |
| hotel Desná Jizerské hory | `/` | title, H2 |
| ubytování s polopenzí Jizerky | `/stravovani` | H1, title |
| bezbariérové ubytování Jizerské hory | `/ubytovani/pokoje-prizemi` | H1, title |
| dog friendly hotel Jizerské hory | `/ubytovani` | H2, sekce |
| ceník ubytování Desná | `/cenik` | H1, title |
| penzion pro sportovní soustředění Jizerky | `/akce` | H2, sekce |
| svatba v Jizerských horách | `/akce` | H2, sekce |
| výlet k Protržené přehradě | `/okoli/protrzena-prehrada` | H1, title |
| kam na běžky v Jizerkách | `/okoli/zimni-vylety` | H1, title |
| cyklotrasy pro rodiny Desná | `/okoli/cyklistika` | H1, title |

**Pravidlo:** jedno klíčové slovo = jedna stránka. Když na dva dotazy cílí dvě stránky, kanibalizují si pozice.

## 4.3 Co konkrétně přepsat

- [ ] **H1 na podstránkách** — dnes jsou generické bez klíčových slov
  - `/ubytovani`: „Nabídka pokojů" → „Ubytování v Jizerských horách — pokoje hotelu u Můstků"
  - `/kontakt`: „Kontakt" → „Kontakt a cesta k hotelu v Desné"
  - `/akce`: „Skupinové akce" → „Skupinové akce a pronájem celého hotelu v Jizerských horách"
- [ ] **Meta descriptions** — musí obsahovat cílový dotaz a důvod kliknout (55–160 znaků)
- [ ] **Odstranit duplicitní bloky** — recenze, „Co dalšího nabízíme", „Co vše můžete v okolí podniknout" jsou na 4 stránkách stejné
- [ ] **Opravit typo** v patičce: „zaslouženýodpočinek" → „zasloužený odpočinek" (je na všech stránkách)
- [ ] **Doplnit obsah tam, kde je ho málo** — `/aktuality` má sotva 2 položky, `/kontakt` je krátký
- [ ] **Přidat FAQ sekci** na `/ubytovani`, `/stravovani`, `/akce` a `/cenik`
  - FAQ je nejsilnější formát pro AI vyhledávače — otázka a přímá odpověď je přesně to, co AI cituje

**Prompt do Antigravity (příklad pro jednu stránku, opakuj pro každou):**

```
Přepiš texty na stránce ubytovani.html podle těchto pravidel. Design, HTML
strukturu ani CSS třídy neměň — měň POUZE textový obsah uvnitř elementů.

Cílová skupina: senioři 60+ a rodiny. Píšeme česky, vykáme, krátké věty,
konkrétní čísla místo přídavných jmen, žádné anglicismy, žádné abstraktní
sliby. Odpovídáme na obavy dřív, než je host vysloví.

Cílový dotaz stránky: "ubytování Jizerské hory" a "pokoje Desná".

Konkrétně:
1. Změň H1 na: Ubytování v Jizerských horách — pokoje hotelu u Můstků
2. Změň title na: Ubytování v Jizerských horách | Pokoje hotelu u Můstků, Desná
3. Změň meta description na text 140-155 znaků, který obsahuje "ubytování
   Jizerské hory", cenu od 700 Kč a snídani v ceně.
4. U sekce "Pokoje přízemí" v textu výslovně zmiň, že jsou BEZBARIÉROVÉ,
   bez schodů, vhodné pro seniory a rodiny s kočárkem, s přímým přístupem
   na terasu a k parkovišti.
5. U sekce "Pokoje s výhledem" zmiň balkón v alpském stylu, výhled na splav
   řeky Bílé Desné a na skokanské můstky.
6. ODSTRAŇ celou sekci s 55 recenzemi — nech jen 4 nejsilnější a přidej
   odkaz "Přečíst všech 55 hodnocení hostů" na /recenze.
7. ODSTRAŇ sekci "Co vše můžete v okolí podniknout" — patří na /okoli.
8. PŘIDEJ novou sekci "Často kladené dotazy" ve stejném designu, jaký má
   FAQ sekce na okoli.html, s těmito otázkami:
   - Jsou pokoje v přízemí opravdu bez schodů?
   - Můžeme s sebou vzít psa?
   - Je v ceně snídaně?
   - Kde zaparkujeme?
   - Dostaneme se k vám bez auta?
   Odpovědi napiš věcně podle faktů v .agents/SEO-CONTEXT.md.

Fakta ber výhradně z .agents/SEO-CONTEXT.md. Nic si nevymýšlej.
```

---

# FÁZE 5 — Optimalizace pro AI vyhledávače (GEO)

Klasické SEO řeší, jak se dostat do seznamu odkazů. GEO (Generative Engine Optimization) řeší, jak se dostat **do odpovědi** ChatGPT, Perplexity nebo Google AI Overview. Jiná pravidla.

## 5.1 Co AI potřebuje

AI necituje hezký marketingový text. Cituje **ověřitelná tvrzení s konkrétními čísly**.

- [ ] **Odpověď hned na začátku sekce.** AI čte prvních pár vět. „Hotel u Můstků má 12 pokojů a 42 lůžek" je citovatelné. „Nabízíme komfortní ubytování" není.
- [ ] **Čísla, ne přídavná jména.** Ne „blízko sjezdovky" → „3,5 km k areálu Černá Říčka, 3 minuty autem".
- [ ] **FAQ sekce na každé stránce.** Otázka + přímá odpověď = formát, který AI přebírá doslova.
- [ ] **Tabulky.** Ceník, vzdálenosti výletů, provozní doba — strukturovaná data se AI čtou snadno.
- [ ] **Konzistence napříč webem.** Když je na jedné stránce „42 lůžek" a na druhé „40 osob", AI si není jistá a raději necituje.

## 5.2 Přístup pro AI crawlery

- [ ] V `robots.txt` **neblokovat** GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot
- [ ] Ověřit, že Netlify `public/_headers` neblokuje boty
- [ ] Ověřit, že obsah je v HTML, ne generovaný JavaScriptem (u tohoto webu je to v pořádku — build obsahuje plný HTML)

## 5.3 Konzistence NAP (Name, Address, Phone)

AI i Google křížově ověřují údaje o firmě napříč internetem. Když se liší, klesá důvěra.

- [ ] Stejný tvar názvu všude — rozhodnout: **„Hotel u Můstků"** vs. „Hotel u Můstku" (dnes se na webu používají oba tvary, i v titulcích!)
- [ ] Stejná adresa všude: `Údolní 368, Desná v Jizerských horách 1, 468 61`
- [ ] Stejné telefonní číslo: `+420 777 666 273`
- [ ] Zkontrolovat a sjednotit i na Google Business Profile, Booking.com, Firmy.cz, Mapy.cz

**Pozor: nekonzistence názvu je aktuálně reálný problém.** Titulky stránek říkají „Hotel u Můstku", staré weby „Hotel U Můstků", recenze „hotel U Můstků". Musí se sjednotit.

## 5.4 Test viditelnosti v AI

- [ ] Zeptat se ChatGPT / Perplexity / Google AI Overview:
  - „hotel v Desné v Jizerských horách"
  - „bezbariérové ubytování Jizerské hory"
  - „ubytování s polopenzí Jizerky"
  - „kde se ubytovat u Tanvaldského Špičáku"
- [ ] Zapsat výsledek jako výchozí stav
- [ ] Opakovat po 1, 3 a 6 měsících

---

# FÁZE 6 — Lokální SEO

Pro hotel je to **stejně důležité jako web sám**. Většina lidí hledá „hotel Jizerské hory" na mobilu a klikne na mapu, ne na organický výsledek.

- [ ] **Google Business Profile** — kompletně vyplnit
  - Kategorie: Hotel (primární) + Penzion
  - Všechny fotky (interiér, exteriér, pokoje, jídlo, okolí) — min. 30
  - Otevírací doba, atributy (bezbariérový přístup, Wi-Fi, parkování, psi vítáni)
  - Popis firmy s klíčovými slovy
  - Produkty/služby s cenami
- [ ] **Aktivně sbírat Google recenze** — dnes má hotel recenze v návštěvní knize na webu, ale ty Google nevidí
  - Připravit QR kód na recepci a kartičku k odjezdu
  - Cíl: 50+ Google recenzí do roka
  - Teprve pak lze do schema legálně přidat `AggregateRating`
- [ ] **Odpovídat na všechny recenze** — signál aktivity pro Google
- [ ] **Mapy.cz** — ověřit a doplnit záznam
- [ ] **Zápis do katalogů:** Firmy.cz, Hotel.cz, Ubytovani-Jizerky.cz, Jizerskehory.cz, Kudyznudy.cz, Liberecky-kraj.cz
  - Všude identické NAP údaje
- [ ] **Zpětné odkazy z místních zdrojů:** město Desná, turistické informační centrum, Jizerská magistrála, ski areály, cyklostezka Járy Cimrmana

---

# FÁZE 7 — Rychlost a technický výkon

Google od roku 2021 hodnotí Core Web Vitals jako faktor pořadí. Pro seniory na mobilu je rychlost navíc otázka použitelnosti.

- [ ] Změřit výchozí stav na **PageSpeed Insights** (mobilní verze!) pro všech 7 stránek
- [ ] **Hero video** na homepage se načítá ze Supabase — zkontrolovat, jestli neblokuje LCP
  - Doporučení: video načítat až po prvním vykreslení, poster obrázek musí být preloaded (už je)
- [ ] **Obrázky** — všechny jsou WebP (dobře), ale zkontrolovat rozměry
  - `Mobil - Kontakt.svg` má **17 MB** — to je kritické, musí se optimalizovat nebo nahradit
  - Doplnit `width` a `height` atributy ke všem `<img>` (zabraňuje CLS)
  - Použít `loading="lazy"` na všechny obrázky pod ohybem
- [ ] **Google Fonts** — zvážit self-hosting místo načítání z CDN (ušetří ~200 ms)
- [ ] Ověřit, že `public/_headers` nastavuje cache pro statické soubory
- [ ] Cíl: **LCP < 2,5 s, INP < 200 ms, CLS < 0,1** na mobilu

## 7.1 Přístupnost = SEO

Pro seniorskou cílovku dvojnásob. Google přístupnost nepřímo odměňuje.

- [ ] Kontrast textu min. 4,5:1
- [ ] Velikost základního písma min. 16 px
- [ ] Klikací plochy min. 44×44 px (dnešní tlačítka mají na mobilu 36 px výšky — **pod limitem**)
- [ ] Všechny obrázky mají popisný `alt` (dnes jsou obecné: „Hotel u Můstku", „Kontakt Hotel u Můstku")
- [ ] Formuláře mají `<label>`
- [ ] Ovladatelnost klávesnicí

**Prompt do Antigravity:**

```
Projdi všechny HTML stránky v kořeni projektu a oprav alt texty u obrázků.

Dnes jsou obecné ("Hotel u Můstku", "Kontakt Hotel u Můstku") a Googlu ani
čtečkám obrazovky nic neříkají.

Pravidlo pro nový alt text: popiš, CO na fotce konkrétně je, v 5-12 slovech,
česky, a kde to dává smysl zmiň lokalitu. Nepřecpávej klíčovými slovy.

Příklady:
místo alt="Hotel u Můstku"
    -> alt="Hotel u Můstků v Desné pohled od splavu řeky Bílé Desné"
místo alt="Nabídka pokojů Hotel u Můstku"
    -> alt="Dvoulůžkový pokoj Standard v přízemí hotelu u Můstků"
místo alt="Kontakt Hotel u Můstku"
    -> alt="Výhled z hotelu na skokanské můstky v Desné"

Zároveň ke KAŽDÉMU <img> doplň atributy width a height podle skutečných
rozměrů souboru (zabraňuje posunu layoutu při načítání) a loading="lazy"
u všech obrázků kromě těch v hero sekcích.
```

---

# FÁZE 8 — Měření a průběžné vylepšování

SEO nekončí nasazením. Tohle je rutina na dalších 12 měsíců.

## 8.1 Nastavit sledování

- [ ] **Google Search Console** — přidat novou verzi webu, odeslat sitemap
- [ ] **Google Analytics 4** — nastavit konverzní událost „odeslaná rezervace"
- [ ] **SEO drift baseline** — pomocí skillu `claude-seo` zachytit výchozí stav:
  ```
  /seo drift baseline https://umustku.cz
  ```
  Pak měsíčně `/seo drift compare https://umustku.cz` — ukáže, co se změnilo

## 8.2 Měsíční kontrola

- [ ] GSC → Výkon: rostou impressions? rostou prokliky? kde jsme na pozicích 4–15 (tam je největší prostor)?
- [ ] GSC → Indexování: nejsou nové chyby?
- [ ] PageSpeed Insights: nezhoršily se Core Web Vitals?
- [ ] Rich Results Test: nerozbilo se schema?
- [ ] Test v AI vyhledávačích (dle 5.4)
- [ ] Nová recenze na Google → odpovědět

## 8.3 Čtvrtletní

- [ ] `/seo audit https://umustku.cz` — kompletní audit přes claude-seo skill
- [ ] Přidat 3–5 nových stránek obsahu (další výlety, sezónní články)
- [ ] Aktualizovat ceník a `lastmod` v sitemap
- [ ] Zkontrolovat, co dělá konkurence (`/seo competitor-pages`)

---

# SHRNUTÍ POŘADÍ

Nedělej to na přeskáčku. Pořadí má logiku — každá fáze staví na předchozí.

```
0. Přístupy (GSC, GBP)              ← bez toho nevidíš, co děláš
        ↓
1. Migrace + doména                 ← nejdřív nesmíš ztratit, co už máš
        ↓
2. Technický základ                 ← schema, canonical, sitemap, robots
        ↓
3. Nové stránky                     ← teprve teď je kam psát texty
        ↓
4. Copywriting                      ← přepis všech textů
        ↓
5. AI / GEO                         ← nadstavba nad hotovými texty
        ↓
6. Lokální SEO                      ← paralelně, nezávisí na webu
        ↓
7. Rychlost a přístupnost           ← finální leštění
        ↓
8. Měření                           ← navždy
```

**Fáze 6 (lokální SEO) můžeš dělat kdykoliv paralelně** — Google Business Profile a sbírání recenzí nezávisí na webu a trvá to nejdéle, tak s tím začni brzy.

---

## Odhad času

| Fáze | Náročnost | Kdo |
|---|---|---|
| 0 — Přístupy | 1–2 dny (čekání na klienta) | ty + klient |
| 1 — Migrace | 2–4 hodiny | Antigravity + kontrola |
| 2 — Technický základ | 4–6 hodin | Antigravity |
| 3 — Nové stránky | 2–3 dny | Antigravity + kontrola designu |
| 4 — Copywriting | 3–5 dní | Claude píše, ty schvaluješ |
| 5 — AI / GEO | 1 den | součást fáze 4 |
| 6 — Lokální SEO | průběžně, 3–6 měsíců | ty + klient |
| 7 — Rychlost | 1 den | Antigravity |
| 8 — Měření | průběžně | ty |

První viditelné výsledky v GSC: **4–8 týdnů po nasazení**. Plný efekt: **3–6 měsíců.**

---

# CO BYLO HOTOVO

## 31. 7. 2026 — Fáze 1.1 + celá Fáze 2

**Opravené soubory:**

- `public/_redirects` — přepsán. Query parametry přesunuty za mezeru (Netlify syntaxe), doplněna přesměrování pro `stranka=novinky`, `stranka=kniha`, `stranka=mapy` a `/de/*`, přidáno 301 z `.html` variant na hezké URL. **Odstraněn catch-all `/*  /index.html  200`**, který způsoboval soft 404.
- Všech 7 HTML stránek — v `<head>`:
  - přidán `<link rel="canonical">` s absolutní URL
  - smazána `<meta name="keywords">` (byla identická na všech stránkách)
  - `og:image` převedena na absolutní URL a **každá stránka má vlastní obrázek**
  - doplněno `og:url`, `og:locale`, `og:site_name`
  - doplněny Twitter Card tagy
- Oprava spojených slov `zasloužený<br>odpočinek` → `zasloužený <br>odpočinek` ve všech 7 souborech (parsery text bez mezery slučovaly).

**Nové soubory:**

- `public/robots.txt` — s odkazem na sitemap, AI crawlery záměrně povolené
- `public/sitemap.xml` — 7 URL s prioritami a changefreq
- `public/llms.txt` — kompletní strukturovaný přehled hotelu pro AI vyhledávače (ceník, vybavení, vzdálenosti, doprava, bezbariérovost, zimní uzavírka)
- `public/404.html` — chybová stránka v designu webu, `noindex`, odkazy na hlavní sekce

**Strukturovaná data (JSON-LD):**

| Stránka | Schema typy |
|---|---|
| index.html | `Hotel` |
| ubytovani.html | `Hotel`, `BreadcrumbList`, 2× `HotelRoom` + `Offer` |
| stravovani.html | `Hotel`, `BreadcrumbList` |
| akce.html | `Hotel`, `BreadcrumbList` |
| okoli.html | `Hotel`, `BreadcrumbList`, `FAQPage` (3 otázky) |
| kontakt.html | `Hotel`, `BreadcrumbList` |
| aktuality.html | `Hotel`, `BreadcrumbList` |

`Hotel` schema obsahuje adresu, GPS, telefon, e-mail, cenové rozpětí, 12 pokojů, zákaz kouření, psi vítáni, check-in/out, zakladatele (Bellingerovi, 2015) a 23 položek `amenityFeature`.

**Záměrně NEPŘIDÁNO:** `AggregateRating`. Google vyžaduje, aby agregované hodnocení pocházelo z doložitelného zdroje. Recenze v knize návštěv se nepočítají. Přidat až po nasbírání Google recenzí (Fáze 6).

## Co zbývá ověřit po nasazení na doménu

- [ ] Rich Results Test na všech 7 stránkách — 0 chyb
- [ ] Otestovat každou starou URL `umustku.cz/cz/index.php?stranka=...`, že skutečně skočí na novou
- [ ] Ověřit, že `umustku.cz/nesmysl` vrací **404**, ne homepage
- [ ] Odeslat `sitemap.xml` v Search Console
- [ ] Zkontrolovat `umustku.cz/robots.txt` a `umustku.cz/llms.txt` v prohlížeči

## Otevřené rozhodnutí

**Název hotelu není konzistentní.** Nový web používá „Hotel u Můstku", starý web a všechny recenze „Hotel U Můstků". Do schema jsem dal `name: "Hotel u Můstku"` (podle aktuálního webu) a `alternateName: "Hotel U Můstků"`, ale je potřeba se s klientem rozhodnout pro jeden tvar a sjednotit ho **všude** — web, Google Business Profile, Booking.com, Firmy.cz, Mapy.cz.

Poznámka: „U Můstků" (množné číslo) odkazuje na skokanské můstky, po kterých je hotel pojmenovaný. „u Můstku" (jednotné) by znamenalo „u mostu".
