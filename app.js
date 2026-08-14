/**
 * FinanceOS — app.js
 * State management, rendering, chart logic, and event bindings.
 */

// ─── DEFAULT CATEGORIES ───────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: 'c_alimentacao',  name: 'Alimentação',      type: 'expense', color: '#f97316', icon: '🍔' },
  { id: 'c_moradia',      name: 'Moradia',           type: 'expense', color: '#3b82f6', icon: '🏠' },
  { id: 'c_transporte',   name: 'Transporte',        type: 'expense', color: '#06b6d4', icon: '🚗' },
  { id: 'c_lazer',        name: 'Lazer',             type: 'expense', color: '#ec4899', icon: '🍿' },
  { id: 'c_saude',        name: 'Saúde',             type: 'expense', color: '#10b981', icon: '💊' },
  { id: 'c_educacao',     name: 'Educação',          type: 'expense', color: '#8b5cf6', icon: '📚' },
  { id: 'c_compras',      name: 'Compras',           type: 'expense', color: '#eab308', icon: '🛍️' },
  { id: 'c_outros_d',     name: 'Outras Despesas',   type: 'expense', color: '#64748b', icon: '⚙️' },
  { id: 'c_salario',      name: 'Salário',           type: 'income',  color: '#10b981', icon: '💼' },
  { id: 'c_investimento', name: 'Investimentos',     type: 'income',  color: '#0ea5e9', icon: '📈' },
  { id: 'c_freelance',    name: 'Freelance',         type: 'income',  color: '#a855f7', icon: '💻' },
  { id: 'c_outros_r',     name: 'Outras Receitas',   type: 'income',  color: '#14b8a6', icon: '💰' },
];

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
function buildInitialState() {
  return {
    accounts: [
      { id: 'acc_1', name: 'Banco Inter',          type: 'checking',   balance: 3450.00 },
      { id: 'acc_2', name: 'Carteira / Dinheiro',  type: 'cash',        balance: 250.00  },
    ],
    creditCards: [
      { id: 'card_1', name: 'Inter Black', limit: 5000.00, closingDay: 5, dueDay: 12 },
    ],
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
    transactions: [
      { id: 't1', type: 'income',  description: 'Salário Principal',  amount: 5500.00, categoryId: 'c_salario',      date: today(0),  payId: 'acc_1',  inst: null, total: null },
      { id: 't2', type: 'income',  description: 'Dividendos FIIs',    amount: 145.20,  categoryId: 'c_investimento', date: today(-2), payId: 'acc_1',  inst: null, total: null },
      { id: 't3', type: 'expense', description: 'Aluguel do Mês',     amount: 1500.00, categoryId: 'c_moradia',      date: today(-5), payId: 'acc_1',  inst: null, total: null },
      { id: 't4', type: 'expense', description: 'Supermercado',       amount: 300.00,  categoryId: 'c_alimentacao',  date: today(-4), payId: 'card_1', inst: 1,    total: 3   },
      { id: 't5', type: 'expense', description: 'Gasolina',           amount: 180.00,  categoryId: 'c_transporte',   date: today(-3), payId: 'acc_1',  inst: null, total: null },
      { id: 't6', type: 'expense', description: 'Jantar com Amigos',  amount: 120.00,  categoryId: 'c_lazer',        date: today(-1), payId: 'card_1', inst: null, total: null },
    ],
    budgets: [
      { categoryId: 'c_alimentacao', limit: 800 },
      { categoryId: 'c_lazer',       limit: 200 },
    ],
    goals: [
      { id: 'g1', name: 'Reserva de Emergência', target: 15000, current: 4000,  deadline: '2027-06-01' },
      { id: 'g2', name: 'Viagem de Férias',       target: 8000,  current: 2500,  deadline: '2026-12-20' },
    ],
    recurring: [
      { id: 'r1', description: 'Netflix',       type: 'expense', amount: 55.90,  categoryId: 'c_lazer',  payId: 'card_1', day: 10, lastRun: null },
      { id: 'r2', description: 'Plano de Saúde', type: 'expense', amount: 350.00, categoryId: 'c_saude',  payId: 'acc_1',  day: 5,  lastRun: null },
    ],
  };
}

// ─── STATE ────────────────────────────────────────────────────────────────────
const KEY = 'financeos_v3';
let S = {};  // active state

function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      S = JSON.parse(raw);
      // Back-compat: make sure categories is an array
      if (!Array.isArray(S.categories)) {
        S.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
      }
      if (!S.recurring)    S.recurring    = [];
      if (!S.budgets)      S.budgets      = [];
      if (!S.goals)        S.goals        = [];
      if (!S.creditCards)  S.creditCards  = [];
    } else {
      S = buildInitialState();
      save();
    }
  } catch { S = buildInitialState(); save(); }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function parseLocalDate(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

function fmt(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getCat(id) {
  return S.categories.find(c => c.id === id) || { name: 'Outros', icon: '⚙️', color: '#64748b', type: 'expense' };
}

function getPayName(id) {
  const acc  = S.accounts.find(a => a.id === id);
  const card = S.creditCards.find(c => c.id === id);
  return acc ? acc.name : card ? card.name : '—';
}

function uid() { return '_' + Math.random().toString(36).slice(2, 9) + Date.now(); }

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).hidden = false;
  document.getElementById(id).querySelector('form')?.reset();
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

window.openModal  = openModal;
window.closeModal = closeModal;

// ─── PAGE NAVIGATION ──────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:    'Dashboard',
  transactions: 'Transações',
  accounts:     'Contas & Cartões',
  goals:        'Metas de Poupança',
  settings:     'Configurações',
};

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .bnav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || page;
  renderPage(page);
}

