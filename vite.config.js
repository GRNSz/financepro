import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import http from 'http';

let ngrokProcess = null;
let ngrokUrl = '';

function getNgrokUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.tunnels && parsed.tunnels.length > 0) {
            const tunnel = parsed.tunnels.find(t => t.proto === 'https' || t.proto === 'http');
            if (tunnel) {
              resolve(tunnel.public_url);
            } else {
              resolve(parsed.tunnels[0].public_url);
            }
          } else {
            reject(new Error('Nenhum túnel ativo encontrado'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

const envPath = path.join(__dirname, '.env');

function getNgrokTokenFromEnv() {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const line = lines.find(l => l.startsWith('NGROK_AUTHTOKEN='));
    if (line) {
      return line.substring('NGROK_AUTHTOKEN='.length).trim();
    }
  }
  return '';
}

function saveNgrokTokenToEnv(token) {
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  let lines = envContent.split(/\r?\n/);
  let found = false;
  lines = lines.map(line => {
    if (line.startsWith('NGROK_AUTHTOKEN=')) {
      found = true;
      return `NGROK_AUTHTOKEN=${token.trim()}`;
    }
    return line;
  });
  if (!found) {
    lines.push(`NGROK_AUTHTOKEN=${token.trim()}`);
  }
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

function configureNgrokToken(token) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ngrok', ['config', 'add-authtoken', token.trim()], {
      shell: true
    });
    let errOut = '';
    proc.stderr.on('data', d => errOut += d.toString());
    proc.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(errOut || `código de saída ${code}`));
    });
  });
}

async function startNgrok(port) {
  if (ngrokProcess) {
    return Promise.resolve(ngrokUrl);
  }

  const token = getNgrokTokenFromEnv();
  if (token) {
    try {
      await configureNgrokToken(token);
    } catch (e) {
      console.error('Erro ao pré-configurar authtoken do ngrok:', e.message);
    }
  }

  return new Promise((resolve, reject) => {
    const proc = spawn('ngrok', ['http', port.toString()], {
      shell: true,
      detached: false
    });

    let stderrOutput = '';
    let stdoutOutput = '';

    proc.stdout.on('data', (data) => {
      stdoutOutput += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Falha ao iniciar ngrok: ${err.message}`));
    });

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const url = await getNgrokUrl();
        clearInterval(interval);
        ngrokProcess = proc;
        ngrokUrl = url;
        resolve(url);
      } catch (e) {
        if (attempts >= 15) {
          clearInterval(interval);
          try { proc.kill(); } catch (_) {}
          const reason = stderrOutput || stdoutOutput || e.message;
          reject(new Error(`ngrok não pôde iniciar em tempo hábil. Detalhes: ${reason}`));
        }
      }
    }, 400);

    proc.on('exit', (code) => {
      clearInterval(interval);
      if (ngrokProcess === proc) {
        ngrokProcess = null;
        ngrokUrl = '';
      }
      const reason = stderrOutput || stdoutOutput || `código de saída: ${code}`;
      reject(new Error(`ngrok encerrou inesperadamente: ${reason}`));
    });
  });
}

function stopNgrok() {
  if (ngrokProcess) {
    try {
      ngrokProcess.kill();
    } catch (e) {
      console.error('Erro ao finalizar ngrok:', e);
    }
    ngrokProcess = null;
    ngrokUrl = '';
    return true;
  }
  return false;
}

export default defineConfig({
  build: {
    minify: 'esbuild',
    target: 'es2020',
    sourcemap: false,
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          chart: ['chart.js'],
          pdf: ['jspdf'],
          excel: ['xlsx']
        }
      }
    }
  },
  server: {
    allowedHosts: true
  },
  plugins: [
    {
      name: 'save-env-plugin',
      configureServer(server) {
        // Garantir encerramento do ngrok ao fechar o servidor Vite
        server.httpServer?.on('close', () => {
          stopNgrok();
        });

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
          } else if (req.url === '/api/tunnel') {
            if (req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ active: !!ngrokProcess, url: ngrokUrl }));
            } else if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', async () => {
                try {
                  const { action, token } = JSON.parse(body);
                  if (action === 'start') {
                    const address = server.httpServer?.address();
                    const port = typeof address === 'object' && address ? address.port : 5173;
                    const url = await startNgrok(port);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, url }));
                  } else if (action === 'stop') {
                    const stopped = stopNgrok();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, stopped }));
                  } else if (action === 'set-token') {
                    if (!token || !token.trim()) {
                      res.writeHead(400, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ error: 'Token inválido' }));
                      return;
                    }
                    try {
                      await configureNgrokToken(token);
                      saveNgrokTokenToEnv(token);
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ success: true }));
                    } catch (err) {
                      res.writeHead(500, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ error: err.message }));
                    }
                  } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Ação inválida' }));
                  }
                } catch (err) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
            }
          } else {
            next();
          }
        });
      }
    }
  ]
});

