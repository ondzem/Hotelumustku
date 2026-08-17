# Hotel u Můstků — web a rezervační systém

Web hotelu v Desné v Jizerských horách. Prezentace, rezervační formulář
a recepční portál pro obsluhu rezervací. Cílová doména `umustku.cz`,
zatím běží na Netlify. Komunikace s uživatelem probíhá **česky**.

---

## Technika v kostce

- **Vite**, vícestránkový statický build. Žádný framework — čisté HTML,
  CSS a vanilla JS. 15 stránek, každá má vlastní `.html` v kořeni
  a je uvedená v `vite.config.js` → `build.rollupOptions.input`.
- **Supabase** — databáze (rezervace, recenze, ceník, blokace termínů).
  Projekt `okgbsclaenbxfvxrbjgm`. Přístup přes veřejný anon klíč.
- **Netlify** — hosting a serverová funkce pro e-maily.
- **Resend** — odesílání e-mailů, výhradně přes serverovou funkci.

```
index.html, ubytovani.html, …   statické stránky (15×)
src/main.js                     ~6300 řádků: šablony, aktivity, přepínání sezóny
src/style.css                   ~13900 řádků
src/booking.css                 kalendář a rezervační formulář
src/components/
  BookingSystem.js              rezervační formulář, dostupnost, výpočet ceny
  AdminDashboard.js             recepční portál
  AdminCenik.js                 okno Ceník v administraci
src/lib/supabaseClient.js       databáze + záloha do localStorage
src/utils/
  cenik.js                      čistá matematika ceníku (bez sítě a DOM)
  pricing.js                    výpočet celé rezervace
  emailService.js               volá serverovou funkci
netlify/functions/send-email.js odesílání e-mailů (běží na serveru)
supabase-*.sql                  migrace, spouští se ručně v SQL Editoru
```

---

## Sedm věcí, které z kódu nepoznáš

### 1. Statické HTML a JS šablony se musí shodovat

Každá stránka existuje **dvakrát**: jako statické HTML (první načtení,
kvůli rychlosti a SEO) a jako šablona v `src/main.js` (vykreslí se při
přechodu mezi stránkami uvnitř webu). Rozhoduje o tom `isPreRenderedMatch`.

**Když upravíš jedno a zapomeneš druhé, chyba se projeví až po prokliku
z jiné stránky.** Tohle byl zdaleka nejčastější zdroj problémů —
zmizelé galerie pokojů, rozbitý navbar, staré názvy.

Po každé změně hlavičky, patičky nebo obsahu sekce, která je v obou:

```bash
# hlavička musí být na všech stránkách i v šabloně stejná
for f in *.html; do
  [ "$f" = "admin.html" ] && continue
  diff <(sed -n '/<header class="site-header">/,/<\/header>/p' index.html) \
       <(sed -n '/<header class="site-header">/,/<\/header>/p' "$f") \
    > /dev/null || echo "LIŠÍ SE: $f"
done
```

Jediná známá a **správná** odchylka: v `ubytovani.html` míří tlačítko
Rezervovat pobyt na `/ubytovani#rezervace`, jinde na `/#rezervace`.
Obojí funguje — směrování dává hashi `#rezervace` přednost před cestou,
takže rezervace naskočí tak jako tak. Neslaďuj to, aniž bys věděl proč.

`admin.html` hlavičku nemá vůbec, proto je z kontroly vynechaný.

### 2. `date_to` je vždy VÝLUČNÉ

U rezervací i blokovaných termínů je `date_to` **první den, který už
není obsazený** — den odjezdu. Čte se pravidlem:

```js
datum >= date_from && datum < date_to
```

Blokace 10.–12. srpna se ukládá jako `date_from: 2026-08-10`,
`date_to: 2026-08-13`. Jednodenní blokace 16. srpna jako `16 → 17`.

Kdo to poplete, zablokuje o den méně a jednodenní blokace neudělá vůbec
nic. Přesně tahle chyba tu už jednou byla.

V administraci se obsluze zobrazuje rozsah **včetně** posledního dne
(funkce `zobrazRozsahBlokace`), aby to dávalo lidský smysl.

### 3. `npm run build` neběží v Linuxu

