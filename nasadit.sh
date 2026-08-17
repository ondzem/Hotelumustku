#!/bin/sh
# Uloží commitnutou práci na GitHub, sestaví web a nasadí ho na Netlify.
# Netlify si build z GitHubu neumí postavit sám (vite build na jejich
# Linuxu neběží), proto se staví tady a nahrává hotový dist.
cd "$(dirname "$0")" || exit 1

# 1) GitHub — pushne, co je commitnuté. Necommitnuté změny nechává být.
git push origin main || exit 1

# 2) Build + Netlify. Token se čte z .env, bez přihlašování.
npm run build || exit 1
export NETLIFY_AUTH_TOKEN=$(grep '^NETLIFY_AUTH_TOKEN=' .env | cut -d= -f2)
npx --yes netlify-cli@latest deploy --prod --dir dist --functions netlify/functions \
  --site 598a91c5-9a28-47bd-8a67-3a4b3cf6bc14 --message "build $(git rev-parse --short HEAD)"
