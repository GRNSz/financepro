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
  periodState,
  initState,
  setS
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
  registerAuthCallback,
  sendPasswordReset,
  updateUserDisplayName,
  updateUserPassword,
  db,
  deleteAccountAndData
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
  setActiveCT,
  renderCalendar,
  renderAchievements,
  render52WeekChallenge,
  renderPerfil
} from './ui/renderers.js';

// Setup Callbacks
registerSyncCallback(() => {
  processRecurringTransactions();
  updateUI();
  if (window.updateSyncStatusDot) window.updateSyncStatusDot();
});

registerAuthCallback((user) => {
  if (window.updateSyncStatusDot) window.updateSyncStatusDot();
  if (user) {
    processRecurringTransactions();
    updateUI();
    
    // Exibe automaticamente o paywall se o plano for grátis
    const plan = S.subscription?.plan || 'free';
    if (plan === 'free') {
      openM('paywall-overlay');
    }
  }
  window.hideGlobalLoader?.();
});

document.addEventListener('DOMContentLoaded', function() {
  // 1. Synchronously load state from LocalStorage to prevent crashes
  load();
  processRecurringTransactions();

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

  // 7b. Tutorials Search filter
  q('#tutSearchInput')?.addEventListener('input', function() {
    const qry = this.value.toLowerCase().trim();
    qa('.tut-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      const keywords = card.dataset.keywords ? card.dataset.keywords.toLowerCase() : '';
      if (text.includes(qry) || keywords.includes(qry)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
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

    const recIs = q('#tx-is-recurring');
    if (recIs) {
      recIs.checked = false;
      const parentRow = recIs.closest('.fr');
      if (parentRow) parentRow.style.display = 'flex';
    }
    const recWrap = q('#tx-rec-wrap');
    if (recWrap) recWrap.style.display = 'none';
    const recFreq = q('#tx-rec-freq');
    if (recFreq) recFreq.value = 'monthly';
    const recDia = q('#tx-rec-dia');
    if (recDia) recDia.value = '';
    const recDiaSemana = q('#tx-rec-dia-semana');
    if (recDiaSemana) recDiaSemana.value = '0';
    const recDayMonthWrap = q('#tx-rec-day-month-wrap');
    if (recDayMonthWrap) recDayMonthWrap.style.display = 'block';
    const recDayWeekWrap = q('#tx-rec-day-week-wrap');
    if (recDayWeekWrap) recDayWeekWrap.style.display = 'none';
    
    // Reset Premium Fields
    if (q('#tx-tags')) q('#tx-tags').value = '';
    if (q('#tx-moeda')) q('#tx-moeda').value = 'BRL';
    if (q('#tx-taxa')) q('#tx-taxa').value = '1';
    if (q('#tx-taxa-wrap')) q('#tx-taxa-wrap').style.display = 'none';

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
    if (this.checked) {
      const recIs = q('#tx-is-recurring');
      if (recIs) recIs.checked = false;
      const recWrap = q('#tx-rec-wrap');
      if (recWrap) recWrap.style.display = 'none';
      if (instWrap) instWrap.style.display = 'block';
    } else {
      if (instWrap) instWrap.style.display = 'none';
      const instVal = q('#tx-inst');
      if (instVal) instVal.value = '1';
    }
    updateTxLivePreview();
  });

  q('#tx-is-recurring')?.addEventListener('change', function() {
    const recWrap = q('#tx-rec-wrap');
    if (this.checked) {
      const instIs = q('#tx-is-installment');
      if (instIs) instIs.checked = false;
      const instWrap = q('#tx-inst-wrap');
      if (instWrap) instWrap.style.display = 'none';
      const instVal = q('#tx-inst');
      if (instVal) instVal.value = '1';
      if (recWrap) recWrap.style.display = 'flex';
    } else {
      if (recWrap) recWrap.style.display = 'none';
    }
    updateTxLivePreview();
  });

  q('#tx-rec-freq')?.addEventListener('change', function() {
    const monthWrap = q('#tx-rec-day-month-wrap');
    const weekWrap = q('#tx-rec-day-week-wrap');
    if (this.value === 'weekly') {
      if (monthWrap) monthWrap.style.display = 'none';
      if (weekWrap) weekWrap.style.display = 'block';
    } else {
      if (monthWrap) monthWrap.style.display = 'block';
      if (weekWrap) weekWrap.style.display = 'none';
    }
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
    
    // Multi-currency Support & Conversion
    const currency = q('#tx-moeda')?.value || 'BRL';
    const rate = currency !== 'BRL' ? (parseFloat(q('#tx-taxa')?.value) || 1) : 1;
    const rawVal = parseFloat(q('#tx-val').value) || 0;
    const val = +(rawVal * rate).toFixed(2); // stored in BRL
    const origVal = currency !== 'BRL' ? rawVal : null;
    
    // Tags Extraction
    const tagsVal = q('#tx-tags')?.value.trim() || '';
    const tags = tagsVal ? tagsVal.split(/\s+/).map(t => t.startsWith('#') ? t : '#' + t) : [];

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
        // Revert balance impact using the stored BRL value
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
        t.origVal = origVal;
        t.currency = currency;
        t.rate = rate;
        t.tags = tags;
        t.catId = catId;
        t.payId = payId;
        t.data = data;
        t.status = stat;
        
        // Apply new balance impact (BRL value)
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
          const splitOrigVal = origVal ? +(origVal / inst).toFixed(2) : null;
          const currentStat = i === 1 ? stat : 'Pendente';
          
          S.transactions.unshift({
            id: uid(),
            tipo,
            desc,
            val: splitVal,
            origVal: splitOrigVal,
            currency,
            rate,
            tags,
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
          origVal,
          currency,
          rate,
          tags,
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

        const isRecurChecked = q('#tx-is-recurring')?.checked;
        if (isRecurChecked) {
          const freq = q('#tx-rec-freq').value;
          let recurrenceDay = 1;
          if (freq === 'weekly') {
            recurrenceDay = parseInt(q('#tx-rec-dia-semana').value) || 0;
          } else {
            recurrenceDay = parseInt(q('#tx-rec-dia').value) || 1;
          }
          S.recurring.push({
            id: uid(),
            desc,
            tipo,
            val,
            catId,
            payId,
            frequency: freq,
            day: recurrenceDay,
            last: null
          });
          processRecurringTransactions();
          renderRecurring();
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
      const plan = S.subscription?.plan || 'free';
      if (plan === 'free' && S.accounts.length >= 1) {
        alert('O plano Grátis é limitado a 1 conta bancária. Escolha o plano Plus ou Pro para adicionar contas ilimitadas!');
        openM('paywall-overlay');
        return;
      }
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
      const plan = S.subscription?.plan || 'free';
      if (plan === 'free' && S.goals.length >= 1) {
        alert('O plano Grátis é limitado a 1 meta de economia. Escolha o plano Plus ou Pro para adicionar mais metas!');
        openM('paywall-overlay');
        return;
      } else if (plan === 'plus' && S.goals.length >= 5) {
        alert('O plano Plus é limitado a 5 metas de economia. Faça upgrade para o Pro para metas ilimitadas!');
        openM('paywall-overlay');
        return;
      }
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
    
    // Reset recurrence form inputs
    const recFreq = q('#rec-freq');
    if (recFreq) recFreq.value = 'monthly';
    const recDia = q('#rec-dia');
    if (recDia) recDia.value = '';
    const recDiaSemana = q('#rec-dia-semana');
    if (recDiaSemana) recDiaSemana.value = '0';
    const monthWrap = q('#rec-day-month-wrap');
    if (monthWrap) monthWrap.style.display = 'block';
    const weekWrap = q('#rec-day-week-wrap');
    if (weekWrap) weekWrap.style.display = 'none';

    openM('m-rec');
  });

  q('#rec-tipo')?.addEventListener('change', () => {
    fillCatSelect(q('#rec-cat'), q('#rec-tipo').value);
  });

  q('#rec-freq')?.addEventListener('change', function() {
    const monthWrap = q('#rec-day-month-wrap');
    const weekWrap = q('#rec-day-week-wrap');
    if (this.value === 'weekly') {
      if (monthWrap) monthWrap.style.display = 'none';
      if (weekWrap) weekWrap.style.display = 'block';
    } else {
      if (monthWrap) monthWrap.style.display = 'block';
      if (weekWrap) weekWrap.style.display = 'none';
    }
  });

  q('#f-rec')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const freq = q('#rec-freq').value;
    let recurrenceDay = 1;
    if (freq === 'weekly') {
      recurrenceDay = parseInt(q('#rec-dia-semana').value) || 0;
    } else {
      const dayVal = q('#rec-dia').value;
      if (!dayVal) {
        alert('Por favor, informe o dia do mês.');
        return;
      }
      recurrenceDay = parseInt(dayVal) || 1;
    }

    S.recurring.push({
      id: uid(),
      desc: q('#rec-desc').value.trim(),
      tipo: q('#rec-tipo').value,
      val: parseFloat(q('#rec-val').value) || 0,
      catId: q('#rec-cat').value,
      payId: q('#rec-conta').value,
      frequency: freq,
      day: recurrenceDay,
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

  // 18. Theme Manager (Light/Dark and Premium Themes)
  function applyTheme(theme) {
    document.body.classList.remove('light', 'midnight', 'forest', 'sakura', 'cyberpunk');
    const toggleBtn = q('#themeToggle');
    
    if (theme === 'light') {
      document.body.classList.add('light');
      if (toggleBtn) toggleBtn.textContent = '☀️';
      if (window.Chart) window.Chart.defaults.color = '#475569';
    } else if (theme === 'midnight') {
      document.body.classList.add('midnight');
      if (toggleBtn) toggleBtn.textContent = '🌌';
      if (window.Chart) window.Chart.defaults.color = '#94a3b8';
    } else if (theme === 'forest') {
      document.body.classList.add('forest');
      if (toggleBtn) toggleBtn.textContent = '🌲';
      if (window.Chart) window.Chart.defaults.color = '#a7f3d0';
    } else if (theme === 'sakura') {
      document.body.classList.add('sakura');
      if (toggleBtn) toggleBtn.textContent = '🌸';
      if (window.Chart) window.Chart.defaults.color = '#be123c';
    } else if (theme === 'cyberpunk') {
      document.body.classList.add('cyberpunk');
      if (toggleBtn) toggleBtn.textContent = '⚡';
      if (window.Chart) window.Chart.defaults.color = '#9b9bbd';
    } else { // default dark
      if (toggleBtn) toggleBtn.textContent = '🌙';
      if (window.Chart) window.Chart.defaults.color = '#7c849c';
    }
    
    updateThemeButtonsUI(theme);
    
    if (activePage === 'dashboard') {
      renderDashboard();
    }
  }

  function updateThemeButtonsUI(activeTheme) {
    qa('.theme-btn').forEach(btn => {
      if (btn.dataset.theme === activeTheme) {
        btn.style.borderColor = 'var(--ac)';
        btn.style.boxShadow = '0 0 8px var(--ac)';
      } else {
        btn.style.borderColor = 'var(--bd2)';
        btn.style.boxShadow = 'none';
      }
    });
  }

  q('#themeToggle')?.addEventListener('click', () => {
    const themes = ['dark', 'light', 'midnight', 'forest', 'sakura', 'cyberpunk'];
    const currentTheme = localStorage.getItem('theme') || 'dark';
    let nextIdx = themes.indexOf(currentTheme) + 1;
    if (nextIdx >= themes.length) nextIdx = 0;
    const newTheme = themes[nextIdx];
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  });

  // Attach configuration theme buttons listeners
  qa('.theme-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const selectedTheme = this.dataset.theme;
      localStorage.setItem('theme', selectedTheme);
      applyTheme(selectedTheme);
    });
  });

  // Apply initial saved theme
  applyTheme(localStorage.getItem('theme') || 'dark');

  // 19. Print trigger
  q('#btnPrint')?.addEventListener('click', () => window.print());

  // 20. Period bar actions
  q('#pPrev')?.addEventListener('click', () => {
    if (periodState.currentMode === 'monthly' || periodState.currentMode === 'weekly') {
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
    if (periodState.currentMode === 'monthly' || periodState.currentMode === 'weekly') {
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

  q('#calPrevBtn')?.addEventListener('click', () => {
    periodState.currentMonth--;
    if (periodState.currentMonth < 0) {
      periodState.currentMonth = 11;
      periodState.currentYear--;
    }
    renderCalendar();
  });

  q('#calNextBtn')?.addEventListener('click', () => {
    periodState.currentMonth++;
    if (periodState.currentMonth > 11) {
      periodState.currentMonth = 0;
      periodState.currentYear++;
    }
    renderCalendar();
  });

  q('#wPrev')?.addEventListener('click', () => {
    if (periodState.currentMode === 'weekly') {
      periodState.currentWeek--;
      if (periodState.currentWeek < 0) {
        periodState.currentWeek = 3;
        periodState.currentMonth--;
        if (periodState.currentMonth < 0) {
          periodState.currentMonth = 11;
          periodState.currentYear--;
        }
      }
      updatePeriodLabel();
      updateUI();
    }
  });

  q('#wNext')?.addEventListener('click', () => {
    if (periodState.currentMode === 'weekly') {
      periodState.currentWeek++;
      if (periodState.currentWeek > 3) {
        periodState.currentWeek = 0;
        periodState.currentMonth++;
        if (periodState.currentMonth > 11) {
          periodState.currentMonth = 0;
          periodState.currentYear++;
        }
      }
      updatePeriodLabel();
      updateUI();
    }
  });

  function setPeriodMode(mode, btnId) {
    periodState.currentMode = mode;
    qa('#periodBar .ctab').forEach(b => b.classList.remove('on'));
    q(btnId)?.classList.add('on');
    updatePeriodLabel();
    updateUI();
  }

  q('#pModeWeek')?.addEventListener('click', () => setPeriodMode('weekly', '#pModeWeek'));
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
      const cleanState = initState();
      setS(cleanState);
      save();
      
      if (db && currentUser && !currentUser.isAnonymous) {
        db.collection('users').doc(currentUser.uid).set(cleanState)
          .then(() => {
            localStorage.clear();
            window.location.reload();
          })
          .catch(err => {
            console.error('Error clearing remote database:', err);
            alert('Erro ao apagar dados na nuvem: ' + err.message);
          });
      } else {
        localStorage.clear();
        window.location.reload();
      }
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
  q('#btnExportPDF')?.addEventListener('click', () => {
    const plan = S.subscription?.plan || 'free';
    if (plan === 'free') {
      alert('A exportação de relatórios PDF está disponível apenas nos planos Plus e Pro. Faça upgrade para desbloquear!');
      openM('paywall-overlay');
      return;
    }
    window.showGlobalLoader?.("Gerando PDF...");
    setTimeout(() => {
      try {
        if (periodState.currentMode === 'weekly') {
          exportWeeklyPDF(periodState.currentWeek);
        } else {
          exportMonthlyPDF();
        }
      } catch (err) {
        console.error('PDF export failed:', err);
        alert('Falha ao gerar PDF: ' + err.message);
      } finally {
        window.hideGlobalLoader?.();
      }
    }, 100);
  });

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
    window.showGlobalLoader?.('Conectando ao Google...');
    loginWithGoogle();
  });

  q('#btnGuestLogin')?.addEventListener('click', () => {
    window.showGlobalLoader?.('Iniciando modo visitante...');
    loginAsGuest(updateUI);
  });

  let authMode = 'login';
  const btnSubmitAuth = q('#btnSubmitAuth');
  const btnToggleAuthMode = q('#btnToggleAuthMode');
  const btnForgotPassword = q('#btnForgotPassword');

  btnToggleAuthMode?.addEventListener('click', (e) => {
    e.preventDefault();
    if (authMode === 'login') {
      authMode = 'signup';
      if (btnSubmitAuth) btnSubmitAuth.textContent = 'Criar Conta';
      btnToggleAuthMode.textContent = 'Já tenho uma conta (Entrar)';
      if (btnForgotPassword) btnForgotPassword.style.display = 'none';
    } else {
      authMode = 'login';
      if (btnSubmitAuth) btnSubmitAuth.textContent = 'Entrar';
      btnToggleAuthMode.textContent = 'Criar uma nova conta';
      if (btnForgotPassword) btnForgotPassword.style.display = 'inline';
    }
  });

  q('#f-login')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = q('#login-email').value.trim();
    const password = q('#login-password').value;
    if (!email || !password) {
      alert('Por favor, preencha o e-mail e a senha.');
      return;
    }
    window.showGlobalLoader?.(authMode === 'signup' ? 'Criando sua conta...' : 'Autenticando...');
    loginWithEmail(email, password, authMode === 'signup');
  });

  q('#btnSignOut')?.addEventListener('click', () => {
    signOutUser();
  });

  q('#btnForgotPassword')?.addEventListener('click', (e) => {
    e.preventDefault();
    const email = q('#login-email').value.trim();
    if (!email) {
      const promptEmail = prompt('Por favor, informe seu e-mail para recuperar a senha:', '');
      if (promptEmail && promptEmail.trim()) {
        sendPasswordReset(promptEmail.trim());
      }
    } else {
      if (confirm(`Deseja enviar um e-mail de redefinição de senha para ${email}?`)) {
        sendPasswordReset(email);
      }
    }
  });

  q('#f-profile-edit')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = q('#profile-name-input').value.trim();
    const newPassword = q('#profile-password-input')?.value;

    const promises = [];
    if (newName && newName !== currentUser?.name) {
      promises.push(updateUserDisplayName(newName));
    }
    if (newPassword && newPassword.trim().length > 0) {
      if (newPassword.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      promises.push(updateUserPassword(newPassword));
    }

    if (promises.length > 0) {
      Promise.all(promises).then(() => {
        const passInp = q('#profile-password-input');
        if (passInp) passInp.value = '';
      }).catch(err => {
        console.error('Error updating profile:', err);
      });
    } else {
      alert('Nenhuma alteração detectada.');
    }
  });

  // Cloud Sync Actions
  q('#btnForceUploadCloud')?.addEventListener('click', () => {
    if (!db || !currentUser || currentUser.isAnonymous) {
      alert('Você não está conectado a uma conta na nuvem.');
      return;
    }
    if (confirm('Tem certeza que deseja SOBRESCREVER os dados da nuvem com os dados locais desta máquina? Esta ação substituirá o banco de dados na nuvem.')) {
      const btn = q('#btnForceUploadCloud');
      if (btn) btn.disabled = true;
      
      db.collection('users').doc(currentUser.uid).set(S)
        .then(() => {
          alert('Dados locais enviados para a nuvem com sucesso!');
        })
        .catch(err => {
          console.error('Erro ao enviar dados para a nuvem:', err);
          alert('Erro ao enviar dados: ' + err.message);
        })
        .finally(() => {
          if (btn) btn.disabled = false;
        });
    }
  });

  q('#btnForceDownloadCloud')?.addEventListener('click', () => {
    if (!db || !currentUser || currentUser.isAnonymous) {
      alert('Você não está conectado a uma conta na nuvem.');
      return;
    }
    if (confirm('Deseja puxar os dados atualizados da nuvem? Isso substituirá as informações locais desta máquina.')) {
      const btn = q('#btnForceDownloadCloud');
      if (btn) btn.disabled = true;
      
      db.collection('users').doc(currentUser.uid).get()
        .then(doc => {
          if (doc.exists) {
            const remoteData = doc.data();
            setS(remoteData);
            processRecurringTransactions();
            updateUI();
            alert('Dados sincronizados da nuvem com sucesso!');
          } else {
            alert('Nenhum dado encontrado na nuvem para esta conta.');
          }
        })
        .catch(err => {
          console.error('Erro ao baixar dados da nuvem:', err);
          alert('Erro ao sincronizar dados da nuvem: ' + err.message);
        })
        .finally(() => {
          if (btn) btn.disabled = false;
        });
    }
  });



  // 29. Firebase boot sequence
  loadFirebaseConfig();
  const fbInitialized = initFirebase();
  if (!fbInitialized) {
    checkGuestLogin(updateUI);
  }

  // 29b. Premium Features Init
  // Stealth Mode Toggle
  const btnStealth = q('#btnStealthToggle');
  let isStealth = localStorage.getItem('financeos_stealth') === 'true';
  function applyStealth(stealth) {
    if (stealth) {
      document.body.classList.add('stealth-active');
      if (btnStealth) btnStealth.textContent = '🕶️';
    } else {
      document.body.classList.remove('stealth-active');
      if (btnStealth) btnStealth.textContent = '👁️';
    }
  }
  btnStealth?.addEventListener('click', () => {
    isStealth = !isStealth;
    localStorage.setItem('financeos_stealth', isStealth);
    if (isStealth) {
      localStorage.setItem('financeos_stealth_activated', 'true');
    }
    applyStealth(isStealth);
    if (activePage === 'perfil') renderAchievements();
  });
  applyStealth(isStealth);

  // Multi-currency field toggle on selection
  q('#tx-moeda')?.addEventListener('change', function() {
    const isBrl = this.value === 'BRL';
    const wrap = q('#tx-taxa-wrap');
    if (wrap) wrap.style.display = isBrl ? 'none' : 'block';
    if (isBrl) {
      q('#tx-taxa').value = '1';
    } else {
      q('#tx-taxa').value = '';
    }
    if (window.updateTxLivePreview) window.updateTxLivePreview();
  });

  // Calendar Export ICS click
  q('#btnExportICS')?.addEventListener('click', function() {
    exportCalendarICS(periodState.currentYear, periodState.currentMonth);
  });

  // Browser Notifications checkbox & request permission
  const chkNotif = q('#chkNotifications');
  if (chkNotif) {
    chkNotif.checked = localStorage.getItem('financeos_notifications') === 'true';
    chkNotif.addEventListener('change', function() {
      localStorage.setItem('financeos_notifications', this.checked);
      if (this.checked) {
        if ('Notification' in window) {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('FinanceOS', {
                body: 'Notificações ativadas com sucesso! 🔔'
              });
            } else {
              alert('Permissão de notificação negada pelo navegador.');
              this.checked = false;
              localStorage.setItem('financeos_notifications', 'false');
            }
          });
         } else {
          alert('Este navegador não suporta notificações de área de trabalho.');
          this.checked = false;
          localStorage.setItem('financeos_notifications', 'false');
        }
      }
    });
  }

  // Trigger browser notifications check on a short delay
  setTimeout(checkUpcomingBillsNotifications, 2000);

  // ── PIN Lock Lógica de Segurança ──
  const chkPinEnabled = q('#chkPinEnabled');
  const btnConfigurePin = q('#btnConfigurePin');
  const modalConfigPin = q('#modal-config-pin');
  const fConfigPin = q('#f-config-pin');
  const pinLockScreen = q('#pin-lock-screen');
  const pinCurrent = q('#pin-current');
  const pinInput1 = q('#pin-input1');
  const pinInput2 = q('#pin-input2');
  const btnDisablePin = q('#btnDisablePin');

  function updatePinCheckbox() {
    if (chkPinEnabled) {
      chkPinEnabled.checked = localStorage.getItem('financeos_pin_enabled') === 'true';
    }
  }
  updatePinCheckbox();

  // Configuração do PIN Modal
  btnConfigurePin?.addEventListener('click', () => {
    const hasPin = !!localStorage.getItem('financeos_pin_code');
    const pinConfirmSection = q('#pin-confirm-section');
    const pinCurrentInput = q('#pin-current');
    
    if (hasPin) {
      if (pinConfirmSection) pinConfirmSection.style.display = 'block';
      if (pinCurrentInput) pinCurrentInput.required = true;
      if (btnDisablePin) btnDisablePin.style.display = 'inline-block';
    } else {
      if (pinConfirmSection) pinConfirmSection.style.display = 'none';
      if (pinCurrentInput) {
        pinCurrentInput.required = false;
        pinCurrentInput.value = '';
      }
      if (btnDisablePin) btnDisablePin.style.display = 'none';
    }
    
    if (pinInput1) { pinInput1.value = ''; pinInput1.required = true; }
    if (pinInput2) { pinInput2.value = ''; pinInput2.required = true; }
    openM('modal-config-pin');
  });

  // Desativar PIN
  btnDisablePin?.addEventListener('click', () => {
    const storedPin = localStorage.getItem('financeos_pin_code');
    const currentVal = pinCurrent ? pinCurrent.value : '';
    
    if (currentVal !== storedPin) {
      alert('PIN atual incorreto!');
      return;
    }
    
    localStorage.removeItem('financeos_pin_code');
    localStorage.setItem('financeos_pin_enabled', 'false');
    updatePinCheckbox();
    closeM('modal-config-pin');
    alert('Bloqueio por PIN desativado com sucesso.');
  });

  // Salvar PIN
  fConfigPin?.addEventListener('submit', (e) => {
    e.preventDefault();
    const storedPin = localStorage.getItem('financeos_pin_code');
    const currentVal = pinCurrent ? pinCurrent.value : '';
    const newPin1 = pinInput1 ? pinInput1.value : '';
    const newPin2 = pinInput2 ? pinInput2.value : '';

    if (storedPin && currentVal !== storedPin) {
      alert('PIN atual incorreto!');
      return;
    }

    if (newPin1.length !== 4 || !/^\d{4}$/.test(newPin1)) {
      alert('O PIN deve conter exatamente 4 números.');
      return;
    }

    if (newPin1 !== newPin2) {
      alert('A confirmação do PIN não corresponde.');
      return;
    }

    localStorage.setItem('financeos_pin_code', newPin1);
    localStorage.setItem('financeos_pin_enabled', 'true');
    updatePinCheckbox();
    closeM('modal-config-pin');
    alert('PIN de segurança configurado com sucesso!');
  });

  // Lógica do Teclado de Bloqueio por PIN
  let typedPin = [];
  const pinDots = qa('#pin-dots-container .pin-dot');

  function updatePinDots() {
    pinDots.forEach((dot, index) => {
      if (index < typedPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  function handlePinInput(val) {
    if (typedPin.length >= 4) return;
    typedPin.push(val);
    updatePinDots();

    if (typedPin.length === 4) {
      const enteredPin = typedPin.join('');
      const storedPin = localStorage.getItem('financeos_pin_code');

      if (enteredPin === storedPin) {
        // Desbloquear
        typedPin = [];
        updatePinDots();
        if (pinLockScreen) pinLockScreen.style.display = 'none';
        sessionStorage.setItem('financeos_last_unlock', Date.now().toString());
      } else {
        // Erro
        const dotsContainer = q('#pin-dots-container');
        if (dotsContainer) {
          dotsContainer.classList.add('shake-element');
          pinDots.forEach(d => d.classList.add('error'));
        }
        setTimeout(() => {
          typedPin = [];
          updatePinDots();
          if (dotsContainer) {
            dotsContainer.classList.remove('shake-element');
            pinDots.forEach(d => d.classList.remove('error'));
          }
        }, 600);
      }
    }
  }

  qa('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handlePinInput(btn.dataset.val);
    });
  });

  q('#btnPinClear')?.addEventListener('click', () => {
    typedPin = [];
    updatePinDots();
  });

  q('#btnPinBackspace')?.addEventListener('click', () => {
    typedPin.pop();
    updatePinDots();
  });

  // Bloquear se o PIN estiver ativo no carregamento inicial
  const pinEnabled = localStorage.getItem('financeos_pin_enabled') === 'true';
  const storedPin = localStorage.getItem('financeos_pin_code');
  const lastUnlock = sessionStorage.getItem('financeos_last_unlock');
  const unlockedRecently = lastUnlock && (Date.now() - parseInt(lastUnlock) < 10000);

  if (pinEnabled && storedPin && !unlockedRecently) {
    if (pinLockScreen) pinLockScreen.style.display = 'flex';
  }

  // Monitorar retorno do segundo plano e inatividade para auto-lock
  function checkAutoLock() {
    const pinEnabled = localStorage.getItem('financeos_pin_enabled') === 'true';
    const storedPin = localStorage.getItem('financeos_pin_code');
    if (!pinEnabled || !storedPin) return;

    const bgTimeStr = sessionStorage.getItem('financeos_background_time');
    if (bgTimeStr) {
      const bgTime = parseInt(bgTimeStr);
      const now = Date.now();
      const diffMinutes = (now - bgTime) / 60000;
      // Bloquear se ficou em background por mais de 2 minutos
      if (diffMinutes >= 2) {
        typedPin = [];
        updatePinDots();
        if (pinLockScreen) pinLockScreen.style.display = 'flex';
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sessionStorage.setItem('financeos_background_time', Date.now().toString());
    } else if (document.visibilityState === 'visible') {
      checkAutoLock();
    }
  });

  // Indicador de Sincronização Status Dot
  function updateSyncStatusDot() {
    const dot = q('#sync-status-indicator');
    if (!dot) return;
    
    if (currentUser && !currentUser.isAnonymous) {
      dot.style.backgroundColor = 'var(--gr)'; // Verde
      dot.title = `Conectado e Sincronizado: ${currentUser.email}`;
    } else if (currentUser && currentUser.isAnonymous) {
      dot.style.backgroundColor = 'var(--am)'; // Amarelo
      dot.title = 'Modo Convidado / Local (Sem sincronização na nuvem)';
    } else {
      dot.style.backgroundColor = 'var(--tx2)'; // Cinza/Desconectado
      dot.title = 'Configuração de nuvem pendente ou local';
    }
  }
  window.updateSyncStatusDot = updateSyncStatusDot;
  updateSyncStatusDot();

  // ── Lógica da Zona de Risco (Exclusão de Conta) ──
  const btnDeleteAccount = q('#btnDeleteAccount');
  const fConfirmDelete = q('#f-confirm-delete');
  const deleteConfirmWord = q('#delete-confirm-word');

  btnDeleteAccount?.addEventListener('click', () => {
    openM('modal-confirm-delete');
  });

  fConfirmDelete?.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = deleteConfirmWord ? deleteConfirmWord.value.trim() : '';
    if (word !== 'APAGAR') {
      alert('Por favor, digite "APAGAR" exatamente como solicitado para confirmar.');
      return;
    }

    const submitBtn = fConfirmDelete.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : 'Excluir Tudo';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Excluindo...';
    }

    deleteAccountAndData()
      .then(() => {
        closeM('modal-confirm-delete');
        alert('Sua conta e todos os dados foram excluídos com sucesso!');
        updateUI();
      })
      .catch(err => {
        console.error('Failed to delete account:', err);
        if (err.code === 'auth/requires-recent-login') {
          alert('Por segurança, esta operação exige um login recente. Por favor, saia do aplicativo (Logout), faça login novamente e tente excluir a conta.');
        } else {
          alert('Erro ao excluir conta: ' + err.message);
        }
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
  });

  // ── Lógica de Carregamento (Loader) ──
  function showGlobalLoader(msg = "Processando em segundo plano...") {
    const loader = q('#global-loader');
    if (loader) {
      const textEl = loader.querySelector('.loader-text');
      if (textEl) textEl.textContent = msg;
      loader.hidden = false;
    }
  }

  function hideGlobalLoader() {
    const loader = q('#global-loader');
    if (loader) {
      loader.hidden = true;
    }
  }

  window.showGlobalLoader = showGlobalLoader;
  window.hideGlobalLoader = hideGlobalLoader;

  // ── Lógica da Tela de Planos (Paywall & Mercado Pago) ──
  const billingCycleToggle = q('#billing-cycle-toggle');
  const btnSelectFree = q('#btn-select-free');
  const btnPaywallClose = q('#btn-paywall-close');
  
  // Atualizar preços iniciais
  function updatePaywallPricing() {
    const isYearly = billingCycleToggle?.checked;
    const pricePlus = q('#price-plus');
    const periodPlus = q('#period-plus');
    const pricePro = q('#price-pro');
    const periodPro = q('#period-pro');
    const btnBuyPlus = q('#btn-buy-plus');
    const btnBuyPro = q('#btn-buy-pro');
    const monthlyLbl = q('#billing-monthly-lbl');
    const yearlyLbl = q('#billing-yearly-lbl');

    if (isYearly) {
      if (pricePlus) pricePlus.textContent = "9,90";
      if (periodPlus) periodPlus.textContent = "/mês (R$ 118,80/ano)";
      if (pricePro) pricePro.textContent = "19,90";
      if (periodPro) periodPro.textContent = "/mês (R$ 238,80/ano)";
      if (btnBuyPlus) btnBuyPlus.href = "https://link.mercadopago.com.br/financeos-plus-anual";
      if (btnBuyPro) btnBuyPro.href = "https://link.mercadopago.com.br/financeos-pro-anual";
      monthlyLbl?.classList.remove('active');
      yearlyLbl?.classList.add('active');
    } else {
      if (pricePlus) pricePlus.textContent = "14,90";
      if (periodPlus) periodPlus.textContent = "/mês";
      if (pricePro) pricePro.textContent = "29,90";
      if (periodPro) periodPro.textContent = "/mês";
      if (btnBuyPlus) btnBuyPlus.href = "https://link.mercadopago.com.br/financeos-plus-mensal";
      if (btnBuyPro) btnBuyPro.href = "https://link.mercadopago.com.br/financeos-pro-mensal";
      monthlyLbl?.classList.add('active');
      yearlyLbl?.classList.remove('active');
    }
  }

  billingCycleToggle?.addEventListener('change', updatePaywallPricing);
  updatePaywallPricing();

  // Fechar paywall
  btnSelectFree?.addEventListener('click', () => closeM('paywall-overlay'));
  btnPaywallClose?.addEventListener('click', () => closeM('paywall-overlay'));

  // Simulação de compras para testes
  q('#btn-simulate-plus')?.addEventListener('click', () => {
    S.subscription = {
      plan: 'plus',
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      status: 'active',
      aiQueriesUsed: 0,
      aiQueriesResetMonth: new Date().toISOString().substring(0, 7)
    };
    save();
    closeM('paywall-overlay');
    alert('Plano Plus simulado e ativado com sucesso! Limites atualizados.');
    updateUI();
  });

  q('#btn-simulate-pro')?.addEventListener('click', () => {
    S.subscription = {
      plan: 'pro',
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      status: 'active',
      aiQueriesUsed: 0,
      aiQueriesResetMonth: new Date().toISOString().substring(0, 7)
    };
    save();
    closeM('paywall-overlay');
    alert('Plano Pro simulado e ativado com sucesso! Todos os recursos liberados.');
    updateUI();
  });

  q('#btn-simulate-reset')?.addEventListener('click', () => {
    S.subscription = {
      plan: 'free',
      expiresAt: null,
      status: 'active',
      aiQueriesUsed: 0,
      aiQueriesResetMonth: new Date().toISOString().substring(0, 7)
    };
    save();
    alert('Assinatura resetada para o Plano Grátis.');
    updateUI();
  });

  // 30. Render initial view
  navigate(activePage);
  updateNotifications();
});

