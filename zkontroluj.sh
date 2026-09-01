#!/usr/bin/env bash
#
# Kontrola, že web funguje. Pustí všechno, co jde ověřit strojově —
# od matematiky ceníku po zabezpečení nasazené stránky.
#
#   ./zkontroluj.sh              vše včetně nasazeného webu a databáze
#   ./zkontroluj.sh --bez-site   jen to, co jde bez internetu
#
# Co skript ověřit NEUMÍ (potřebuje přihlášenou recepci, viz CLAUDE.md,
# oddíl „Jak se dostat do administrace při testování"): tisk rezervace,
# ruční zápis, ořez fotky a rozvržení administrace na telefonu.

set -uo pipefail
cd "$(dirname "$0")"

BEZ_SITE=0
[ "${1:-}" = "--bez-site" ] && BEZ_SITE=1

# Po přepnutí na ostrou doménu sem patří https://umustku.cz. Netlify
# tehdy začne z .netlify.app přesměrovávat (301) a kontroly stránek by
# hlásily chybu, přestože web běží. Dá se přebít: WEB=... ./zkontroluj.sh
WEB="${WEB:-https://papaya-travesseiro-6b341e.netlify.app}"
PROSLO=0
SELHALO=0
PRESKOCENO=0

zelena() { printf '  \033[32m✓\033[0m %s\n' "$1"; PROSLO=$((PROSLO+1)); }
cervena() { printf '  \033[31m✗\033[0m %s\n' "$1"; SELHALO=$((SELHALO+1)); }
seda()   { printf '  \033[2m–\033[0m %s\n' "$1"; PRESKOCENO=$((PRESKOCENO+1)); }
nadpis() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# ---------------------------------------------------------------- sestavení
nadpis "Sestavení"
if npm run build > /tmp/kontrola-build.log 2>&1; then
  zelena "web se sestaví ($(find dist -type f | wc -l | tr -d ' ') souborů)"
else
  cervena "build spadl — podrobnosti v /tmp/kontrola-build.log"
  tail -5 /tmp/kontrola-build.log | sed 's/^/      /'
fi

# ------------------------------------------------- statické HTML vs šablony
# Každá stránka existuje dvakrát: jako statické HTML a jako šablona
# v main.js. Když se rozejdou, chyba se projeví až po prokliku zevnitř webu.
nadpis "Shoda stránek"
# Jediná správná odchylka: v ubytovani.html míří tlačítko Rezervovat
# pobyt na /ubytovani#rezervace, jinde na /#rezervace. Obojí funguje —
# směrování dává hashi přednost před cestou. Kontrola ji proto srovná.
hlavicka() {
  sed -n '/<header class="site-header">/,/<\/header>/p' "$1" \
    | sed 's|href="/ubytovani#rezervace"|href="/#rezervace"|'
}
ROZDILNE=""
for f in *.html; do
  [ "$f" = "admin.html" ] && continue   # admin hlavičku nemá
  if ! diff -q <(hlavicka index.html) <(hlavicka "$f") > /dev/null; then
    ROZDILNE="$ROZDILNE $f"
  fi
done
if [ -z "$ROZDILNE" ]; then
  zelena "hlavička je shodná na všech stránkách"
else
  cervena "hlavička se liší:$ROZDILNE"
fi

POCET_STRANEK=$(ls -1 *.html | wc -l | tr -d ' ')
POCET_VSTUPU=$(grep -cE "^\s+[a-z_]+: '[a-z0-9_.-]+\.html',?$" vite.config.js)
if [ "$POCET_STRANEK" = "$POCET_VSTUPU" ]; then
  zelena "všech $POCET_STRANEK stránek je v build.rollupOptions.input"
else
  cervena "stránek je $POCET_STRANEK, ale ve vite.config.js jen $POCET_VSTUPU"
fi

