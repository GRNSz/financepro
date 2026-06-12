import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// Parse .env file locally at build-time
let geminiApiKey = 'AIzaSyDcg7b9EQB4cvsUQx5fnR_CwSeMUr-RGv8';
let fbApiKey = '';
let fbAuthDomain = '';
let fbDatabaseUrl = '';
let fbProjectId = '';
let fbStorageBucket = '';
let fbMessagingSenderId = '';
let fbAppId = '';
let fbMeasurementId = '';

if (fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const getVal = key => {
      const match = envContent.match(new RegExp(`${key}\\s*=\\s*([^\\n\\r]*)`));
      return match && match[1] ? match[1].trim() : '';
    };
    
    geminiApiKey = getVal('VITE_GEMINI_API_KEY') || geminiApiKey;
    fbApiKey = getVal('VITE_FIREBASE_API_KEY');
    fbAuthDomain = getVal('VITE_FIREBASE_AUTH_DOMAIN');
    fbDatabaseUrl = getVal('VITE_FIREBASE_DATABASE_URL');
    fbProjectId = getVal('VITE_FIREBASE_PROJECT_ID');
    fbStorageBucket = getVal('VITE_FIREBASE_STORAGE_BUCKET');
    fbMessagingSenderId = getVal('VITE_FIREBASE_MESSAGING_SENDER_ID');
    fbAppId = getVal('VITE_FIREBASE_APP_ID');
    fbMeasurementId = getVal('VITE_FIREBASE_MEASUREMENT_ID');
  } catch (err) {
    console.error('Error reading .env file:', err);
  }
}

export default defineConfig({
  define: {
    '__VITE_GEMINI_API_KEY__': JSON.stringify(geminiApiKey),
    '__VITE_FIREBASE_API_KEY__': JSON.stringify(fbApiKey),
    '__VITE_FIREBASE_AUTH_DOMAIN__': JSON.stringify(fbAuthDomain),
    '__VITE_FIREBASE_DATABASE_URL__': JSON.stringify(fbDatabaseUrl),
    '__VITE_FIREBASE_PROJECT_ID__': JSON.stringify(fbProjectId),
    '__VITE_FIREBASE_STORAGE_BUCKET__': JSON.stringify(fbStorageBucket),
    '__VITE_FIREBASE_MESSAGING_SENDER_ID__': JSON.stringify(fbMessagingSenderId),
    '__VITE_FIREBASE_APP_ID__': JSON.stringify(fbAppId),
    '__VITE_FIREBASE_MEASUREMENT_ID__': JSON.stringify(fbMeasurementId)
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
                let envContent = '';
                if (fs.existsSync('.env')) {
                  envContent = fs.readFileSync('.env', 'utf8');
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
                  fs.writeFileSync('.env', lines.join('\n'), 'utf8');
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                } else {
                  lines = lines.filter(line => !line.startsWith('VITE_GEMINI_API_KEY='));
                  fs.writeFileSync('.env', lines.join('\n'), 'utf8');
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
    },
    {
      name: 'html-replace-plugin',
      transformIndexHtml(html) {
        return html
          .replace(/__VITE_GEMINI_API_KEY__/g, geminiApiKey)
          .replace(/__VITE_FIREBASE_API_KEY__/g, fbApiKey)
          .replace(/__VITE_FIREBASE_AUTH_DOMAIN__/g, fbAuthDomain)
          .replace(/__VITE_FIREBASE_DATABASE_URL__/g, fbDatabaseUrl)
          .replace(/__VITE_FIREBASE_PROJECT_ID__/g, fbProjectId)
          .replace(/__VITE_FIREBASE_STORAGE_BUCKET__/g, fbStorageBucket)
          .replace(/__VITE_FIREBASE_MESSAGING_SENDER_ID__/g, fbMessagingSenderId)
          .replace(/__VITE_FIREBASE_APP_ID__/g, fbAppId)
          .replace(/__VITE_FIREBASE_MEASUREMENT_ID__/g, fbMeasurementId);
      }
    }
  ]
});