function renderPage(page) {
  if (page === 'dashboard')    renderDashboard();
  if (page === 'transactions') renderTransactions();
  if (page === 'accounts')     renderAccounts();
  if (page === 'goals')        renderGoals();
  if (page === 'settings')     renderSettings();
}

// ─── RENDER — DASHBOARD ───────────────────────────────────────────────────────
let chartMain = null;
let chartCat  = null;

function renderDashboard() {
  const now = new Date();
  const cy = now.getFullYear(), cm = now.getMonth();

  // Month figures
  let mIncome = 0, mExpense = 0, mIncCount = 0, mExpCount = 0;
  S.transactions.forEach(t => {
    const d = parseLocalDate(t.date);
    if (d.getFullYear() === cy && d.getMonth() === cm) {
      if (t.type === 'income')  { mIncome  += t.amount; mIncCount++; }
      else                      { mExpense += t.amount; mExpCount++; }
    }
  });

  // Card invoices
  let totalCards = 0;
  S.creditCards.forEach(c => { totalCards += cardInvoice(c.id, cy, cm); });

  // Net balance
  const netBal = S.accounts.reduce((s, a) => s + a.balance, 0) - totalCards;

  document.getElementById('kpi-balance').textContent    = fmt(netBal);
  document.getElementById('kpi-income').textContent     = fmt(mIncome);
  document.getElementById('kpi-expense').textContent    = fmt(mExpense);
  document.getElementById('kpi-cards').textContent      = fmt(totalCards);
  document.getElementById('kpi-income-sub').textContent = `+${mIncCount} transações`;
  document.getElementById('kpi-expense-sub').textContent= `−${mExpCount} transações`;

  renderMainChart();
  renderCatChart();
  renderDashBudgets();
  renderDashRecent();
}

function cardInvoice(cardId, year, month) {
  const card = S.creditCards.find(c => c.id === cardId);
  if (!card) return 0;
  let total = 0;
  S.transactions.forEach(t => {
    if (t.payId !== cardId || t.type !== 'expense') return;
    const d = parseLocalDate(t.date);
    let im = d.getMonth(), iy = d.getFullYear();
    if (d.getDate() > card.closingDay) {
      im++; if (im > 11) { im = 0; iy++; }
    }
    if (iy === year && im === month) total += t.amount;
  });
  return total;
}

function renderMainChart() {
  const mode = document.getElementById('chartMode')?.value || '6months';
  const yr   = parseInt(document.getElementById('chartYear')?.value || new Date().getFullYear());
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const labels = [], inc = [], exp = [];
  const now = new Date();

  // BOLT OPTIMIZATION: Replaced O(N*M) loop and expensive Date parsing
  // with O(N) single pass and fast string slicing.
  if (mode === '6months') {
    const prefixes = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(MONTHS[d.getMonth()]);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      prefixes.push(`${d.getFullYear()}-${m}`);
      inc.push(0); exp.push(0);
    }

    S.transactions.forEach(t => {
      const prefix = t.date.substring(0, 7);
      const idx = prefixes.indexOf(prefix);
      if (idx !== -1) {
        if (t.type === 'income') inc[idx] += t.amount; else exp[idx] += t.amount;
      }
    });
  } else {
    for (let m = 0; m < 12; m++) {
      labels.push(MONTHS[m]);
      inc.push(0); exp.push(0);
    }

    const prefix = yr.toString();
    S.transactions.forEach(t => {
      if (t.date.substring(0, 4) === prefix) {
        const m = parseInt(t.date.substring(5, 7), 10) - 1;
        if (t.type === 'income') inc[m] += t.amount; else exp[m] += t.amount;
      }
    });
  }

  const ctx = document.getElementById('chartMain').getContext('2d');
  if (chartMain) chartMain.destroy();
  chartMain = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Receitas',  data: inc, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 6, borderSkipped: false },
        { label: 'Despesas',  data: exp, backgroundColor: 'rgba(244,63,94,0.7)',  borderRadius: 6, borderSkipped: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8891a8', font: { size: 12 }, boxWidth: 10 } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8891a8', font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8891a8', font: { size: 11 } } },
      },
    },
  });
}