# --------------------------------------------------------------- matematika
nadpis "Ceník a rezervace"
if node kontrola/cenik.mjs; then zelena "matematika ceníku"; else cervena "matematika ceníku"; fi
if node kontrola/rezervace.mjs; then zelena "pravidla rezervace a zálohy"; else cervena "pravidla rezervace a zálohy"; fi
if node kontrola/plachta.mjs; then zelena "geometrie plachty dostupnosti"; else cervena "geometrie plachty dostupnosti"; fi
if node kontrola/pulene-dny.mjs; then zelena "půlené dny při překryvu termínů"; else cervena "půlené dny při překryvu termínů"; fi

# ------------------------------------------------------------------- klíče
# Do prohlížeče smí jen anon klíč. Servisní klíč a klíč k Resendu tam
# kdysi skončily a viděl je každý návštěvník.
nadpis "Klíče v balíčku"
if [ -d dist ]; then
  # Prohledávají se jen textové soubory, do kterých se klíč může dostat.
  # Prosté `grep -r dist/` sahá i do videa a fotek; regulární výraz
  # s {20,} nad binárními daty tam pak běží MINUTY a celá kontrola vypadá
  # zaseknutě. Klíč se navíc do .webp ani .mp4 zabalit nemůže.
  TEXTOVE=$(find dist -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.css' \
    -o -name '*.html' -o -name '*.json' -o -name '*.map' -o -name '*.txt' \
    -o -name '*.svg' -o -name '_headers' -o -name '*.xml' \) 2>/dev/null)
  NALEZ=0
  for vzorek in "service_role" "re_[A-Za-z0-9_]{20,}" "SUPABASE_SERVICE_ROLE" "sbp_[A-Za-z0-9]{20,}"; do
    if [ -n "$TEXTOVE" ] && printf '%s\n' "$TEXTOVE" | tr '\n' '\0' | xargs -0 grep -lsE "$vzorek" 2>/dev/null | grep -q .; then
      cervena "v dist/ je něco jako '$vzorek'"; NALEZ=1
    fi
  done
  [ $NALEZ = 0 ] && zelena "v balíčku není servisní klíč ani klíč k Resendu"
  if [ -f .env ]; then
    ANON=$(grep -E '^VITE_SUPABASE_ANON_KEY=' .env | cut -d= -f2-)
    if [ -n "$ANON" ] && grep -rqsF "$ANON" dist/assets/; then
      zelena "anon klíč v balíčku je (tak to má být — chrání ho pravidla v databázi)"
    else
      cervena "anon klíč v balíčku CHYBÍ — web se nepřipojí k databázi"
    fi
  else
    seda ".env chybí, anon klíč nekontroluji"
  fi
else
  seda "dist/ neexistuje, klíče nelze zkontrolovat"
fi

# ------------------------------------------------------------- typy e-mailů
# Nový typ zprávy musí přibýt i do POVOLENE_TYPY, jinak ho serverová
# funkce odmítne se stavem 400 a e-mail hostu nedojde.
# --------------------------------------------------- adresa recepce
# Upozornění pro recepci musí chodit na hotelovou adresu. Soukromá
# schránka majitele tu kdysi byla, dokud se doména překlápěla; do kódu
# se vracet nemá a v repozitáři (který je veřejný) nemá co dělat.
nadpis "Adresa recepce"
SOUKROMA=$(grep -rlE "ondra\.zeman05@|@gmail\.com" src netlify *.html 2>/dev/null | head -3)
if [ -z "$SOUKROMA" ]; then
  zelena "v kódu není soukromá adresa, jen hotelová"
else
  cervena "soukromá adresa v kódu: $(echo "$SOUKROMA" | tr '\n' ' ')"
fi

nadpis "Typy e-mailů"
CHYBEJICI=$(node --input-type=module -e "
import { readFileSync, readdirSync, statSync } from 'fs';
const soubory = [];
(function projdi(d){ for (const p of readdirSync(d)) { const c = d + '/' + p;
  statSync(c).isDirectory() ? projdi(c) : c.endsWith('.js') && soubory.push(c); } })('src');
const pouzite = new Set();
for (const s of soubory)
  for (const m of readFileSync(s,'utf8').matchAll(/sendEmail\(\{[^}]*?type:\s*'([a-z0-9_]+)'/gs)) pouzite.add(m[1]);
const fn = readFileSync('netlify/functions/send-email.js','utf8');
const blok = fn.slice(fn.indexOf('POVOLENE_TYPY'), fn.indexOf(']', fn.indexOf('POVOLENE_TYPY')));
const povolene = new Set([...blok.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]));
console.log([...pouzite].filter(t => !povolene.has(t)).join(' '));
" 2>/dev/null)
if [ -z "$CHYBEJICI" ]; then
  zelena "všechny odesílané typy jsou v POVOLENE_TYPY"
else
  cervena "chybí v POVOLENE_TYPY: $CHYBEJICI"
fi

# ------------------------------------------------- dialogy prohlížeče
# Administrace se musí ptát vlastním oknem (AdminPotvrzeni.js). Nativní
# confirm/alert vypadá jako hlášení prohlížeče, ne jako náš web, a Safari
# na iPhonu ho umí přebít vlastní hláškou o „dalších dialozích".
# --------------------------------------------------------- zvláštní období
nadpis "Svátky a zimní přestávka"
if VYSTUP=$(node kontrola/terminy.mjs 2>&1); then
  zelena "minimum nocí, Silvestr a zimní přestávka"
else
  cervena "zvláštní období: $(echo "$VYSTUP" | grep '✗' | head -2 | tr '\n' ' ')"
fi

# ------------------------------------------------------------- export
nadpis "Export kontaktů"
if VYSTUP=$(node kontrola/export.mjs 2>&1); then
  zelena "export kontaktů a rezervací"
else
  cervena "export kontaktů: $(echo "$VYSTUP" | grep '✗' | head -2 | tr '\n' ' ')"
fi

# ------------------------------------------------- escapování v administraci
# Jméno a poznámka hosta i text recenze píše kdokoli z internetu a jdou
# do innerHTML v administraci. Bez escapování stačilo odeslat rezervaci
# se značkou a kód se spustil recepčnímu s platnou relací, která má
# v databázi přístup ke všemu.
nadpis "Escapování cizího textu"
NEESCAPOVANE=$(grep -nE '\$\{(r|reservation)\.(guest_name|guest_note|guest_email|guest_phone|text|author_name|room_name)[^}]*\}' \
  src/components/AdminDashboard.js src/utils/printReservationService.js 2>/dev/null \
  | grep -v 'escapujText\|escapujTisk' || true)
if [ -z "$NEESCAPOVANE" ]; then
  zelena "cizí text jde do administrace jen escapovaný"
else
  cervena "neescapovaný cizí text: $(echo "$NEESCAPOVANE" | head -2 | tr '\n' ' ')"
fi

nadpis "Dialogy"
NATIVNI=$(grep -rn -E "(^|[^.\w])(window\.)?(confirm|alert|prompt)\(" src --include='*.js' \
  | grep -v "AdminPotvrzeni.js" \
  | grep -vE ':[0-9]+: *(//|\*|/\*)' || true)   # komentáře o alert() nejsou volání
if [ -z "$NATIVNI" ]; then
  zelena "administrace nepoužívá dialogy prohlížeče"
else
  cervena "nativní dialog prohlížeče: $(echo "$NATIVNI" | head -3 | tr '\n' ' ')"
fi

# ------------------------------------------------- podklad hero fotek
# Bez náhledu svítí na místě hero fotky tmavá plocha, dokud se nestáhne —
# na mobilu to byly klidně tři vteřiny.
nadpis "Hero fotky"
CHYBI_LQIP=""
for TRIDA in hero-summer-poster hero-rooms-poster hero-events-poster \
             hero-activities-poster hero-news-poster hero-contact-poster \
             hero-category-poster-turistika hero-category-poster-cyklistika \
             hero-category-poster-zimni-vylety hero-category-poster-vylety-autem; do
  grep -q "^\.$TRIDA { background-image: linear-gradient(" src/style.css \
    || CHYBI_LQIP="$CHYBI_LQIP $TRIDA"
done
if [ -z "$CHYBI_LQIP" ]; then
  zelena "všechny hero fotky mají barevný podklad v CSS"
else
  cervena "hero fotka bez podkladu:$CHYBI_LQIP"
fi

if [ $BEZ_SITE = 1 ]; then
  nadpis "Souhrn"
  printf "  prošlo %s, selhalo %s, přeskočeno %s (bez sítě)\n\n" "$PROSLO" "$SELHALO" "$PRESKOCENO"
  exit $([ "$SELHALO" -gt 0 ] && echo 1 || echo 0)
fi

# ------------------------------------------------------------- nasazený web
nadpis "Nasazený web"
if ! curl -s --max-time 10 -o /dev/null "$WEB/"; then
  seda "web není dostupný — přeskakuji zbytek"
else
  for cesta in "/" "/ubytovani" "/stravovani" "/akce" "/okoli" "/aktuality" "/kontakt" "/admin" "/podminky" "/gdpr" "/cookies"; do
    KOD=$(curl -s --max-time 15 -o /dev/null -w "%{http_code}" "$WEB$cesta")
    [ "$KOD" = "200" ] && zelena "$cesta" || cervena "$cesta vrací $KOD"
  done

  # Web nesmí odkazovat na zdrojáky — na produkci /src/ neexistuje.
  if curl -s --max-time 15 "$WEB/" | grep -q '/src/main.js'; then
    cervena "stránka odkazuje na /src/main.js — je nasazený nesestavený repozitář"
  else
    zelena "stránka odkazuje na sestavený balíček"
  fi

  nadpis "Serverové funkce"
  ODP=$(curl -s --max-time 20 -X POST "$WEB/.netlify/functions/upload-news-image" \
        -H "Content-Type: application/json" -d '{"base64":"aGk=","contentType":"image/jpeg"}')
  echo "$ODP" | grep -q "přihlášená recepce" \
    && zelena "nahrání fotky vyžaduje přihlášení" \
    || cervena "nahrání fotky nechrání přihlášení: $ODP"

  KOD=$(curl -s --max-time 20 -o /dev/null -w "%{http_code}" -X POST "$WEB/.netlify/functions/send-email" \
        -H "Content-Type: application/json" -H "Origin: https://cizi-web.example" \
        -d '{"to":"nikdo@example.com","subject":"x","html":"x","type":"test"}')
  [ "$KOD" = "403" ] || [ "$KOD" = "401" ] \
    && zelena "odesílání e-mailů odmítá cizí původ ($KOD)" \
    || cervena "odesílání e-mailů přijalo cizí původ ($KOD)"

  # BEZ hlavičky Origin. Tuhle cestu dřív funkce pouštěla („když Origin
  # chybí, je to volání zevnitř“), jenže hlavičku posílá jen prohlížeč —
  # curl a jakýkoli skript ji vynechá, takže se kontrola obešla jedním
  # příkazem. Tělo je schválně neplatné: 403 = zastaveno na původu,
  # 400 = původ prošel a spadlo to až na validaci.
  KOD=$(curl -s --max-time 20 -o /dev/null -w "%{http_code}" -X POST "$WEB/.netlify/functions/send-email" \
        -H "Content-Type: application/json" -d '{}')
  [ "$KOD" = "403" ] \
    && zelena "odesílání e-mailů odmítá požadavek bez původu" \
    || cervena "odesílání e-mailů pustilo požadavek BEZ hlavičky Origin ($KOD) — obejde se curlem!"

  # Cizí web na netlify.app. Takovou adresu si zadarmo pořídí kdokoli,
  # takže obecné pravidlo na *.netlify.app byla otevřená pošta.
  KOD=$(curl -s --max-time 20 -o /dev/null -w "%{http_code}" -X POST "$WEB/.netlify/functions/send-email" \
        -H "Content-Type: application/json" -H "Origin: https://cizi-utocnik-test.netlify.app" -d '{}')
  [ "$KOD" = "403" ] \
    && zelena "odesílání e-mailů odmítá cizí web na netlify.app" \
    || cervena "odesílání e-mailů pustilo cizí netlify.app ($KOD)"
fi

# ------------------------------------------------------------------ databáze
nadpis "Databáze a zabezpečení"
if [ ! -f .env ]; then
  seda ".env chybí, databázi nelze zkontrolovat"
else
  set -a; . ./.env; set +a
  A="apikey: ${VITE_SUPABASE_ANON_KEY}"
  B="Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}"

  # Veřejný kalendář smí číst jen termíny, ne jména a kontakty hostů.
  # Pozor na výklad odpovědi: pravidla v databázi řádky FILTRUJÍ, nevrací
  # chybu. Prázdné pole [] tedy znamená „zavřeno", ne „rozbito". Chyba
  # přijde jen tam, kde je odepřený rovnou sloupec (osobní údaje hostů).
  prazdne_nebo_chyba() { [ "$1" = "[]" ] || echo "$1" | grep -q '"code"'; }

  ODP=$(curl -s --max-time 20 "$VITE_SUPABASE_URL/rest/v1/reservations?select=guest_name,guest_email&limit=1" -H "$A" -H "$B")
  prazdne_nebo_chyba "$ODP" \
    && zelena "osobní údaje hostů jsou pro veřejnost zavřené" \
    || cervena "anon klíčem jdou přečíst jména a e-maily hostů!"

  ODP=$(curl -s --max-time 20 "$VITE_SUPABASE_URL/rest/v1/reservations?select=room_id,date_from,date_to,status&limit=1" -H "$A" -H "$B")
  echo "$ODP" | grep -q '^\[' \
    && zelena "veřejný kalendář si termíny přečte" \
    || cervena "veřejný kalendář si termíny nepřečte: $ODP"

  ODP=$(curl -s --max-time 20 "$VITE_SUPABASE_URL/rest/v1/contact_messages?select=*&limit=1" -H "$A" -H "$B")
  prazdne_nebo_chyba "$ODP" \
    && zelena "zprávy z kontaktního formuláře jsou zavřené" \
    || cervena "anon klíčem jdou přečíst kontaktní zprávy!"

  # Nová recenze čeká na schválení, veřejnosti se ukáže až potom.
  ODP=$(curl -s --max-time 20 "$VITE_SUPABASE_URL/rest/v1/reviews?select=status" -H "$A" -H "$B")
  # Skutečná hodnota je `pending_approval`. Vzorek `"status":"pending"`
  # ji sice jako předponu chytí, ale jen náhodou — a kdyby se stav
  # přejmenoval, kontrola by tiše přestala hlídat cokoli.
  echo "$ODP" | grep -q '"status":"pending_approval"' \
    && cervena "neschválené recenze jsou vidět veřejně!" \
    || zelena "veřejně jsou vidět jen schválené recenze"

  # Zápis do ceníku musí být zavřený.
  #
  # Samotný stavový kód to nepozná: pravidla řádek odfiltrují, takže
  # „aktualizováno nula řádků" i „zakázáno" vrátí 204. Rozhodne až
  # `Prefer: return=representation` — zavřený zápis vrátí prázdné pole.
  # Zapisuje se schválně TÁŽ hodnota, jaká tam už je, aby ani při
  # otevřených pravidlech kontrola nic nezměnila.
  RADEK=$(curl -s --max-time 20 "$VITE_SUPABASE_URL/rest/v1/cenik_nastaveni?select=klic,hodnota&limit=1" \
          -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY:-$VITE_SUPABASE_ANON_KEY}" \
          -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY:-$VITE_SUPABASE_ANON_KEY}")
  KLIC=$(echo "$RADEK" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d)[0].klic)}catch{}})')
  HODN=$(echo "$RADEK" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d)[0].hodnota)}catch{}})')
  if [ -n "$KLIC" ]; then
    ODP=$(curl -s --max-time 20 -X PATCH "$VITE_SUPABASE_URL/rest/v1/cenik_nastaveni?klic=eq.$KLIC" \
          -H "$A" -H "$B" -H "Content-Type: application/json" -H "Prefer: return=representation" \
          -d "{\"hodnota\":$HODN}")
    prazdne_nebo_chyba "$ODP" \
      && zelena "ceník nejde přepsat veřejným klíčem" \
      || cervena "ceník JE zapisovatelný veřejným klíčem!"
  else
    seda "ceník je prázdný, zápis nekontroluji"
  fi

  if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    ODP=$(curl -s --max-time 20 "$VITE_SUPABASE_URL/storage/v1/bucket" \
          -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
    echo "$ODP" | grep -q 'aktuality-images' \
      && zelena "úložiště aktuality-images existuje" \
      || cervena "úložiště aktuality-images chybí — nahrání fotky selže"

    POCET=$(curl -s --max-time 20 "$VITE_SUPABASE_URL/auth/v1/admin/users" \
            -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).users.length)}catch{console.log("?")}})')
    [ "$POCET" = "1" ] \
      && zelena "v Supabase Auth je jediný účet (žádný testovací nezůstal)" \
      || cervena "v Supabase Auth je účtů: $POCET — zkontrolujte, jestli tam nezůstal testovací"
  else
    seda "servisní klíč není v .env, úložiště a účty nekontroluji"
  fi
