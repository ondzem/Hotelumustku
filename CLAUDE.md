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

Z výlučnosti plyne i to, že **v plně obsazený den se ještě smí odjet** —
poslední noc se spí den předtím. Rezervační kalendář proto první obsazený
den za příjezdem nabízí jako den odjezdu (`je-jen-odjezd`, šrafovaně).
Jen ten první: na další by se muselo přespat plnou noc. Než se to opravilo
18. 8. 2026, `isDisabled = isPast || jePlne` zakazoval kliknout na cokoli
obsazeného, takže na okraji každé blokace padala jinak platná rezervace.

**V Dostupnosti znamená tentýž vybraný rozsah u každého tlačítka něco
jiného.** Klepnutí na 24. a 30. je u „Zapsat rezervaci" příjezd 24.
a odjezd 30., tedy noci 24.–29. U „Zablokovat termín" je to ale požadavek
zavřít 24. **až 30. včetně** — obsluha vybírá dny, ne pobyt. Blokace proto
ukládá `date_to = posunDatum(p.doo, 1)`. Konvence z oddílu 2 platí dál,
`date_to` je pořád výlučné; liší se jen to, co si pod vybraným rozsahem
představuje člověk. Aby to nemátlo, je pod tlačítky věta, která oba
výklady vypíše čísly. Nesjednocuj to na jeden výklad — 18. 8. 2026 se
ukázalo, že blokace končila o den dřív, než majitel čekal.

