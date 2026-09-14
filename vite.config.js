import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Načte i proměnné BEZ předpony VITE_ (prázdný třetí parametr).
  // Zůstávají jen tady na serveru, do prohlížeče se nedostanou —
  // Vite do balíčku vkládá výhradně proměnné s předponou VITE_.
  const env = loadEnv(mode, process.cwd(), '');
  // VITE_SUPABASE_ANON_KEY tu musí být taky: serverová funkce pro fotky
  // jím ověřuje token přihlášené recepce a bez něj vrací 500.
  for (const klic of ['RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
    if (env[klic] && !process.env[klic]) process.env[klic] = env[klic];
  }

  return {
  server: {
    // Port jde přebít proměnnou PORT. Kvůli souběžné práci ve více
    // pracovních kopiích (git worktree) — na 5173 běží jen ta první,
    // ostatní by jinak nenastartovaly.
    port: Number(process.env.PORT) || 5173,
    strictPort: true
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
        ubytovani: 'ubytovani.html',
        stravovani: 'stravovani.html',
        akce: 'akce.html',
        okoli: 'okoli.html',
        okoli_turistika: 'okoli-turistika.html',
        okoli_cyklistika: 'okoli-cyklistika.html',
        okoli_zima: 'okoli-zima.html',
        okoli_vylety_autem: 'okoli-vylety-autem.html',
        aktuality: 'aktuality.html',
        kontakt: 'kontakt.html',
        gdpr: 'gdpr.html',
        cookies: 'cookies.html',
        podminky: 'podminky.html'
      }
    }
  },
  plugins: [
    {
      name: 'clean-urls-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.method === 'GET' && !req.url.startsWith('/api') && !req.url.includes('.')) {
            const cleanPath = req.url.split('?')[0].split('#')[0].replace(/\/$/, '');
            const queryAndHash = req.url.slice(cleanPath.length);
            if (cleanPath === '/admin' || cleanPath === '/recepce') {
              req.url = '/admin.html' + queryAndHash;
            } else if (cleanPath === '/ubytovani' || cleanPath === '/pokoje') {
              req.url = '/ubytovani.html' + queryAndHash;
            } else if (cleanPath === '/stravovani') {
              req.url = '/stravovani.html' + queryAndHash;
            } else if (cleanPath === '/akce') {
              req.url = '/akce.html' + queryAndHash;
            } else if (cleanPath === '/okoli') {
              req.url = '/okoli.html' + queryAndHash;
            } else if (cleanPath === '/kontakt') {
              req.url = '/kontakt.html' + queryAndHash;
            } else if (cleanPath === '/aktuality') {
              req.url = '/aktuality.html' + queryAndHash;
            } else if (cleanPath === '/gdpr') {
              req.url = '/gdpr.html' + queryAndHash;
            } else if (cleanPath === '/cookies') {
              req.url = '/cookies.html' + queryAndHash;
            } else if (cleanPath === '/podminky') {
              req.url = '/podminky.html' + queryAndHash;
            }
          }
          next();
        });
      }
    },
    {
      /**
       * Zpřístupní serverovou funkci pro odesílání e-mailů i při
       * běžném `npm run dev`. Vývojový server Vite serverové funkce
       * nezná, takže by adresa /.netlify/functions/send-email vracela
       * 404 a e-maily by lokálně nechodily.
       *
       * Volá se PŘESNĚ TÁŽ funkce jako na produkci, takže se chování
       * nemůže rozejít. Klíč zůstává na serveru, prohlížeč ho nevidí.
       */
      name: 'serverova-funkce-emailu-ve-vyvoji',
      configureServer(server) {
        server.middlewares.use('/.netlify/functions/send-email', async (req, res) => {
          let telo = '';
          req.on('data', (kus) => { telo += kus; });
          req.on('end', async () => {
            try {
              const { default: handler } = await import('./netlify/functions/send-email.js');
              // Origin i Authorization se MUSÍ přenést. Funkce teď žádost
              // bez Origin odmítá (jinak by kontrolu obešel každý skript)
              // a u zkušebních e-mailů chce token přihlášené recepce —
              // bez přenosu by lokální vývoj hlásil 403 a 401.
              const hlavicky = { 'Content-Type': 'application/json' };
              if (req.headers.origin) hlavicky.Origin = req.headers.origin;
              if (req.headers.authorization) hlavicky.Authorization = req.headers.authorization;
              const pozadavek = new Request('http://localhost/.netlify/functions/send-email', {
                method: req.method || 'POST',
                headers: hlavicky,
                body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : telo
              });
              const odpoved = await handler(pozadavek);
              res.statusCode = odpoved.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(await odpoved.text());
            } catch (err) {
              console.error('Chyba serverové funkce e-mailu ve vývoji:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(err && err.message) }));
            }
          });
        });
      }
    },
    {
      /**
       * Totéž pro nahrávání fotek aktualit. Bez toho by šlo fotku
       * přidat jen na produkci a lokálně by administrace hlásila 404.
       *
       * Limit těla je vyšší než u e-mailů — fotka jde jako base64,
       * což je zhruba o třetinu víc znaků než samotný soubor.
       */
      name: 'serverova-funkce-fotek-ve-vyvoji',
      configureServer(server) {
        server.middlewares.use('/.netlify/functions/upload-news-image', async (req, res) => {
          const kusy = [];
          req.on('data', (kus) => kusy.push(kus));
          req.on('end', async () => {
            try {
              const { default: handler } = await import('./netlify/functions/upload-news-image.js');
              // Hlavička Authorization se MUSÍ přenést. Bez ní funkce
              // nepozná přihlášenou recepci a lokálně vždycky vrátí 401,
              // takže nahrání fotky ve vývoji nešlo vůbec vyzkoušet.
              // Typ obsahu se MUSÍ přenést — funkce z něj pozná formát fotky
              // a bez něj by odmítla i platný WebP. Tělo jde jako binárka,
              // ne jako text; převod na utf8 by fotku rozbil.
              const hlavicky = { 'Content-Type': req.headers['content-type'] || 'application/octet-stream' };
              if (req.headers.authorization) hlavicky.Authorization = req.headers.authorization;
              const pozadavek = new Request('http://localhost/.netlify/functions/upload-news-image', {
                method: req.method || 'POST',
                headers: hlavicky,
                body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : Buffer.concat(kusy)
              });
              const odpoved = await handler(pozadavek);
              res.statusCode = odpoved.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(await odpoved.text());
            } catch (err) {
              console.error('Chyba serverové funkce fotek ve vývoji:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(err && err.message) }));
            }
          });
        });
      }
    }
  ]
  };
});