fi

# --------------------------------------------- registrace a zápisová pravidla
# Tyhle tři věci se nastavují RUČNĚ v Supabase (viz supabase-ZABEZPECENI-2.sql
# a přepínač registrací v Auth). Kontrola je tu proto, že se dají kdykoli
# omylem vrátit zpátky — a poznat by to šlo až podle podvržené recenze.
nadpis "Zápis z veřejného klíče"
if [ ! -f .env ]; then
  seda ".env chybí, zápisová pravidla nelze zkontrolovat"
else
  set -a; . ./.env; set +a
  H="apikey: ${VITE_SUPABASE_ANON_KEY}"
  J="Content-Type: application/json"

  ODP=$(curl -s --max-time 15 -X POST "$VITE_SUPABASE_URL/auth/v1/signup" -H "$H" -H "$J" \
    -d '{"email":"kontrola-registrace@umustku.cz","password":"Kontrola-Hesloo-123456"}')
  if echo "$ODP" | grep -q "signup_disabled"; then
    zelena "veřejné registrace jsou vypnuté"
  else
    cervena "REGISTRACE JSOU OTEVŘENÉ — kdokoli si založí účet do administrace"
  fi

  ODP=$(curl -s --max-time 15 -X POST "$VITE_SUPABASE_URL/rest/v1/reviews" -H "$H" -H "$J" \
    -d '{"id":"kontrola-rls-recenze","full_name":"Kontrola","author_name":"Kontrola","text":"x","date":"01. 01. 2026","status":"approved","created_at":"2026-01-01T00:00:00.000Z"}')
  if echo "$ODP" | grep -q "42501"; then
    zelena "recenzi nejde vložit rovnou jako schválenou"
  else
    cervena "PODVRŽENÁ RECENZE PROJDE — vloží se rovnou jako schválená"
  fi

  ODP=$(curl -s --max-time 15 -X POST "$VITE_SUPABASE_URL/rest/v1/reservations" -H "$H" -H "$J" \
    -d '{"id":"00000000-0000-0000-0000-0000000000aa","code":"KONTROLA-RLS","manage_token":"x","room_id":"p6","room_name":"Pokoj 6 - Standard","date_from":"2027-01-10","date_to":"2027-01-12","adults_count":2,"guest_name":"Kontrola","guest_email":"kontrola@example.com","guest_phone":"1","status":"confirmed","total_price":0,"deposit_price":0,"remaining_price":0}')
  if echo "$ODP" | grep -q "42501"; then
    zelena "rezervaci nejde vložit rovnou jako potvrzenou"
  else
    cervena "PODVRŽENÁ REZERVACE PROJDE — vloží se rovnou jako potvrzená"
  fi
fi

nadpis "Souhrn"
if [ "$SELHALO" -gt 0 ]; then
  printf "  \033[31mprošlo %s, SELHALO %s\033[0m, přeskočeno %s\n\n" "$PROSLO" "$SELHALO" "$PRESKOCENO"
  exit 1
fi
printf "  \033[32mprošlo všech %s kontrol\033[0m, přeskočeno %s\n\n" "$PROSLO" "$PRESKOCENO"
