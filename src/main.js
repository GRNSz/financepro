import { 
  S, 
  load, 
  save, 
  uid, 
  fmt, 
  fmtD, 
  q, 
  qa, 
  isoToday, 
  openM, 
  closeM, 
  periodState 
} from './state.js';

import { 
  initFirebase, 
  loadFirebaseConfig, 
  checkGuestLogin, 
  loginWithGoogle, 
  loginWithEmail, 
  loginAsGuest, 
  signOutUser, 
  currentUser,
  registerSyncCallback,
  registerAuthCallback
} from './firebase.js';

import { 
  handleImportFile, 
  selectAllImport, 
  saveImportedTransactions 
} from './importer.js';

import { 
  pressCalc, 
  calculateOvertime, 
  switchCalcTab, 
  calculateAmortization, 
  calculateFire 
} from './calculator.js';

import { sendAiMessage } from './ai.js';
import { exportWeeklyPDF, exportMonthlyPDF } from './pdf.js';

import { 
  navigate, 
  renderPage, 
  updateUI, 
  updatePeriodLabel, 
  renderDashboard, 
  renderContas, 
  renderMetas, 
  renderDividas, 
  renderGuardado, 
  renderBudgets, 
  renderRecurring, 
  renderCatGrid, 
  activePage, 
  applyFilters, 
  fillCatSelect, 
  fillPaySelect,
  updateNotifications,
  updateTxLivePreview,
  activeCT,
  setActiveCT
} from './ui/renderers.js';

// Setup Callbacks
registerSyncCallback(() => {
  updateUI();
});

registerAuthCallback((user) => {
  if (user) {
    updateUI();
  }
});