Vite používá `rolldown`, jehož nativní binárka je jen pro macOS. V
kontejneru nebo na Linuxu build spadne. Ověřuj změny přes `npm run dev`
a v prohlížeči; finální build spouští uživatel u sebe.

### 4. Ceny se počítají za osobu a noc, ne za pokoj

Cena klesá s počtem lidí na pokoji — přesně podle ceníku hotelu:

| Kategorie | 1 osoba | 2 osoby | 3 osoby | 4 osoby |
|---|---|---|---|---|
| Standard | 890 | 740 | 720 | 700 |
| Nadstandard | 1780 | 890 | 890 | 890 |

U nadstandardu není 1780 chyba: sólo host platí celý pokoj.

Každá noc se oceňuje **zvlášť** — sama si najde svou sezónu a pozná,
jestli je víkend. Pobyt přes přelom sezóny se tím rozpočítá sám.

Pořadí hledání ceny, první vyplněná hodnota vyhrává:

1. výjimka pro konkrétní pokoj v nalezené sezóně
2. cena kategorie v nalezené sezóně
3. výjimka pro pokoj v základní sezóně
4. cena kategorie v základní sezóně
5. `VYCHOZI_CENY` v `src/utils/cenik.js`

Prázdná buňka v sezóně tedy znamená „použij základní ceník".

**Víkendový příplatek (pá, so, ne)** se řídí kategorií pokoje, ne
sezónou: standard i turistický +60 Kč, nadstandard +100 Kč / osoba / noc.
Nastavuje se v Příplatcích (`cenik_nastaveni`: `vikend_standard`,
`vikend_nadstandard`). Starý sloupec `cenik_sezony.vikendovy_priplatek`
v databázi zůstal, ale výpočet ho už nečte.

**Příplatek za sólo obsazení se nepřipočítává.** Sloupec „1 osoba" už ho
obsahuje — kdyby se přidal zvlášť, počítal by se dvakrát. Příplatek za
pobyt na jednu noc (+200 / osoba) platí dál.

Sezóny s datem `MM-DD` platí každý rok a smí přecházet přes Nový rok
(zima `11-01` → `04-15`). Sezóny s celým datem `YYYY-MM-DD` jsou
jednorázové a mají přednost.

### 5. Klíče nesmí do prohlížeče

Resend API klíč byl kdysi natvrdo v `src/utils/emailService.js` a skončil
v `dist/assets/main-*.js`, tedy u každého návštěvníka. Teď e-maily
odesílá `netlify/functions/send-email.js` a klíč se čte
z `process.env.RESEND_API_KEY`.

Do klientského kódu smí jen proměnné s předponou `VITE_`. Cokoli
citlivého musí být bez ní — Vite to pak do balíčku nezabalí.

Když přidáš nový typ e-mailu, dopiš ho do `POVOLENE_TYPY` v serverové
funkci. Jinak ho odmítne se stavem 400.

Lokálně e-maily fungují díky middleware ve `vite.config.js`, který
naslouchá na `/.netlify/functions/send-email` a volá tutéž funkci.

### 6. Nic těžkého do Supabase Storage

Úvodní video bylo na Supabase Storage, mělo 36 MB a servírovalo se bez
cachování — každé načtení stránky znamenalo nové stažení. Zhruba 460
návštěv vyčerpalo měsíční limit 5 GB a Supabase **zamkl celý projekt**:
rezervace, administrace i ceník začaly vracet chybu 402.

Video je teď v `public/hotel_hero_video.mp4` (4,7 MB, 1080p, 2,4 Mbit/s,
bez zvuku, faststart) a servíruje ho Netlify.

Statické soubory patří do `public/`. Supabase je na data, ne na média.

Pozn.: dashboard Supabase funguje i při zamčeném projektu, protože jde
do Postgresu napřímo. Zamčené je jen veřejné API, tedy to, co používá
web. Snadno to svede z cesty při hledání příčiny.

### 6b. Aktuality se do HTML nezapisují

Seznam aktualit na `aktuality.html` byl kdysi zapsaný natvrdo. Po
smazání v administraci na webu zůstal viset — a protože `isPreRenderedMatch`
u předrenderované stránky přeskočil načítání, návštěvník po obnovení
stránky viděl novinky, které už neexistovaly, zatímco při prokliku
zevnitř webu viděl ty správné.

