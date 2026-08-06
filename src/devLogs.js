export function initDevLogger() {
  window.devLogs = [];
  window.addDevLog = function(msg, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const entry = { time, msg, type };
    window.devLogs.push(entry);
    
    const panel = document.getElementById('dev-console-logs');
    if (panel) {
      let color = '#94a3b8';
      if (type === 'error') color = '#f87171';
      if (type === 'success') color = '#4ade80';
      if (type === 'warn') color = '#facc15';
      
      const div = document.createElement('div');
      div.style.padding = '3px 0';
      div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      div.style.color = color;
      div.innerHTML = `<strong>[${time}] [${type.toUpperCase()}]</strong> ${msg}`;
      panel.appendChild(div);
      panel.scrollTop = panel.scrollHeight;
    }
    console.log(`[DEV_LOG] [${type}] ${msg}`);
  };

  window.addEventListener('error', function(e) {
    window.addDevLog(e.message + ' at ' + e.filename + ':' + e.lineno + ':' + e.colno, 'error');
  });
  window.addEventListener('unhandledrejection', function(e) {
    window.addDevLog('Promise rejection: ' + (e.reason ? (e.reason.message || e.reason) : 'unknown'), 'error');
  });

  window.checkAdminView = function() {
    const trigger = document.getElementById('btn-dev-trigger');
    const panel = document.getElementById('dev-console-panel');
    if (!trigger) return;

    // Completely disable and hide in production unless explicit secret key is present
    const isProd = import.meta.env ? import.meta.env.PROD : true;
    const devSecretKey = localStorage.getItem('poupafy_dev_secret');
    
    if (isProd && devSecretKey !== 'ENABLED_DEV_MODE') {
      trigger.style.display = 'none';
      if (panel) panel.style.display = 'none';
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isUrlAdmin = urlParams.get('debug') === 'true' && devSecretKey === 'ENABLED_DEV_MODE';
    
    if (!isProd || isUrlAdmin) {
      trigger.style.display = 'block';
    } else {
      trigger.style.display = 'none';
      if (panel) panel.style.display = 'none';
    }
  };

  window.addDevLog('Debug logger initialized successfully.', 'success');
}

export function setupDevConsolePanel() {
  const panel = document.getElementById('dev-console-panel');
  const trigger = document.getElementById('btn-dev-trigger');
  const btnClose = document.getElementById('btn-dev-close');
  const btnClear = document.getElementById('btn-dev-clear');
  const btnCopy = document.getElementById('btn-dev-copy');
  const logContainer = document.getElementById('dev-console-logs');

  if (logContainer && window.devLogs) {
    window.devLogs.forEach(entry => {
      let color = '#94a3b8';
      if (entry.type === 'error') color = '#f87171';
      if (entry.type === 'success') color = '#4ade80';
      if (entry.type === 'warn') color = '#facc15';
      
      const div = document.createElement('div');
      div.style.padding = '3px 0';
      div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      div.style.color = color;
      div.innerHTML = `<strong>[${entry.time}] [${entry.type.toUpperCase()}]</strong> ${entry.msg}`;
      logContainer.appendChild(div);
    });
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  if (window.checkAdminView) window.checkAdminView();

  trigger?.addEventListener('click', () => {
    if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  });
  btnClose?.addEventListener('click', () => {
    if (panel) panel.style.display = 'none';
  });
  btnClear?.addEventListener('click', () => {
    if (logContainer) logContainer.innerHTML = '';
    window.devLogs = [];
    window.addDevLog('Logs cleared.', 'info');
  });
  btnCopy?.addEventListener('click', () => {
    const text = (window.devLogs || []).map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.msg}`).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => alert('Logs copiados para a área de transferência!'))
      .catch(err => alert('Erro ao copiar logs: ' + err));
  });
}