document.addEventListener('DOMContentLoaded', function() {
  // 1. Synchronously load state from LocalStorage to prevent crashes
  load();

  // 2. Configure Chart.js Defaults if present
  if (window.Chart) {
    window.Chart.defaults.color = '#7c849c';
    window.Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  }

  // 3. Set date header in UI
  const dateEl = q('#tbDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('pt-BR', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }

  // 4. Navigation Button Listeners
  qa('.nb, .bnb').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  qa('[data-page]').forEach(btn => {
    if (!btn.classList.contains('nb') && !btn.classList.contains('bnb')) {
      btn.addEventListener('click', () => navigate(btn.dataset.page));
    }
  });

  // Logo navigation click listener
  q('.logo')?.addEventListener('click', () => {
    navigate('dashboard');
  });

  // Mobile menu sidebar toggle
  q('#menuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // Close sidebar on outside click (mobile viewports)
  document.addEventListener('click', (e) => {
    const sb = document.getElementById('sidebar');
    const menuBtn = q('#menuBtn');
    if (window.innerWidth <= 768 && sb?.classList.contains('open') && !sb.contains(e.target) && e.target !== menuBtn) {
      sb.classList.remove('open');
    }
  });

  // 5. Modal Close Controls
  qa('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeM(btn.dataset.close));
  });

  qa('.mbd').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el) el.hidden = true;
    });
  });

  // 6. Chart controls
  q('#chartMode')?.addEventListener('change', renderDashboard);
  q('#chartYear')?.addEventListener('change', renderDashboard);

  // 7. Transaction List Filter controls
  ['#fSearch', '#fTipo', '#fCat', '#fStatus'].forEach(sel => {
    const el = q(sel);
    if (el) {
      el.addEventListener('input', applyFilters);
      el.addEventListener('change', applyFilters);
    }
  });

  // 8. Open/Create Transaction Modals
  function openTxCreateModal() {
    q('#tx-id').value = '';
    const tipo = q('#tx-tipo').value;
    fillCatSelect(q('#tx-cat'), tipo);
    fillPaySelect(q('#tx-conta'));
    q('#tx-data').value = isoToday();
    q('#tx-status').value = tipo === 'Receita' ? 'Recebido' : 'Pago';
    
    const isInst = q('#tx-is-installment');
    if (isInst) isInst.checked = false;
    
    const instWrap = q('#tx-inst-wrap');
    if (instWrap) instWrap.style.display = 'none';
    
    const instInput = q('#tx-inst');
    if (instInput) instInput.value = '1';
    
    q('#tx-modal-title').textContent = "Novo Lançamento";

    const keepOpenWrap = q('#tx-keep-open-wrap');
    if (keepOpenWrap) keepOpenWrap.style.display = 'flex';

    openM('m-tx');
    updateTxLivePreview();
  }

  q('#btnNewTx')?.addEventListener('click', openTxCreateModal);
  q('#btnNewTx2')?.addEventListener('click', openTxCreateModal);

  q('#tx-tipo')?.addEventListener('change', () => {
    const val = q('#tx-tipo').value;
    fillCatSelect(q('#tx-cat'), val);
    const statusEl = q('#tx-status');
    if (statusEl) {
      statusEl.value = val === 'Receita' ? 'Recebido' : 'Pago';
    }
  });

  q('#tx-is-installment')?.addEventListener('change', function() {
    const instWrap = q('#tx-inst-wrap');
    if (instWrap) instWrap.style.display = this.checked ? 'block' : 'none';
    if (!this.checked) {
      const instVal = q('#tx-inst');
      if (instVal) instVal.value = '1';
    }
    updateTxLivePreview();
  });

  ['#tx-val', '#tx-conta', '#tx-tipo', '#tx-cat', '#tx-status', '#tx-is-installment', '#tx-inst'].forEach(sel => {
    const el = q(sel);
    if (el) {
      el.addEventListener('input', updateTxLivePreview);
      el.addEventListener('change', updateTxLivePreview);
    }
  });

  // Transaction form submit
  q('#f-tx')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = q('#tx-id').value;
    const tipo = q('#tx-tipo').value;
    const val = parseFloat(q('#tx-val').value) || 0;
    const desc = q('#tx-desc').value.trim();
    const catId = q('#tx-cat').value;
    const payId = q('#tx-conta').value;
    const data = q('#tx-data').value;
    const stat = q('#tx-status').value;
    const isInstChecked = q('#tx-is-installment')?.checked;
    const inst = isInstChecked ? (parseInt(q('#tx-inst').value) || 1) : 1;

    if (id) {
      // Edit Mode
      const t = S.transactions.find(x => x.id === id);
      if (t) {
        // Revert balance impact
        if (t.status !== 'Pendente') {
          const oldAcc = S.accounts.find(a => a.id === t.payId);
          if (oldAcc) {
            const oldChange = t.tipo === 'Receita' ? t.val : -t.val;
            oldAcc.balance -= oldChange;
          }
        }
        
        // Update fields
        t.tipo = tipo;
        t.desc = desc;
        t.val = val;
        t.catId = catId;
        t.payId = payId;
        t.data = data;
        t.status = stat;
        
        // Apply new balance impact
        if (stat !== 'Pendente') {
          const newAcc = S.accounts.find(a => a.id === payId);
          if (newAcc) {
            const newChange = tipo === 'Receita' ? val : -val;
            newAcc.balance += newChange;
          }
        }
      }
    } else {
      // Create Mode
      if (inst > 1) {
        for (let i = 1; i <= inst; i++) {
          const d = new Date(data + 'T00:00:00');
          d.setMonth(d.getMonth() + i - 1);
          const parts = d.toISOString().split('T')[0];
          const splitVal = +(val / inst).toFixed(2);
          const currentStat = i === 1 ? stat : 'Pendente';
          
          S.transactions.unshift({
            id: uid(),
            tipo,
            desc,
            val: splitVal,
            catId,
            payId,
            data: parts,
            status: currentStat,
            inst: i,
            total: inst
          });
          
          if (currentStat !== 'Pendente') {
            const acc = S.accounts.find(a => a.id === payId);
            if (acc) acc.balance += (tipo === 'Receita' ? splitVal : -splitVal);
          }
        }
      } else {
        S.transactions.unshift({
          id: uid(),
          tipo,
          desc,
          val,
          catId,
          payId,
          data,
          status: stat,
          inst: null,
          total: null
        });
        
        if (stat !== 'Pendente') {
          const acc = S.accounts.find(a => a.id === payId);
          if (acc) acc.balance += (tipo === 'Receita' ? val : -val);
        }
      }
    }
    
    save();

    const keepOpen = q('#tx-keep-open')?.checked;
    if (keepOpen && !id) {
      q('#tx-desc').value = '';
      q('#tx-val').value = '';
      const preview = q('#tx-live-preview');
      if (preview) preview.style.display = 'none';
      q('#tx-desc').focus();
    } else {
      closeM('m-tx');
    }

    if (activePage === 'lancamentos') applyFilters();
    renderDashboard();
  });

  // 9. Accounts bancárias
  q('#btnNewAcc')?.addEventListener('click', () => {
    q('#acc-id').value = '';
    q('#acc-nome').value = '';
    q('#acc-tipo').value = 'Conta Corrente';
    q('#acc-bal').value = '';
    q('#acc-broker').value = '';
    q('#acc-rent').value = '';
    q('#acc-inv-fields').style.display = 'none';
    q('#acc-modal-title').textContent = "Nova Conta Bancária";
    openM('m-acc');
  });

  q('#acc-tipo')?.addEventListener('change', function() {
    const isInv = this.value === 'Investimentos';
    q('#acc-inv-fields').style.display = isInv ? 'grid' : 'none';
  });

  q('#f-acc')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = q('#acc-id').value;
    const name = q('#acc-nome').value.trim();
    const type = q('#acc-tipo').value;
    const balance = parseFloat(q('#acc-bal').value) || 0;
    const broker = q('#acc-broker').value.trim();
    const rent = q('#acc-rent').value.trim();
    
    if (id) {
      const acc = S.accounts.find(a => a.id === id);
      if (acc) {
        acc.name = name;
        acc.type = type;
        acc.balance = balance;
        acc.broker = type === 'Investimentos' ? broker : '';
        acc.rent = type === 'Investimentos' ? rent : '';
      }
    } else {
      S.accounts.push({
        id: uid(),
        name,
        type,
        balance,
        broker: type === 'Investimentos' ? broker : '',
        rent: type === 'Investimentos' ? rent : ''
      });
    }
    
    save();
    closeM('m-acc');
    renderContas();
    renderDashboard();
  });

  // 10. Cartões de Crédito
  q('#btnNewCard')?.addEventListener('click', () => {
    q('#card-id').value = '';
    q('#card-modal-title').textContent = "Novo Cartão de Crédito";
    openM('m-card');
  });

  q('#f-card')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = q('#card-id').value;
    const name = q('#card-nome').value.trim();
    const limit = parseFloat(q('#card-lim').value) || 0;
    const close = parseInt(q('#card-fech').value) || 1;
    const due = parseInt(q('#card-venc').value) || 10;
    
    if (id) {
      const c = S.cards.find(x => x.id === id);
      if (c) {
        c.name = name;
        c.limit = limit;
        c.close = close;
        c.due = due;
      }
    } else {
      S.cards.push({ id: uid(), name, limit, close, due });
    }
    
    save();
    closeM('m-card');
    renderContas();
  });

  // 11. Metas de poupança
  q('#btnNewGoal')?.addEventListener('click', () => {
    q('#goal-id').value = '';
    q('#goal-modal-title').textContent = "Nova Meta de Poupança";
    openM('m-goal');
  });

  q('#f-goal')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = q('#goal-id').value;
    const name = q('#goal-nome').value.trim();
    const tgt = parseFloat(q('#goal-tgt').value) || 0;
    const dl = q('#goal-data').value;
    
    if (id) {
      const g = S.goals.find(x => x.id === id);
      if (g) {
        g.name = name;
        g.tgt = tgt;
        g.dl = dl;
      }
    } else {
      S.goals.push({ id: uid(), name, tgt, cur: 0, dl });
    }
    
    save();
    closeM('m-goal');
    renderMetas();
  });

  q('#f-goal-mv')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = q('#goal-mv-id').value;
    const op = q('#goal-mv-op').value;
    const v = parseFloat(q('#goal-mv-val').value) || 0;
    const g = S.goals.find(x => x.id === id);
    if (!g) return;
    
    g.cur = op === 'dep' ? g.cur + v : Math.max(0, g.cur - v);
    save();
    closeM('m-goal-mv');
    renderMetas();
  });

  // 12. Orçamentos de categorias (Budgets)
  q('#btnNewBudget')?.addEventListener('click', () => {
    fillCatSelect(q('#bud-cat'), 'Despesa');
    openM('m-budget');
  });

  q('#f-budget')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const catId = q('#bud-cat').value;
    const lim = parseFloat(q('#bud-lim').value) || 0;
    const idx = S.budgets.findIndex(b => b.catId === catId);
    
    if (idx >= 0) {
      S.budgets[idx].lim = lim;
    } else {
      S.budgets.push({ catId, lim });
    }
    
    save();
    closeM('m-budget');
    renderBudgets();
  });

  // 13. Transações recorrentes
  q('#btnNewRec')?.addEventListener('click', () => {
    fillCatSelect(q('#rec-cat'), 'Despesa');
    fillPaySelect(q('#rec-conta'));
    openM('m-rec');
  });

  q('#rec-tipo')?.addEventListener('change', () => {
    fillCatSelect(q('#rec-cat'), q('#rec-tipo').value);
  });

  q('#f-rec')?.addEventListener('submit', (e) => {
    e.preventDefault();
    S.recurring.push({
      id: uid(),
      desc: q('#rec-desc').value.trim(),
      tipo: q('#rec-tipo').value,
      val: parseFloat(q('#rec-val').value) || 0,
      catId: q('#rec-cat').value,
      payId: q('#rec-conta').value,
      day: parseInt(q('#rec-dia').value) || 1,
      last: null
    });
    
    save();
    closeM('m-rec');
    renderRecurring();
  });

  // 14. Nova Categoria
  q('#btnNewCat')?.addEventListener('click', () => openM('m-cat'));

  qa('.cp').forEach(cp => {
    cp.addEventListener('click', () => {
      q('#cat-cor').value = cp.dataset.c;
      qa('.cp').forEach(x => x.classList.remove('on'));
      cp.classList.add('on');
    });
  });

  q('#f-cat')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = q('#cat-nome').value.trim();
    const tipo = q('#cat-tipo').value;
    const ico = q('#cat-ico').value.trim() || '📌';
    const cor = q('#cat-cor').value;
    
    S.categories.push({ id: 'cc_' + uid(), name: nome, type: tipo, icon: ico, color: cor });
    save();
    closeM('m-cat');
    setActiveCT(tipo);
    qa('.ctab').forEach(t => t.classList.toggle('on', t.dataset.ct === tipo));
    renderCatGrid();
  });

  qa('.ctab').forEach(tab => {
    tab.addEventListener('click', () => {
      setActiveCT(tab.dataset.ct);
      qa('.ctab').forEach(t => t.classList.remove('on'));
      tab.classList.add('on');
      renderCatGrid();
    });
  });

  // 15. Dívidas
  q('#btnNewDebt')?.addEventListener('click', () => {
    q('#debt-id').value = '';
    q('#debt-modal-title').textContent = "Nova Dívida";
    openM('m-debt');
  });

  q('#f-debt')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = q('#debt-id').value;
    const nome = q('#dbt-nome').value.trim();
    const total = parseFloat(q('#dbt-total').value) || 0;
    const oferta = parseFloat(q('#dbt-oferta').value) || 0;
    const status = q('#dbt-status').value;
    const forma = q('#dbt-forma').value;
    
    if (id) {
      const d = S.debts.find(x => x.id === id);
      if (d) {
        d.nome = nome;
        d.total = total;
        d.oferta = oferta;
        d.status = status;
        d.forma = forma;
      }
    } else {
      S.debts.push({ id: uid(), nome, total, oferta, status, forma });
    }
    
    save();
    closeM('m-debt');
    renderDividas();
    renderDashboard();
  });

  // 16. Dinheiro Guardado (Savings)
  q('#btnNewSaving')?.addEventListener('click', () => {
    q('#sv-data').value = isoToday();
    openM('m-saving');
  });

  q('#f-saving')?.addEventListener('submit', (e) => {
    e.preventDefault();
    S.savings.push({
      id: uid(),
      val: parseFloat(q('#sv-val').value) || 0,
      data: q('#sv-data').value,
      desc: q('#sv-desc').value.trim()
    });
    
    save();
    closeM('m-saving');
    renderGuardado();
    renderDashboard();
  });

  // 17. Backup & Restore / Excel & OFX Importer
  q('#btnExportCSV')?.addEventListener('click', () => {
    if (!S.transactions.length) {
      alert('Sem lançamentos.');
      return;
    }
    let c = 'Data,Descrição,Categoria,Tipo,Valor,Status,Conta\n';
    S.transactions.forEach(t => {
      const cat = getCat(t.catId).name;
      const pay = getPay(t.payId);
      c += `${t.data},"${t.desc.replace(/"/g, '""')}","${cat}",${t.tipo},${t.val},${t.status},"${pay}"\n`;
    });
    
    const blob = new Blob(['\ufeff' + c], { type: 'text/csv;charset=utf-8' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'lancamentos-' + isoToday() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  });

  q('#btnBackup')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'financeos-backup-' + isoToday() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  });

  q('#btnRestore')?.addEventListener('click', () => q('#fileRestore').click());

  q('#fileRestore')?.addEventListener('change', function(e) {
    if (!e.target.files[0]) return;
    const r = new FileReader();
    r.onload = function(ev) {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.transactions) {
          S.categories = d.categories;
          S.accounts = d.accounts;
          S.cards = d.cards;
          S.transactions = d.transactions;
          S.budgets = d.budgets;
          S.goals = d.goals;
          S.recurring = d.recurring;
          S.savings = d.savings;
          S.debts = d.debts;
          
          save();
          alert('Backup restaurado!');
          navigate('dashboard');
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch (err) {
        alert('Erro ao ler o arquivo de backup.');
      }
    };
    r.readAsText(e.target.files[0]);
  });

  // Drag and drop spreadsheet/OFX import zones
  // 1. General Import Card
  const generalDropZone = q('#drop-zone');
  const generalFileInput = q('#import-file-input');

  generalDropZone?.addEventListener('click', () => generalFileInput?.click());
  generalDropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    generalDropZone.style.borderColor = 'var(--ac)';
    generalDropZone.style.background = 'rgba(99,102,241,0.05)';
  });
  generalDropZone?.addEventListener('dragleave', () => {
    generalDropZone.style.borderColor = 'var(--bd2)';
    generalDropZone.style.background = 'var(--s2)';
  });
  generalDropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    generalDropZone.style.borderColor = 'var(--bd2)';
    generalDropZone.style.background = 'var(--s2)';
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file);
  });
  generalFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImportFile(file);
  });

  // 2. Banco Inter Import Card
  const interDropZone = q('#dropZone');
  const interFileInput = q('#bankFile');

  interDropZone?.addEventListener('click', () => interFileInput?.click());
  interDropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    interDropZone.style.borderColor = 'var(--ac)';
  });
  interDropZone?.addEventListener('dragleave', () => {
    interDropZone.style.borderColor = '';
  });
  interDropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    interDropZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file);
  });
  interFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImportFile(file);
  });

  q('#btnConfirmImport')?.addEventListener('click', saveImportedTransactions);
  q('#btnCancelImport')?.addEventListener('click', () => {
    if (generalFileInput) generalFileInput.value = '';
    const previewArea = q('#import-preview-area');
    if (previewArea) previewArea.style.display = 'none';
  });

  // 18. Theme Manager (Light/Dark)
  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light');
      const toggleBtn = q('#themeToggle');
      if (toggleBtn) toggleBtn.textContent = '☀️';
      if (window.Chart) {
        window.Chart.defaults.color = '#475569';
      }
    } else {
      document.body.classList.remove('light');
      const toggleBtn = q('#themeToggle');
      if (toggleBtn) toggleBtn.textContent = '🌙';
      if (window.Chart) {
        window.Chart.defaults.color = '#7c849c';
      }
    }
    if (activePage === 'dashboard') {
      renderDashboard();
    }
  }

  q('#themeToggle')?.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light');
    const newTheme = isLight ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  });

  // Apply initial saved theme
  applyTheme(localStorage.getItem('theme') || 'dark');

  // 19. Print trigger
  q('#btnPrint')?.addEventListener('click', () => window.print());

  // 20. Period bar actions
  q('#pPrev')?.addEventListener('click', () => {
    if (periodState.currentMode === 'monthly') {
      periodState.currentMonth--;
      if (periodState.currentMonth < 0) {
        periodState.currentMonth = 11;
        periodState.currentYear--;
      }
    } else if (periodState.currentMode === 'yearly') {
      periodState.currentYear--;
    }
    updatePeriodLabel();
    updateUI();
  });

  q('#pNext')?.addEventListener('click', () => {
    if (periodState.currentMode === 'monthly') {
      periodState.currentMonth++;
      if (periodState.currentMonth > 11) {
        periodState.currentMonth = 0;
        periodState.currentYear++;
      }
    } else if (periodState.currentMode === 'yearly') {
      periodState.currentYear++;
    }
    updatePeriodLabel();
    updateUI();
  });

  function setPeriodMode(mode, btnId) {
    periodState.currentMode = mode;
    qa('#periodBar .ctab').forEach(b => b.classList.remove('on'));
    q(btnId)?.classList.add('on');
    updatePeriodLabel();
    updateUI();
  }

  q('#pModeMonth')?.addEventListener('click', () => setPeriodMode('monthly', '#pModeMonth'));
  q('#pModeYear')?.addEventListener('click', () => setPeriodMode('yearly', '#pModeYear'));
  q('#pModeAll')?.addEventListener('click', () => setPeriodMode('all', '#pModeAll'));

  updatePeriodLabel();

  // 21. Banco Inter sync simulation
  q('#btnSyncInter')?.addEventListener('click', () => openM('m-inter-sync'));

  q('#f-inter-sync')?.addEventListener('submit', (e) => {
    e.preventDefault();
    q('#f-inter-sync').style.display = 'none';
    const progArea = q('#inter-sync-progress');
    if (progArea) progArea.style.display = 'flex';
    
    const statusText = q('#inter-sync-status');
    const progressBar = q('#inter-sync-bar');
    
    const steps = [
      { pct: 20, status: 'Estabelecendo handshake TLS mútuo (mTLS)...', delay: 800 },
      { pct: 50, status: 'Autenticando e gerando Token OAuth...', delay: 700 },
      { pct: 85, status: 'Consultando extrato via API de Contas Correntes Inter...', delay: 1200 },
      { pct: 100, status: 'Importação e reconciliação concluídas!', delay: 600 }
    ];
    
    let currentStep = 0;
    
    function runSyncStep() {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        if (progressBar) progressBar.style.width = step.pct + '%';
        if (statusText) statusText.textContent = step.status;
        currentStep++;
        setTimeout(runSyncStep, step.delay);
      } else {
        closeM('m-inter-sync');
        q('#f-inter-sync').style.display = 'flex';
        if (progArea) progArea.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
        
        const tgtAcc = S.accounts.find(a => a.name.toLowerCase().includes('inter')) || S.accounts[0];
        if (!tgtAcc) {
          alert('Por favor, crie uma conta bancária primeiro.');
          return;
        }
        
        const importedTxs = [
          {
            id: uid(),
            tipo: 'Receita',
            desc: 'Pix Recebido - Banco Inter',
            val: 180.00,
            catId: 'c_outr',
            payId: tgtAcc.id,
            data: isoToday(),
            status: 'Recebido',
            inst: null,
            total: null
          },
          {
            id: uid(),
            tipo: 'Despesa',
            desc: 'Inter Mall Cashback',
            val: 14.90,
            catId: 'c_comp',
            payId: tgtAcc.id,
            data: isoToday(),
            status: 'Recebido',
            inst: null,
            total: null
          },
          {
            id: uid(),
            tipo: 'Despesa',
            desc: 'Assinatura Inter Pass',
            val: 19.90,
            catId: 'c_fixa',
            payId: tgtAcc.id,
            data: isoToday(),
            status: 'Pago',
            inst: null,
            total: null
          }
        ];
        
        let addedCount = 0;
        importedTxs.forEach(tx => {
          const isDup = S.transactions.some(t => t.desc === tx.desc && t.val === tx.val && t.data === tx.data);
          if (!isDup) {
            S.transactions.unshift(tx);
            tgtAcc.balance += (tx.tipo === 'Receita' ? tx.val : -tx.val);
            addedCount++;
          }
        });
        
        if (addedCount > 0) {
          save();
          if (activePage === 'lancamentos') applyFilters();
          renderDashboard();
          alert(`Sincronização concluída com sucesso!\n${addedCount} novas transações importadas para a conta "${tgtAcc.name}".`);
        } else {
          alert('Sincronização realizada com sucesso. Nenhuma nova transação encontrada.');
        }
      }
    }
    
    setTimeout(runSyncStep, 100);
  });

  // 22. App reset
  q('#btnReset')?.addEventListener('click', () => {
    if (confirm('Apagar TODOS os dados? Isso não pode ser desfeito!')) {
      localStorage.clear();
      window.location.reload();
    }
  });

  // 23. Simulators inputs listeners
  ['#sim-init', '#sim-monthly', '#sim-time', '#sim-time-type', '#sim-rate-custom'].forEach(sel => {
    const el = q(sel);
    if (el) {
      el.addEventListener('input', window.runSimulation);
      el.addEventListener('change', window.runSimulation);
    }
  });
  q('#sim-type')?.addEventListener('change', function() {
    const isCustom = this.value === 'custom';
    const customWrap = q('#sim-rate-custom-wrap');
    if (customWrap) customWrap.style.display = isCustom ? 'flex' : 'none';
    window.runSimulation();
  });

  // Run simulation initially
  if (typeof window.runSimulation === 'function') {
    window.runSimulation();
  }

  // 24. Export PDF trigger
  q('#btnExportPDF')?.addEventListener('click', exportMonthlyPDF);

  // 25. AI Assistant Panels and bubble triggers
  q('#ai-chat-bubble')?.addEventListener('click', () => {
    const panel = q('#ai-chat-panel');
    if (panel) {
      const isVisible = panel.style.display === 'flex';
      panel.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        q('#aiChatInput')?.focus();
        const msgContainer = q('#aiChatMessages');
        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
      }
    }
  });

  q('#btnAiClose')?.addEventListener('click', () => {
    const panel = q('#ai-chat-panel');
    if (panel) panel.style.display = 'none';
  });

  q('#btnAiSend')?.addEventListener('click', sendAiMessage);

  q('#aiChatInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendAiMessage();
    }
  });

  const aiKeyInput = q('#ai-api-key-input');
  if (aiKeyInput) {
    aiKeyInput.value = localStorage.getItem('financeos_ai_api_key') || '';
  }

  q('#btnSaveAIKey')?.addEventListener('click', async () => {
    const key = q('#ai-api-key-input').value.trim();
    if (key) {
      localStorage.setItem('financeos_ai_api_key', key);
    } else {
      localStorage.removeItem('financeos_ai_api_key');
    }
    
    try {
      const res = await fetch('/api/save-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      if (data.success) {
        alert('Chave de API salva com sucesso no .env e no navegador!');
      } else {
        alert('Chave salva no navegador! (Nota: erro ao gravar no servidor local: ' + (data.error || 'Erro desconhecido') + ')');
      }
    } catch (err) {
      alert('Chave de API salva no navegador com sucesso!');
    }
  });

  // 26. Calculator DSR options toggle
  q('#he-has-dsr')?.addEventListener('change', function() {
    const configEl = q('#he-dsr-config');
    if (configEl) {
      configEl.style.display = this.checked ? 'flex' : 'none';
    }
  });

  // 27. Notifications dropdown toggle
  const btnNotif = q('#btnNotifications');
  const dropdownNotif = q('#notif-dropdown');
  btnNotif?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdownNotif) {
      const isVisible = dropdownNotif.style.display === 'flex';
      dropdownNotif.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        updateNotifications();
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (dropdownNotif && !btnNotif?.contains(e.target) && !dropdownNotif.contains(e.target)) {
      dropdownNotif.style.display = 'none';
    }
  });

  // 28. Auth forms listeners
  q('#btnLoginGoogle')?.addEventListener('click', () => {
    loginWithGoogle();
  });

  q('#btnGuestLogin')?.addEventListener('click', () => {
    loginAsGuest(updateUI);
  });

  q('#btnSignUpEmail')?.addEventListener('click', () => {
    const email = q('#login-email').value.trim();
    const password = q('#login-password').value;
    if (!email || !password) {
      alert('Por favor, preencha o e-mail e a senha.');
      return;
    }
    loginWithEmail(email, password, true);
  });

  q('#f-login')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = q('#login-email').value.trim();
    const password = q('#login-password').value;
    loginWithEmail(email, password, false);
  });

  q('#btnSignOut')?.addEventListener('click', () => {
    signOutUser();
  });

  // 29. Firebase boot sequence
  loadFirebaseConfig();
  const fbInitialized = initFirebase();
  if (!fbInitialized) {
    checkGuestLogin(updateUI);
  }

  // 30. Render initial view
  navigate(activePage);
  updateNotifications();
});
