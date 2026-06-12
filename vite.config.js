import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// Parse .env file locally at build-time
let geminiApiKey = 'AIzaSyDcg7b9EQB4cvsUQx5fnR_CwSeMUr-RGv8';
let fbApiKey = '';
let fbAuthDomain = '';
let fbProjectId = '';
let fbStorageBucket = '';
let fbMessagingSenderId = '';
let fbAppId = '';

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
    fbProjectId = getVal('VITE_FIREBASE_PROJECT_ID');
    fbStorageBucket = getVal('VITE_FIREBASE_STORAGE_BUCKET');
    fbMessagingSenderId = getVal('VITE_FIREBASE_MESSAGING_SENDER_ID');
    fbAppId = getVal('VITE_FIREBASE_APP_ID');
  } catch (err) {
    console.error('Error reading .env file:', err);
  }
}

export default defineConfig({
  define: {
    '__VITE_GEMINI_API_KEY__': JSON.stringify(geminiApiKey),
    '__VITE_FIREBASE_API_KEY__': JSON.stringify(fbApiKey),
    '__VITE_FIREBASE_AUTH_DOMAIN__': JSON.stringify(fbAuthDomain),
    '__VITE_FIREBASE_PROJECT_ID__': JSON.stringify(fbProjectId),
    '__VITE_FIREBASE_STORAGE_BUCKET__': JSON.stringify(fbStorageBucket),
    '__VITE_FIREBASE_MESSAGING_SENDER_ID__': JSON.stringify(fbMessagingSenderId),
    '__VITE_FIREBASE_APP_ID__': JSON.stringify(fbAppId)
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