function renderCatChart() {
  const now = new Date(); const cy = now.getFullYear(), cm = now.getMonth();
  const map = {};
  S.transactions.forEach(t => {
    if (t.type !== 'expense') return;
    const d = parseLocalDate(t.date);
    if (d.getFullYear() === cy && d.getMonth() === cm) {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    }
  });

  const labels = [], data = [], colors = [];
  Object.entries(map).forEach(([id, amt]) => {
    const cat = getCat(id);
    labels.push(cat.name); data.push(amt); colors.push(cat.color);
  });

  const ctx = document.getElementById('chartCat').getContext('2d');
  if (chartCat) chartCat.destroy();
  if (data.length === 0) {
    chartCat = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Sem despesas'], datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.06)'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' },
    });
    return;
  }
  chartCat = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#8891a8', font: { size: 11 }, boxWidth: 10, padding: 14 } } },
      cutout: '68%',
    },
  });
}

function renderDashBudgets() {
  const now = new Date(); const cy = now.getFullYear(), cm = now.getMonth();
  const spent = {};
  S.transactions.forEach(t => {
    if (t.type !== 'expense') return;
    const d = parseLocalDate(t.date);
    if (d.getFullYear() === cy && d.getMonth() === cm) {
      spent[t.categoryId] = (spent[t.categoryId] || 0) + t.amount;
    }
  });

  const el = document.getElementById('dash-budgets');
  const alerts = S.budgets.filter(b => (spent[b.categoryId] || 0) / b.limit >= 0.7);
  if (alerts.length === 0) {
    el.innerHTML = '<p class="empty-msg">Nenhum orçamento em alerta. 🎉</p>';
    return;
  }
  el.innerHTML = alerts.map(b => {
    const cat = getCat(b.categoryId);
    const s = spent[b.categoryId] || 0;
    const pct = Math.min(100, Math.round(s / b.limit * 100));
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    const clrVar = cls === 'over' ? 'var(--red)' : cls === 'warn' ? 'var(--amber)' : 'var(--green)';
    return `<div class="list-item budget-item">
      <div class="budget-item-header">
        <div class="list-item-left"><span class="list-item-icon">${cat.icon}</span><span class="list-item-name">${cat.name}</span></div>
        <span style="font-size:12px; font-weight:700; color:${clrVar}">${pct}%</span>
      </div>
      <div class="budget-bar-bg"><div class="budget-bar ${cls}" style="width:${pct}%"></div></div>
      <div class="budget-meta"><span>${fmt(s)} gastos</span><span>de ${fmt(b.limit)}</span></div>
    </div>`;
  }).join('');
}

function renderDashRecent() {
  const recent = [...S.transactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 6);
  const el = document.getElementById('dash-recent-list');
  if (recent.length === 0) { el.innerHTML = '<p class="empty-msg">Sem transações.</p>'; return; }
  el.innerHTML = recent.map(t => txItemHTML(t)).join('');
}

// ─── RENDER — TRANSACTIONS ────────────────────────────────────────────────────
function renderTransactions() {
  populateCatFilter();
  populateAccountFilter();
  applyFilters();
}