**Minulé dny v kalendáři nedostávají barvu obsazenosti.** Růžová a žlutá
v už proběhlém týdnu vypadaly jako rozbité vykreslení a vedly k hlášení,
že „na volný den nejde kliknout" — přitom šlo prostě o včerejšek. Veřejný
kalendář minulost jen zešedne, administrace ji ztlumí na 70 % a má na to
položku v legendě („Už proběhlo"), protože majitel se do minulosti dívá
schválně.

### 3. Build na Netlify stojí na `netlify.toml`

Nastavení buildu je schválně v `netlify.toml` v repozitáři, ne jen
v Netlify. Při přepojení repozitáře 17. 8. 2026 se totiž v jejich
rozhraní vymazal build příkaz i publikovaná složka a Netlify publikoval
**nesestavený repozitář** — web odkazoval na `/src/main.js`, který na
produkci neexistuje, a stránky byly rozbité. Soubor v repozitáři tohle
přežije, nastavení v rozhraní ne.

Build na jejich Linuxu proběhne v pořádku — `package-lock.json` obsahuje
i linuxové binárky rolldownu. (Dřívější poznámka, že build mimo macOS
spadne, už neplatí.)

Nasadit ručně, bez čekání na Netlify, jde přes `./nasadit.sh` — pushne
na GitHub, sestaví web lokálně a nahraje hotový `dist` i funkce.

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

**Zimní parkování je JEDNORÁZOVÉ za pobyt, ne za noc.** Je to příspěvek
na zimní údržbu příjezdové cesty a ta se nedělá znovu každou noc; majitel
to tak určil 22. 8. 2026 (100 Kč / auto). Do té doby se násobilo počtem
nocí, takže týdenní pobyt platil sedminásobek. Násobí se jen počtem aut.
Hlídá to `kontrola/rezervace.mjs`. Pes a elektrokolo se za noc počítají
dál — pozor na to při úpravách, jsou hned vedle v témže výpočtu.

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
- **Oznamovací banner v boční záložce byl zrušen** (18. 8. 2026). Majitel
  ho nikdy nechtěl — aktuality patří výhradně na stránku Aktuality.
  Odstraněno z `main.js` (`activeBannerCache`, `refreshActiveBanner`,
  `vlozOznameniDoStranky`, `initOznameni`, `getTopAnnouncementBarHTML`),
  z formuláře v `AdminDashboard.js`, z ukládání v `supabaseClient.js`
  i 22 pravidel ze `style.css`. Sloupce `is_banner` a `banner_text`
  v tabulce `aktuality` zůstaly, jen se nepoužívají. Nevracej to.

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

## Hero video se nenačítalo — dvě příčiny

Majitel hlásil, že video na úvodní stránce nejede. Nebyla to jedna chyba,
ale dvě, a každá sama o sobě stačila:

- **Video leží v KOŘENI jako `/hotel_hero_video.mp4`.** Pravidla
  v `public/_headers` cachovala `/videos/*` a `/*.webp`, ale `.mp4`
  v kořeni nechytla — Netlify ho servíroval s `max-age=0,
  must-revalidate`, takže se **5 MB stahovalo při každé návštěvě znovu**.
  Přibylo proto pravidlo `/*.mp4`.
- **Odhad rychlosti sítě blokoval video i tam, kde neměl.** Prohlížeč
  hlásí `effectiveType: 3g` i na optice a na běžném mobilním připojení,
  dokud si rychlost nepřeměří — video se kvůli tomu nepouštělo ani na
  počítači, ani na telefonu. Teď na `3g` nebere ohled vůbec; vypíná ho
  jen úsporný režim (`saveData`) a `2g` / `slow-2g`.

**Na mobilu jde lehčí verze videa.** `hotel_hero_video_mobil.mp4`
(854 px, 1,4 MB proti 4,8 MB) přes `data-src-mobil` na `<source>`;
vybírá se v `spustHeroVideo()` podle šířky pod 768 px. Dřív se na
telefonu video nepouštělo vůbec, protože plná verze ubírala pásmo
dotazům do databáze a obsazenost v kalendáři naskakovala se zpožděním.
S lehkou verzí to platit přestalo. Vyrábí se takhle:

```bash
ffmpeg -i public/hotel_hero_video.mp4 -vf scale=854:-2 -c:v libx264 \
  -crf 30 -preset slow -profile:v main -an -movflags +faststart \
  public/hotel_hero_video_mobil.mp4
```

Adresa musí být na **třech** místech naráz — `index.html` a dvě šablony
v `main.js` (letní hero a přepnutí sezóny).

Že video chybí, není vidět jako díra — pod ním je hero fotka, takže
stránka vypadá v pořádku a chyba se hlásí špatně („občas to nejede").

## Svátky, Silvestr a zimní přestávka

Dvě období, která se opakují **každý rok** a řídí se jen dnem a měsícem.
Veškerá logika je v `src/utils/terminy.js` (čistý modul, testuje ho
`kontrola/terminy.mjs`); nikde jinde se ta data nepíšou ručně.

| Období | Rozsah | Co dělá |
|---|---|---|
| Svátky | 26. 12. – 2. 1. | nejkratší pobyt **3 noci** místo dvou |
| Zimní přestávka | 5. 10. – 25. 12. | hotel bývá zavřený, po domluvě se otevře |

Pět věcí, které nejsou z kódu vidět:

- **Svátky přecházejí přes Nový rok, takže se rozsah testuje obráceně.**
  `12-26` je větší než `01-02`, takže obvyklé `mmdd >= od && mmdd <= doo`
  vrátí u celého období nepravdu a 31. 12. by nepatřilo nikam. Hlídá to
  `vRozsahuMM_DD`, kde se při přetočeném rozsahu přepíná na „nebo".
- **Prochází se NOCI pobytu, ne krajní dny.** Noc patří ke dni příjezdu,
  takže se jde od `date_from` po `date_to` bez posledního dne. Pobyt
  23. → 26. 12. tedy do svátků nezasahuje (poslední noc je 25.) a odjezd
  31. 12. neznamená, že host stráví Silvestr v hotelu.
- **Minimum se počítá z DNE PŘÍJEZDU, ne z celého pobytu.** Kdyby se
  ptalo na celý pobyt, host by uvízl v kruhu: vybere dvě noci, systém
  řekne „potřebujete tři", on přidá noc — a teprve tím se do svátků
  dostane. Takhle pravidlo platí od prvního kliknutí.
- **Upozornění na zimní přestávku visí na ZOBRAZENÉM MĚSÍCI, ne na
  výběru.** Zavřené dny má majitel zablokované, takže jsou plné a nedají
  se rozkliknout — podle výběru by se hláška nikdy neukázala a host by
  koukal na červený říjen bez vysvětlení. `mesicZasahujeMimoProvoz()` ji
  proto zobrazí ve chvíli, kdy si ten měsíc otevře.
- **Silvestrovská hláška slibuje ubytování, ne program.** Majitel do
  silvestrovského večera předem investuje (kapela, výzdoba) a při pěti
  hostech se mu nevyplatí. Věta proto říká, že program chystají jen při
  dostatečném počtu hostů a dají vědět při potvrzení — ubytování je
  jisté tak jako tak. Není to podmínka ani varování a nesmí se to
  přepsat na příslib.

**Na formulaci zavíracího období záleží víc než na kódu.** Holé „máme
zavřeno" čte host jako „tomu hotelu se nechce" — a to majiteli ubližuje
u člověka, který web vidí poprvé. Text proto pojmenuje důvod, který je
v horách samozřejmý (je po podzimu, sníh ještě nedorazil), a ukáže, že
se ten čas využívá na údržbu; zavření je pak vidět jako péče o hotel.
Poslední věta nechává dveře otevřené, protože při větší skupině se
otevřít vyplatí. Tenhle blok má vlastní tvar (`.booking-mimo-sezonu`)
— štítek, nadpis, dva odstavce a telefon — protože na rozdíl od
ostatních dvou poznámek nemá jen informovat, ale uklidnit.

Vzhled: všechna tři sdělení sdílejí `.booking-poznamka` (oddíl „POZNÁMKY
V REZERVAČNÍM FORMULÁŘI" v `booking.css`) — tenký svislý proužek, znak
místo ikony, žádná sytá výplň. Liší se jen barvou proužku: svátky
modrozelená, Silvestr tlumené zlato, zavřeno cihlová. **Nesmí to
vypadat jako sleva ani jako chyba** — je to informace. 31. 12. má
v kalendáři zlatý prstenec (`.cal-day.je-silvestr::after`), ne výplň;
tu si drží obsazenost a vybraný termín.

## Zavírání provozu — tři způsoby, jedno okno

Nepřidávej čtvrtý způsob. Padly už dva pokusy postavit vedle nich další
„nedostupnost", oba skončily jako duplicita:

- **`blocked_dates`** — konkrétní pokoj (nebo celý hotel) na rozsah dnů.
  Nástroj na dovolenou, uzávěrku i rezervaci z Booking.com.
- **`disabled_rooms`** — pokoj mimo provoz natrvalo, bez ohledu na datum.
  Takhle jsou vyřazené turistické pokoje. Ovládá se přes **🔒 Blokování
  pokojů**.
- **Mezisezóna** — jen věta v rezervačním formuláři, že bývá užší
  nabídka. Nic neblokuje, pozná se podle názvu období
  (`maOmezenouDostupnost` v `cenik.js`).

**Do `blocked_dates` se zapisuje jen z 📆 Dostupnost a blokace**
(`AdminDostupnost.js`). Dřív k tomu bylo druhé okno „📅 Blokovat termíny"
s vlastním kalendářem, vlastním seznamem blokací a vlastním rušením —
tedy dvě místa na tutéž věc. Bylo zrušeno 18. 8. 2026 a všechno, co uměla
navíc (důvod blokace s předvolbami, varování na kolizní rezervace), se
přesunulo do Dostupnosti. Ta má proti němu navíc obsazenost, takže je
vidět, co se vlastně zavírá.

Kdyby se někdy vracel samostatný kalendář na blokace, znamená to, že se
duplicita staví znovu. Spolu s oknem zmizely i `renderAdminCalendarMarkup()`
a `groupContiguousDateRanges()` v `AdminDashboard.js` — blokuje se souvislý
rozsah, ne rozklikané jednotlivé dny.

## Rezervace celého hotelu (skupinové akce)

`room_id` je jeden sloupec, takže „celý hotel" se do jednoho řádku nevejde.
Volba **🏨 Celý hotel** v ručním zápisu proto založí **rezervaci na každý
prodejný pokoj** se stejným hostem, termínem a značkou „Skupinová akce" v
poznámce. Obsazenost tím sedí všude a nemusí se nic obcházet blokací.

Tři věci, které nejsou z kódu vidět:

- **Příplatky nese první pokoj.** Polopenzi, psa, elektrokola ani parkování
  si skupina neobjednává devětkrát. Kdyby se předaly do každého výpočtu,
  sečetly by se za každý pokoj zvlášť.
- **Prázdný pokoj se počítá aspoň za jednu osobu.** Cena je za osobu a noc,
  takže nula osob by nedala žádnou sazbu. U dvaceti lidí se tak naúčtuje
  jednadvacet — formulář to říká nahlas a nabízí přepsání částky.
- **Ručně zadaná cena se rozpustí poměrně** podle ceníkových podílů
  jednotlivých pokojů, takže součet rezervací odpovídá tomu, co se skupinou
  domluvíte. Poslední pokoj dostane zbytek, aby zaokrouhlení nikam neuteklo.

## Ruční zápis rezervace — pokoj se vybírá podle dostupnosti

Výběr pokoje byl prosté `<select>` s názvy. Obsluha do něj mohla zapsat
hosta na pokoj, který už byl na tentýž termín zabraný, a systém mlčel —
majitel to našel tak, že si schválně zkusil zadat dvakrát tentýž termín
a tentýž pokoj a dostal „dostupný".

Teď je to seznam s dostupností (`renderVyberPokoje` v
`AdminRucniRezervace.js`), stavěný podle výběru pokoje na webu: název,
cena za celý pobyt, lůžka a odznak Volno / Obsazeno / Zavřeno / Mimo
provoz. Nad seznamem je souhrn „volných 8 z 9".

Čtyři věci, které nejsou z kódu vidět:

- **Rozbaluje se v toku, ne jako plovoucí panel.** Uvnitř rolovacího okna
  administrace se absolutně umístěný panel buď ořízne, nebo přeleze přes
  patičku s tlačítkem Založit rezervaci.
- **Dostupnost počítá `dostupnostPokoje()` z rezervací i blokací** —
  zavřený pokoj se prodat nesmí zrovna tak jako obsazený. Blokace celého
  hotelu (`room_id: 'all'`) platí i na jednotlivý pokoj.
- **Obsazený pokoj jde vybrat jen vědomě.** Klepnutí otevře potvrzení
  (recepční může vědět o výměně nebo o chystaném stornu) a teprve pak se
  nastaví `povolitKolizi`. Ten souhlas se **ruší při každé změně
  termínu** — jinak by přenesl kolizi, o které obsluha nikdy nevěděla.
- **Poslední kontrola je až u tlačítka Založit**, ne jen při výběru.
  Termín se dá změnit i potom, co byl pokoj vybraný jako volný.

## Hledání v seznamu rezervací

Nad záložkami stavů je políčko, které filtruje karty podle kódu, jména,
e-mailu, telefonu, města, poznámky, pokoje i termínu. Platí i v archivu —
je to tentýž seznam, jen jiná sekce.

Čtyři věci, které nejsou z kódu vidět:

- **Psaní NEPŘEKRESLUJE administraci.** `render()` vyměňuje celý DOM přes
  `innerHTML`, takže by po každém úhozu vypadl kurzor a psát by šlo jen
  po jednom písmenu. Karty se proto jen skrývají (`prefiltrujSeznamRezervaci`).
  Plné vykreslení filtruje týmž výrazem, takže po překreslení z jiného
  důvodu — třeba když doběhne načtení dat — seznam pořád sedí.
- **Porovnává se bez diakritiky** (`normalizuj`). Recepční napíše „nemec"
  a musí najít „Němec"; funguje to i obráceně. Podklad k porovnání nese
  každá karta v `data-hledat`, takže se při psaní už nic nenormalizuje.
- **Hledá se i mimo vybranou záložku a hlásí se to.** Když výraz nic
  nenajde ve vybraném stavu, ukáže se, kolik shod leží jinde, a tlačítko
  přepne tam, kde doopravdy jsou. Rozlišuje se archiv od aktivních
  (`kamSHledanim`) — archiv je vlastní sekce, ne stav, takže přepnutí na
  „Všechny" by hosta z archivu nenašlo a tlačítko by slibovalo něco, co
  neudělá.
- **Čísla v záložkách se při hledání přepočítají** na počet shod v tom
  kterém stavu a záložka bez shody se ztlumí. Původní hodnoty se drží
  v `data-celkem`, aby se po vymazání výrazu měly kam vrátit.

Na mobilu je políčko **nad** záložkami (`order: -1`): hledá se častěji než
prochází stavy. Pozor na to, že lišta filtrů je tam sloupec — `flex-basis:
100 %` z desktopu tam přestane znamenat šířku a začne znamenat výšku,
takže se políčko srazí na 24 px. Ve sloupci musí být `flex: 0 0 auto`.

## Export kontaktů a rezervací

Tlačítko **📥 Export kontaktů** stáhne CSV. Matematika je v `src/utils/
exportKontaktu.js` (čistý modul, testuje ho `kontrola/export.mjs`),
ovládání v `src/components/AdminExport.js`.

Dvě podoby výstupu, protože slouží dvěma různým věcem:

- **Adresář hostů** — jeden řádek na hosta, pobyty sečtené. Kvůli tomu to
  celé vzniklo: majitel chce občas poslat novinku. Slučuje se podle
  e-mailu malými písmeny; host bez e-mailu (zapsaný po telefonu) se
  sloučí podle jména a telefonu, aby se všichni bezmailoví neslili
  do jednoho řádku.
- **Soupis rezervací** — jeden řádek na rezervaci, s termínem a částkami.

Pět věcí, které nejsou z kódu vidět:

- **Oddělovač je STŘEDNÍK a soubor začíná značkou UTF-8 (BOM).** Excel
  v české lokalizaci čte čárku jako desetinnou značku, takže soubor
  oddělený čárkami naskládá celý řádek do jedné buňky; bez BOM přečte
  soubor v systémovém kódování a z „Němec" udělá „NÄ›mec". Tohle je
  nejčastější důvod, proč „export nefunguje". Řádky končí CRLF.
- **Hodnota začínající na `=` `+` `-` `@` dostane apostrof.** Excel by ji
  vyhodnotil jako vzorec — host podepsaný `=SUM(...)` by tak dostal kód
  do cizího počítače. U telefonů (`+420…`) to má vedlejší užitek: bez
  apostrofu z nich Excel udělá rozbitý vzorec.
- **Období se počítá buď podle data vzniku rezervace, nebo podle data
  příjezdu**, a není to jedno: „kdo si u nás objednal v posledním měsíci"
  a „kdo u nás v létě bydlel" jsou dvě různé otázky. Přepíná se to a pod
  přepínačem je věta, která říká, co která volba znamená.
- **Horní mez rozsahu je VČETNĚ**, na rozdíl od `date_to` u rezervací.
  Obsluha vybírá „od 1. do 31. srpna" a čeká, že jednatřicátý bude uvnitř.
- **Storna jsou ve výchozím stavu venku, archiv uvnitř.** Archivovaná
  rezervace je jen odklizený pobyt, kontakt platí dál; stornovaný host
  u nás nikdy nebyl.

**Export do databáze nic nezapisuje.** Čte jen to, co má administrace
načtené, a soubor sestaví v prohlížeči — žádná tabulka na uložené exporty
není a není proč ji zakládat. Kdo bude hledat, kam se exporty ukládají,
hledá zbytečně.

Pod souhrnem je věta o tom, že soubor nese osobní údaje a že obchodní
sdělení musí nést možnost odhlášení. Nemazat — je to jediné místo, kde se
to obsluze připomene.

## Administrace se ptá vlastním oknem, ne prohlížečem

`window.confirm` / `alert` / `prompt` v administraci nemají co dělat.
Nativní dialog vypadá jako hlášení prohlížeče, ne jako náš web, a Safari
na iPhonu ho navíc umí přebít vlastní hláškou „Zabránit této stránce
v otevírání dalších dialogů".

Slouží k tomu `adminPotvrzeni()` v `src/components/AdminPotvrzeni.js` —
vrací slib s `true`/`false`, takže se použije jako `await`. Věší se
přímo na `<body>`, **ne do administrace**: ta se celá překresluje přes
`innerHTML`, takže by dialog uprostřed čekání na odpověď zmizel i
s posluchači a slib by se nikdy nevyřídil.

Datová vrstva (`supabaseClient.js`) o administraci nic neví a nemá jak
zavolat toast, proto posílá `window.dispatchEvent(new CustomEvent(
'admin-hlaska', { detail: '…' }))`; `AdminDashboard.init()` to poslouchá.

Hlídá to kontrola „Dialogy" v `./zkontroluj.sh`.

## Semafor fází rezervace

Fáze se čte jako semafor a **stejná barva platí na třech místech
naráz** — odznak na kartě rezervace, barevný proužek karty a pruh
v plachtě dostupnosti. Recepční díky tomu pozná stav rovnou z přehledu
a nemusí kvůli tomu proklikávat jednotlivé karty:

| Fáze | Význam | Barva |
|---|---|---|
| 1. Ke schválení | čeká to na recepci, host nic neplatil | červená `#d64541` |
| 2. Čeká na zálohu | pokyny odešly, čekáme na peníze | oranžová `#e0a021` |
| 3. Závazně potvrzeno | záloha na účtu, pobyt platí | zelená `#3f8f4a` |
| Stornováno | mimo hru | šedá `#95a5a6` |

Paleta je v proměnných `--faze1/2/3` v `booking.css` (oddíl SEMAFOR FÁZÍ
REZERVACE). Nikde jinde se ty odstíny nepíšou natvrdo.

Dvě věci, které nejsou z kódu vidět:

- **Tlačítko nese barvu fáze, do KTERÉ posouvá, ne té, ve které stojí.**
  „Schválit & poslat QR kód" je oranžové (posouvá do 2), „Potvrdit
  přijetí zálohy" zelené (posouvá do 3). Červené tlačítko hned vedle
  tlačítka Stornovat by vypadalo jako něco nevratného.
- **Blokace zůstala červená šrafovaná.** Se rezervací ve fázi 1 ji
  nespojí právě to šrafování — a hlavně je to jiná věc než host, takže
  se nesmí splést. Legenda pod plachtou vypisuje všechny čtyři stavy.

## Plachta dostupnosti — pokoje v řádcích, dny ve sloupcích

Okno 📆 Dostupnost a blokace má **dva pohledy** a přepínají se nahoře:

- **Tabulka měsíce** (výchozí, `AdminPlachta.js`) — všech dvanáct pokojů
  pod sebou, dny měsíce ve sloupcích, rezervace a blokace jako pruhy.
- **Kalendář jednoho pokoje** — původní měsíční kalendář, který je lepší
  na otázku „které dny je volný zrovna tenhle pokoj".

Plachta vznikla na přání majitele: když s hostem telefonuje, nepotřebuje
proklikat dvanáct pokojů, ale jedním pohledem odpovědět „šestnáctého mám
volný Mahagon a Pokoj 7". Tak to dělají hotelové systémy, které zná.

Čtyři věci, které nejsou z kódu vidět:

- **Obsazenost se v plachtě NEPOČÍTÁ ZNOVU.** Bere se ze stejných funkcí
  jako kalendář (`zabranyDuvod`, `odjezdVDen`, `prijezdVDen`), které jsou
  kvůli tomu z `AdminDostupnost.js` vyexportované. Kdyby si plachta
  počítala své, byla by to druhá pravda o tomtéž — a ta se rozejde.
- **Půlený den tu není úhlopříčka, ale posun pruhu o půl buňky.** Pruh
  začíná uprostřed dne příjezdu a končí uprostřed dne odjezdu, takže
  říká totéž co šrafovaná půlka, jen to jde přečíst přes celý pobyt.
  Proto je šířka dne **pevná** (`--plachta-den`) a ne procentní: půl
  buňky se počítá `calc(var(--plachta-den) / 2)` a s procenty by ta
  polovina znamenala při každé změně okna něco jiného.
- **Blokace celého hotelu (`room_id: 'all'`) musí být v řádku každého
  pokoje.** Jinak by pokoj vypadal volný, přestože zavřený je.
- **Na okraji měsíce se půlka vypouští.** Pobyt přesahující do dalšího
  měsíce dojede až na kraj mřížky (`konOrez`), jinak by to vypadalo, že
  tam končí. Hlídá to `kontrola/plachta.mjs`.

Klepnutí do řádku pokoje vybírá termín **a zároveň přepíná pokoj**, takže
se nemusí sahat na rozbalovátko. Klepnutí na **číslo dne v záhlaví** vybere
tu jednu noc pro celý hotel — to je přesně dotaz, se kterým host volá.
Všechno pod plachtou (zápis rezervace, blokace s důvodem, upozornění na
kolizní rezervace) zůstalo beze změny.

**Na telefonu se plachta neláme do jiného tvaru.** Sloupce se zúží na
28 px, názvy pokojů jdou pod sebe („Pokoj 3" / „Mahagon") a mřížka roluje
vodorovně se zamrzlým sloupcem názvů; po otevření se sama odroluje na
dnešek. Přelámat ji na malém displeji do seznamu by znamenalo druhý způsob
čtení téhož — a právě kvůli jednomu společnému pohledu to celé vzniklo.
Pro úzký displej je od toho zkratka přes číslo dne v záhlaví.

## Půlené dny v kalendářích administrace

Úhlopříčka čte čas: **levý horní roh je ráno, pravý dolní odpoledne.**

- **Odjezdový den** (`is-turnover-day`) — padne na něj `date_to`. Do 10:00 se
  odjíždí, potom volno. Barva nahoře, bílá dole.
- **Příjezdový den** (`is-arrival-day`) — padne na něj `date_from`. Do 15:00
  je ještě volno, potom obsazeno. Bílá nahoře, barva dole.

Odjezd se hlásí jen u dne, který je jinak **volný**, příjezd jen u dne
**obsazeného** — plyne to z výlučnosti `date_to`. Když v jeden den někdo
odjíždí a hned nato jiný přijíždí, jsou obě půlky zabrané a buňka zůstane
celá; půlit ji by lhalo.

**Půlí se JEN tehdy, když je druhá polovina dne opravdu prázdná.**
Rozhoduje obsazenost obou polovin, ne počty příjezdů a odjezdů —
pravidlo je v `src/utils/obsazenost.js` (`obsazenostPulek`, `pulkyDne`)
a sdílí ho administrace i web, aby se nemohly rozejít.

Původní verze počítala přestupy a při překryvu termínů lhala:

```
blokace pokoje 1     21. → 25.   (končí 25. v 10:00)
rezervace pokoje 3   24. → 26.   (běží celý 24. i 25.)
```

25. srpna vycházel půlený, protože „někdo odjíždí a nikdo nepřijíždí".
Jenže pokoj 3 je ten den obsazený celý, takže hotel prázdný dopoledne
není a buňka má být celá. Totéž 24. srpna: blokace pokoje 1 běží celý
den, není co půlit, i když do pokoje 3 zrovna někdo přijíždí. Hlídá to
`kontrola/pulene-dny.mjs` přesně na tomhle případu.

Z téhož pravidla plyne i to, že když v jednom pokoji host odjíždí a týž
den se do něj stěhuje další, zůstane buňka celá.

Platí ve **třech** kalendářích: v Přehledu dostupnosti
(`AdminDostupnost.js`), v ručním zápisu (`AdminRucniRezervace.js`)
a od 18. 8. 2026 i ve veřejném rezervačním formuláři
(`BookingSystem.obsazenostPulekDne()`). Styl `is-turnover-day` byl
v `booking.css` napsaný už dávno, ale dlouho ho nikdo nenasadil.

**Vybraný termín přebíjí obsazenost — a to i na webu.** Půlka v barvě
obsazenosti se hostovi kreslila přes jeho vlastní den příjezdu, takže
zelená zmizela pod oranžovou a vypadalo to, že den vybraný není. Vybrané
dny proto půlené třídy nedostávají vůbec (`jeVybrany` v obou
komponentách) a celý rozsah drží zelený podklad: kraje sytěji
(`#cadbb0`), dny mezi nimi světleji (`#eef3e6`). Že se přijíždí od 15:00
a odjíždí do 10:00, říká popisek pod kalendářem a bublina u dne — na
barvu se to věšet nesmí, protože tutéž úhlopříčku používá obsazenost.

**Ve vybraném rozsahu patří podklad výběru, ne obsazenosti.** Obsluha
potřebuje vidět, kam až výběr sahá; když vyhrávala obsazenost, prostřední
den vypadal nevybraně a obsluha si myslela, že jí výběr přeskočil. Podklad
je proto zelený a obsazenost nese výrazný rámeček (červený u plného,
oranžový u částečného) a barva čísla.

## Responzivita a rozvržení — co se tu už rozbilo

- **Hlavička se láme na 820 px, zbytek mobilu na 768 px.** Mezi 769 a 820 px
  se odkazy dotýkaly loga. Pravidla hlavičky a hamburger menu jsou proto
  **přesunutá** (ne zkopírovaná) do `@media (max-width: 820px)` v `style.css`;
  ≤768 je podmnožina, takže telefon se chová stejně jako dřív. Kdo bude
  breakpoint měnit, musí hýbat celým blokem, ne jednotlivými pravidly.
- **`transform: none` ruší i vodorovné vycentrování.** Pravidlo
  v `@media (max-height: 820px)` mělo zrušit svislý posun šipky pod hero
  tlačítkem, ale shodilo i `translateX(-50%)` — šipka se o 19 px odsunula
  doprava na každém telefonu nižším než 820 px. Ruší se teď zvlášť.
- **Hero na stránce Rezervace se nesmí umisťovat natvrdo.** V `booking.css`
  bylo `top: 230px !important`, jenže sekce je vysoká `52svh`; na displeji
  667 px vysokém z ní text vytekl do bílé sekce pod ní. Obsah se sází
  flexboxem, ne absolutní pozicí.
- **Prohlížeč obnovuje scroll i mezi statickými stránkami.** Kdo si prohlédl
  patičku a pak klikl v navigaci, přistál na nové stránce zase dole. Řeší to
  `history.scrollRestoration = 'manual'` v `main.js` plus dorovnání po `load`.
- **Odrolování na sekci nesmí viset na jediném `requestAnimationFrame`.**
  Fotky dotékají postupně a cíl se pod ním posune — tlačítko „Aktivity
  v okolí" tím vypadalo jako nefunkční. Slouží k tomu `odrolujNaSekci()`,
  která pozici přepočítá několikrát a naposledy po `load`; jakmile uživatel
  sám zaroluje, přestane.

- **Přechod mezi stránkami musí sám odrolovat nahoru.** Odkazy `/akce`,
  `/okoli` a spol. chytá delegovaná obsluha a řeší je `navigateTo()`
  přes `pushState` — tedy uvnitř téže stránky, kde prohlížeč scroll sám
  nevrací. Kdo si prohlédl patičku a klikl v ní na jinou stránku, zůstal
  na nové zase dole v patičce; na mobilu, kde je patička přes několik
  obrazovek, to vypadalo, že odkaz vůbec nefunguje. `navigateTo()` proto
  skočí na začátek — ale **jen když v adrese není kotva**, jinak by vzal
  odrolování cíli, který si ho řídí sám.

- **Odbytá cookie lišta nechávala dole zaseknutý stín.** Skrývá se
  `transform: translateY(100%)`, jenže její stín `0 -4px 24px` míří
  NAHORU, takže se dál kreslil zpátky do obrazovky — u dolního okraje
  zůstal tmavý pruh a protože je lišta `position: fixed`, jezdil
  s uživatelem. Na tabletu to bylo vidět nejvíc: lišta je tam vysoká
  167 px a při schovávání adresního řádku prohlížeč fixní prvky
  přepočítává se zpožděním, takže uměl nechat vykreslený i kus té tmavé
  plochy. **Skrytý fixní prvek se musí přestat kreslit, ne jen odjet
  z obrazu** — proto má `visibility: hidden`, `box-shadow: none`
  a `opacity: 0` (přepínají se až po dojetí animace, `0s linear 0.3s`,
  aby zmizení nebylo useknuté).

### Jak se responzivita kontroluje

Ne okem, ale měřením: stránka se načte do iframu o pevné šířce (viz oddíl
„Jak si ověřit, že to funguje") a projdou se všechny prvky. Hlásí se ty,
jejichž `getBoundingClientRect()` přesahuje šířku okna.

Dvě věci, bez kterých detektor jen šumí:

- **Přeskočit potomky vodorovných rolovadel.** Karusely recenzí a galerie
  pokojů jsou schválně širší než okno; bez téhle výjimky hlásil detektor
  přes tisíc „vad" na stránku.
- **Sledovat `documentElement.scrollWidth`.** Když se rovná šířce okna,
  stránka vodorovně neroluje — jenže přetečený obsah může být oříznutý
  a nedostupný, takže se musí hlídat obojí.

Poslední průchod (18. 8. 2026) našel jen administraci na 320 px, viz níž.

### Administrace na úzkých displejích

Odsazení tří vnořených rámů (`admin-page-main` 33 px, `admin-dashboard-wrapper`
16 px, `admin-header-bar` 14 px) ukrajovalo 126 px z 320. Na dva sloupce
tlačítek zbylo 194 px, takže pravý sloupec končil až za okrajem okna —
oříznutý a nedostupný. Pod 400 px se proto okraje ztenčují a pod 380 px
je jeden sloupec.

**Potomek gridu má `min-width: auto`.** Nesmrskne se pod šířku svého textu
a vyteče z buňky. Na kartách rezervací tím jméno hosta a datum přetékaly
o 21 px; řeší to `min-width: 0` na `.res-card-grid > *`. Na tohle pozor
u každého nového gridu s textem.

### Administrace na telefonu a tabletu

Pravidla vznikala postupně ve čtyřech `@media` blocích (767.98, 768, 400,
380) a rozešla se. Sjednocené jsou teď v jednom bloku na konci
`booking.css`, hranice je všude **768 px včetně**.

- **Na PŘESNĚ 768 px** (iPad na výšku) platila půlka mobilního a půlka
  stolního rozvržení, protože jedna sada pravidel měla `max-width: 767.98px`
  a druhá `max-width: 768px`. Filtr pokojů tím zůstal vycentrovaný na
  316 px uprostřed prázdné šířky.
- **Jedna svislá linka pro všechno.** Odsazení se sčítalo ze tří
  vnořených rámů (12 + 10 + 20), takže každý blok začínal jinde:
  tlačítka nástrojů na 32 px, bílé karty na 22 px, obsah karty rezervace
  až na 47 px — z 375px displeje zbylo na text 285 px. Teď drží všechno
  hranu 12 px (na tabletu 22 px).
- **Přepínač stavů je mřížka, ne vodorovný posuvník.** Useknuté „2. Če…"
  nevypadá jako něco, co se dá posunout, ale jako rozbité vykreslení.
- **Řádky `space-between` se na mobilu skládají pod sebe**
  (`.admin-seznam-radek`). Tlačítka Upravit/Smazat mají pevnou šířku a
  smrskla levou půlku řádku na „Spu…", přes kterou ještě přelezla.

### Okna administrace na mobilu

- **`height: 100vh` je na telefonu VĚTŠÍ než viditelná plocha**, dokud
  je vidět adresní řádek. Okno vysázené doprostřed takové plochy vyleze
  horním okrajem mimo obrazovku — a protože rolovala jen jeho vnitřní
  část, na hlavičku okna se nedalo dostat vůbec. Přesně tohle obsluha
  popisovala jako „sjedu dolů a nahoru už se nevrátím". Překryv má proto
  `100dvh`, sází se od horního okraje a centruje se `margin: auto`, jen
  když se vejde.
- **Žádné rolovadlo v rolovadle.** Seznamy uvnitř oken měly vlastní
  rámeček s pevnou výškou (`.admin-vnitrni-seznam`); na malém displeji
  se ruší a roluje jen překryv. **Ceník je výjimka** — má pevnou hlavičku
  a lištu s tlačítkem Uložit, které musí být vidět pořád, takže si vnitřní
  rolování nechává; jen s výškou `min(90dvh, 900px)`.
- **Zámek rolování pod oknem se neopisuje ručně.** Ruční seznam příznaků
  se rozešel — chyběla v něm Správa recenzí, potvrzení smazání aktuality
  i recenze a okno e-mailů, takže se pod nimi rolovala stránka za oknem.
  Hledá se teď podle názvu vlastnosti (`/^show[A-Za-z]*Modal$/`), takže
  nové okno nejde zapomenout. Samotné `overflow: hidden` na `body` navíc
  Safari na iPhonu ignoruje; drží to až `position: fixed` se zapamatovanou
  pozicí, kterou `zamkniRolovaniStranky()` po zavření vrátí.

## Posluchače na předrenderovaných stránkách

`initInteractivity()` běží po **každém** přechodu. Když se DOM nevyměňuje
(`isPreRenderedMatch`), přímé `btn.addEventListener` navrství druhý, třetí…
posluchač na tomtéž prvku. U FAQ na stránce okolí to znamenalo, že klik
otázku otevřel a hned zase zavřel — na produkci víc než v dev serveru,
protože tam se statické HTML servíruje vždycky. FAQ se proto váže
delegovaně na `document` a jen jednou (`window.__faqNavazano`). Nový
interaktivní prvek na předrenderované stránce řeš stejně.

## Fotky

Fotky **v kartách** se zmenšují na 900 px delší stranu, kvalita 80. Karta je
na desktopu široká nejvýš ~440 px, takže 900 px pokryje i retinu. Složky
`Fotky Aktivit` a `Aktivity v hotelu` tím šly z 11,6 MB na 6,5 MB.

```bash
magick vstup.webp -resize '900x900>' -quality 80 -strip vystup.webp
```

**Autofill v prohlížeči se nedá přebarvit `background-color`.** Chrome
předvyplněná políčka obarvuje světle modrou a vlastní vykreslení si
přebije. Zabere jedině obrovský vnitřní stín v barvě podkladu plus
`-webkit-text-fill-color` na písmo (`style.css`, oddíl „PŘEDVYPLNĚNÍ
PROHLÍŽEČEM"). Nedá se to ověřit skriptem — autofill spouští prohlížeč
přes vlastní rozhraní, ne stránka.

**HERO FOTKY SE TAKHLE ZMENŠOVAT NESMÍ.** Jsou přes celou šířku okna, takže
900 px je na nich vidět jako rozmazanina. Doplatily na to 18. 8. 2026 při
hromadné optimalizaci — musely se obnovovat z historie gitu. Jsou to:

| Stránka | Fotka |
|---|---|
| okoli | `Aktivity v hotelu/vyhled na krajinu desktop.webp` (+ `… mobil.webp`) |
| okoli-turistika | `Fotky Aktivit/Turistika.webp` |
| okoli-cyklistika | `Fotky Aktivit/cyklistika.webp` |
| okoli-zima | `Fotky Aktivit/Zimni vylety.webp` |
| okoli-vylety-autem | `Fotky Aktivit/vylety autem.webp` |
| aktuality | `Fotky Aktivit/Aktulity hero sekce.webp` |

**Pod každou hero fotkou je barevný přechod zapečený v CSS.** Hero je
přes celou šířku okna a váží 100–500 kB; do jejího stažení tam nebylo
nic — jen tmavá plocha, kterou majitel popisoval jako „tři vteřiny černá
obrazovka".

Nejdřív tam byla zmenšenina té fotky (28 × 28 px roztažená přes celé
okno). Vyplnilo to černotu hned, ale majitel to zamítl: rozmazaná fotka
vypadá jako rozbité vykreslení, ne jako načítání — „přijdeš na stránku
a uvidíš takovouhle hrůzu". **Nevracej to.**

Je tam proto svislý přechod ze čtyř barev odečtených z té konkrétní
fotky (oddíl „PODKLAD HERO FOTEK" ve `style.css`). Vypadá jako záměr,
barevně sedí k tomu, co za chvíli dojde, a pod ztmavením a bílým textem
je k nerozeznání od pozadí fotky. Váží dohromady necelý kilobajt a je
přímo ve stylu, takže je na místě s prvním vykreslením.

Klíčem je **třída, ne cesta k souboru** — kategorie okolí se vykresluje
ze šablony s proměnnou adresou (`cat.heroImg`) a na tu by se v HTML
nedalo sáhnout. Nová hero fotka potřebuje novou položku, jinak zůstane
černá; hlídá to kontrola „Hero fotky" v `./zkontroluj.sh`. Barvy se
odečtou takhle:

```bash
magick vstup.webp -resize 1x4! -depth 8 txt:-   # čtyři barvy shora dolů
```

**Na telefon jde užší varianta `… mobil.webp`** přes `<picture>`
(`-resize '1000x1000>' -quality 78`), což ušetří zhruba 60 % bajtů.
Musí být na **třech** místech naráz: ve statické stránce, v šabloně
v `main.js` a v `preloadCategory()`, který si fotku předstahuje. A pozor
na `<link rel="preload">` — bez `media` stáhne prohlížeč obě varianty.
Přesně tohle dělalo `okoli.html`: mobilní fotka existovala a `<picture>`
ji bralo, ale preload k ní přihodil ještě těch 503 kB desktopové.

Hero drž na **nativním rozlišení, nejméně 1600 px** na šířku. A pozor:
překódovat už jednou zkomprimovaný WebP nic neušetří a jen ubere kvalitu —
`cyklistika.webp` po překódování na kvalitu 90 **narostla** ze 457 kB na
529 kB. Když je potřeba se vrátit, ber soubor z gitu beze změny:

```bash
git show <commit>:"public/Fotky Aktivit/Turistika.webp" > "public/Fotky Aktivit/Turistika.webp"
```

## Zabezpečení — co drží web pohromadě

Bezpečnostní kontrola 18. 8. 2026 našla čtyři vážné věci. Všechny jsou
opravené, ale na pravidlech níž stojí celý web — kdo je obejde, otevře je
znovu.

**0. RLS je POVOLUJÍCÍ — stačí jedno cizí pravidlo a je otevřeno.**
Při prvním spuštění migrace zůstala vedle nových pravidel stará povolující
(„Enable read access for all users" a podobná), takže se anonymním klíčem
dál četly kontaktní zprávy a přepisoval ceník. `supabase-ZABEZPECENI.sql`
proto **maže všechna** pravidla na dotčených tabulkách, ne jen vlastní.
Pravidla se navíc zakládají v cyklu s kontrolou `to_regclass` — jedna
chybějící tabulka uprostřed jinak shodí skript a všechno za ní zůstane
odemčené. Na konci skriptu je kontrolní výpis; `cizich_pravidel` musí být
u všech tabulek nula.

**1. Anonymní klíč je veřejný. Chrání ho jen pravidla v databázi.**
`supabase-ZABEZPECENI.sql` zapíná RLS na všech tabulkách. Role `anon`
(návštěvník) smí založit rezervaci, recenzi a zprávu a přečíst si veřejný
obsah. Role `authenticated` (přihlášený recepční) smí vše.

Osobní údaje hostů chrání **oprávnění na sloupce**, ne jen řádková pravidla:
```sql
REVOKE SELECT ON public.reservations FROM anon;
GRANT  SELECT (room_id, date_from, date_to, status) ON public.reservations TO anon;
```
Veřejný kalendář víc nepotřebuje. Kdyby někdy potřeboval další sloupec,
přidej ho do `GRANT`, **nikdy nevracej `SELECT` na celou tabulku** — jinak
jsou jména, e-maily a telefony hostů zase veřejné.

**2a. Recepční zadává jen heslo.** Supabase Auth přihlašuje dvojicí
e-mail + heslo, ale políčko na adresu je schválně skryté a předvyplněné
z `VITE_ADMIN_EMAIL` (`.env` i Netlify → Environment variables). Adresa se
tím dostane do zdrojáku, což nevadí — je to uživatelské jméno, ne přístupový
údaj. Když proměnná chybí, formulář si o e-mail řekne, aby se nikdo
nezamkl venku.

**2. Administrace se přihlašuje do Supabase Auth.** Dřív se porovnával
otisk hesla v prohlížeči a do databáze se chodilo týmž anon klíčem jako za
návštěvníka — přihlášení tedy nechránilo vůbec nic. Navíc stačilo
v konzoli nastavit `hotel_mustku_admin_auth_v1` na `true` a administrace se
otevřela. Teď rozhoduje token ze Supabase Auth a `localStorage` se nevěří.

**3. Serverové funkce nejsou veřejné.** `send-email` kontroluje hlavičku
`Origin` a drží limit 5 zpráv za minutu z jedné adresy; bez toho to byla
otevřená pošta — příjemce, předmět i HTML se berou z požadavku, takže
kdokoli mohl rozesílat phishing z domény hotelu a zničit jí pověst.
`upload-news-image` má servisní klíč, proto vyžaduje token přihlášené
recepce.

**3b. Veřejné formuláře nesmí číst vložený řádek zpátky.** Kontaktní
formulář i recenze měly za `insert()` ještě `.select()`. Host ale svou
zprávu číst nesmí a nová recenze čeká na schválení, takže vracení řádku
skončilo chybou 42501 a formulář hlásil selhání, i když se záznam uložil.
U čehokoli, co zapisuje návštěvník, `.select()` nepřipojuj.

**4. Cizí text se do stránky vkládá jen přes `esc()`.** Recenze, aktuality
a oznámení píšou lidé zvenčí a jdou do `innerHTML`. Bez escapování stačilo
uložit recenzi s `<img src=x onerror=…>` a kód se spustil každému
návštěvníkovi včetně recepčního. Na adresy obrázků je `escUrl()`.

**5. Cizí text se do administrace vkládá jen přes `escapujText()`.**
Jméno a poznámka hosta i text recenze píše kdokoli z internetu a jdou
do `innerHTML`. Bez escapování stačilo odeslat rezervaci se značkou
`<img src=x onerror=…>` a kód se spustil recepčnímu s platnou relací —
ta má podle RLS přístup ke všem tabulkám, takže by šlo vytáhnout osobní
údaje všech hostů nebo mazat rezervace. **Toast se escapuje až u
vykreslení**, na jednom místě: hlášky sestavují různé moduly a některé do
nich dávají jméno hosta, takže escapovat u každého volajícího zvlášť se
dřív nebo později zapomene. Tisková sestava má vlastní `escapujTisk()` —
sype se do `document.write()` v okně, které dědí původ webu. Hlídá to
kontrola „Escapování cizího textu".

**6. Příjemce e-mailu si NEURČUJE volající.** Funkce `send-email` bere
příjemce, předmět i HTML z požadavku, takže sama o sobě je otevřená
pošta. Origin se z neprohlížečového klienta nastaví libovolně, spoléhat
se na něj nejde. Rozhoduje proto **typ zprávy**: `PRIJEMCE_HOTEL` jde
natvrdo na recepci (ať přišlo cokoli), `PRIJEMCE_HOST` jen na adresu,
která sedí s existující rezervací (ověřuje se servisním klíčem proti
databázi podle `reservationCode`), a `test` vyžaduje token přihlášené
recepce. Poslat spam cizímu člověku by tedy znamenalo, že si ten člověk
u hotelu nejdřív zarezervoval pobyt.

Dvě díry, které tu byly do 1. 9. 2026 a hlídají je teď kontroly:
požadavek **bez hlavičky `Origin`** se pouštěl (curl ji neposílá, takže
se kontrola obešla jedním příkazem) a pravidlo `*.netlify.app` pouštělo
**libovolný cizí web** — takovou adresu si zadarmo pořídí kdokoli.

**7. Měřicí kód nesmí být natvrdo v HTML.** Na čtyřech stránkách okolí
byl blok Google Analytics přímo v `<head>`, takže se načetl při otevření
stránky bez ohledu na cookie lištu — přesně proti tomu, co slibuje
`cookies.html`. Po udělení souhlasu se pak načetl podruhé. Vkládá ho
výhradně `initGA4()` v `main.js` po souhlasu.

**7b. Cizí text se escapuje i v E-MAILECH, nejen na webu.** Zpráva
z kontaktního formuláře a text recenze jdou recepci jako HTML. Bez
escapování si tam host propašuje vlastní odkaz — recepčnímu přijde
z ověřené domény hotelu zpráva, která vypadá jako systémové sdělení
a vede kamkoli. JavaScript poštovní klient nespustí, ale phishing na
vlastní recepci stačí. Slouží k tomu `escapujMail()` v `emailService.js`;
escapuje i uvozovku a apostrof, protože část hodnot jde do atributů
(`href="mailto:…"`), kde by se uvozovkou dal atribut ukončit.

**Kontrola escapování musí escapované výskyty NEJDŘÍV VYMAZAT** a teprve
zbytek řádku prohledat. Dřív filtrovala `grep -v escapujText`, jenže to
zahodí celý řádek — a na tomtéž řádku bývá jedno pole escapované a druhé
ne. Přesně tak prošly neescapované údaje v potvrzovacích oknech a
kontrola u toho svítila zeleně. Falešná jistota je horší než žádná
kontrola. Hlásí se jen pole, které se opravdu vypisuje (`${x.guest_name}`
nebo `${x.guest_name || 'Host'}`), ne použití v podmínce.

**8. Zápis z veřejného klíče je omezený i OBSAHEM, ne jen tabulkou.**
Návštěvník smí založit recenzi a rezervaci, ale RLS mu nedovolí zvolit si
stav: recenze jde vložit jen jako `pending_approval`, rezervace jen jako
`pending_approval` a nearchivovaná. Bez toho by si kdokoli anonymním
klíčem vložil rovnou schválenou recenzi na web, nebo potvrzenou rezervaci
do knihy. Pravidla jsou v `supabase-ZABEZPECENI-2.sql`.

U recenzí je k tomu **oprávnění na sloupce**, aby host nemohl přepsat
třeba `created_at` u cizího řádku. Do seznamu patří VŠECHNY sloupce,
které formulář posílá — a ten posílá i `created_at`. Když se zapomene,
zápis skončí na 42501 „permission denied for table reviews" a hostovi se
recenze tiše neuloží. Přesně tahle chyba tu při psaní pravidel vznikla.

**Veřejné registrace v Supabase Auth musí být vypnuté.** Jinak si kdokoli
založí účet a přihlásí se do administrace — role `authenticated` má podle
RLS přístup ke všem tabulkám. Je to přepínač „Allow new users to sign up"
v Authentication → Sign In / Providers, tedy nastavení mimo repozitář;
hlídá ho proto kontrola „Zápis z veřejného klíče" v `./zkontroluj.sh`,
která zkusí registraci a čeká `signup_disabled`.

Bezpečnostní hlavičky jsou v `public/_headers`; `/admin` má navíc
`noindex` a `no-store`.

## Storno rezervace — dva různé e-maily

Běžný storno e-mail hostu píše, že „při odeslání žádosti jste neplatili
žádné peníze (0 Kč)". U rezervace, kterou recepce překlopila do stavu
`confirmed`, je to ale **nepravda** — záloha už je na účtu hotelu a host
má nárok na její vrácení. Poslat mu tuhle větu je vzkaz, že o peníze
přišel.

Rozhoduje `maZaplacenouZalohu()` v `pricing.js`: stav `confirmed`
**a** nenulová `deposit_price`. Stav `confirmed` nastavuje obsluha až
ve chvíli, kdy zálohu vidí na účtu (tlačítko Potvrdit přijetí zálohy).

- neplaceno → `generateEmailCancellation()`, typ `email_cancellation`
- zaplaceno → `generateEmailCancellationRefund()`, typ
  `email_cancellation_refund` — vypíše uhrazenou částku a požádá
  o číslo účtu **v odpovědi na ten e-mail**. Číslo účtu hosta v databázi
  nemáme a schválně ho nesbíráme formulářem.

**Rozhodnout se musí ještě před zápisem `cancelled`.** Po přepsání stavu
už z rezervace nepoznáš, jestli za ni host zaplatil, a pošleš mu to
špatné.

## Ořez fotky aktuality

Ovládání je v `src/components/AdminFotoOrez.js`, styly v oddílu „OŘEZ
FOTKY AKTUALITY" ve `style.css`. Nahradilo to přes tři sta řádků kreslení
do canvasu se zoomem přímo v `AdminDashboard.js`, které se při každém
překreslení administrace navazovalo znovu a jehož potvrzovací tlačítko
tiše nedělalo nic, když se `cropBox` nestihl nastavit.

Čtyři věci, na kterých to stojí:

- **Výřez se drží v pixelech ORIGINÁLU**, ne v zobrazených. Ukazatel se
  přepočítává dělením měřítkem (`clientWidth / naturalWidth`) a rámeček
  se násobí zpátky. Kdyby se ukládaly zobrazené pixely, ořez by změnil
  význam při každé změně velikosti okna.
- **Poměr je zamčený, takže volná je vždy jen jedna míra.** Spočítá se
  šířka, výška se z ní odvodí. U rohu rozhoduje ten směr, kterým se táhne
  výrazněji — svislý posun se přitom musí přepočítat na šířku (`* POMER`),
  jinak by u širokého poměru vodorovný tah vždycky přebil svislý.
- **Ořezávat se musí v pořadí a po každé změně šířky dopočítat výšku.**
  Nezávislé ořezání obou měr rozbije poměr na okraji fotky. Když by
  výsledek klesl pod minimum, celý snímek se zahodí (`return`) — jeden
  zahozený pohyb myši si nikdo nevšimne, převrácený rámeček ano.
- **Výstup vynucuje canvas, ne ovládání.** Cílový obdélník je konstanta
  `CIL_SIRKA × CIL_VYSKA` (1280 × 720), takže ať uživatel táhne kamkoli,
  ven vyleze pokaždé stejně velký obrázek a karty aktualit neposkakují.
  Formát se mění jen na tom jednom místě.

**Vybraná fotka se drží jako objektová adresa, ne jako data URL.**
Čtyřmegabajtová fotka se jako base64 rozroste na 5,4 MB textu, který se
při KAŽDÉM překreslení administrace znovu vkládá do `innerHTML` a znovu
dekóduje — na tom stálo ono „hrozně dlouho se to nahrávalo". Objektová
adresa je jen odkaz do paměti; musí se ale při zavření uvolnit
(`URL.revokeObjectURL`), jinak v paměti zůstávají fotky, které už nikdo
nevidí.

**Výstup je WebP, ne JPEG, a posílá se binárně, ne jako base64.** WebP je
při stejně vypadající kvalitě zhruba o třetinu menší; prohlížeč, který ho
neumí zakódovat, vrátí z `toBlob` PNG — pozná se to podle typu a spadne
se zpátky na JPEG, jinak by se do koše nahrával několikamegový PNG. Tělo
požadavku je samotný soubor a formát se čte z hlavičky `Content-Type`;
base64 v JSONu byl o třetinu delší a navíc vyžadoval dvojí převod.
Kdo bude tuhle cestu měnit, musí to udržet na třech místech —
`uploadNewsImage`, `netlify/functions/upload-news-image.js` a middleware
ve `vite.config.js` (ten musí přenést `Content-Type` i `Authorization`
a tělo poslat jako binárku, ne jako text).

**Cache hlavička se objektu zapisuje při NAHRÁNÍ, ne při čtení.** Storage
si `cache-control` z nahrávání uloží do metadat řádku a při stažení ji
vrací; nedá se tedy dodatečně přenastavit u koše ani v projektu, jen
novým nahráním. Proto ji `upload-news-image.js` posílá — kdo ji odtud
odstraní, dostane výchozí `no-cache` a fotky aktualit se začnou stahovat
znovu a znovu (viz limit egressu v oddílu 6).

Ověřeno 20. 8. 2026 proti nasazenému projektu: všechny fotky v koši mají
v metadatech `public, max-age=31536000, immutable`, veřejná adresa tuhle
hlavičku vrací a Cloudflare před Storage hlásí `cf-cache-status: HIT`.
Fotky aktualit tedy cachované jsou a **stěhovat je na Netlify není proč.**

**Měř to GETem, ne HEADem.** Na téže adrese vrací každá metoda něco
jiného, deterministicky:

```bash
curl -s -D - -o /dev/null "<URL>" | grep -i cache   # GET  → max-age=31536000, HIT
curl -sI                  "<URL>" | grep -i cache   # HEAD → no-cache, REVALIDATED
```

Ta druhá hodnota je artefakt HEADu, ne to, co dostane návštěvník —
prohlížeč si obrázek v `<img>` bere GETem a HEAD na něj nepošle nikdy.
Kdo změří `curl -I` a uvěří mu, dojde k závěru, že cachování nefunguje,
a začne fotky zbytečně stěhovat jinam. Přesně tahle chyba se tu už
jednou stala. (Uložená metadata se čtou přes
`POST /storage/v1/object/list/<koš>`.)

Podmíněný GET s `If-None-Match` vrátí `304` a nula bajtů, ale k tomu se
prohlížeč dostane, jen když z nějakého důvodu mezipaměť obejde. Běžná
druhá návštěva neodešle požadavek vůbec.

Nahrávání samo funguje (ověřeno proti nasazené funkci s platným tokenem).
Ve **vývoji** ale dřív selhávalo vždycky: middleware ve `vite.config.js`
nepřenášel hlavičku `Authorization`, takže funkce nepoznala přihlášenou
recepci a vracela 401, a do `process.env` se nekopíroval
`VITE_SUPABASE_ANON_KEY`, bez kterého se token nemá čím ověřit. Obojí je
opravené — kdo bude přidávat další serverovou funkci, musí hlavičky
přenést taky.

## Mazání rezervace — jeden požadavek, ne pět

Smazání rezervace posílalo do databáze až **pět** požadavků: dva čekané
v obsluze a další tři na pozadí, protože se `deleteStoredReservation()`
volalo třikrát za sebou. Obsluze to přišlo zaseknuté, klikla znovu a
mazání se vyvolalo několikrát. Teď jde jeden cílený požadavek (podle tvaru
se pozná, jestli je to `id` typu uuid, nebo `code`), okno se zavírá hned
a `mazeSeRezervace` brání druhému spuštění.

## Rozdělaná rezervace se pamatuje

Host, který si odskočí na jinou stránku a vrátí se, nesmí přijít o to, co
už vyplnil. Drží to `ulozVyberDoSezeni()` / `nactiVyberZeSezeni()`
v `BookingSystem.js` — v `sessionStorage`, tedy do zavření karty, a navíc
jen dvě hodiny. Ukládá se termín, pokoj, počty osob, **doplňkové služby,
slevový kód i údaje hosta**; původně jen první čtyři, takže zaškrtnutou
polopenzi nebo uplatněný kód musel host zadávat znovu.

Dvě věci, které při tom nejsou z kódu vidět:

- **Slevový kód se ukládá jako text a při návratu se ověřuje znovu.**
  Kdyby se ukládala hotová sleva, přežil by i kód, který mezitím vypršel
  nebo ho recepce vypnula.
- **Kód se musí podržet v `slevovyKodKUplatneni`, než se stihne uplatnit.**
  Ukládá se při každém překreslení, takže první render po návratu ho
  přepsal prázdnou hodnotou dřív, než doběhlo načtení kódů — a sleva se
  ztratila, přestože byla uložená správně. Když ji host sám smaže, pole se
  vyprázdní, aby ji podržená hodnota nevzkřísila.

## E-mailové adresy

Jsou **dvě a mají různou roli**. Obě jsou v `src/utils/emailService.js`,
nikam je nepiš natvrdo:

- **`HOTEL_EMAIL`** = `hotel@umustku.cz` — adresa, kterou **vidí hosté**
  v textech e-mailů a na tiskových sestavách.
- **`RECEPCE_PRIJEMCE`** = `HOTEL_EMAIL` — kam **chodí upozornění**
  (nová žádost o rezervaci, zpráva z kontaktního formuláře, nová
  recenze). Od 23. 8. 2026 je to tatáž adresa jako `HOTEL_EMAIL`.

  Dřív tu byla soukromá schránka majitele, protože doména se teprve
  překlápěla a upozornění by se ztrácela. **Soukromou adresu sem
  nevracej** — hotelu chodí pošta na hotelovou adresu. Když by
  `hotel@umustku.cz` nedoručovala, řeší se to na doméně, ne přesměrováním
  do kódu.

  Musí sedět s konstantou `RECEPCE` v `netlify/functions/send-email.js`
  (ta se používá i jako záloha, když Resend nepustí e-mail na cizí
  adresu) — mění se to na obou místech naráz.

V kódu kdysi byly rozeseté tři různé adresy včetně `info@hotelumustku.cz`,
která nikdy neexistovala — a přesto se posílala hostům v e-mailu
o vypršení lhůty pro úhradu zálohy.

## Databáze

Tabulky: `reservations`, `blocked_dates`, `room_prices`, `disabled_rooms`,
`discount_codes`, `aktuality`, `reviews`, `contact_messages`,
`cenik_sezony`, `cenik_ceny`, `cenik_ceny_pokoj`, `cenik_nastaveni`.

**Pokoje 1–6 se 1. 9. 2026 přečíslovaly zrcadlově** (1↔6, 2↔5, 3↔4)
podle skutečného značení na chodbě. Identifikátory `p1`–`p6`, `pa` se
NEMĚNILY — drží fyzický pokoj, jeho fotky (`/pokoje/p6/…`), typ,
rezervace i blokace; změnilo se jen číslo v názvu. **Proto id neodpovídá
číslu v názvu** (`p6` = „Pokoj 6", ale `p3` = „Pokoj 1") a nikoho nesmí
napadnout to „srovnat" — přejmenování id by rozpojilo všechny vazby
v databázi. Turistické (mimo provoz) jsou teď Pokoj 1–3, Mahagon je
Pokoj 4. Názvy se měnily na čtyřech místech naráz: `MOCK_ROOMS`,
`room_prices` v databázi, rozpis v `main.js` a statické
`ubytovani.html`; u existujících rezervací se přepsal uložený
`room_name`, aby tisk a e-maily neposílaly hosty ke starým dveřím.

Zdrojem pravdy je Supabase, `localStorage` slouží jako záloha pro případ
výpadku. Vzor: `getStored*()` čte zálohu, `fetch*()` načte z databáze
a zálohu přepíše. Rezervační formulář tak ukáže ceny i offline.

**PostgREST vrací nejvýš 1000 řádků na dotaz a přebytek MLČKY zahodí** —
nevrátí chybu ani příznak. Prosté `select('*')` proto nad tisícem
rezervací vypadá, že funguje, jen v administraci část hostů chybí:
nejsou v seznamu, nenajde je hledání a hlavně nejsou v exportu kontaktů,
kde by si toho nikdo nevšiml. Administrace proto chodí po stránkách
(`nactiVsechnyRadky` v `AdminDashboard.js`) a stejně musí načítat každý
další seznam, který může přerůst tisícovku. Ověřeno 21. 8. 2026 na 1100
zkušebních řádcích: jeden dotaz jich vrátil 1000, stránkované načtení
všech 1100.

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
- **Do minulosti se v rezervačním formuláři nelistuje.** Šipka na
  předchozí měsíc je v aktuálním měsíci vypnutá — host by v minulosti
  jen bloudil mezi samými nedostupnými dny a ptal se, proč nejde nic
  vybrat. Hlídá to i obsluha kliknutí, ne jen atribut `disabled`, který
  jde v prohlížeči obejít. **V administraci to platit NESMÍ** — majitel
  se do starých měsíců dívá schválně, když dohledává, kdo tam byl.
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

**Do `room_prices` ani `cenik_sezony` se nesmí psát upsertem.** Tabulka drží ještě sloupce
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

**Přesně totéž potkalo `cenik_sezony`** (19. 8. 2026): `nazev` je NOT
NULL, jenže obrazovka Základního ceníku pole s názvem vůbec nemá — je to
„celý rok" a nepřejmenovává se — takže se neposílal a každé uložení
skončilo hláškou `null value in column "nazev"`. Ceny se přitom uložily,
takže to vypadalo, že se ukládání jednou povede a jednou ne. Období se
proto ukládá přes `ulozObdobi()`, které existující řádek mění
`update()`em; `insert()` je jen pro nové období. Kdyby přibyla další
tabulka s povinným sloupcem, který obrazovka nevyplňuje, platí to samé.

---

## Jak se dostat do administrace při testování

Administrace stojí na Supabase Auth, takže bez přihlášení se v ní nedá
nic proměřit. **Heslo majitele k tomu není potřeba a nemá se sdělovat** —
jakmile jednou padne do chatu, je vidět v historii a musí se měnit.

Místo toho dočasný účet. Trvá to dvě minuty:

```bash
set -a && . ./.env && set +a
HESLO="Zkouska-$(openssl rand -hex 10)"; MAIL="zkouska-recepce@umustku.cz"
curl -s -X POST "$VITE_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$MAIL\",\"password\":\"$HESLO\",\"email_confirm\":true}"
echo "VITE_ADMIN_EMAIL=$MAIL" > .env.local   # .env.local je v .gitignore (*.local)
echo "$HESLO"                                # heslo si nech mimo repozitář
```

Pak restartovat vývojový server (`.env.local` se načte jen při startu),
přihlásit se tím heslem a testovat. **Po sobě uklidit** — smazat účet
přes `DELETE /auth/v1/admin/users/<id>`, smazat `.env.local` a ověřit,
že v `/auth/v1/admin/users` zůstal jen `hotel@umustku.cz`.

Pozor na dvě věci, které vypadají jako chyba a nejsou:

- **Náhledové okno běží skryté, takže se v něm zmrazí animace i
  `requestAnimationFrame`.** Screenshot pak ukáže zamrzlý mezistav —
  třeba okno posunuté o stovky pixelů, protože se zastavila nabíhací
  animace. Rozhoduje měření (`getBoundingClientRect`,
  `elementFromPoint`), ne obrázek.
- Klikání přes `computer` umí vypršet, když je okno skryté. Spolehlivější
  je vyvolat kliknutí skriptem.

## Jak si ověřit, že to funguje

Nejdřív `./zkontroluj.sh` (nebo `npm run zkontroluj`). Projde 42 kontrol:
sestavení, shodu hlaviček napříč stránkami, matematiku ceníku a zálohy,
klíče v balíčku, typy e-mailů, dostupnost nasazených stránek, odmítání
neoprávněných volání serverových funkcí a pravidla v databázi. S přepínačem
`--bez-site` běží jen offline část. Testy jsou v `kontrola/`.

Dvě věci, které se v něm daly snadno splést, a proto jsou v kódu popsané:

- **Klíče se hledají jen v textových souborech balíčku.** `grep -r dist/`
  sahá i do videa a fotek a regulární výraz s `{20,}` nad binárními daty
  tam běží minuty — celá kontrola pak vypadá zaseknutě. Klíč se do
  `.webp` ani `.mp4` zabalit nemůže, takže se prohledávají jen `.js`,
  `.css`, `.html` a spol. Pozor při ověřování, že kontrola umí selhat:
  skript si `dist/` na začátku **sám znovu sestaví**, takže podstrčený
  klíč se z něj vymaže dřív, než na kontrolu dojde řada.
- **Prázdné pole `[]` z databáze znamená ZAVŘENO, ne rozbito.** Pravidla
  RLS řádky filtrují, nevrací chybu. Kontrola, která čekala chybový objekt,
  hlásila díru tam, kde žádná není.
- **Zákaz zápisu nepozná stavový kód.** „Aktualizováno nula řádků" i
  „zakázáno" vrátí 204. Rozhodne až `Prefer: return=representation`;
  zavřený zápis vrátí `[]`. Zapisovat se přitom musí TÁŽ hodnota, jaká
  v řádku už je, aby kontrola sama nic nezměnila.

Skript neumí ověřit to, co vyžaduje přihlášenou recepci — tisk rezervace,
ruční zápis, ořez fotky a rozvržení administrace na telefonu. Na to je
oddíl výš o dočasném účtu.

Zbytek se ověřuje takhle:


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

- ~~**Kapacita pokojů.**~~ Opraveno majitelem 17. 8. 2026 (dřívější
  zadání z 16. 8. bylo chybné). Všude jsou **dvě stálá lůžka**, liší se
  jen přistýlky — čísla níž platí po přečíslování z 1. 9. 2026:
  Pokoj 6, 7, 10, 11, 12 → 1 přistýlka (3 osoby); Pokoj 5 → 2 přistýlky
  (4 osoby); Mahagon, Motýl, Zen → bez přistýlky (2 osoby). Turistické
  pokoje (1, 2, 3) 2 osoby, jsou mimo provoz. Nadstandard tedy pojme jen
  dva lidi — pozor na texty, které slibují čtyři (strukturovaná data
  v `ubytovani.html` na to už doplatila).
- ~~**Ceník naživo neověřený.**~~ Ověřeno 16. 8. 2026 v prohlížeči:
  migrace v databázi proběhla (základní ceník + letní a zimní sezóna),
  uložení cen i termínu sezóny se propíše do Supabase a zkušební výpočet
  z něj počítá správně. Testovací data byla vrácena do původního stavu.
- ~~**Video na mobilu.**~~ Vyřešeno 17. 8. 2026. `autoplay` přebíjelo
  `preload="none"` a 4,7 MB se stahovalo hned — na mobilu tím video
  ubíralo pásmo dotazům do databáze a obsazenost v kalendáři naskakovala
  se zpožděním. Adresa je teď v `data-src` a video pouští
  `spustHeroVideo()` v `main.js`: na displeji užším než 768 px a při
  úsporném nebo pomalém připojení (`saveData`, 2G/3G) se nespustí vůbec,
  jinak až po `load`. Kdo mění hero sekci, musí to udržet na třech
  místech — `index.html`, šablona v `main.js` a vytváření videa
  při přepnutí sezóny.
- **Texty v `podminky.html`** obsahují údaje, které nikdo nepotvrdil
  (mimo jiné kamery u parkoviště). Majitel je má projít.
- ~~**Aktuality nespolehlivé.**~~ Opraveno 17. 8. 2026, viz oddíl 6b.
  Ověřeno i na nasazeném webu: nahrání fotky přes serverovou funkci
  projde a stránka se plní z databáze, ne z HTML.
- **Zrušit přístupový token** `sbp_…`, který byl kdysi vložený do chatu.
  Supabase → Account → Access Tokens. Pozor, ať nezrušíš ten nový
  v `.env` (`SUPABASE_ACCESS_TOKEN`) — na tom teď stojí spouštění SQL.
- **Výpisy dat z databáze se necommitují.** `supabase-EXPORT-dat.sql`
  a `supabase-IMPORT-dat.sql` obsahují rezervace a kontaktní zprávy,
  tedy osobní údaje hostů, a repozitář je veřejný. Jsou v `.gitignore`.
- **Spuštění domény.** Po přepnutí na `umustku.cz` odeslat sitemapu
  a požádat o indexaci.

---

## Skilly — používat, ne čekat na vyzvání

Než sáhnu na první nástroj u netriviálního zadání, projít tyhle čtyři a nahlas
říct, co použiju a proč. Plné pravidlo je v globálním `~/.claude/CLAUDE.md`.

- **claude-mem** — na začátku místo slepého grepování (`mem-search`,
  `smart-explore`). Tohle jediné reálně šetří kontext.
- **andrej-karpathy-skills:karpathy-guidelines** — u každé práce s kódem.
- **superpowers** — podle fáze: `systematic-debugging` na chybu,
  `brainstorming` → `writing-plans` → `executing-plans` na novou věc,
  `verification-before-completion` než řeknu „hotovo".
- **ruflo-core** — jen když zlobí tooling nebo MCP.
- **graphify** — orientace v kódu přes znalostní graf místo grepu.
  Podrobně níž v oddílu „graphify — znalostní graf projektu“.

Nevyvolávat všechny naráz, to jde proti smyslu. Headroom není skill, je to
lokální proxy na portu 8787 — nedá se vyvolat, buď běží, nebo ne.

## Zvyklosti

- **Odpovídej maximálně stručně. Tohle je nejčastěji vytýkaná věc.**
  Odpověď má jen dvě části: **(1) co má uživatel udělat** — když nic, tak
  „hotovo" a tečka; **(2) důležitá informace, pokud nějaká je** — jedna
  věta. Nic dalšího.

  Nepiš, co jsi udělal, co jsi ověřil, kdo měl pravdu, proč chyba vznikla
  ani co se dělo v jiné session. Žádné nadpisy, tabulky ani odrážky
  s provedenými kroky.

  **Délka nesmí růst s tím, jak sezení pokračuje.** Sklouzává to takhle:
  krátká odpověď, krátká, o něco delší, a pak odstavce s nadpisy. Po
  velkém kusu práce je nutkání vypsat, co všechno se ověřilo, největší —
  a je to přesně ta chyba. Čím víc práce, tím kratší odpověď.

  Default 1–3 věty. Delší jen na dotaz „proč / jak to funguje" nebo když
  uživatel potřebuje víc kroků k provedení. Práci tím neodbývej — dělá se
  celá a pořádně, jen se o ní nepíše slohovka.
- Komentáře a názvy nových proměnných česky, tak jako ve zbytku projektu.
- Komentář má vysvětlovat **proč**, ne co je z kódu vidět. Zvlášť
  u míst, kde předchozí zjevné řešení nefungovalo.
- `AdminDashboard.js` má přes 3100 řádků. Novou větší funkci raději do
  vlastního souboru — jako `AdminCenik.js`.
- Barvy: zelená `#697947`, tmavá `#1c1c19`, krémová `#ece8dd`.
- Ceny se formátují přes `formatCzechPrice()`, datumy přes
  `formatCzechDateStr()`.

## graphify — znalostní graf projektu

Projekt má znalostní graf v `graphify-out/`. Staví ho `graphify` (tree-sitter
AST, lokálně, bez LLM a bez placeného API). Slouží k tomu, aby se odpovědi
na otázky o kódu hledaly v grafu, ne slepým grepováním.

```bash
graphify query "jak se počítá cena rezervace"   # podgraf k otázce
graphify explain "BookingSystem"                # jeden uzel a jeho okolí
graphify path "BookingSystem" "calculateReservationPrice()"
graphify god-nodes                              # nejpropojenější místa
graphify update .                               # obnovit graf po změně kódu
```

Pravidla:

- **Značka v odpovědi.** Když odpověď stavím na datech z grafu, první řádek
  odpovědi je `⬡ graphify — <dotaz, který jsem spustil>`. Značka musí nést
  ten skutečný dotaz, ne jen symbol — aby šla ověřit. Když jsem se grafu
  na otázku o kódu nezeptal, napíšu místo značky proč.
- **Ověření, že značka nelže.** Každý dotaz se zapisuje s časem do
  `~/.cache/graphify-queries.log` (zapnuto přes `GRAPHIFY_QUERY_LOG_ENABLE`
  v `.claude/settings.json` a `.mcp.json`). Kontrola:
  `tail -5 ~/.cache/graphify-queries.log`. Když je v odpovědi značka a v logu
  ze stejné minuty nic, značka je vymyšlená.
- **Vynucení, ne slib.** `GRAPHIFY_HOOK_STRICT=1` zablokuje první čtení
  zdrojáku v session, dokud reálně neproběhl dotaz do grafu. Tohle na rozdíl
  od slibu nejde obejít zapomenutím.
- **Na otázku o kódu nejdřív `graphify query`**, teprve pak čtení souborů.
  Vrátí menší výřez než grep a rovnou s vazbami. Na tohle upozorňuje i
  PreToolUse hook v `.claude/settings.json`.
- **Po zásahu do kódu spustit `graphify update .`**, ať graf nezestárne.
  Dělá to i post-commit hook, takže po commitu se to stane samo.
- `graphify-out/GRAPH_REPORT.md` je na širší architektonický přehled,
  `graph.html` na proklikání v prohlížeči.

**Co v grafu NENÍ:** patnáct statických `.html` stránek. Graphify je bere
jako dokumenty, ne kód, a ty potřebují sémantický průchod přes LLM
(`/graphify .` v Claude Code, nebo API klíč a `graphify extract .`).
V grafu je zatím jen JS, SQL a konfigurace. Na dvojí vykreslování stránek
(oddíl 1 nahoře) proto graf **neupozorní** — to se pořád musí hlídat ručně.

Graf běží i jako MCP server (`.mcp.json`), takže vedle CLI jsou k dispozici
nástroje `query_graph`, `get_node`, `shortest_path`, `god_nodes` a další.
