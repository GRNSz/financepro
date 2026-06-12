import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'save-env-plugin',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/save-env' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const { key } = JSON.parse(body);
                let envContent = '';
                const envPath = path.join(__dirname, '.env');
                if (fs.existsSync(envPath)) {
                  envContent = fs.readFileSync(envPath, 'utf8');
                }
                
                let lines = envContent.split(/\r?\n/);
                
                if (key && key.trim()) {
                  let found = false;
                  lines = lines.map(line => {
                    if (line.startsWith('VITE_GEMINI_API_KEY=')) {
                      found = true;
                      return `VITE_GEMINI_API_KEY=${key.trim()}`;
                    }
                    return line;
                  });
                  if (!found) {
                    lines.push(`VITE_GEMINI_API_KEY=${key.trim()}`);
                  }
                  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                } else {
                  lines = lines.filter(line => !line.startsWith('VITE_GEMINI_API_KEY='));
                  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, removed: true }));
                }
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ]
});
