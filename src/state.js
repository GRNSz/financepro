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
  return d.toISOString().split('T')[0];
}

export function initState() {
  return {
    accounts:[
      {id:'ac1',name:'Banco Inter',  type:'Conta Corrente',balance:3450},
      {id:'ac2',name:'Carteira',     type:'Dinheiro',      balance:250},
    ],
    cards:[
      {id:'cd1',name:'Inter Black',limit:5000,close:5,due:12},
    ],
    categories: JSON.parse(JSON.stringify(DEF_CATS)),
    transactions:[
      {id:'t1',tipo:'Receita', desc:'Salário',       val:5500, catId:'c_sal', payId:'ac1',data:isoToday(0), status:'Recebido', inst:null,total:null},
      {id:'t2',tipo:'Despesa', desc:'Aluguel',        val:1500, catId:'c_mor', payId:'ac1',data:isoToday(-5),status:'Pago',     inst:null,total:null},
      {id:'t3',tipo:'Despesa', desc:'Supermercado',   val:300,  catId:'c_alim',payId:'cd1',data:isoToday(-4),status:'Pago',     inst:1,   total:3},
      {id:'t4',tipo:'Despesa', desc:'Gasolina',       val:180,  catId:'c_trsp',payId:'ac1',data:isoToday(-3),status:'Pago',     inst:null,total:null},
      {id:'t5',tipo:'Despesa', desc:'Netflix (fixo)', val:55.9, catId:'c_laz', payId:'cd1',data:isoToday(-1),status:'Pendente', inst:null,total:null},
    ],
    budgets:[
      {catId:'c_alim',lim:800},
      {catId:'c_laz', lim:200},
    ],
    goals:[
      {id:'g1',name:'Reserva de Emergência',tgt:15000,cur:4000,dl:'2027-06-01'},
      {id:'g2',name:'Viagem de Férias',      tgt:8000, cur:2500,dl:'2026-12-20'},
    ],
    recurring:[
      {id:'r1',desc:'Netflix',    tipo:'Despesa',val:55.9, catId:'c_laz', payId:'cd1',day:10,last:null},
      {id:'r2',desc:'Plano Saúde',tipo:'Despesa',val:350,  catId:'c_sau', payId:'ac1',day:5, last:null},
    ],
    savings:[
      {id:'s1',val:300,data:isoToday(0),desc:'Guardado em junho'},
    ],
    debts:[
      {id:'d1',nome:'Cartão Pai',total:1200,oferta:900,status:'Pendente',forma:'À Vista'},
    ],
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
}

export function setS(newState) {
  S = newState;
  fixState();
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
  currentMode: 'monthly', // 'monthly', 'yearly', 'all'
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() // 0-indexed
};