function populateCatFilter() {
  const sel = document.getElementById('catFilter');
  sel.innerHTML = '<option value="all">Todas</option>' +
    S.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

function populateAccountFilter() {
  const sel = document.getElementById('accountFilter');
  sel.innerHTML = '<option value="all">Todas</option>' +
    S.accounts.map(a => `<option value="${a.id}">🏦 ${a.name}</option>`).join('') +
    S.creditCards.map(c => `<option value="${c.id}">💳 ${c.name}</option>`).join('');
}

function applyFilters() {
  const search  = document.getElementById('searchFilter').value.toLowerCase();
  const type    = document.getElementById('typeFilter').value;
  const catId   = document.getElementById('catFilter').value;
  const accId   = document.getElementById('accountFilter').value;
  const period  = document.getElementById('periodFilter').value;
  const now     = new Date();

  const filtered = S.transactions.filter(t => {
    if (search && !t.description.toLowerCase().includes(search)) return false;
    if (type !== 'all' && t.type !== type) return false;
    if (catId !== 'all' && t.categoryId !== catId) return false;
    if (accId !== 'all' && t.payId !== accId) return false;
    if (period !== 'all') {
      const d = parseLocalDate(t.date);
      if (period === 'thisMonth'  && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (period === 'lastMonth') {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        if (d.getMonth() !== lm.getMonth() || d.getFullYear() !== lm.getFullYear()) return false;
      }
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const el = document.getElementById('txList');
  document.getElementById('txListTitle').textContent = `${filtered.length} transação(ões)`;

  if (filtered.length === 0) {
    el.innerHTML = '<p class="empty-msg">Nenhuma transação encontrada.</p>';
    return;
  }
  el.innerHTML = filtered.map(t => txItemHTML(t, true)).join('');
}

function txItemHTML(t, withDel = false) {
  const cat = getCat(t.categoryId);
  const payName = getPayName(t.payId);
  const instLabel = t.inst ? ` <span style="opacity:.6;font-size:11px">(${t.inst}/${t.total})</span>` : '';
  const delBtn = withDel ? `<button class="btn-del" onclick="deleteTx('${t.id}')" title="Excluir">✕</button>` : '';
  return `<div class="tx-item">
    <div class="tx-left">
      <div class="tx-icon" style="background:${cat.color}1a; color:${cat.color}">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-title">${t.description}${instLabel}</div>
        <div class="tx-meta">
          <span style="color:${cat.color}">${cat.name}</span>
          <span class="tx-meta-sep">·</span>
          <span>${payName}</span>
          <span class="tx-meta-sep">·</span>
          <span>${fmtDate(t.date)}</span>
        </div>
      </div>
    </div>
    <div class="tx-right">
      <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '−'} ${fmt(t.amount)}</span>
      ${delBtn}
    </div>
  </div>`;
}

window.deleteTx = function(id) {
  if (!confirm('Excluir esta transação?')) return;
  S.transactions = S.transactions.filter(t => t.id !== id);
  save();
  applyFilters();
  renderDashboard();
};

// ─── RENDER — ACCOUNTS & CARDS ────────────────────────────────────────────────
function renderAccounts() {
  const ACC_ICONS = { checking: '🏦', savings: '💰', cash: '💵', investment: '📈' };
  const ACC_TYPE  = { checking: 'Conta Corrente', savings: 'Poupança', cash: 'Dinheiro', investment: 'Investimentos' };

  const el = document.getElementById('accountsList');
  if (S.accounts.length === 0) { el.innerHTML = '<p class="empty-msg">Nenhuma conta cadastrada.</p>'; }
  else {
    el.innerHTML = S.accounts.map(a => `
      <div class="account-item">
        <div class="account-item-header">
          <div>
            <div class="account-icon">${ACC_ICONS[a.type] || '🏦'}</div>
            <div class="account-name">${a.name}</div>
            <div class="account-type">${ACC_TYPE[a.type] || a.type}</div>
          </div>
          <button class="btn-del" onclick="deleteAccount('${a.id}')">✕</button>
        </div>
        <div class="account-balance ${a.balance < 0 ? 'tx-amount expense' : ''}">${fmt(a.balance)}</div>
      </div>`).join('');
  }

  const now = new Date(); const cy = now.getFullYear(), cm = now.getMonth();
  const el2 = document.getElementById('cardsList');
  if (S.creditCards.length === 0) { el2.innerHTML = '<p class="empty-msg">Nenhum cartão cadastrado.</p>'; }
  else {
    el2.innerHTML = S.creditCards.map(c => {
      const inv = cardInvoice(c.id, cy, cm);
      const avail = Math.max(0, c.limit - inv);
      const pct = Math.min(100, Math.round(inv / c.limit * 100));
      const barCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
      return `<div class="cc-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div class="cc-name">${c.name}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="cc-chip"></div>
            <button class="btn-del" style="color:rgba(255,255,255,0.4); font-size:14px;" onclick="deleteCard('${c.id}')">✕</button>
          </div>
        </div>
        <div>
          <div class="cc-invoice-label">Fatura Atual</div>
          <div class="cc-invoice">${fmt(inv)}</div>
          <div class="cc-progress"><div class="cc-progress-bar ${barCls}" style="width:${pct}%"></div></div>
          <div class="cc-meta"><span>Disponível ${fmt(avail)}</span><span>Limite ${fmt(c.limit)}</span></div>
        </div>
        <div class="cc-footer">
          <div class="cc-due">Fecha dia ${c.closingDay} • Vence dia ${c.dueDay}</div>
        </div>
      </div>`;
    }).join('');
  }
}

window.deleteAccount = function(id) {
  if (S.accounts.length <= 1) { alert('Mantenha pelo menos uma conta.'); return; }
  if (confirm('Excluir esta conta?')) { S.accounts = S.accounts.filter(a => a.id !== id); save(); renderAccounts(); }
};
window.deleteCard = function(id) {
  if (confirm('Excluir este cartão?')) { S.creditCards = S.creditCards.filter(c => c.id !== id); save(); renderAccounts(); }
};

// ─── RENDER — GOALS ───────────────────────────────────────────────────────────
function renderGoals() {
  const el = document.getElementById('goalsList');
  if (S.goals.length === 0) { el.innerHTML = '<p class="empty-msg">Nenhuma meta criada.</p>'; return; }
  el.innerHTML = S.goals.map(g => {
    const pct = Math.min(100, Math.round(g.current / g.target * 100));
    const rem = Math.max(0, g.target - g.current);
    return `<div class="goal-item">
      <div class="goal-header">
        <div>
          <div class="goal-name">🎯 ${g.name}</div>
          <div class="goal-deadline">Meta: ${fmtDate(g.deadline)}</div>
        </div>
        <button class="btn-del" onclick="deleteGoal('${g.id}')">✕</button>
      </div>
      <div class="goal-amount">${fmt(g.current)}</div>
      <div class="goal-target">de ${fmt(g.target)} • Faltam ${fmt(rem)}</div>
      <div class="progress"><div class="progress-bar ${pct >= 100 ? 'full' : ''}" style="width:${pct}%"></div></div>
      <div class="goal-footer">
        <span class="goal-pct">${pct}% concluído</span>
        <div class="goal-actions">
          <button class="btn-sm-goal" onclick="openGoalMove('${g.id}', 'deposit')">+ Depositar</button>
          <button class="btn-sm-goal" onclick="openGoalMove('${g.id}', 'withdraw')">− Resgatar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.openGoalMove = function(id, mode) {
  const goal = S.goals.find(g => g.id === id);
  if (!goal) return;
  document.getElementById('goalMoveId').value = id;
  document.getElementById('goalMoveType').value = mode;
  document.getElementById('goalMoveTitle').textContent = mode === 'deposit' ? `Depositar — ${goal.name}` : `Resgatar — ${goal.name}`;
  document.getElementById('goalMoveAmount').value = '';
  openModal('modal-goal-move');
};

window.deleteGoal = function(id) {
  if (confirm('Excluir esta meta?')) { S.goals = S.goals.filter(g => g.id !== id); save(); renderGoals(); }
};

// ─── RENDER — SETTINGS ───────────────────────────────────────────────────────
let activeCatTab = 'expense';

function renderSettings() {
  renderBudgets();
  renderRecurring();
  renderCategoriesGrid();
}

function renderBudgets() {
  const now = new Date(); const cy = now.getFullYear(), cm = now.getMonth();
  const spent = {};
  S.transactions.forEach(t => {
    if (t.type !== 'expense') return;
    const d = parseLocalDate(t.date);
    if (d.getFullYear() === cy && d.getMonth() === cm) spent[t.categoryId] = (spent[t.categoryId] || 0) + t.amount;
  });

  const el = document.getElementById('budgetList');
  if (S.budgets.length === 0) { el.innerHTML = '<p class="empty-msg">Sem orçamentos definidos.</p>'; return; }
  el.innerHTML = S.budgets.map(b => {
    const cat = getCat(b.categoryId);
    const s = spent[b.categoryId] || 0;
    const pct = Math.min(100, Math.round(s / b.limit * 100));
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    return `<div class="list-item budget-item">
      <div class="budget-item-header">
        <div class="list-item-left">
          <span class="list-item-icon">${cat.icon}</span>
          <div class="list-item-info">
            <div class="list-item-name">${cat.name}</div>
            <div class="list-item-sub">${fmt(s)} de ${fmt(b.limit)}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:12px; font-weight:700;">${pct}%</span>
          <button class="btn-del" onclick="deleteBudget('${b.categoryId}')">✕</button>
        </div>
      </div>
      <div class="budget-bar-bg"><div class="budget-bar ${cls}" style="width:${pct}%"></div></div>
      <div class="budget-meta"><span>${pct}% usado</span><span>${fmt(Math.max(0, b.limit - s))} restante</span></div>
    </div>`;
  }).join('');
}

window.deleteBudget = function(catId) {
  S.budgets = S.budgets.filter(b => b.categoryId !== catId); save(); renderBudgets();
};

function renderRecurring() {
  const el = document.getElementById('recurringList');
  if (S.recurring.length === 0) { el.innerHTML = '<p class="empty-msg">Sem lançamentos fixos.</p>'; return; }
  el.innerHTML = S.recurring.map(r => {
    const cat = getCat(r.categoryId);
    const payName = getPayName(r.payId);
    return `<div class="list-item">
      <div class="list-item-left">
        <span class="list-item-icon">${cat.icon}</span>
        <div class="list-item-info">
          <div class="list-item-name">${r.description}</div>
          <div class="list-item-sub">${cat.name} · ${payName} · Dia ${r.day}</div>
        </div>
      </div>
      <div class="list-item-right">
        <span class="list-item-value ${r.type}">${r.type === 'income' ? '+' : '−'} ${fmt(r.amount)}</span>
        <button class="btn-del" onclick="deleteRecurring('${r.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

window.deleteRecurring = function(id) {
  S.recurring = S.recurring.filter(r => r.id !== id); save(); renderRecurring();
};

function renderCategoriesGrid() {
  const el = document.getElementById('categoriesGrid');
  const list = S.categories.filter(c => c.type === activeCatTab);

  if (list.length === 0) { el.innerHTML = '<p class="empty-msg">Nenhuma categoria aqui.</p>'; return; }

  el.innerHTML = list.map(c => `
    <div class="cat-tile">
      <span class="cat-emoji">${c.icon}</span>
      <div class="cat-label">
        <div class="cat-label-name">${c.name}</div>
        <span class="cat-label-badge" style="background:${c.color}22; color:${c.color}; border:1px solid ${c.color}44">
          ${c.type === 'expense' ? 'Despesa' : 'Receita'}
        </span>
      </div>
      <button class="btn-del" onclick="deleteCategory('${c.id}')" title="Excluir">✕</button>
    </div>`).join('');
}

window.deleteCategory = function(id) {
  const inUse = S.transactions.some(t => t.categoryId === id) ||
                S.budgets.some(b => b.categoryId === id) ||
                S.recurring.some(r => r.categoryId === id);
  if (inUse && !confirm('Essa categoria está em uso. Excluir mesmo assim?')) return;
  S.categories = S.categories.filter(c => c.id !== id);
  save();
  renderCategoriesGrid();
  // Refresh tx and budget dropdowns
};

// ─── POPULATE SELECT HELPERS ──────────────────────────────────────────────────
function fillCatSelect(el, type = null) {
  const cats = type ? S.categories.filter(c => c.type === type) : S.categories;
  el.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

function fillPaySelect(el) {
  el.innerHTML =
    `<optgroup label="Contas Bancárias">${S.accounts.map(a => `<option value="${a.id}">🏦 ${a.name}</option>`).join('')}</optgroup>` +
    `<optgroup label="Cartões de Crédito">${S.creditCards.map(c => `<option value="${c.id}">💳 ${c.name}</option>`).join('')}</optgroup>`;
}

function fillBudgetCatSelect() {
  const el = document.getElementById('budgetCat');
  fillCatSelect(el, 'expense');
}

function fillRecurringSelects() {
  const type = document.getElementById('recType').value;
  fillCatSelect(document.getElementById('recCat'), type);
  fillPaySelect(document.getElementById('recAccount'));
}

// ─── RECURRING CRON CHECK ─────────────────────────────────────────────────────
function checkRecurring() {
  const now = new Date();
  const cy = now.getFullYear(), cm = now.getMonth(), cd = now.getDate();
  let changed = false;

  S.recurring.forEach(r => {
    // Only fire if today >= r.day and haven't already generated this month
    if (cd < r.day) return;
    const yearMonth = `${cy}-${String(cm + 1).padStart(2, '0')}`;
    if (r.lastRun === yearMonth) return;

    // Check no duplicate exists
    const dup = S.transactions.some(t =>
      t.description === r.description + ' (fixo)' &&
      t.amount === r.amount &&
      t.categoryId === r.categoryId
    );

    const dateStr = `${cy}-${String(cm + 1).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`;
    if (!dup) {
      S.transactions.unshift({
        id: uid(), type: r.type, description: r.description + ' (fixo)',
        amount: r.amount, categoryId: r.categoryId, date: dateStr,
        payId: r.payId, inst: null, total: null,
      });
    }
    r.lastRun = yearMonth;
    changed = true;
  });

  if (changed) save();
}

// ─── BANK IMPORT (OFX / CSV) ──────────────────────────────────────────────────
let importQueue = [];

function processFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    if (file.name.toLowerCase().endsWith('.ofx')) {
      importQueue = parseOFX(text);
    } else {
      importQueue = parseCSV(text);
    }
    showImportPreview();
  };
  reader.readAsText(file, 'utf-8');
}

function parseCSV(text) {
  const lines = text.split('\n');
  const result = [];
  lines.forEach(line => {
    const cols = line.split(/[;,]/);
    if (cols.length < 3) return;
    const dateStr = cols[0].trim();
    const desc    = cols[1].trim();
    const rawAmt  = cols[2].trim().replace(/\./g, '').replace(',', '.');
    const match   = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return;
    const date = `${match[3]}-${match[2]}-${match[1]}`;
    const amount = parseFloat(rawAmt);
    if (isNaN(amount) || amount === 0) return;
    result.push({ id: uid(), type: amount >= 0 ? 'income' : 'expense', description: desc, amount: Math.abs(amount), date });
  });
  return result;
}

function showImportPreview() {
  const el = document.getElementById('importList');
  const previewEl = document.getElementById('importPreview');
  document.getElementById('importCount').textContent = `${importQueue.length} transação(ões) encontradas`;
  previewEl.hidden = false;

  el.innerHTML = importQueue.map((t, i) => `
    <div class="import-item">
      <input type="checkbox" id="imp_${i}" checked>
      <div class="imp-desc">${t.description}</div>
      <div class="imp-date">${fmtDate(t.date)}</div>
      <div class="imp-amount ${t.type}">${t.type === 'income' ? '+' : '−'} ${fmt(t.amount)}</div>
    </div>`).join('');
}

function confirmImport() {
  // auto-detect account
  let targetAcc = S.accounts.find(a => a.name.toLowerCase().includes('inter')) || S.accounts[0];
  if (!targetAcc) { alert('Crie uma conta bancária antes de importar.'); return; }

  let count = 0;
  importQueue.forEach((t, i) => {
    const chk = document.getElementById(`imp_${i}`);
    if (!chk?.checked) return;
    const dup = S.transactions.some(s => s.description === t.description && s.amount === t.amount && s.date === t.date);
    if (dup) return;

    // Auto-categorize
    let catId = t.type === 'income' ? 'c_outros_r' : 'c_outros_d';
    const dl = t.description.toLowerCase();
    if (/mercado|supermercado|ifood|rappi/.test(dl)) catId = 'c_alimentacao';
    else if (/uber|combustiv|posto|gasolina/.test(dl)) catId = 'c_transporte';
    else if (/netflix|cinema|spotify/.test(dl)) catId = 'c_lazer';
    else if (/salario|salário|remunera/.test(dl)) catId = 'c_salario';

    S.transactions.unshift({ ...t, categoryId: catId, payId: targetAcc.id, inst: null, total: null });
    count++;
  });

  save();
  alert(`${count} transações importadas para "${targetAcc.name}".`);
  importQueue = [];
  document.getElementById('importPreview').hidden = true;
  document.getElementById('bankFile').value = '';
  applyFilters();
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
function exportJSON() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `financeos-backup-${today()}.json`);
}

function exportCSV() {
  if (S.transactions.length === 0) { alert('Sem transações.'); return; }
  let csv = 'ID,Tipo,Descricao,Valor,Categoria,Data,Conta,Parcela\n';
  S.transactions.forEach(t => {
    const cat = getCat(t.categoryId).name;
    const pay = getPayName(t.payId);
    const inst = t.inst ? `${t.inst}/${t.total}` : 'Vista';
    const desc = `"${t.description.replace(/"/g, '""')}"`;
    csv += `${t.id},${t.type === 'income' ? 'Receita' : 'Despesa'},${desc},${t.amount},"${cat}",${t.date},"${pay}","${inst}"\n`;
  });
  triggerDownload(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `financeos-transacoes-${today()}.csv`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.transactions && data.categories) {
        S = data; save();
        alert('Backup restaurado com sucesso!');
        navigate('dashboard');
      } else { alert('Arquivo de backup inválido.'); }
    } catch { alert('Erro ao ler o arquivo.'); }
  };
  reader.readAsText(file);
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Chart.defaults.color = '#8891a8';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

  load();
  checkRecurring();

  // Navigation buttons (sidebar + bottom)
  document.querySelectorAll('.nav-btn, .bnav-btn, .btn-link[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Mobile menu toggle
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Topbar date
  const opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('pt-BR', opts);

  // Open TX modal from header buttons
  document.getElementById('btnNewTx').addEventListener('click',  () => openTxModal());
  document.getElementById('btnNewTx2').addEventListener('click', () => openTxModal());

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.hidden = true; });
  });

  // ── TRANSACTION FORM ──
  function openTxModal() {
    const txType = document.getElementById('txType').value;
    fillCatSelect(document.getElementById('txCat'), txType);
    fillPaySelect(document.getElementById('txAccount'));
    document.getElementById('txDate').value = today();
    document.getElementById('installGroup').style.display = 'none';
    openModal('modal-tx');
  }

  document.getElementById('txType').addEventListener('change', e => {
    fillCatSelect(document.getElementById('txCat'), e.target.value);
  });

  document.getElementById('txAccount').addEventListener('change', e => {
    const isCard = S.creditCards.some(c => c.id === e.target.value);
    const isExpense = document.getElementById('txType').value === 'expense';
    document.getElementById('installGroup').style.display = (isCard && isExpense) ? 'block' : 'none';
  });

  document.getElementById('formTx').addEventListener('submit', e => {
    e.preventDefault();
    const type   = document.getElementById('txType').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const desc   = document.getElementById('txDesc').value.trim();
    const catId  = document.getElementById('txCat').value;
    const payId  = document.getElementById('txAccount').value;
    const date   = document.getElementById('txDate').value;
    const inst   = parseInt(document.getElementById('txInstallments').value) || 1;
    const isCard = S.creditCards.some(c => c.id === payId);

    if (inst > 1 && isCard && type === 'expense') {
      for (let i = 1; i <= inst; i++) {
        const d = parseLocalDate(date);
        d.setMonth(d.getMonth() + i - 1);
        S.transactions.unshift({
          id: uid(), type, description: `${desc}`, amount: +(amount / inst).toFixed(2),
          categoryId: catId, date: d.toISOString().split('T')[0], payId, inst: i, total: inst,
        });
      }
    } else {
      S.transactions.unshift({ id: uid(), type, description: desc, amount, categoryId: catId, date, payId, inst: null, total: null });
      // Update checking account balance
      const acc = S.accounts.find(a => a.id === payId);
      if (acc) acc.balance += type === 'income' ? amount : -amount;
    }
    save();
    closeModal('modal-tx');
    renderDashboard();
    applyFilters();
  });

  // ── ACCOUNT FORM ──
  document.getElementById('btnNewAccount').addEventListener('click', () => openModal('modal-account'));
  document.getElementById('formAccount').addEventListener('submit', e => {
    e.preventDefault();
    S.accounts.push({
      id: uid(),
      name: document.getElementById('accName').value.trim(),
      type: document.getElementById('accType').value,
      balance: parseFloat(document.getElementById('accBalance').value) || 0,
    });
    save(); closeModal('modal-account'); renderAccounts();
  });

  // ── CARD FORM ──
  document.getElementById('btnNewCard').addEventListener('click', () => openModal('modal-card'));
  document.getElementById('formCard').addEventListener('submit', e => {
    e.preventDefault();
    S.creditCards.push({
      id: uid(),
      name: document.getElementById('cardName').value.trim(),
      limit: parseFloat(document.getElementById('cardLimit').value) || 0,
      closingDay: parseInt(document.getElementById('cardClose').value) || 1,
      dueDay: parseInt(document.getElementById('cardDue').value) || 10,
    });
    save(); closeModal('modal-card'); renderAccounts();
  });

  // ── GOAL FORM ──
  document.getElementById('btnNewGoal').addEventListener('click', () => openModal('modal-goal'));
  document.getElementById('formGoal').addEventListener('submit', e => {
    e.preventDefault();
    S.goals.push({
      id: uid(),
      name: document.getElementById('goalName').value.trim(),
      target: parseFloat(document.getElementById('goalTarget').value) || 0,
      current: 0,
      deadline: document.getElementById('goalDate').value,
    });
    save(); closeModal('modal-goal'); renderGoals();
  });

  // ── GOAL MOVE ──
  document.getElementById('formGoalMove').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('goalMoveId').value;
    const mode = document.getElementById('goalMoveType').value;
    const amount = parseFloat(document.getElementById('goalMoveAmount').value) || 0;
    const goal = S.goals.find(g => g.id === id);
    if (!goal) return;
    if (mode === 'deposit') goal.current += amount;
    else goal.current = Math.max(0, goal.current - amount);
    save(); closeModal('modal-goal-move'); renderGoals();
  });

  // ── BUDGET FORM ──
  document.getElementById('btnNewBudget').addEventListener('click', () => {
    fillBudgetCatSelect();
    openModal('modal-budget');
  });
  document.getElementById('formBudget').addEventListener('submit', e => {
    e.preventDefault();
    const catId = document.getElementById('budgetCat').value;
    const limit = parseFloat(document.getElementById('budgetLimit').value) || 0;
    const existing = S.budgets.findIndex(b => b.categoryId === catId);
    if (existing >= 0) S.budgets[existing].limit = limit;
    else S.budgets.push({ categoryId: catId, limit });
    save(); closeModal('modal-budget'); renderBudgets();
  });

  // ── RECURRING FORM ──
  document.getElementById('btnNewRecurring').addEventListener('click', () => {
    fillRecurringSelects();
    openModal('modal-recurring');
  });
  document.getElementById('recType').addEventListener('change', fillRecurringSelects);
  document.getElementById('formRecurring').addEventListener('submit', e => {
    e.preventDefault();
    S.recurring.push({
      id: uid(),
      description: document.getElementById('recDesc').value.trim(),
      type: document.getElementById('recType').value,
      amount: parseFloat(document.getElementById('recAmount').value) || 0,
      categoryId: document.getElementById('recCat').value,
      payId: document.getElementById('recAccount').value,
      day: parseInt(document.getElementById('recDay').value) || 1,
      lastRun: null,
    });
    save(); closeModal('modal-recurring'); renderRecurring();
  });

  // ── CATEGORY FORM ──
  document.getElementById('btnNewCategory').addEventListener('click', () => openModal('modal-category'));

  // Color presets
  document.querySelectorAll('.cp').forEach(cp => {
    cp.addEventListener('click', () => {
      document.getElementById('catColor').value = cp.dataset.color;
      document.querySelectorAll('.cp').forEach(c => c.classList.remove('selected'));
      cp.classList.add('selected');
    });
  });

  document.getElementById('formCategory').addEventListener('submit', e => {
    e.preventDefault();
    const name  = document.getElementById('catName').value.trim();
    const type  = document.getElementById('catType').value;
    const icon  = document.getElementById('catIcon').value.trim() || '📌';
    const color = document.getElementById('catColor').value;
    if (!name) return;

    const newCat = { id: 'c_custom_' + uid(), name, type, icon, color };
    S.categories.push(newCat);
    save();
    closeModal('modal-category');
    renderCategoriesGrid();
    // Show success
    activeCatTab = type;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.ctype === type));
    renderCategoriesGrid();
  });

  // Cat tabs
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeCatTab = tab.dataset.ctype;
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderCategoriesGrid();
    });
  });

  // ── CHART CONTROLS ──
  document.getElementById('chartMode')?.addEventListener('change', renderDashboard);
  document.getElementById('chartYear')?.addEventListener('change', renderDashboard);

  // ── FILTERS ──
  ['searchFilter','typeFilter','catFilter','accountFilter','periodFilter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', applyFilters);
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });

  // ── FILE IMPORT (INTER) ──
  const dz = document.getElementById('dropZone');
  const bankFileInput = document.getElementById('bankFile');

  dz.addEventListener('click', () => bankFileInput.click());
  bankFileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('over');
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  });

  document.getElementById('btnConfirmImport').addEventListener('click', confirmImport);
  document.getElementById('btnCancelImport').addEventListener('click', () => {
    importQueue = []; document.getElementById('importPreview').hidden = true; bankFileInput.value = '';
  });

  // ── BACKUP ──
  document.getElementById('btnExportJSON').addEventListener('click', exportJSON);
  document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
  document.getElementById('btnImportTrigger').addEventListener('click', () => document.getElementById('importJSONFile').click());
  document.getElementById('importJSONFile').addEventListener('change', e => { if (e.target.files[0]) importJSON(e.target.files[0]); });
  document.getElementById('btnResetAll').addEventListener('click', () => {
    if (confirm('Apagar TODOS os dados?')) { S = buildInitialState(); save(); navigate('dashboard'); }
  });

  // ── BOOT ──
  navigate('dashboard');
});