Do `#news-main-inner-container` teď patří jen načítací stav; obsah plní
vždy `nactiAktualityDoStranky()` z tabulky `aktuality`.

Další věci, které tu byly rozbité a stojí za hlídání:

- Řadit se musí podle `updated_at` **a při shodě podle `id`**. Bez
  druhého kritéria vracel Postgres stejné časy pokaždé v jiném pořadí.
- Datum na kartě je `created_at`, ne `updated_at`. To druhé se mění při
  každé opravě překlepu a hýbe s ním i přesouvání aktualit.
- Fotky patří do koše `aktuality-images` (viz
  `supabase-aktuality-uloziste.sql`). Když koš chybí, nahrání selže —
  administrace dřív fotku tiše uložila jako base64 do `image_url` a
  hlásila úspěch.
- **Fotku nahrává server, ne prohlížeč.** Koš je veřejný jen pro čtení;
  zápis anonymním klíčem schválně povolený není, protože ten klíč je
  vidět ve zdrojáku stránky a kdokoli by mohl fotky nahrávat i mazat.
  Nahrávání jde přes `netlify/functions/upload-news-image.js` servisním
  klíčem (`SUPABASE_SERVICE_ROLE_KEY`, bez předpony `VITE_`). Lokálně to
  funguje díky middleware ve `vite.config.js`, stejně jako u e-mailů.
- Oznamovací banner se vkládá do `document.body` funkcí
  `vlozOznameniDoStranky()`, ne do šablony patičky: načítá se až po
  vykreslení a na statických stránkách by chyběl úplně.

### 7. Migrace se spouštějí ručně

SQL soubory v kořeni pouští uživatel v Supabase → SQL Editor. Píšou se
tak, aby šly spustit **opakovaně** (`IF NOT EXISTS`, `ON CONFLICT`).

- `supabase-archiv.sql` — archiv rezervací a zimní parkování
- `supabase-cenik.sql` — sezóny, ceny, výjimky, příplatky
- `supabase-cenik-UKLID.sql` — vrátí zpět změny z předchozího

**SQL si otestuj, než ho pošleš dál.** V sandboxu na to funguje PGlite,
což je opravdový PostgreSQL ve WASM:

```bash
mkdir -p /tmp/pgtest && cd /tmp/pgtest
npm init -y && npm install @electric-sql/pglite
# pak přes db.exec(sql) prohnat celý soubor, včetně druhého spuštění
```

Dva známé zákopy, na které tu už došlo:

- V `ON CONFLICT … DO UPDATE SET` se cílová tabulka **nesmí** psát
  s názvem schématu. `public.room_prices.sloupec` skončí chybou 42P01,
  která tvrdí, že tabulka neexistuje.
- `array_agg(attname)` vrací `name[]`, ne `text[]`. Porovnání
  s `ARRAY['…']` spadne na 42883.

Po migraci si Supabase drží mezipaměť schématu a nová tabulka nemusí být
přes API hned vidět (`PGRST205`). Pomůže `NOTIFY pgrst, 'reload schema';`,
a když ne, restart projektu v Settings → General.

---

## Ceník v administraci

Okno používá recepční, kterému je kolem šedesáti. Pravidla, která se tu
osvědčila a nemají se rozvolňovat:

- **Jedna úloha na obrazovku, jedno tlačítko Uložit.** Uloží vše, co je
  na obrazovce vidět. Nikdy nepřidávej druhé ukládací tlačítko — dřív
  jich bylo pět a šlo tiše přijít o půlku změn.
- **Termín období a jeho ceny patří na tutéž obrazovku.** Byly zvlášť a
  uživatel musel překlikávat mezi dvěma místy o téže věci.
- **Okno se otevírá okamžitě**, data dotékají potom (`oknoNacita()`).
  Nečekej na databázi před prvním vykreslením.
- **Pole navíc se skrývají, dokud nedávají smysl** — priorita se ukáže,
  teprve když se období opravdu překrývají.
- **Odchod s rozepsanými změnami se ptá** (`ad.cenikZmeneno`).
- **Uvnitř okna smí rolovat jen `.cenik-obsah`.** Vnořené scrollovací
  rámečky znamenají, že uživatel nevidí, že seznam pokračuje.
