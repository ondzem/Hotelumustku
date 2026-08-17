import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Načte i proměnné BEZ předpony VITE_ (prázdný třetí parametr).
  // Zůstávají jen tady na serveru, do prohlížeče se nedostanou —
  // Vite do balíčku vkládá výhradně proměnné s předponou VITE_.
  const env = loadEnv(mode, process.cwd(), '');
  for (const klic of ['RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL']) {
    if (env[klic] && !process.env[klic]) process.env[klic] = env[klic];
  }

  return {
  server: {
    port: 5173,
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
              const pozadavek = new Request('http://localhost/.netlify/functions/send-email', {
                method: req.method || 'POST',
                headers: { 'Content-Type': 'application/json' },
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
              const pozadavek = new Request('http://localhost/.netlify/functions/upload-news-image', {
                method: req.method || 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : Buffer.concat(kusy).toString('utf8')
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