export function processRecurringTransactions() {
  if (!S || !Array.isArray(S.recurring)) return;
  
  let changed = false;
  const todayStr = getLocalToday();
  const yesterdayStr = getLocalYesterday();
  
  S.recurring.forEach(r => {
    // 1. Initialize last run date if null/empty
    if (!r.last) {
      r.last = yesterdayStr;
      changed = true;
    }
    
    let current = new Date(r.last + 'T12:00:00');
    const targetDate = new Date(todayStr + 'T12:00:00');
    targetDate.setDate(targetDate.getDate() + 180);
    let loopCount = 0;
    
    while (true) {
      current.setDate(current.getDate() + 1);
      if (current > targetDate) break;
      
      loopCount++;
      if (loopCount > 185) { // Safety limit slightly above 180 days
        console.warn('Recurring engine reached safety limit for rule:', r);
        break;
      }
      
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const currentStr = `${y}-${m}-${d}`;
      
      let matches = false;
      if (r.frequency === 'weekly') {
        const wDay = current.getDay();
        const targetWDay = r.day !== undefined ? r.day : 0;
        matches = (wDay === targetWDay);
      } else if (r.frequency === 'monthly') {
        const mDay = current.getDate();
        const targetMDay = r.day || 1;
        const lastDayOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        if (targetMDay >= lastDayOfMonth) {
          matches = (mDay === lastDayOfMonth);
        } else {
          matches = (mDay === targetMDay);
        }
      }
      
      if (matches) {
        // Double check to prevent duplicate transactions
        const alreadyExists = S.transactions.some(t => 
          t.desc === r.desc && 
          t.tipo === r.tipo && 
          t.val === r.val && 
          t.data === currentStr &&
          t.catId === r.catId
        );
        
        if (!alreadyExists) {
          S.transactions.push({
            id: uid(),
            desc: r.desc,
            tipo: r.tipo,
            val: r.val,
            catId: r.catId,
            payId: r.payId,
            data: currentStr,
            status: 'Pendente',
            inst: null,
            total: null
          });
          changed = true;
        }
      }
      
      r.last = currentStr;
      changed = true;
    }
  });
  
  if (changed) {
    save();
  }
}

function getLocalToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function exportCalendarICS(year, month) {
  const list = (S.transactions || []).filter(t => {
    const d = new Date(t.data + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });
  
  if (!list.length) {
    alert('Nenhum lançamento encontrado neste mês para exportar!');
    return;
  }
  
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FinanceOS//Calendar Export//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  list.forEach(t => {
    const cat = S.categories.find(c => c.id === t.catId) || { name: 'Outros', icon: '⚙️' };
    const acc = S.accounts.find(a => a.id === t.payId);
    const card = S.cards.find(c => c.id === t.payId);
    const payName = acc ? acc.name : card ? card.name : '—';
    
    const startIso = t.data.replace(/-/g, '');
    const d = new Date(t.data + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const endIso = d.toISOString().split('T')[0].replace(/-/g, '');
    
    const valueStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.val);
    const summary = `${t.tipo === 'Receita' ? '📈' : '📉'} ${t.desc} (${valueStr})`;
    const description = `Tipo: ${t.tipo}\\nValor: ${valueStr}\\nCategoria: ${cat.name}\\nConta/Cartão: ${payName}\\nStatus: ${t.status}`;
    
    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${t.id}@financeos.app`);
    ics.push(`DTSTAMP:${timestamp}`);
    ics.push(`DTSTART;VALUE=DATE:${startIso}`);
    ics.push(`DTEND;VALUE=DATE:${endIso}`);
    ics.push(`SUMMARY:${summary}`);
    ics.push(`DESCRIPTION:${description}`);
    ics.push('END:VEVENT');
  });
  
  ics.push('END:VCALENDAR');
  
  const icsString = ics.join('\r\n');
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `financeos_agenda_${year}_${String(month + 1).padStart(2, '0')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function checkUpcomingBillsNotifications() {
  if (localStorage.getItem('financeos_notifications') !== 'true') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];
  
  const notifiedTxs = JSON.parse(sessionStorage.getItem('financeos_notified_txs') || '{}');
  let hasNewNotification = false;
  
  (S.transactions || []).forEach(t => {
    if (t.tipo === 'Despesa' && t.status === 'Pendente' && t.data === todayStr) {
      if (!notifiedTxs[t.id]) {
        const valueStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.val);
        new Notification('Fatura Vencendo Hoje ⏰', {
          body: `A despesa "${t.desc}" no valor de ${valueStr} vence hoje!`,
          tag: t.id
        });
        notifiedTxs[t.id] = true;
        hasNewNotification = true;
      }
    }
  });
  
  if (hasNewNotification) {
    sessionStorage.setItem('financeos_notified_txs', JSON.stringify(notifiedTxs));
  }
}

window.exportCalendarICS = exportCalendarICS;
window.checkUpcomingBillsNotifications = checkUpcomingBillsNotifications;

// Event delegation for Challenge Multiplier change
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'challenge-multiplier') {
    changeMultiplier52(parseInt(e.target.value));
  }
});

