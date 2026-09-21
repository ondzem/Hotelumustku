#!/usr/bin/env bash
# Změna hesla do administrace a odhlášení VŠECH přihlášených zařízení.
#
# Heslo se zadává jen sem do terminálu (nezobrazuje se) a nikam jinam
# nechodí — ani do chatu, ani do repozitáře. Proto skript, a ne úprava
# v administraci přes cizí ruce: jakmile heslo jednou padne do zprávy,
# je vidět v historii a musí se měnit znovu.
#
# Postup:
#   1. servisním klíčem nastaví účtu nové heslo,
#   2. tím heslem se přihlásí (ověří, že opravdu platí),
#   3. odhlásí VŠECHNY relace toho účtu (scope=global) — všechny
#      prohlížeče, telefony i tablety musí zadat nové heslo.
#
# Otevřená administrace vypadne při dalším obnovení stránky, nejpozději
# do hodiny (tak dlouho platí už vydaný přístupový token).
#
# Použití:  ./zmenit-heslo-recepce.sh            (účet z VITE_ADMIN_EMAIL)
#           ./zmenit-heslo-recepce.sh jiny@mail   (jiný účet)
set -euo pipefail
cd "$(dirname "$0")"

set -a; . ./.env; [ -f .env.local ] && . ./.env.local; set +a
: "${VITE_SUPABASE_URL:?Chybí VITE_SUPABASE_URL v .env}"
: "${VITE_SUPABASE_ANON_KEY:?Chybí VITE_SUPABASE_ANON_KEY v .env}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Chybí SUPABASE_SERVICE_ROLE_KEY v .env}"

MAIL="${1:-${VITE_ADMIN_EMAIL:-}}"
[ -n "$MAIL" ] || { echo "Chybí e-mail účtu (VITE_ADMIN_EMAIL nebo první parametr)."; exit 1; }

# Nové heslo: z proměnné NOVE_HESLO (jen pro automatické zkoušky),
# jinak se zeptá dvakrát bez zobrazení.
if [ -n "${NOVE_HESLO:-}" ]; then
  HESLO="$NOVE_HESLO"
else
  read -r -s -p "Nové heslo pro $MAIL: " HESLO; echo
  read -r -s -p "Zopakujte heslo: " HESLO2; echo
  [ "$HESLO" = "$HESLO2" ] || { echo "Hesla se neshodují, nic se nezměnilo."; exit 1; }
fi
[ -n "$HESLO" ] || { echo "Heslo je prázdné, nic se nezměnilo."; exit 1; }

json() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }
pole() { python3 -c 'import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1]))' "$1"; }

# --- 1. najít účet ------------------------------------------------------
ID=$(curl -s "$VITE_SUPABASE_URL/auth/v1/admin/users?per_page=1000" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  | pole "next((u['id'] for u in d.get('users',[]) if u.get('email','').lower()==$(json "$(echo "$MAIL" | tr '[:upper:]' '[:lower:]')")), '')")
[ -n "$ID" ] || { echo "Účet $MAIL v Supabase neexistuje."; exit 1; }

# --- 2. nastavit heslo --------------------------------------------------
KOD=$(curl -s -o /tmp/zmena-hesla.$$ -w '%{http_code}' -X PUT "$VITE_SUPABASE_URL/auth/v1/admin/users/$ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -d "{\"password\": $(json "$HESLO")}")
if [ "$KOD" != "200" ]; then
  echo "Heslo se nepodařilo nastavit (HTTP $KOD):"; cat /tmp/zmena-hesla.$$; echo
  rm -f /tmp/zmena-hesla.$$; exit 1
fi
rm -f /tmp/zmena-hesla.$$
echo "✓ Heslo pro $MAIL je změněné."

# --- 3. přihlásit se novým heslem a odhlásit všechna zařízení -----------
TOKEN=$(curl -s -X POST "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\": $(json "$MAIL"), \"password\": $(json "$HESLO")}" | pole "d.get('access_token','')")
unset HESLO HESLO2 NOVE_HESLO
[ -n "$TOKEN" ] || { echo "Novým heslem se nepodařilo přihlásit — odhlášení zařízení NEPROBĚHLO."; exit 1; }

KOD=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$VITE_SUPABASE_URL/auth/v1/logout?scope=global" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN")
[ "$KOD" = "204" ] || { echo "Odhlášení všech zařízení selhalo (HTTP $KOD)."; exit 1; }
echo "✓ Všechna zařízení jsou odhlášená — všude se musí zadat nové heslo."