- Rozbalovátka přepínej v DOM, ne přes `ad.render()` — překreslení
  odroluje okno nahoru a uživatel neví, kam obsah zmizel.

---

## Zavírání provozu — tři nástroje, každý na něco jiného

Nepřidávej čtvrtý. Padly už dva pokusy postavit vedle nich další
„nedostupnost", oba skončily jako duplicita:

- **📅 Blokovat termíny** (`blocked_dates`) — konkrétní pokoj na rozsah
  dnů. Tohle je nástroj na dovolenou, uzávěrku i rezervaci z Booking.com.
- **🔒 Blokování pokojů** (`disabled_rooms`) — pokoj mimo provoz natrvalo,
  bez ohledu na datum. Takhle jsou vyřazené turistické pokoje.
- **Mezisezóna** — jen věta v rezervačním formuláři, že bývá užší
  nabídka. Nic neblokuje, pozná se podle názvu období
  (`maOmezenouDostupnost` v `cenik.js`).

---

## Databáze

Tabulky: `reservations`, `blocked_dates`, `room_prices`, `disabled_rooms`,
`discount_codes`, `aktuality`, `reviews`, `contact_messages`,
`cenik_sezony`, `cenik_ceny`, `cenik_ceny_pokoj`, `cenik_nastaveni`.

Zdrojem pravdy je Supabase, `localStorage` slouží jako záloha pro případ
výpadku. Vzor: `getStored*()` čte zálohu, `fetch*()` načte z databáze
a zálohu přepíše. Rezervační formulář tak ukáže ceny i offline.

`ALLOWED_SUPABASE_COLUMNS` v `supabaseClient.js` filtruje, co se posílá
do tabulky `reservations`. Nový sloupec je potřeba dopsat i sem, jinak
se zápis tiše zahodí.

### Kudy tečou změny z ceníku na web

| Co admin změní | Tabulka | Kde se to musí projevit |
|---|---|---|
| Ceny za osobu a noc | `cenik_ceny` | rezervace (výpočet), karty pokojů „od …" |
| Výjimka pro pokoj | `cenik_ceny_pokoj` | rezervace (výpočet) |
| Období a termíny | `cenik_sezony` | rezervace (která sazba platí), upozornění na mezisezónu |
| Příplatky | `cenik_nastaveni` | rezervace — **popisek i výpočet** |
| Název pokoje, lůžka | `room_prices` | rezervace (seznam, kapacita), karty pokojů, ubytovani.html |

Dvě věci, které se tu už rozešly a stojí za kontrolu po každé změně:

- **Procenta zálohy taky ne.** „30 %" a „70 %" byly natvrdo v e-mailech,
  v tisku i v administraci, zatímco částka se počítala z ceníku. Po
  změně na 40 % by e-mail psal 30 % a účtoval 40 %. Živé výpočty berou
  `pricing.depositPercentage`, u **už uložených** rezervací se procento
  dopočítá ze zapsaných částek (`procentoZalohy()` v `pricing.js`) —
  jinak by změna nastavení zpětně přepsala popisky u starých rezervací.
- **Pobyt na jednu noc se nepřijímá.** Rezervační formulář vyžaduje
  minimálně dvě noci (`hasValidDates()`), takže příplatek za jednu noc
  byl odstraněn z ceníku i z výpočtu — nemohl by nikdy nastat.
