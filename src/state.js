export const DEF_CATS = [
  {id:'c_alim',name:'Alimentação',  type:'expense',color:'#f97316',icon:'🍔'},
  {id:'c_mor', name:'Moradia',      type:'expense',color:'#3b82f6',icon:'🏠'},
  {id:'c_trsp',name:'Transporte',   type:'expense',color:'#06b6d4',icon:'🚗'},
  {id:'c_laz', name:'Lazer',        type:'expense',color:'#ec4899',icon:'🍿'},
  {id:'c_sau', name:'Saúde',        type:'expense',color:'#10b981',icon:'💊'},
  {id:'c_edu', name:'Educação',     type:'expense',color:'#8b5cf6',icon:'📚'},
  {id:'c_comp',name:'Compras',      type:'expense',color:'#eab308',icon:'🛍️'},
  {id:'c_fixa',name:'FIXA',         type:'expense',color:'#64748b',icon:'📌'},
  {id:'c_out', name:'Outros',       type:'expense',color:'#475569',icon:'⚙️'},
  {id:'c_sal', name:'Salário',      type:'income', color:'#10b981',icon:'💼'},
  {id:'c_inv', name:'Investimentos',type:'income', color:'#0ea5e9',icon:'📈'},
  {id:'c_free',name:'Freelance',    type:'income', color:'#a855f7',icon:'💻'},
  {id:'c_outr',name:'Outras Receitas',type:'income',color:'#14b8a6',icon:'💰'},
];

export function isoToday(off = 0) {
  const d = new Date(); d.setDate(d.getDate() + off);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function initState() {
  return {
    accounts:[],
    cards:[],
    categories: JSON.parse(JSON.stringify(DEF_CATS)),
    transactions:[],
    budgets:[],
    goals:[],
    recurring:[],
    savings:[],
    debts:[],
  };
}

export const SKEY = 'financeos_v4';
export let S = {};

let saveCallbacks = [];
export function registerSaveCallback(cb) {
  saveCallbacks.push(cb);
}

export function save() {
  localStorage.setItem(SKEY, JSON.stringify(S));
  saveCallbacks.forEach(cb => {
    try {
      cb(S);
    } catch (e) {
      console.error('Error running save callback:', e);
    }
  });
}

export function load() {
  try {
    const r = localStorage.getItem(SKEY);
    if (r) {
      S = JSON.parse(r);
      fixState();
    } else {
      S = initState();
      save();
    }
  } catch (e) {
    S = initState();
    save();
  }
}

export function fixState() {
  if (!S) S = initState();
  if (!Array.isArray(S.categories))   S.categories = JSON.parse(JSON.stringify(DEF_CATS));
  if (!Array.isArray(S.accounts))     S.accounts   = [];
  if (!Array.isArray(S.cards))        S.cards      = [];
  if (!Array.isArray(S.transactions)) S.transactions = [];
  if (!Array.isArray(S.budgets))      S.budgets    = [];
  if (!Array.isArray(S.goals))        S.goals      = [];
  if (!Array.isArray(S.recurring))    S.recurring  = [];
  if (!Array.isArray(S.savings))      S.savings    = [];
  if (!Array.isArray(S.debts))        S.debts      = [];
  if (!S.challenge52) S.challenge52 = { multiplier: 1, checkedWeeks: [] };
}

export function setS(newState) {
  S = newState;
  fixState();
  localStorage.setItem(SKEY, JSON.stringify(S));
}

export function uid() {
  return '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export function fmtD(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function getCat(id) {
  return S.categories.find(c => c.id === id) || { name: 'Outros', icon: '⚙️', color: '#64748b', type: 'expense' };
}

export function getPay(id) {
  const a = S.accounts.find(a => a.id === id);
  const c = S.cards.find(c => c.id === id);
  return a ? a.name : c ? c.name : '—';
}

export function q(sel) { return document.querySelector(sel); }
export function qa(sel) { return document.querySelectorAll(sel); }

export function openM(id) {
  const el = document.getElementById(id);
  if (el) {
    el.hidden = false;
    el.querySelector('form')?.reset();
  }
}

export function closeM(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

// Period global state
export let periodState = {
  currentMode: 'monthly', // 'weekly', 'monthly', 'yearly', 'all'
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(), // 0-indexed
  currentWeek: 0
};

export function getActiveWeekRange() {
  const totalDays = new Date(periodState.currentYear, periodState.currentMonth + 1, 0).getDate();
  const weekIndex = periodState.currentWeek !== undefined ? periodState.currentWeek : 0;
  const starts = [1, 8, 15, 22];
  const ends = [7, 14, 21, totalDays];
  
  const startDay = starts[weekIndex];
  const endDay = ends[weekIndex];
  
  const year = periodState.currentYear;
  const month = String(periodState.currentMonth + 1).padStart(2, '0');
  
  const startIso = `${year}-${month}-${String(startDay).padStart(2, '0')}`;
  const endIso = `${year}-${month}-${String(endDay).padStart(2, '0')}`;
  
  return { 
    startIso, 
    endIso, 
    label: `Semana ${weekIndex + 1} (${String(startDay).padStart(2, '0')} a ${String(endDay).padStart(2, '0')})` 
  };
}
