import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        ubytovani: 'ubytovani.html',
        stravovani: 'stravovani.html',
        akce: 'akce.html',
        okoli: 'okoli.html',
        aktuality: 'aktuality.html',
        kontakt: 'kontakt.html'
      }
    }
  },
  plugins: [
    {
      name: 'resend-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/resend/emails', async (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const apiKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY || '';
                const authHeader = req.headers['authorization'] || (apiKey ? `Bearer ${apiKey}` : '');
                const resendResponse = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                  },
                  body: body
                });
                const data = await resendResponse.json();
                res.statusCode = resendResponse.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err) {
                console.error('Vite Resend Middleware Error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          } else {
            res.statusCode = 405;
            res.end('Method Not Allowed');
          }
        });
      }
    }
  ]
});
