import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// Parse .env file locally at build-time
let apiKey = 'AIzaSyDcg7b9EQB4cvsUQx5fnR_CwSeMUr-RGv8';
if (fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const match = envContent.match(/VITE_GEMINI_API_KEY\s*=\s*(.*)/);
    if (match && match[1]) {
      apiKey = match[1].trim();
    }
  } catch (err) {
    console.error('Error reading .env file:', err);
  }
}

export default defineConfig({
  define: {
    '__VITE_GEMINI_API_KEY__': JSON.stringify(apiKey)
  },
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
                if (key && key.trim()) {
                  fs.writeFileSync('.env', `VITE_GEMINI_API_KEY=${key.trim()}\n`, 'utf8');
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                } else {
                  if (fs.existsSync('.env')) {
                    fs.unlinkSync('.env');
                  }
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