export function toggleWeek52Challenge(weekIndex) {
  if (!S.challenge52) {
    S.challenge52 = { multiplier: 1, checkedWeeks: [] };
  }
  const idx = S.challenge52.checkedWeeks.indexOf(weekIndex);
  if (idx > -1) {
    S.challenge52.checkedWeeks.splice(idx, 1);
  } else {
    S.challenge52.checkedWeeks.push(weekIndex);
  }
  save();
  render52WeekChallenge();
  renderAchievements();
}

export function changeMultiplier52(multiplier) {
  if (!S.challenge52) {
    S.challenge52 = { multiplier: 1, checkedWeeks: [] };
  }
  S.challenge52.multiplier = multiplier;
  save();
  render52WeekChallenge();
  renderAchievements();
}

export function depositChallengeWeek(weekIndex, valueBRL) {
  q('#tx-id').value = '';
  q('#tx-tipo').value = 'Despesa';
  fillCatSelect(q('#tx-cat'), 'Despesa');
  fillPaySelect(q('#tx-conta'));
  
  const catSelect = q('#tx-cat');
  const options = Array.from(catSelect.options);
  const matchPoup = options.find(o => o.text.toLowerCase().includes('poup'));
  const matchInv = options.find(o => o.text.toLowerCase().includes('invest'));
  const matchOut = options.find(o => o.text.toLowerCase().includes('out'));
  let targetCatId = '';
  if (matchPoup) targetCatId = matchPoup.value;
  else if (matchInv) targetCatId = matchInv.value;
  else if (matchOut) targetCatId = matchOut.value;
  else if (options.length > 0) targetCatId = options[0].value;
  if (targetCatId) catSelect.value = targetCatId;

  q('#tx-val').value = valueBRL.toFixed(2);
  q('#tx-desc').value = `Desafio 52 Semanas - Semana ${weekIndex + 1}`;
  q('#tx-data').value = isoToday();
  q('#tx-status').value = 'Pago';

  const isInst = q('#tx-is-installment');
  if (isInst) isInst.checked = false;
  const instWrap = q('#tx-inst-wrap');
  if (instWrap) instWrap.style.display = 'none';
  const instInput = q('#tx-inst');
  if (instInput) instInput.value = '1';

  const recIs = q('#tx-is-recurring');
  if (recIs) {
    recIs.checked = false;
    const parentRow = recIs.closest('.fr');
    if (parentRow) parentRow.style.display = 'flex';
  }
  const recWrap = q('#tx-rec-wrap');
  if (recWrap) recWrap.style.display = 'none';

  if (q('#tx-tags')) q('#tx-tags').value = 'Desafio52';
  if (q('#tx-moeda')) q('#tx-moeda').value = 'BRL';
  if (q('#tx-taxa')) q('#tx-taxa').value = '1';
  if (q('#tx-taxa-wrap')) q('#tx-taxa-wrap').style.display = 'none';

  q('#tx-modal-title').textContent = `Desafio 52 Semanas - Semana ${weekIndex + 1}`;

  const keepOpenWrap = q('#tx-keep-open-wrap');
  if (keepOpenWrap) keepOpenWrap.style.display = 'flex';

  openM('m-tx');
  updateTxLivePreview();
}

window.toggleWeek52Challenge = toggleWeek52Challenge;
window.changeMultiplier52 = changeMultiplier52;
window.depositChallengeWeek = depositChallengeWeek;