- **Popisky částek nesmí být napsané natvrdo.** V rezervačním formuláři
  byly v textech čísla („+195 Kč / osoba / noc"), zatímco výpočet bral
  hodnotu z databáze. Po změně v administraci formulář sliboval starou
  cenu a účtoval novou. Vše teď jde přes `this.castka(klic)`
  v `BookingSystem.js` — nikdy tam nepiš číslo ručně.
- **Veřejný web musí pokoje načíst z databáze, ne jen ze zálohy.**
  Názvy a lůžka se braly jen z `localStorage`, takže první návštěvník
  viděl napevno zapsané názvy z `MOCK_ROOMS` a cenu „od" spočítanou pro
  dvoulůžkový pokoj. Řeší to `fetchRoomPrices()` volané v `main.js`
  spolu s `fetchCenik()`; po doběhnutí se pouští obě `sync*ToDOM` funkce.

**Do `room_prices` se nesmí psát upsertem.** Tabulka drží ještě sloupce
ze starého cenového modelu — `base_price`, `weekday_price`,
`weekend_price` — a `base_price` je NOT NULL bez výchozí hodnoty.
PostgREST posílá upsert jako `INSERT … ON CONFLICT`, takže Postgres
kontroluje povinné sloupce i u řádku, který se ve skutečnosti jen
aktualizuje, a zápis spadne na `23502 null value in column "base_price"`.
Přesně na tohle doplatilo ukládání pokojů v ceníku: tlačítko hlásilo
chybu, ale nikdo si toho nevšiml, protože data v paměti vypadala uložená.
Existující řádek se proto mění přes `update()` (viz `ulozPokoje()`
v `AdminCenik.js`), `insert()` se použije jen pro pokoj, který v tabulce
ještě není, a staré sloupce se doplní z `MOCK_ROOMS`.

---

## Jak si ověřit, že to funguje

Nespoléhej na to, že změna vypadá správně v kódu. Osvědčené postupy:

- **Responzivita** — vlož do stránky iframe s pevnou šířkou a měř
  v něm. Media queries pak reagují na jeho šířku, ne na okno prohlížeče.
- **Animace a IntersectionObserver** — v záložce na pozadí prohlížeč
  vše zmrazí. Měření z neaktivní záložky nic neznamená.
- **Změny v databázi** — zapiš testovací data, ověř chování, ukliď po
  sobě a potvrď návrat do původního stavu.
- **Matematika ceníku** — `src/utils/cenik.js` je čistý modul, dá se
  spustit v Node a protestovat bez prohlížeče.

---

## Nedodělky

- ~~**Kapacita pokojů.**~~ Potvrzeno majitelem a zadáno 16. 8. 2026.
  Stálá lůžka: Pokoj 1, 7, 10, 11, 12 → 3; Pokoj 2 → 4; Mahagon, Motýl,
  Zen → 2. Přistýlky jsou dopočítané tak, aby se všude došlo na 4 osoby.
  Turistické pokoje (4, 5, 6) zůstaly na 2 — jsou vyřazené z provozu.
- ~~**Ceník naživo neověřený.**~~ Ověřeno 16. 8. 2026 v prohlížeči:
  migrace v databázi proběhla (základní ceník + letní a zimní sezóna),
  uložení cen i termínu sezóny se propíše do Supabase a zkušební výpočet
  z něj počítá správně. Testovací data byla vrácena do původního stavu.
- **Video na mobilu.** Stahuje se i tam. Nabízí se ukázat na mobilu jen
  fotku a video nespouštět. Vyžaduje zásah do `preload`/`autoplay`,
  takže se to musí ověřit v prohlížeči.
- **Texty v `podminky.html`** obsahují údaje, které nikdo nepotvrdil
  (mimo jiné kamery u parkoviště). Majitel je má projít.
- **Zrušit přístupový token** `sbp_…`, který byl kdysi vložený do chatu.
  Supabase → Account → Access Tokens.
- **Spuštění domény.** Po přepnutí na `umustku.cz` odeslat sitemapu
  a požádat o indexaci.

---

## Zvyklosti

- **Odpovídej maximálně stručně.** Stačí výsledek — „Hotovo, upravil jsem X."
  Žádné shrnutí postupu, tabulky, seznamy provedených kroků ani opakování
  zadání. Default 1–3 věty. Delší odpověď jen na dotaz „proč / jak to
  funguje" nebo když uživatel potřebuje víc kroků k provedení. Práci tím
  neodbývej — dělá se celá a pořádně, jen se o ní nepíše slohovka.
- Komentáře a názvy nových proměnných česky, tak jako ve zbytku projektu.
- Komentář má vysvětlovat **proč**, ne co je z kódu vidět. Zvlášť
  u míst, kde předchozí zjevné řešení nefungovalo.
- `AdminDashboard.js` má přes 3100 řádků. Novou větší funkci raději do
  vlastního souboru — jako `AdminCenik.js`.
- Barvy: zelená `#697947`, tmavá `#1c1c19`, krémová `#ece8dd`.
- Ceny se formátují přes `formatCzechPrice()`, datumy přes
  `formatCzechDateStr()`.
