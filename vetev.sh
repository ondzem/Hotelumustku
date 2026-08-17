#!/bin/bash
# Založí novou pracovní kopii (git worktree) vedle projektu.
#
# Použití:  ./vetev.sh nazev
# Vznikne:  ../hotel-vetve/nazev  na větvi  prace/nazev
#
# Kopie sdílí node_modules s hlavní složkou (symlink) a dostane vlastní
# .env, protože ten se do gitu záměrně nedává.

set -e

NAZEV="$1"
if [ -z "$NAZEV" ]; then
  echo "Použití: ./vetev.sh nazev-ukolu"
  exit 1
fi

HLAVNI="$(cd "$(dirname "$0")" && pwd)"
CIL="$HLAVNI/../hotel-vetve/$NAZEV"

if [ -e "$CIL" ]; then
  echo "Složka $CIL už existuje."
  exit 1
fi

git -C "$HLAVNI" worktree add "$CIL" -b "prace/$NAZEV"
ln -sfn "$HLAVNI/node_modules" "$CIL/node_modules"
[ -f "$HLAVNI/.env" ] && cp "$HLAVNI/.env" "$CIL/.env"

echo
echo "Hotovo. Otevři v Claude Code složku:"
echo "  $CIL"
