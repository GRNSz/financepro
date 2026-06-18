import { S, setS, load, save, uid, fmt, fmtD, getCat, getPay, q, qa, openM, closeM, periodState, getActiveWeekRange, calendarState } from '../state.js';
import { currentUser } from '../firebase.js';

export function escapeHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let chMain = null;
let chCat = null;
export let activePage = 'dashboard';

export function setActivePage(page) {
  activePage = page;
}

const PAGE_TITLES = {
  dashboard:'Dashboard', calculadora:'Calculadora', lancamentos:'Lançamentos', dividas:'Dívidas',
  guardado:'Dinheiro Guardado', contas:'Contas & Cartões',
  metas:'Metas', config:'Configurações', notificacoes:'Central de Notificações', perfil:'Meu Perfil',
  calendario:'Calendário', tutoriais:'Tutoriais', suporte:'Suporte & Contato'
};

export function navigate(page) {
  // hide all pages
  qa('.page').forEach(p=>p.classList.remove('on'));
  // deactivate all nav btns
  qa('.nb,.bnb').forEach(b=>b.classList.remove('on'));

  const pg = document.getElementById('page-'+page);
  if(pg) pg.classList.add('on');

  qa('.nb[data-page="'+page+'"], .bnb[data-page="'+page+'"]').forEach(b=>b.classList.add('on'));

  q('#pageTitle').textContent = PAGE_TITLES[page]||page;
  activePage = page;

  // Close sidebar on mobile
  if(window.innerWidth<=768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }

  // Show/hide global periodBar based on current tab
  const periodPages = ['dashboard', 'lancamentos', 'guardado'];
  const pBar = q('#periodBar');
  if (pBar) {
    pBar.style.display = periodPages.includes(page) ? 'flex' : 'none';
  }

  renderPage(page);
}

// Bind globally for onclick handlers in index.html
window.navigate = navigate;

export function renderPage(p) {
  if(p==='dashboard')   renderDashboard();
  if(p==='calculadora') renderCalculadora();
  if(p==='lancamentos') renderLancamentos();
  if(p==='dividas')     renderDividas();
  if(p==='guardado')    renderGuardado();
  if(p==='contas')      renderContas();
  if(p==='metas')       renderMetas();
  if(p==='config')      renderConfig();
  if(p==='calendario')  renderCalendar();
  if(p==='perfil')      renderPerfil();
  if(p==='suporte')     renderSuporte();
}

export function updateUI() {
  renderPage(activePage);
  updatePeriodLabel();
}

// Bind globally
window.updateUI = updateUI;

export function updatePeriodLabel() {
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const lbl = q('#pLabel');
  if (!lbl) return;
  
  const pdfBtn = q('#btnExportPDF');
  const weekChanger = q('#weekChanger');
  
  if (periodState.currentMode === 'weekly') {
    const range = getActiveWeekRange();
    lbl.textContent = `${MESES[periodState.currentMonth]} de ${periodState.currentYear}`;
    if (weekChanger) {
      weekChanger.style.display = 'flex';
      const wLabel = q('#wLabel');
      if (wLabel) wLabel.textContent = range.label;
    }
    q('#pPrev').disabled = false;
    q('#pNext').disabled = false;
    if (pdfBtn) {
      pdfBtn.textContent = '📄 PDF Semanal';
      pdfBtn.title = 'Gerar Relatório PDF da Semana';
    }
  } else {
    if (weekChanger) {
      weekChanger.style.display = 'none';
    }
    if (periodState.currentMode === 'monthly') {
      lbl.textContent = `${MESES[periodState.currentMonth]} de ${periodState.currentYear}`;
      q('#pPrev').disabled = false;
      q('#pNext').disabled = false;
      if (pdfBtn) {
        pdfBtn.textContent = '📄 PDF Mensal';
        pdfBtn.title = 'Gerar Relatório PDF do Mês';
      }
    } else if (periodState.currentMode === 'yearly') {
      lbl.textContent = `${periodState.currentYear}`;
      q('#pPrev').disabled = false;
      q('#pNext').disabled = false;
      if (pdfBtn) {
        pdfBtn.textContent = '📄 PDF Anual';
        pdfBtn.title = 'Gerar Relatório PDF do Ano';
      }
    } else {
      lbl.textContent = 'Todo o Período';
      q('#pPrev').disabled = true;
      q('#pNext').disabled = true;
      if (pdfBtn) {
        pdfBtn.textContent = '📄 PDF Consolidado';
        pdfBtn.title = 'Gerar Relatório PDF de Todo o Período';
      }
    }
  }
}

export function renderDashboard() {
  let mRec=0, mDesp=0, mRecCnt=0, mDespCnt=0;
  
  let endIso = null;
  if (periodState.currentMode === 'weekly') {
    endIso = getActiveWeekRange().endIso;
  } else if (periodState.currentMode === 'monthly') {
    endIso = new Date(periodState.currentYear, periodState.currentMonth + 1, 0).toISOString().split('T')[0];
  } else if (periodState.currentMode === 'yearly') {
    endIso = `${periodState.currentYear}-12-31`;
  }

  if (Array.isArray(S.transactions)) {
    S.transactions.forEach(t=>{
      const d=new Date(t.data+'T00:00:00');
      let matches = false;
      if (periodState.currentMode === 'weekly') {
        const range = getActiveWeekRange();
        matches = t.data >= range.startIso && t.data <= range.endIso;
      } else if (periodState.currentMode === 'monthly') {
        matches = d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth;
      } else if (periodState.currentMode === 'yearly') {
        matches = d.getFullYear() === periodState.currentYear;
      } else {
        matches = true;
      }
      
      if (matches) {
        if(t.tipo==='Receita'){mRec+=t.val;mRecCnt++;}
        else{mDesp+=t.val;mDespCnt++;}
      }
    });
  }

  // Reconstruct historical account balance
  let totalBal = Array.isArray(S.accounts) ? S.accounts.reduce((s,a)=>s+a.balance,0) : 0;
  if (endIso && Array.isArray(S.transactions)) {
    let afterNet = 0;
    S.transactions.forEach(t => {
      if (t.data > endIso && t.status !== 'Pendente') {
        const acc = S.accounts.find(a => a.id === t.payId);
        if (acc) {
          afterNet += (t.tipo === 'Receita' ? t.val : -t.val);
        }
      }
    });
    totalBal -= afterNet;
  }

  // Calculate historical savings
  let totalGuard = 0;
  if (Array.isArray(S.savings)) {
    S.savings.forEach(sv => {
      if (!endIso || sv.data <= endIso) {
        totalGuard += sv.val;
      }
    });
  }

  let periodSub = 'este mês';
  if (periodState.currentMode === 'weekly') periodSub = 'esta semana';
  else if (periodState.currentMode === 'yearly') periodSub = 'este ano';
  else if (periodState.currentMode === 'all') periodSub = 'todo período';

  q('#k-saldo').textContent = fmt(totalBal);
  q('#k-saldo-sub').textContent = periodState.currentMode === 'all' ? 'Todas as contas' : 'Saldo ao fim do período';
  q('#k-rec').textContent = fmt(mRec);
  q('#k-rec-sub').textContent = `${mRecCnt} lançamentos (${periodSub})`;
  q('#k-desp').textContent = fmt(mDesp);
  q('#k-desp-sub').textContent = `${mDespCnt} lançamentos (${periodSub})`;
  q('#k-guard').textContent = fmt(totalGuard);

  renderMainChart();
  renderCatChart();
  renderDashPrevisto(mRec, mDesp, totalBal);
  renderDashSaude(mRec, mDesp);
  renderDashRecent();
  renderWeeklySummaries();
  checkUpcomingBills();
  renderDashBudgets();
  updateNotifications();
}

window.renderDashboard = renderDashboard;

export function renderDashSaude(rec, desp) {
  const el = q('#dash-saude');
  if (!el) return;
  
  if (rec === 0) {
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:12px 0">
        <span style="font-size:24px">📊</span>
        <div style="font-size:13px;font-weight:700">Sem receitas este mês</div>
        <p style="font-size:11.5px;color:var(--tx2)">Registre receitas para calcular sua saúde financeira.</p>
      </div>`;
    return;
  }
  
  // Helper to classify category
  const getCategoryType = (cat) => {
    const id = cat.id;
    const name = (cat.name || '').toLowerCase();
    const needsKeywords = ['moradia', 'aluguel', 'água', 'luz', 'internet', 'alimentação', 'mercado', 'transporte', 'combustível', 'saúde', 'farmácia', 'médico', 'educação', 'escola', 'faculdade', 'fixa', 'imposto', 'seguro'];
    const wantsKeywords = ['lazer', 'cinema', 'compras', 'shopping', 'restaurante', 'bar', 'viagem', 'férias', 'hobby', 'presente', 'vestuário', 'roupa', 'assinatura', 'streaming', 'jogo'];
    
    if (['c_alim', 'c_mor', 'c_trsp', 'c_sau', 'c_edu', 'c_fixa'].includes(id)) return 'need';
    if (['c_laz', 'c_comp', 'c_out'].includes(id)) return 'want';
    
    if (needsKeywords.some(kw => name.includes(kw))) return 'need';
    if (wantsKeywords.some(kw => name.includes(kw))) return 'want';
    
    return 'need';
  };

  // Compute essential vs style despesas
  let nSum = 0, wSum = 0;
  if (Array.isArray(S.transactions)) {
    S.transactions.forEach(t => {
      if (t.tipo !== 'Despesa') return;
      
      const d = new Date(t.data + 'T00:00:00');
      let matches = false;
      if (periodState.currentMode === 'weekly') {
        const range = getActiveWeekRange();
        matches = t.data >= range.startIso && t.data <= range.endIso;
      } else if (periodState.currentMode === 'monthly') {
        matches = d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth;
      } else if (periodState.currentMode === 'yearly') {
        matches = d.getFullYear() === periodState.currentYear;
      } else {
        matches = true;
      }
      
      if (matches) {
        const cat = getCat(t.catId);
        if (getCategoryType(cat) === 'need') {
          nSum += t.val;
        } else {
          wSum += t.val;
        }
      }
    });
  }

  // Calculate percentages
  const pctN = (nSum / rec) * 100;
  const pctW = (wSum / rec) * 100;
  const pctS = Math.max(0, 100 - pctN - pctW);
  const totalExpenses = nSum + wSum;

  let score = 'D';
  let scoreMsg = 'Desequilíbrio Financeiro';
  let scoreAdvice = 'Suas despesas essenciais ou estilo de vida estão consumindo quase toda a sua renda. Faça uma revisão detalhada do orçamento.';
  let scoreColor = 'var(--rd)';
  let scoreEmoji = '📉';

  if (totalExpenses > rec) {
    score = 'F';
    scoreMsg = 'Déficit Financeiro';
    scoreAdvice = 'Você está gastando mais do que ganha! Tente cortar imediatamente os Desejos e revisar despesas Fixas.';
    scoreColor = 'var(--rd)';
    scoreEmoji = '🚨';
  } else if (pctN <= 50 && pctW <= 30 && pctS >= 20) {
    score = 'A+';
    scoreMsg = 'Equilíbrio Ideal';
    scoreAdvice = 'Excelente! Suas finanças estão perfeitamente equilibradas dentro da regra 50/30/20. Continue investindo.';
    scoreColor = 'var(--gr)';
    scoreEmoji = '🚀';
  } else if (pctN <= 60 && pctW <= 35 && pctS >= 10) {
    score = 'B';
    scoreMsg = 'Bom Equilíbrio';
    scoreAdvice = 'Você consegue poupar, mas tente reduzir despesas supérfluas para alcançar a taxa de poupança ideal de 20%.';
    scoreColor = 'var(--ac)';
    scoreEmoji = '👍';
  } else if (pctN <= 70 && pctW <= 40 && pctS >= 5) {
    score = 'C';
    scoreMsg = 'Orçamento Apertado';
    scoreAdvice = 'Sua taxa de poupança está muito baixa. Monitore despesas variáveis de lazer para evitar entrar no vermelho.';
    scoreColor = 'var(--am)';
    scoreEmoji = '⚠️';
  }

  // Determine progress colors
  const colorN = pctN <= 50 ? 'var(--gr)' : pctN <= 60 ? 'var(--am)' : 'var(--rd)';
  const colorW = pctW <= 30 ? 'var(--gr)' : pctW <= 40 ? 'var(--am)' : 'var(--rd)';
  const colorS = pctS >= 20 ? 'var(--gr)' : pctS >= 10 ? 'var(--ac)' : 'var(--rd)';

  el.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:14px; padding:6px 0">
      
      <!-- Score Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--s3); padding:10px 14px; border-radius:10px; border:1px solid var(--bd2)">
        <div>
          <span style="font-size:11px; text-transform:uppercase; color:var(--tx2); font-weight:700; letter-spacing:0.5px">Nota Geral</span>
          <div style="font-size:14px; font-weight:750; color:var(--tx); margin-top:2px">${scoreMsg}</div>
        </div>
        <div style="font-size:24px; font-weight:900; color:${scoreColor}; background:rgba(255,255,255,0.04); padding:6px 12px; border-radius:8px; border:1px solid var(--bd2); line-height:1; min-width:55px; text-align:center;">
          ${score}
        </div>
      </div>

      <!-- Categories breakdown -->
      <div style="display:flex; flex-direction:column; gap:10px; font-size:12px;">
        <!-- Needs -->
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px">
            <span style="font-weight:600; color:var(--tx)">Necessidades (Essencial)</span>
            <span style="color:var(--tx2)">${pctN.toFixed(0)}% <span style="font-size:10px; opacity:0.6">/ 50%</span></span>
          </div>
          <div class="prog" style="height:6px; background:var(--s3); border-radius:3px; margin-bottom:0">
            <div class="prog-bar" style="width:${Math.min(100, pctN)}%; background:${colorN}"></div>
          </div>
        </div>

        <!-- Wants -->
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px">
            <span style="font-weight:600; color:var(--tx)">Desejos (Estilo de Vida)</span>
            <span style="color:var(--tx2)">${pctW.toFixed(0)}% <span style="font-size:10px; opacity:0.6">/ 30%</span></span>
          </div>
          <div class="prog" style="height:6px; background:var(--s3); border-radius:3px; margin-bottom:0">
            <div class="prog-bar" style="width:${Math.min(100, pctW)}%; background:${colorW}"></div>
          </div>
        </div>

        <!-- Savings -->
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px">
            <span style="font-weight:600; color:var(--tx)">Poupança (Investimentos)</span>
            <span style="color:var(--tx2)">${pctS.toFixed(0)}% <span style="font-size:10px; opacity:0.6">/ 20%</span></span>
          </div>
          <div class="prog" style="height:6px; background:var(--s3); border-radius:3px; margin-bottom:0">
            <div class="prog-bar" style="width:${Math.min(100, pctS)}%; background:${colorS}"></div>
          </div>
        </div>
      </div>

      <!-- Advice Box -->
      <div style="display:flex; gap:10px; align-items:flex-start; background:var(--s2); padding:10px 12px; border-radius:10px; border:1px solid var(--bd)">
        <span style="font-size:18px; line-height:1.2">${scoreEmoji}</span>
        <div style="min-width:0">
          <div style="font-size:12px; font-weight:700; color:var(--tx); margin-bottom:2px">Dica Recomendada</div>
          <div style="font-size:11.5px; color:var(--tx2); line-height:1.4">${scoreAdvice}</div>
        </div>
      </div>

    </div>`;
}

export function renderMainChart() {
  if(!window.Chart) {
    const canvas = q('#chMain');
    if(canvas) {
      canvas.style.display = 'none';
      let msg = canvas.parentElement.querySelector('.chart-offline-msg');
      if(!msg) {
        msg = document.createElement('div');
        msg.className = 'empty chart-offline-msg';
        msg.style.padding = '80px 20px';
        msg.textContent = 'Gráficos indisponíveis (sem conexão com a internet)';
        canvas.parentElement.appendChild(msg);
      }
    }
    return;
  }
  const MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const labels=[],rec=[],desp=[];

  if (periodState.currentMode === 'weekly') {
    const totalDays = new Date(periodState.currentYear, periodState.currentMonth + 1, 0).getDate();
    const weeksList = [
      { start: 1, end: 7, label: 'Sem 1' },
      { start: 8, end: 14, label: 'Sem 2' },
      { start: 15, end: 21, label: 'Sem 3' },
      { start: 22, end: totalDays, label: 'Sem 4' }
    ];
    weeksList.forEach(w => {
      labels.push(w.label);
      let r = 0, e = 0;
      if (Array.isArray(S.transactions)) {
        S.transactions.forEach(t => {
          const td = new Date(t.data + 'T00:00:00');
          if (td.getFullYear() === periodState.currentYear && td.getMonth() === periodState.currentMonth) {
            const day = td.getDate();
            if (day >= w.start && day <= w.end) {
              if (t.tipo === 'Receita') r += t.val; else e += t.val;
            }
          }
        });
      }
      rec.push(r); desp.push(e);
    });
  } else if (periodState.currentMode === 'monthly') {
    for(let i=5;i>=0;i--){
      const d=new Date(periodState.currentYear, periodState.currentMonth-i, 1);
      labels.push(MESES[d.getMonth()]);
      let r=0,e=0;
      if (Array.isArray(S.transactions)) {
        S.transactions.forEach(t=>{
          const td=new Date(t.data+'T00:00:00');
          if(td.getFullYear()===d.getFullYear()&&td.getMonth()===d.getMonth()){
            if(t.tipo==='Receita')r+=t.val; else e+=t.val;
          }
        });
      }
      rec.push(r); desp.push(e);
    }
  } else if (periodState.currentMode === 'yearly') {
    for(let m=0;m<12;m++){
      labels.push(MESES[m]);
      let r=0,e=0;
      if (Array.isArray(S.transactions)) {
        S.transactions.forEach(t=>{
          const td=new Date(t.data+'T00:00:00');
          if(td.getFullYear()===periodState.currentYear&&td.getMonth()===m){
            if(t.tipo==='Receita')r+=t.val; else e+=t.val;
          }
        });
      }
      rec.push(r); desp.push(e);
    }
  } else {
    for(let i=11;i>=0;i--){
      const d=new Date(periodState.currentYear, periodState.currentMonth-i, 1);
      labels.push(MESES[d.getMonth()]);
      let r=0,e=0;
      if (Array.isArray(S.transactions)) {
        S.transactions.forEach(t=>{
          const td=new Date(t.data+'T00:00:00');
          if(td.getFullYear()===d.getFullYear()&&td.getMonth()===d.getMonth()){
            if(t.tipo==='Receita')r+=t.val; else e+=t.val;
          }
        });
      }
      rec.push(r); desp.push(e);
    }
  }

  const isLight = document.body.classList.contains('light');
  const tickColor = isLight ? '#475569' : '#7c849c';
  const gridColor = isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.04)';

  const ctx=q('#chMain').getContext('2d');
  if(chMain){chMain.destroy();}
  chMain=new window.Chart(ctx,{
    type:'bar',
    data:{labels,datasets:[
      {label:'Receitas', data:rec, backgroundColor:'rgba(16,185,129,.7)',  borderRadius:5,borderSkipped:false},
      {label:'Despesas', data:desp,backgroundColor:'rgba(244,63,94,.7)',   borderRadius:5,borderSkipped:false},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:tickColor,font:{size:11},boxWidth:10}}},
      scales:{
        x:{grid:{display:false},ticks:{color:tickColor,font:{size:11}}},
        y:{grid:{color:gridColor},ticks:{color:tickColor,font:{size:11}}},
      }
    }
  });
}

export function renderCatChart(){
  if(!window.Chart){
    const canvas = q('#chCat');
    if(canvas){
      canvas.style.display = 'none';
      let msg = canvas.parentElement.querySelector('.chart-offline-msg');
      if(!msg){
        msg = document.createElement('div');
        msg.className = 'empty chart-offline-msg';
        msg.style.padding = '80px 20px';
        msg.textContent = 'Gráficos indisponíveis (sem conexão com a internet)';
        canvas.parentElement.appendChild(msg);
      }
    }
    return;
  }
  const map={};
  if (Array.isArray(S.transactions)) {
    S.transactions.forEach(t=>{
      if(t.tipo!=='Despesa')return;
      const d=new Date(t.data+'T00:00:00');
      let matches = false;
      if (periodState.currentMode === 'monthly') {
        matches = d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth;
      } else if (periodState.currentMode === 'yearly') {
        matches = d.getFullYear() === periodState.currentYear;
      } else {
        matches = true;
      }
      if(matches)
        map[t.catId]=(map[t.catId]||0)+t.val;
    });
  }
  const labels=[],data=[],colors=[];
  Object.entries(map).forEach(([id,v])=>{
    const c=getCat(id); labels.push(c.name); data.push(v); colors.push(c.color);
  });
  const isLight = document.body.classList.contains('light');
  const tickColor = isLight ? '#475569' : '#7c849c';

  const ctx=q('#chCat').getContext('2d');
  if(chCat){chCat.destroy();}
  if(!data.length){
    chCat=new window.Chart(ctx,{type:'doughnut',data:{labels:['Sem dados'],datasets:[{data:[1],backgroundColor:['rgba(255,255,255,.06)'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'70%'}});
    return;
  }
  chCat=new window.Chart(ctx,{
    type:'doughnut',
    data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',
      plugins:{legend:{position:'right',labels:{color:tickColor,font:{size:11},boxWidth:10,padding:12}}}
    }
  });
}

export function renderDashPrevisto(mRec, mDesp, totalBal){
  let startIso = null;
  let endIso = null;
  if (periodState.currentMode === 'weekly') {
    const range = getActiveWeekRange();
    startIso = range.startIso;
    endIso = range.endIso;
  } else if (periodState.currentMode === 'monthly') {
    startIso = `${periodState.currentYear}-${String(periodState.currentMonth + 1).padStart(2, '0')}-01`;
    endIso = `${periodState.currentYear}-${String(periodState.currentMonth + 1).padStart(2, '0')}-${new Date(periodState.currentYear, periodState.currentMonth + 1, 0).getDate()}`;
  } else if (periodState.currentMode === 'yearly') {
    startIso = `${periodState.currentYear}-01-01`;
    endIso = `${periodState.currentYear}-12-31`;
  }

  // 1. Saldo Inicial
  let saldoInicial = Array.isArray(S.accounts) ? S.accounts.reduce((s, a) => s + a.balance, 0) : 0;
  if (startIso && Array.isArray(S.transactions)) {
    let afterStartNet = 0;
    S.transactions.forEach(t => {
      if (t.data >= startIso && t.status !== 'Pendente') {
        const acc = S.accounts.find(a => a.id === t.payId);
        if (acc) {
          afterStartNet += (t.tipo === 'Receita' ? t.val : -t.val);
        }
      }
    });
    saldoInicial -= afterStartNet;
  } else if (Array.isArray(S.transactions)) {
    let allNet = 0;
    S.transactions.forEach(t => {
      if (t.status !== 'Pendente') {
        const acc = S.accounts.find(a => a.id === t.payId);
        if (acc) {
          allNet += (t.tipo === 'Receita' ? t.val : -t.val);
        }
      }
    });
    saldoInicial -= allNet;
  }

  // 2. Receitas e Despesas do Período (Recebidas + Pendentes)
  let recPeriodo = 0;
  let despPeriodo = 0;
  if (Array.isArray(S.transactions)) {
    S.transactions.forEach(t => {
      const d = new Date(t.data + 'T00:00:00');
      let matches = false;
      if (periodState.currentMode === 'weekly') {
        const range = getActiveWeekRange();
        matches = t.data >= range.startIso && t.data <= range.endIso;
      } else if (periodState.currentMode === 'monthly') {
        matches = d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth;
      } else if (periodState.currentMode === 'yearly') {
        matches = d.getFullYear() === periodState.currentYear;
      } else {
        matches = true;
      }
      
      if (matches) {
        if (t.tipo === 'Receita') {
          recPeriodo += t.val;
        } else {
          despPeriodo += t.val;
        }
      }
    });
  }

  const saldoPrev = saldoInicial + recPeriodo - despPeriodo;

  const el = q('#dash-previsto');
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bd)">
        <span style="font-size:12.5px;color:var(--tx2)">Saldo Inicial do Período</span>
        <span style="font-weight:700;font-size:14px">${fmt(saldoInicial)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bd)">
        <span style="font-size:12.5px;color:var(--tx2)">Receitas do Período</span>
        <span style="font-weight:700;font-size:14px;color:var(--gr)">+${fmt(recPeriodo)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--bd)">
        <span style="font-size:12.5px;color:var(--tx2)">Despesas do Período</span>
        <span style="font-weight:700;font-size:14px;color:var(--rd)">-${fmt(despPeriodo)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0">
        <span style="font-size:12.5px;font-weight:700">Saldo Final Previsto</span>
        <span style="font-weight:800;font-size:16px;color:${saldoPrev >= 0 ? 'var(--gr)' : 'var(--rd)'}">${fmt(saldoPrev)}</span>
      </div>
    </div>`;
}

export function renderDashRecent(){
  const recent = Array.isArray(S.transactions) ? [...S.transactions].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,6) : [];
  const el=q('#dash-recent');
  if(!recent.length){el.innerHTML='<p class="empty">Sem lançamentos.</p>';return;}
  el.innerHTML='<table class="tx-tbl"><tbody>'+recent.map(t=>{
    const c=getCat(t.catId);
    return`<tr>
      <td style="width:38px"><div style="width:34px;height:34px;border-radius:8px;background:${c.color}1a;color:${c.color};display:flex;align-items:center;justify-content:center;font-size:16px">${c.icon}</div></td>
      <td><div style="font-size:12.5px;font-weight:600">${t.desc}</div><div style="font-size:11px;color:var(--tx2)">${fmtD(t.data)}</div></td>
      <td style="text-align:right"><span class="${t.tipo==='Receita'?'amt-in':'amt-ex'}">${t.tipo==='Receita'?'+':'−'} ${fmt(t.val)}</span></td>
    </tr>`;
  }).join('')+'</tbody></table>';
}

export function renderWeeklySummaries() {
  const el = q('#dash-weekly-list');
  if (!el) return;

  const totalDays = new Date(periodState.currentYear, periodState.currentMonth + 1, 0).getDate();
  const weeks = [
    { start: 1, end: 7, label: 'Semana 1 (01 a 07)' },
    { start: 8, end: 14, label: 'Semana 2 (08 a 14)' },
    { start: 15, end: 21, label: 'Semana 3 (15 a 21)' },
    { start: 22, end: totalDays, label: `Semana 4 (22 a ${totalDays})` }
  ];

  const weekExpenses = weeks.map(w => {
    let sum = 0;
    let count = 0;
    if (Array.isArray(S.transactions)) {
      S.transactions.forEach(t => {
        const d = new Date(t.data + 'T00:00:00');
        if (d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth && t.tipo === 'Despesa') {
          const day = d.getDate();
          if (day >= w.start && day <= w.end) {
            sum += t.val;
            count++;
          }
        }
      });
    }
    return { ...w, sum, count };
  });

  el.innerHTML = weekExpenses.map((w, idx) => {
    return `
      <div style="background:var(--s2); border:1px solid var(--bd); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px; transition:border-color 0.2s;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-size:13.5px; font-weight:700; letter-spacing:-0.2px;">${w.label}</h4>
          <span style="font-size:10px; font-weight:750; background:rgba(239,68,68,0.15); color:var(--rd); padding:2px 6px; border-radius:4px; text-transform:uppercase;">Despesa</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:4px;">
          <span style="font-size:18px; font-weight:800; color:var(--rd);">${fmt(w.sum)}</span>
          <span style="font-size:11px; color:var(--tx2);">${w.count} lançamento(s)</span>
        </div>
        <button class="bs sm" style="width:100%; margin-top:4px; padding:8px;" onclick="exportWeeklyPDF(${idx})" title="Gerar PDF da ${w.label}">📄 PDF Semanal</button>
      </div>
    `;
  }).join('');
}

export function checkUpcomingBills() {
  const alertsEl = q('#dash-bill-alerts');
  if (!alertsEl) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);
  threeDaysFromNow.setHours(23,59,59,999);

  const bills = Array.isArray(S.transactions) ? S.transactions.filter(t => {
    if (t.tipo !== 'Despesa' || t.status !== 'Pendente') return false;
    const d = new Date(t.data + 'T00:00:00');
    return d <= threeDaysFromNow;
  }) : [];

  if (bills.length === 0) {
    alertsEl.style.display = 'none';
    alertsEl.innerHTML = '';
    return;
  }

  let overdueCount = 0;
  let upcomingCount = 0;
  let totalAmount = 0;

  bills.forEach(t => {
    const d = new Date(t.data + 'T00:00:00');
    if (d < today) {
      overdueCount++;
    } else {
      upcomingCount++;
    }
    totalAmount += t.val;
  });

  let message = '';
  if (overdueCount > 0 && upcomingCount > 0) {
    message = `Você tem <strong>${overdueCount}</strong> despesa(s) atrasada(s) e <strong>${upcomingCount}</strong> a vencer nos próximos 3 dias, totalizando <strong>${fmt(totalAmount)}</strong>.`;
  } else if (overdueCount > 0) {
    message = `Você tem <strong>${overdueCount}</strong> despesa(s) atrasada(s), totalizando <strong>${fmt(totalAmount)}</strong>!`;
  } else {
    message = `Você tem <strong>${upcomingCount}</strong> despesa(s) vencendo nos próximos 3 dias, totalizando <strong>${fmt(totalAmount)}</strong>.`;
  }

  alertsEl.innerHTML = `
    <div style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.25); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text); flex-wrap: wrap; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">⚠️</span>
        <span style="font-size: 13.5px;">${message}</span>
      </div>
      <button class="bp sm" onclick="filterPendingExpenses()" style="font-size: 12px; padding: 6px 12px;">Visualizar Contas</button>
    </div>
  `;
  alertsEl.style.display = 'block';
}

window.filterPendingExpenses = function() {
  navigate('lancamentos');
  const fStatusEl = q('#fStatus');
  if (fStatusEl) fStatusEl.value = 'Pendente';
  const fTipoEl = q('#fTipo');
  if (fTipoEl) fTipoEl.value = 'Despesa';
  const fSearchEl = q('#fSearch');
  if (fSearchEl) fSearchEl.value = '';
  const fCatEl = q('#fCat');
  if (fCatEl) fCatEl.value = '';
  applyFilters();
};

export function renderDashBudgets(){
  const now=new Date(), cy=now.getFullYear(), cm=now.getMonth();
  const spent={};
  if (Array.isArray(S.transactions)) {
    S.transactions.forEach(t=>{
      if(t.tipo!=='Despesa')return;
      const d=new Date(t.data+'T00:00:00');
      if(d.getFullYear()===cy&&d.getMonth()===cm) spent[t.catId]=(spent[t.catId]||0)+t.val;
    });
  }
  const el=q('#dash-budgets');
  if(!el) return;
  const alerts=Array.isArray(S.budgets) ? S.budgets.filter(b=>(spent[b.catId]||0)/b.lim>=0.7) : [];
  if(!alerts.length){el.innerHTML='<p class="empty-msg">Nenhum orçamento em alerta. 🎉</p>';return;}
  el.innerHTML=alerts.map(b=>{
    const c=getCat(b.catId); const s=spent[b.catId]||0;
    const pct=Math.min(100,Math.round(s/b.lim*100));
    const cls=pct>=100?'over':pct>=80?'warn':'ok';
    const clrVar=cls==='over'?'var(--rd)':cls==='warn'?'var(--am)':'var(--gr)';
    return`<div class="li bud-item">
      <div class="bud-hd">
        <div class="li-l"><span class="li-ico">${c.icon}</span><span class="li-name">${c.name}</span></div>
        <span style="font-size:12px;font-weight:700;color:${clrVar}">${pct}%</span>
      </div>
      <div class="bud-bg"><div class="bud-bar ${cls}" style="width:${pct}%"></div></div>
      <div class="bud-meta"><span>${fmt(s)} gastos</span><span>de ${fmt(b.lim)}</span></div>
    </div>`;
  }).join('');
}

// ── LANÇAMENTOS ────────────────────────────────────────────────────
export function renderLancamentos(){
  fillCatSelect(q('#fCat'), '');
  applyFilters();
}

window.renderLancamentos = renderLancamentos;

export function fillCatSelect(el, filterType){
  if(!el)return;
  const opts = filterType
    ? S.categories.filter(c=>c.type===(filterType==='Receita'?'income':'expense'))
    : S.categories;
  el.innerHTML='<option value="">Todas</option>'+opts.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

window.fillCatSelect = fillCatSelect;

export function fillPaySelect(el){
  if(!el)return;
  el.innerHTML=
    '<optgroup label="Contas">'+S.accounts.map(a=>`<option value="${a.id}">${a.type==='Investimentos'?'📈':'🏦'} ${a.name}</option>`).join('')+'</optgroup>'+
    (S.cards.length?'<optgroup label="Cartões">'+S.cards.map(c=>`<option value="${c.id}">💳 ${c.name}</option>`).join('')+'</optgroup>':'');
}

window.fillPaySelect = fillPaySelect;

export function applyFilters(){
  const srch  = (q('#fSearch')||{value:''}).value.toLowerCase();
  const tipo  = (q('#fTipo')||{value:''}).value;
  const catId = (q('#fCat')||{value:''}).value;
  const stat  = (q('#fStatus')||{value:''}).value;

  const list = (S.transactions || []).filter(t=>{
    if (srch) {
      if (srch.startsWith('#')) {
        const tagQuery = srch.trim();
        if (!t.tags || !t.tags.some(tag => tag.toLowerCase().includes(tagQuery))) {
          return false;
        }
      } else {
        if (!t.desc.toLowerCase().includes(srch)) return false;
      }
    }
    if(tipo && t.tipo!==tipo) return false;
    if(catId && t.catId!==catId) return false;
    if(stat && t.status!==stat) return false;
    
    // Apply global period filter
    const d=new Date(t.data+'T00:00:00');
    if (periodState.currentMode === 'weekly') {
      const range = getActiveWeekRange();
      if (t.data < range.startIso || t.data > range.endIso) return false;
    } else if (periodState.currentMode === 'monthly') {
      if (d.getFullYear() !== periodState.currentYear || d.getMonth() !== periodState.currentMonth) return false;
    } else if (periodState.currentMode === 'yearly') {
      if (d.getFullYear() !== periodState.currentYear) return false;
    }
    return true;
  }).sort((a,b)=>b.data.localeCompare(a.data));

  const tb=q('#txTbody');
  if(!tb)return;
  q('#txTitle').textContent=list.length+' Lançamento(s)';
  if(!list.length){tb.innerHTML='<tr><td colspan="7" class="empty">Nenhum lançamento encontrado.</td></tr>';return;}
  tb.innerHTML=list.map(t=>{
    const c=getCat(t.catId);
    const pn=getPay(t.payId);
    const inlbl=t.inst?` <span style="opacity:.6;font-size:10.5px">(${t.inst}/${t.total})</span>`:'';
    const sCls=t.status==='Pago'?'s-pago':t.status==='Recebido'?'s-recebido':'s-pendente';
    
    const taglbl = (t.tags && t.tags.length) ? `<div style="margin-top: 4px; display:flex; gap: 4px; flex-wrap: wrap;">${t.tags.map(tag => { const escapedTag = escapeHtml(tag); return `<span class="tag-pill" style="font-size:10px; background:var(--s3); color:var(--tx2); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--bd2); cursor:pointer;" onclick="event.stopPropagation(); window.filterByTag('${escapedTag}')">${escapedTag}</span>`; }).join('')}</div>` : '';
    
    let origText = '';
    if (t.currency && t.currency !== 'BRL' && t.origVal) {
      const curSymbol = t.currency === 'USD' ? '$' : t.currency === 'EUR' ? '€' : '';
      origText = `<br><span style="font-size:9.5px;color:var(--tx2)" title="Taxa de câmbio: 1 ${t.currency} = ${fmt(t.rate)}">${curSymbol} ${t.origVal.toFixed(2)} (${t.currency})</span>`;
    }

    return`<tr>
      <td style="white-space:nowrap;font-size:12px">${fmtD(t.data)}</td>
      <td><span style="font-weight:600">${escapeHtml(t.desc)}</span>${inlbl}${taglbl}<br><span style="font-size:11px;color:var(--tx2)">${pn}</span></td>
      <td><span class="cat-pill" style="background:${c.color}1a;color:${c.color}">${c.icon} ${c.name}</span></td>
      <td><span style="font-size:11.5px;font-weight:600;color:${t.tipo==='Receita'?'var(--gr)':'var(--tx2)'}">${t.tipo}</span></td>
      <td class="${t.tipo==='Receita'?'amt-in':'amt-ex'}" style="white-space:nowrap">${t.tipo==='Receita'?'+':'−'} ${fmt(t.val)}${origText}</td>
      <td><span class="status-pill ${sCls}" onclick="toggleTxStatus('${t.id}')" title="Clique para alternar status">${t.status}</span></td>
      <td style="white-space:nowrap">
        <button class="bedit" onclick="editTx('${t.id}')" title="Editar">✏️</button>
        <button class="bdel" onclick="delTx('${t.id}')" title="Excluir">✕</button>
        <button class="bs sm" style="padding: 5px 7px; font-size: 11px; margin-left: 2px; border-radius: 6px; min-width: auto; height: 28px;" onclick="cloneTxToNextMonth('${t.id}')" title="Clonar para o próximo mês">🔄</button>
      </td>
    </tr>`;
  }).join('');
  renderInstallmentTracker();
}

window.filterByTag = function(tag) {
  const fSearch = q('#fSearch');
  if (fSearch) {
    fSearch.value = tag;
    applyFilters();
  }
};

window.applyFilters = applyFilters;

window.cloneTxToNextMonth = function(id) {
  const t = S.transactions.find(x => x.id === id);
  if (!t) return;
  
  const d = new Date(t.data + 'T00:00:00');
  d.setMonth(d.getMonth() + 1);
  const nextMonthIso = d.toISOString().split('T')[0];
  
  const cloned = {
    id: uid(),
    tipo: t.tipo,
    desc: t.desc,
    val: t.val,
    origVal: t.origVal || null,
    currency: t.currency || 'BRL',
    rate: t.rate || 1,
    tags: t.tags ? [...t.tags] : [],
    catId: t.catId,
    payId: t.payId,
    data: nextMonthIso,
    status: 'Pendente',
    inst: null,
    total: null
  };
  
  S.transactions.unshift(cloned);
  save();
  alert(`Lançamento "${t.desc}" clonado para o próximo mês (${fmtD(nextMonthIso)}) como Pendente!`);
  if (activePage === 'lancamentos') applyFilters();
  renderDashboard();
};

window.toggleTxStatus = function(id){
  const t = S.transactions.find(x => x.id === id);
  if (!t) return;
  const isPaid = t.status === 'Pago' || t.status === 'Recebido';
  const newStatus = t.tipo === 'Receita' ? (isPaid ? 'Pendente' : 'Recebido') : (isPaid ? 'Pendente' : 'Pago');
  
  // Update bank account balance based on status toggle
  const acc = S.accounts.find(a => a.id === t.payId);
  if (acc) {
    const change = t.tipo === 'Receita' ? t.val : -t.val;
    if (newStatus === 'Pendente') {
      acc.balance -= change; // revert payment
    } else {
      acc.balance += change; // complete payment
    }
  }
  t.status = newStatus;
  save();
  if (activePage === 'lancamentos') applyFilters();
  renderDashboard();
};

window.editTx = function(id){
  const t = S.transactions.find(x => x.id === id);
  if (!t) return;
  q('#tx-id').value = id;
  q('#tx-tipo').value = t.tipo;
  const currency = t.currency || 'BRL';
  q('#tx-moeda').value = currency;
  q('#tx-taxa').value = t.rate || 1;
  q('#tx-taxa-wrap').style.display = currency !== 'BRL' ? 'block' : 'none';
  q('#tx-val').value = currency !== 'BRL' ? (t.origVal || t.val) : t.val;
  q('#tx-tags').value = (t.tags || []).join(' ');
  q('#tx-desc').value = t.desc;
  
  fillCatSelect(q('#tx-cat'), t.tipo);
  q('#tx-cat').value = t.catId;
  
  fillPaySelect(q('#tx-conta'));
  q('#tx-conta').value = t.payId;
  
  q('#tx-data').value = t.data;
  q('#tx-status').value = t.status;
  
  const hasInst = t.inst !== null && t.inst !== undefined;
  q('#tx-is-installment').checked = hasInst;
  q('#tx-inst-wrap').style.display = hasInst ? 'block' : 'none';
  q('#tx-inst').value = hasInst ? t.total : '1';
  
  q('#tx-modal-title').textContent = "Editar Lançamento";
  
  // Hide keep-open and recurrence options on edit mode
  const keepOpenWrap = q('#tx-keep-open-wrap');
  if (keepOpenWrap) {
    keepOpenWrap.style.display = 'none';
    q('#tx-keep-open').checked = false;
  }

  const recIs = q('#tx-is-recurring');
  if (recIs) {
    recIs.checked = false;
    const parentRow = recIs.closest('.fr');
    if (parentRow) parentRow.style.display = 'none';
  }
  const recWrap = q('#tx-rec-wrap');
  if (recWrap) recWrap.style.display = 'none';
  
  openM('m-tx');
  // Trigger preview update
  if (window.updateTxLivePreview) window.updateTxLivePreview();
};

window.delTx=function(id){
  if(confirm('Excluir este lançamento?')){
    const t = S.transactions.find(x => x.id === id);
    if (t && t.status !== 'Pendente') {
      const acc = S.accounts.find(a => a.id === t.payId);
      if (acc) {
        acc.balance -= (t.tipo === 'Receita' ? t.val : -t.val);
      }
    }
    S.transactions=S.transactions.filter(t=>t.id!==id);
    save(); applyFilters(); renderDashboard();
  }
};

// ── DÍVIDAS ───────────────────────────────────────────────────────
export function renderDividas(){
  const totalVal    = Array.isArray(S.debts) ? S.debts.reduce((s,d)=>s+d.total,0) : 0;
  const totalOferta = Array.isArray(S.debts) ? S.debts.reduce((s,d)=>s+(d.oferta||0),0) : 0;
  const totalDesc   = totalVal-totalOferta;
  const pend        = Array.isArray(S.debts) ? S.debts.filter(d=>d.status!=='Pago').length : 0;

  q('#dk-total').textContent   = fmt(totalVal);
  q('#dk-oferta').textContent  = fmt(totalOferta);
  q('#dk-desconto').textContent= fmt(Math.max(0,totalDesc));
  q('#dk-pend').textContent    = pend;

  const tb=q('#debtTbody');
  if(!tb) return;
  if(!S.debts.length){tb.innerHTML='<tr><td colspan="8" class="empty">Nenhuma dívida cadastrada.</td></tr>';return;}
  tb.innerHTML=S.debts.map(d=>{
    const oferta = d.oferta||0;
    const descPct= d.total>0?((d.total-oferta)/d.total*100).toFixed(1):0;
    const descVal= d.total-oferta;
    const sCls=d.status==='Pago'?'s-pago':d.status==='Negociando'?'s-pendente':'s-pendente';
    return`<tr>
      <td style="font-weight:600">${d.nome}</td>
      <td style="color:var(--rd);font-weight:700">${fmt(d.total)}</td>
      <td style="color:var(--gr);font-weight:700">${oferta?fmt(oferta):'—'}</td>
      <td><span class="status-pill ${sCls}" onclick="toggleDebtStatus('${d.id}')" title="Clique para alternar status">${d.status}</span></td>
      <td style="font-size:12px;color:var(--tx2)">${d.forma}</td>
      <td style="font-weight:600">${oferta?fmt(descVal):'—'}</td>
      <td style="font-weight:600">${oferta?descPct+'%':'—'}</td>
      <td style="white-space:nowrap">
        <button class="bedit" onclick="editDebt('${d.id}')">✏️</button>
        <button class="bdel" onclick="delDebt('${d.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

window.renderDividas = renderDividas;

window.toggleDebtStatus = function(id){
  const d = S.debts.find(x => x.id === id);
  if (!d) return;
  const cycle = { 'Pendente': 'Negociando', 'Negociando': 'Pago', 'Pago': 'Pendente' };
  d.status = cycle[d.status] || 'Pendente';
  save();
  if (activePage === 'dividas') renderDividas();
  renderDashboard();
};

window.editDebt = function(id){
  const d = S.debts.find(x => x.id === id);
  if (!d) return;
  q('#debt-id').value = id;
  q('#dbt-nome').value = d.nome;
  q('#dbt-total').value = d.total;
  q('#dbt-oferta').value = d.oferta || '';
  q('#dbt-status').value = d.status;
  q('#dbt-forma').value = d.forma;
  q('#debt-modal-title').textContent = "Editar Dívida";
  openM('m-debt');
};

window.delDebt=function(id){
  if(confirm('Excluir esta dívida?')){ S.debts=S.debts.filter(d=>d.id!==id); save(); renderDividas(); renderDashboard(); }
};

// ── DINHEIRO GUARDADO ─────────────────────────────────────────────
export function renderGuardado(){
  let endIso = null;
  if (periodState.currentMode === 'weekly') {
    endIso = getActiveWeekRange().endIso;
  } else if (periodState.currentMode === 'monthly') {
    endIso = new Date(periodState.currentYear, periodState.currentMonth + 1, 0).toISOString().split('T')[0];
  } else if (periodState.currentMode === 'yearly') {
    endIso = `${periodState.currentYear}-12-31`;
  }

  const total = Array.isArray(S.savings) ? S.savings.filter(sv => !endIso || sv.data <= endIso).reduce((s,sv)=>s+sv.val,0) : 0;
  q('#sv-total').textContent=fmt(total);
  
  const tb=q('#savingsTbody');
  if(!tb) return;
  const list = Array.isArray(S.savings) ? S.savings.filter(sv => {
    const d = new Date(sv.data + 'T00:00:00');
    if (periodState.currentMode === 'weekly') {
      const range = getActiveWeekRange();
      return sv.data >= range.startIso && sv.data <= range.endIso;
    } else if (periodState.currentMode === 'monthly') {
      return d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth;
    } else if (periodState.currentMode === 'yearly') {
      return d.getFullYear() === periodState.currentYear;
    }
    return true;
  }).sort((a,b)=>b.data.localeCompare(a.data)) : [];
  
  if(!list.length){tb.innerHTML='<tr><td colspan="4" class="empty">Nenhum registro encontrado para este período.</td></tr>';return;}
  tb.innerHTML=list.map(sv=>`<tr>
    <td style="font-size:12.5px">${fmtD(sv.data)}</td>
    <td style="color:var(--pu);font-weight:700">${fmt(sv.val)}</td>
    <td style="font-size:12px;color:var(--tx2)">${sv.desc||'—'}</td>
    <td><button class="bdel" onclick="delSaving('${sv.id}')">✕</button></td>
  </tr>`).join('');
}

window.renderGuardado = renderGuardado;

window.delSaving=function(id){
  if(confirm('Excluir este registro?')){ S.savings=S.savings.filter(s=>s.id!==id); save(); renderGuardado(); renderDashboard(); }
};

window.runSimulation = function() {
  const initVal = parseFloat(q('#sim-init')?.value) || 0;
  const monthlyVal = parseFloat(q('#sim-monthly')?.value) || 0;
  let timeVal = parseInt(q('#sim-time')?.value) || 0;
  const timeType = q('#sim-time-type')?.value;
  if (timeType === 'y') timeVal = timeVal * 12;

  const type = q('#sim-type')?.value;
  let annualRate = 0;
  if (type === 'cdi100') annualRate = 10.5;
  else if (type === 'cdi110') annualRate = 11.55;
  else if (type === 'selic') annualRate = 10.75;
  else if (type === 'poupanca') annualRate = 6.17;
  else if (type === 'custom') annualRate = parseFloat(q('#sim-rate-custom')?.value) || 0;

  const r = Math.pow(1 + annualRate / 100, 1/12) - 1;
  let fv = 0;
  if (r === 0) {
    fv = initVal + monthlyVal * timeVal;
  } else {
    fv = initVal * Math.pow(1 + r, timeVal) + monthlyVal * ((Math.pow(1 + r, timeVal) - 1) / r);
  }

  const totalInvested = initVal + monthlyVal * timeVal;
  const totalGained = Math.max(0, fv - totalInvested);

  const resTotal = q('#sim-res-total');
  const resInvested = q('#sim-res-invested');
  const resGained = q('#sim-res-gained');

  if (resTotal) resTotal.textContent = fmt(fv);
  if (resInvested) resInvested.textContent = fmt(totalInvested);
  if (resGained) resGained.textContent = fmt(totalGained);
};

// ── CONTAS & CARTÕES ──────────────────────────────────────────────
export function renderContas(){
  const el = q('#accList');
  if (!el) return;
  const normalAccounts = S.accounts.filter(a => a.type !== 'Investimentos');
  const investAccounts = S.accounts.filter(a => a.type === 'Investimentos');

  if(!normalAccounts.length){
    el.innerHTML='<p class="empty">Nenhuma conta corrente cadastrada.</p>';
  } else {
    el.innerHTML=normalAccounts.map(a=>`
      <div class="acc-item">
        <div class="acc-top">
          <div><div class="acc-ico">${{Conta_Corrente:'🏦',Poupança:'💰',Dinheiro:'💵'}[a.type.replace(' ','_')]||'🏦'}</div>
            <div class="acc-name">${a.name}</div>
            <div class="acc-type">${a.type}</div></div>
          <div style="display:flex;gap:4px">
            <button class="bedit" onclick="editAcc('${a.id}')">✏️</button>
            <button class="bdel" onclick="delAcc('${a.id}')">✕</button>
          </div>
        </div>
        <div class="acc-bal" style="color:${a.balance<0?'var(--rd)':'var(--tx)'}">${fmt(a.balance)}</div>
      </div>`).join('');
  }

  const secInv = q('#sec-investimentos');
  const elInv = q('#invAccList');
  if (secInv && elInv) {
    if (investAccounts.length > 0) {
      secInv.style.display = 'block';
      elInv.innerHTML = investAccounts.map(a => {
        const brokerLbl = a.broker ? `<div style="font-size:11px;color:var(--tx2)">Corretora: <b>${a.broker}</b></div>` : '';
        const rentLbl = a.rent ? `<div style="font-size:11.5px;color:var(--pu);font-weight:600;margin-top:2px">📊 ${a.rent}</div>` : '';
        return `
        <div class="acc-item">
          <div class="acc-top">
            <div>
              <div class="acc-ico">📈</div>
              <div class="acc-name">${a.name}</div>
              <div class="acc-type">${a.type}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="bedit" onclick="editAcc('${a.id}')">✏️</button>
              <button class="bdel" onclick="delAcc('${a.id}')">✕</button>
            </div>
          </div>
          <div class="acc-bal" style="color:${a.balance<0?'var(--rd)':'var(--tx)'};margin-bottom:6px">${fmt(a.balance)}</div>
          ${brokerLbl}
          ${rentLbl}
        </div>`;
      }).join('');
    } else {
      secInv.style.display = 'none';
      elInv.innerHTML = '';
    }
  }

  const now=new Date(), cy=now.getFullYear(), cm=now.getMonth();
  const el2=q('#cardList');
  if (!el2) return;
  if(!S.cards.length){el2.innerHTML='<p class="empty">Nenhum cartão.</p>';}
  else el2.innerHTML=S.cards.map(c=>{
    let inv=0;
    S.transactions.forEach(t=>{
      if(t.payId!==c.id||t.tipo!=='Despesa')return;
      const d=new Date(t.data+'T00:00:00');
      let im=d.getMonth(),iy=d.getFullYear();
      if(d.getDate()>c.close){im++;if(im>11){im=0;iy++;}}
      if(iy===cy&&im===cm)inv+=t.val;
    });
    const avail=Math.max(0,c.limit-inv);
    const pct=Math.min(100,Math.round(inv/c.limit*100));
    const bc=pct>=90?'danger':pct>=70?'warn':'';
    return`<div class="cc-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="cc-name">${c.name}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="cc-chip"></div>
          <button class="bedit" style="color:rgba(255,255,255,.35)" onclick="editCard('${c.id}')">✏️</button>
          <button class="bdel" style="color:rgba(255,255,255,.35)" onclick="delCard('${c.id}')">✕</button>
        </div>
      </div>
      <div><div class="cc-inv-lbl">Fatura Atual</div><div class="cc-inv">${fmt(inv)}</div></div>
      <div>
        <div class="cc-prog-bg"><div class="cc-prog-bar ${bc}" style="width:${pct}%"></div></div>
        <div class="cc-meta"><span>Disponível ${fmt(avail)}</span><span>Limite ${fmt(c.limit)}</span></div>
        <div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:4px">Fecha dia ${c.close} · Vence dia ${c.due}</div>
      </div>
    </div>`;
  }).join('');
}

window.renderContas = renderContas;

window.editAcc = function(id) {
  const acc = S.accounts.find(a => a.id === id);
  if (!acc) return;
  q('#acc-id').value = id;
  q('#acc-nome').value = acc.name;
  q('#acc-tipo').value = acc.type;
  q('#acc-bal').value = acc.balance;

  const invFields = q('#acc-inv-fields');
  if (acc.type === 'Investimentos') {
    q('#acc-broker').value = acc.broker || '';
    q('#acc-rent').value = acc.rent || '';
    if (invFields) invFields.style.display = 'grid';
  } else {
    q('#acc-broker').value = '';
    q('#acc-rent').value = '';
    if (invFields) invFields.style.display = 'none';
  }

  q('#acc-modal-title').textContent = "Editar Conta Bancária";
  openM('m-acc');
};

window.editCard = function(id) {
  const c = S.cards.find(x => x.id === id);
  if (!c) return;
  q('#card-id').value = id;
  q('#card-nome').value = c.name;
  q('#card-lim').value = c.limit;
  q('#card-fech').value = c.close;
  q('#card-venc').value = c.due;
  q('#card-modal-title').textContent = "Editar Cartão de Crédito";
  openM('m-card');
};

window.delAcc=function(id){
  if(S.accounts.length<=1){alert('Mantenha ao menos uma conta.');return;}
  if(confirm('Excluir conta?')){S.accounts=S.accounts.filter(a=>a.id!==id);save();renderContas();renderDashboard();}
};
window.delCard=function(id){
  if(confirm('Excluir cartão?')){S.cards=S.cards.filter(c=>c.id!==id);save();renderContas();renderDashboard();}
};

// ── METAS ────────────────────────────────────────────────────────
export function renderMetas(){
  const el=q('#goalList');
  if (!el) return;
  if(!S.goals.length){el.innerHTML='<p class="empty">Nenhuma meta criada.</p>';return;}
  el.innerHTML=S.goals.map(g=>{
    const pct=Math.min(100,Math.round(g.cur/g.tgt*100));
    return`<div class="goal-item">
      <div class="goal-top">
        <div><div class="goal-name">🎯 ${g.name}</div><div class="goal-dl">Meta: ${fmtD(g.dl)}</div></div>
        <div style="display:flex;gap:4px">
          <button class="bedit" onclick="editGoal('${g.id}')">✏️</button>
          <button class="bdel" onclick="delGoal('${g.id}')">✕</button>
        </div>
      </div>
      <div class="goal-cur">${fmt(g.cur)}</div>
      <div class="goal-tgt">de ${fmt(g.tgt)} · Faltam ${fmt(Math.max(0,g.tgt-g.cur))}</div>
      <div class="prog"><div class="prog-bar ${pct>=100?'done':''}" style="width:${pct}%"></div></div>
      <div class="goal-foot">
        <span class="goal-pct">${pct}% concluído</span>
        <div class="goal-acts">
          <button class="b-goal" onclick="openGoalMv('${g.id}','dep')">+ Dep</button>
          <button class="b-goal" onclick="openGoalMv('${g.id}','ret')">− Resg</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.renderMetas = renderMetas;

window.editGoal = function(id) {
  const g = S.goals.find(x => x.id === id);
  if (!g) return;
  q('#goal-id').value = id;
  q('#goal-nome').value = g.name;
  q('#goal-tgt').value = g.tgt;
  q('#goal-data').value = g.dl;
  q('#goal-modal-title').textContent = "Editar Meta de Poupança";
  openM('m-goal');
};

window.openGoalMv=function(id,op){
  const g=S.goals.find(x=>x.id===id); if(!g)return;
  q('#goal-mv-id').value=id;
  q('#goal-mv-op').value=op;
  q('#goal-mv-title').textContent=(op==='dep'?'Depositar':'Resgatar')+' — '+g.name;
  q('#goal-mv-val').value='';
  openM('m-goal-mv');
};
window.delGoal=function(id){
  if(confirm('Excluir meta?')){S.goals=S.goals.filter(g=>g.id!==id);save();renderMetas();}
};

// ── CONFIG ───────────────────────────────────────────────────────
export let activeCT='expense';

export function setActiveCT(val) {
  activeCT = val;
}

export function renderConfig(){
  renderBudgets(); renderRecurring(); renderCatGrid();
}

window.renderConfig = renderConfig;

export function renderBudgets(){
  const now=new Date(), cy=now.getFullYear(), cm=now.getMonth();
  const spent={};
  if (Array.isArray(S.transactions)) {
    S.transactions.forEach(t=>{
      if(t.tipo!=='Despesa')return;
      const d=new Date(t.data+'T00:00:00');
      if(d.getFullYear()===cy&&d.getMonth()===cm) spent[t.catId]=(spent[t.catId]||0)+t.val;
    });
  }
  const el=q('#budgetList');
  if(!el) return;
  if(!S.budgets.length){el.innerHTML='<p class="empty">Sem orçamentos.</p>';return;}
  el.innerHTML=S.budgets.map(b=>{
    const c=getCat(b.catId); const s=spent[b.catId]||0;
    const pct=Math.min(100,Math.round(s/b.lim*100));
    const cls=pct>=100?'over':pct>=80?'warn':'ok';
    return`<div class="li bud-item">
      <div class="bud-hd">
        <div class="li-l"><span class="li-ico">${c.icon}</span><div class="li-inf"><div class="li-name">${c.name}</div><div class="li-sub">${fmt(s)} de ${fmt(b.lim)}</div></div></div>
        <div style="display:flex;align-items:center;gap:7px"><span style="font-size:11.5px;font-weight:700">${pct}%</span><button class="bdel" onclick="delBudget('${b.catId}')">✕</button></div>
      </div>
      <div class="bud-bg"><div class="bud-bar ${cls}" style="width:${pct}%"></div></div>
      <div class="bud-meta"><span>${pct}% usado</span><span>${fmt(Math.max(0,b.lim-s))} restante</span></div>
    </div>`;
  }).join('');
}

window.renderBudgets = renderBudgets;
window.delBudget=function(catId){S.budgets=S.budgets.filter(b=>b.catId!==catId);save();renderBudgets();};

export function renderRecurring(){
  const el=q('#recList');
  if(!el) return;
  if(!S.recurring.length){el.innerHTML='<p class="empty">Sem lançamentos fixos.</p>';return;}
  el.innerHTML=S.recurring.map(r=>{
    const c=getCat(r.catId); const pn=getPay(r.payId);
    const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    let dayText = '';
    if (r.frequency === 'weekly') {
      const wDay = r.day !== undefined ? r.day : 0;
      dayText = weekDays[wDay] ? `Toda ${weekDays[wDay]}` : `Dia de semana ${wDay}`;
    } else {
      dayText = `Dia ${r.day || 1}`;
    }
    return`<div class="li">
      <div class="li-l"><span class="li-ico">${c.icon}</span>
        <div class="li-inf"><div class="li-name">${r.desc}</div><div class="li-sub">${c.name} · ${pn} · ${dayText}</div></div>
      </div>
      <div class="li-r"><span class="li-val ${r.tipo==='Receita'?'in':'ex'}">${r.tipo==='Receita'?'+':'−'} ${fmt(r.val)}</span><button class="bdel" onclick="delRec('${r.id}')">✕</button></div>
    </div>`;
  }).join('');
}

window.renderRecurring = renderRecurring;
window.delRec=function(id){S.recurring=S.recurring.filter(r=>r.id!==id);save();renderRecurring();};

export function renderCatGrid(){
  const el=q('#catGrid');
  if(!el) return;
  const list=S.categories.filter(c=>c.type===activeCT);
  if(!list.length){el.innerHTML='<p class="empty">Nenhuma categoria.</p>';return;}
  el.innerHTML=list.map(c=>`
    <div class="ctile">
      <span class="cemo">${c.icon}</span>
      <div class="clbl">
        <div class="clbl-name">${c.name}</div>
        <span class="clbl-badge" style="background:${c.color}22;color:${c.color};border:1px solid ${c.color}44">${c.type==='expense'?'Despesa':'Receita'}</span>
      </div>
      <button class="bdel" onclick="delCat('${c.id}')">✕</button>
    </div>`).join('');
}

window.renderCatGrid = renderCatGrid;
window.delCat=function(id){
  const inUse=S.transactions.some(t=>t.catId===id)||S.budgets.some(b=>b.catId===id)||S.recurring.some(r=>r.catId===id);
  if(inUse&&!confirm('Categoria em uso. Excluir mesmo assim?'))return;
  S.categories=S.categories.filter(c=>c.id!==id); save(); renderCatGrid();
};

export function renderCalculadora() {}

export function renderInstallmentTracker() {
  const listEl = q('#installment-tracker-list');
  const cardEl = q('#installment-tracker-card');
  if (!listEl || !cardEl) return;
  
  const instTxs = Array.isArray(S.transactions) ? S.transactions.filter(t => t.inst !== null && t.total !== null) : [];
  
  if (instTxs.length === 0) {
    cardEl.style.display = 'none';
    return;
  }
  
  cardEl.style.display = 'block';
  
  const groups = {};
  instTxs.forEach(t => {
    const key = `${t.desc}_${t.total}_${t.tipo}`;
    if (!groups[key]) {
      groups[key] = {
        desc: t.desc,
        tipo: t.tipo,
        total: t.total,
        val: t.val,
        txs: []
      };
    }
    groups[key].txs.push(t);
  });
  
  listEl.innerHTML = Object.values(groups).map(g => {
    const paidTxs = g.txs.filter(t => t.status === 'Pago' || t.status === 'Recebido');
    const paidCount = paidTxs.length;
    const remainingCount = g.total - paidCount;
    
    const paidVal = paidCount * g.val;
    const remainingVal = remainingCount * g.val;
    
    const pct = Math.round((paidCount / g.total) * 100);
    
    const typeLabel = g.tipo === 'Receita' ? 'Recebido' : 'Pago';
    
    return `
      <div class="inst-card">
        <div class="inst-header">
          <div>
            <h4 class="inst-title">${g.desc}</h4>
            <span style="font-size:11px;color:var(--tx2)">Valor por parcela: <b>${fmt(g.val)}</b></span>
          </div>
          <span class="inst-pill" style="background:${g.tipo === 'Receita' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)'};color:${g.tipo === 'Receita' ? 'var(--gr)' : 'var(--acl)'}">
            ${g.tipo === 'Receita' ? 'Entrada' : 'Saída'}
          </span>
        </div>
        
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
            <span>Progresso: <b>${paidCount} de ${g.total}</b></span>
            <span>${pct}%</span>
          </div>
          <div class="inst-progress-bar-bg">
            <div class="inst-progress-bar-fill" style="width:${pct}%; background: ${g.tipo === 'Receita' ? 'var(--gr)' : 'linear-gradient(90deg, var(--ac), var(--pu))'}"></div>
          </div>
        </div>
        
        <div class="inst-footer">
          <div>${typeLabel}: <span class="inst-val-highlight">${fmt(paidVal)}</span></div>
          <div style="text-align:right">Restante: <span class="inst-val-highlight" style="color: ${g.tipo === 'Despesa' ? 'var(--rd)' : 'var(--gr)'}">${fmt(remainingVal)}</span></div>
        </div>
      </div>
    `;
  }).join('');
}

export function updateNotifications() {
  const dropdownContainer = q('#notif-list');
  const dropdownBadge = q('#notif-badge');
  const pageContainer = q('#notif-page-list');
  const pageCountLbl = q('#notif-page-count');
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);
  threeDaysFromNow.setHours(23,59,59,999);
  
  const pendingTxs = (S.transactions || []).filter(t => t.tipo === 'Despesa' && t.status === 'Pendente');
  
  const items = [];
  
  pendingTxs.forEach(t => {
    const d = new Date(t.data + 'T00:00:00');
    if (d < today) {
      items.push({
        type: 'overdue',
        title: 'Despesa Atrasada ⚠️',
        desc: `A despesa "<b>${t.desc}</b>" de <b>${fmt(t.val)}</b> venceu em ${fmtD(t.data)}.`,
        date: d
      });
    } else if (d <= threeDaysFromNow) {
      items.push({
        type: 'upcoming',
        title: 'Despesa Próxima do Vencimento 📅',
        desc: `A despesa "<b>${t.desc}</b>" de <b>${fmt(t.val)}</b> vencerá em ${fmtD(t.data)}.`,
        date: d
      });
    }
  });
  
  // Exceder orçamentos (80% ou mais)
  const spent = {};
  if (Array.isArray(S.transactions)) {
    S.transactions.forEach(t => {
      if (t.tipo !== 'Despesa') return;
      const d = new Date(t.data + 'T00:00:00');
      if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()) {
        spent[t.catId] = (spent[t.catId] || 0) + t.val;
      }
    });
  }
  
  if (Array.isArray(S.budgets)) {
    S.budgets.forEach(b => {
      const s = spent[b.catId] || 0;
      const pct = s / b.lim;
      const cat = getCat(b.catId);
      if (pct >= 1.0) {
        items.push({
          type: 'budget-over',
          title: 'Orçamento Estourado 🚨',
          desc: `O orçamento da categoria <b>${cat.icon} ${cat.name}</b> estourou! Limite: ${fmt(b.lim)}, Usado: ${fmt(s)}.`,
          date: today
        });
      } else if (pct >= 0.8) {
        items.push({
          type: 'budget-warn',
          title: 'Orçamento Próximo do Limite 📌',
          desc: `Você utilizou <b>${Math.round(pct*100)}%</b> do orçamento de <b>${cat.icon} ${cat.name}</b>.`,
          date: today
        });
      }
    });
  }
  
  if (dropdownBadge) {
    dropdownBadge.textContent = items.length;
    dropdownBadge.style.display = items.length > 0 ? 'inline-block' : 'none';
  }
  
  if (pageCountLbl) {
    pageCountLbl.textContent = `${items.length} alerta${items.length === 1 ? '' : 's'}`;
  }
  
  const emptyHtml = `
    <div style="padding: 24px 16px; text-align: center; color: var(--tx2);">
      <span style="font-size: 24px; display: block; margin-bottom: 8px;">🎉</span>
      <div style="font-size: 13px; font-weight: 700;">Tudo sob controle!</div>
      <p style="font-size: 11px; margin: 4px 0 0;">Nenhuma despesa pendente vencendo ou orçamento em alerta no momento.</p>
    </div>
  `;
  
  if (items.length === 0) {
    if (dropdownContainer) dropdownContainer.innerHTML = emptyHtml;
    if (pageContainer) pageContainer.innerHTML = emptyHtml;
    return;
  }
  
  const listHtml = items.map(item => {
    let borderClr = 'var(--am)';
    if (item.type === 'overdue' || item.type === 'budget-over') borderClr = 'var(--rd)';
    
    return `
      <div class="li" style="border-left: 3px solid ${borderClr}; padding: 12px; background: var(--s2); border-radius: 8px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px;">
        <div style="font-size: 12px; font-weight: 800; color: var(--tx);">${item.title}</div>
        <div style="font-size: 11.5px; color: var(--tx2); line-height: 1.4;">${item.desc}</div>
      </div>
    `;
  }).join('');

  if (dropdownContainer) dropdownContainer.innerHTML = listHtml;
  if (pageContainer) pageContainer.innerHTML = listHtml;

  if (window.checkUpcomingBillsNotifications) {
    window.checkUpcomingBillsNotifications();
  }
}

window.updateNotifications = updateNotifications;

export function updateTxLivePreview() {
  const previewEl = q('#tx-live-preview');
  if (!previewEl) return;
  
  const currency = q('#tx-moeda')?.value || 'BRL';
  const rate = currency !== 'BRL' ? (parseFloat(q('#tx-taxa')?.value) || 1) : 1;
  const rawVal = parseFloat(q('#tx-val').value) || 0;
  const val = +(rawVal * rate).toFixed(2); // value in BRL
  
  const payId = q('#tx-conta').value;
  const tipo = q('#tx-tipo').value;
  const catId = q('#tx-cat').value;
  const status = q('#tx-status').value;
  
  if (rawVal <= 0 || !payId) {
    previewEl.style.display = 'none';
    return;
  }
  
  let messages = [];
  
  if (currency !== 'BRL') {
    const curSymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
    messages.push(`💱 <b>Conversão Cambial:</b> ${curSymbol} ${rawVal.toFixed(2)} (${currency}) convertidos à taxa de ${rate.toFixed(4)} = <b>${fmt(val)}</b>.`);
  }
  
  // 1. Account / Card Balance impact
  const acc = S.accounts.find(a => a.id === payId);
  const card = S.cards.find(c => c.id === payId);
  
  if (acc) {
    if (status !== 'Pendente') {
      const change = tipo === 'Receita' ? val : -val;
      const newBal = acc.balance + change;
      messages.push(`🏦 Saldo de <b>${acc.name}</b> mudará de <b>${fmt(acc.balance)}</b> para <b style="color:${newBal < 0 ? 'var(--rd)' : 'var(--gr)'}">${fmt(newBal)}</b>.`);
    } else {
      messages.push(`🏦 Saldo de <b>${acc.name}</b> não mudará imediatamente (Lançamento Pendente).`);
    }
  } else if (card) {
    if (tipo === 'Despesa') {
      const now = new Date();
      const cy = now.getFullYear();
      const cm = now.getMonth();
      let inv = 0;
      S.transactions.forEach(t => {
        if (t.payId !== card.id || t.tipo !== 'Despesa') return;
        const d = new Date(t.data + 'T00:00:00');
        let im = d.getMonth(), iy = d.getFullYear();
        if (d.getDate() > card.close) {
          im++; if (im > 11) { im = 0; iy++; }
        }
        if (iy === cy && im === cm) inv += t.val;
      });
      
      const newInv = inv + val;
      const pct = Math.round((newInv / card.limit) * 100);
      messages.push(`💳 Fatura de <b>${card.name}</b> mudará de <b>${fmt(inv)}</b> para <b>${fmt(newInv)}</b> (Consumindo <b>${pct}%</b> do limite de ${fmt(card.limit)}).`);
      if (pct >= 90) {
        messages.push(`<span style="color:var(--rd);font-weight:700">⚠️ Atenção: Limite do cartão quase esgotado!</span>`);
      }
    }
  }
  
  // 2. Budget impact
  if (tipo === 'Despesa' && catId) {
    const budget = S.budgets.find(b => b.catId === catId);
    if (budget) {
      const cat = getCat(catId);
      const now = new Date();
      const cy = now.getFullYear();
      const cm = now.getMonth();
      let spent = 0;
      S.transactions.forEach(t => {
        if (t.tipo !== 'Despesa' || t.catId !== catId) return;
        const d = new Date(t.data + 'T00:00:00');
        if (d.getFullYear() === cy && d.getMonth() === cm) spent += t.val;
      });
      
      const isEdit = !!q('#tx-id').value;
      let oldVal = 0;
      if (isEdit) {
        const oldTx = S.transactions.find(t => t.id === q('#tx-id').value);
        if (oldTx && oldTx.catId === catId && oldTx.tipo === 'Despesa') {
          oldVal = oldTx.val;
        }
      }
      
      const newSpent = spent - oldVal + val;
      const left = budget.lim - newSpent;
      
      if (left < 0) {
        messages.push(`<span style="color:var(--rd);font-weight:700">⚠️ Orçamento estourado! Limite: ${fmt(budget.lim)}, Previsto: ${fmt(newSpent)} (Excederá em ${fmt(Math.abs(left))}).</span>`);
      } else {
        messages.push(`📌 Orçamento da categoria <b>${cat.name}</b>: Restará <b>${fmt(left)}</b> de ${fmt(budget.lim)}.`);
      }
    }
  }
  
  // Installment preview message
  const isInstChecked = q('#tx-is-installment')?.checked;
  const instVal = parseInt(q('#tx-inst')?.value) || 1;
  if (isInstChecked && instVal > 1) {
    const splitVal = +(val / instVal).toFixed(2);
    messages.push(`📅 <b>Lançamento Parcelado:</b> Será dividido em <b>${instVal}x de ${fmt(splitVal)}</b> distribuído nos próximos meses.`);
  }

  if (messages.length > 0) {
    previewEl.style.display = 'flex';
    previewEl.innerHTML = messages.map(m => `<div style="line-height:1.4">${m}</div>`).join('');
  } else {
    previewEl.style.display = 'none';
  }
}

window.updateTxLivePreview = updateTxLivePreview;
export function renderCalendar() {
  const calGrid = q('#calGrid');
  const monthLbl = q('#calMonthLabel');
  if (!calGrid || !monthLbl) return;

  // Initialize checkbox value from localStorage
  const cbSync = q('#cbGoogleCalendarSync');
  if (cbSync) {
    if (localStorage.getItem('financepro_gcal_sync') === null && localStorage.getItem('financeos_gcal_sync') === null) {
      localStorage.setItem('financepro_gcal_sync', 'false');
    }
    cbSync.checked = (localStorage.getItem('financepro_gcal_sync') || localStorage.getItem('financeos_gcal_sync')) === 'true';
    
    // Add event listener once
    if (!cbSync.dataset.listenerBound) {
      cbSync.addEventListener('change', function() {
        localStorage.setItem('financepro_gcal_sync', this.checked ? 'true' : 'false');
        renderCalendar();
      });
      cbSync.dataset.listenerBound = 'true';
    }
  }

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const year = calendarState.currentYear;
  const month = calendarState.currentMonth;

  monthLbl.textContent = `${MESES[month]} de ${year}`;

  calGrid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const cell = document.createElement('div');
    cell.className = 'cal-cell prev-next-month';
    cell.innerHTML = `<span style="font-size:11px;font-weight:600">${dayNum}</span>`;
    calGrid.appendChild(cell);
  }

  const todayD = new Date();
  const todayStr = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTxs = (S.transactions || []).filter(t => t.data === dayStr);
    
    const cell = document.createElement('div');
    cell.className = 'cal-cell current-month-day';
    
    if (dayStr === todayStr) {
      cell.classList.add('today-cell');
    }
    
    let indHtml = '';
    if (dayTxs.length > 0) {
      const showTxs = dayTxs.slice(0, 2);
      const remainingCount = dayTxs.length - showTxs.length;
      
      const pills = showTxs.map(t => {
        const color = t.tipo === 'Receita' ? 'var(--gr)' : 'var(--rd)';
        const statusOpacity = t.status === 'Pendente' ? 'opacity:0.6' : 'font-weight:700';
        return `<div style="font-size:8px;padding:1px 3px;border-radius:3px;background:${color}22;color:${color};text-overflow:ellipsis;overflow:hidden;white-space:nowrap;max-width:100%;${statusOpacity}">${t.desc}</div>`;
      }).join('');
      
      const badge = remainingCount > 0 ? `<div style="font-size:8px;color:var(--tx2);text-align:right">+${remainingCount}</div>` : '';
      indHtml = `<div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;width:100%">${pills}${badge}</div>`;
    }
    
    cell.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
        <span style="font-size:12px;font-weight:700">${d}</span>
      </div>
      ${indHtml}
    `;
    
    cell.addEventListener('click', () => {
      qa('#calGrid .cal-cell').forEach(el => el.classList.remove('selected-cell'));
      cell.classList.add('selected-cell');
      showDayDetails(dayStr, d, MESES[month], year, dayTxs);
    });
    
    calGrid.appendChild(cell);
  }

  // Next month trailing days
  const totalCells = firstDay + totalDays;
  const nextMonthDays = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= nextMonthDays; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell prev-next-month';
    cell.innerHTML = `<span style="font-size:11px;font-weight:600">${d}</span>`;
    calGrid.appendChild(cell);
  }

  const detailCard = q('#calDayDetailCard');
  if (detailCard) detailCard.style.display = 'none';
}

export function showDayDetails(dayIso, dayNum, monthName, year, txs) {
  const detailCard = q('#calDayDetailCard');
  const detailTitle = q('#calDetailTitle');
  const dayList = q('#calDayList');
  if (!detailCard || !detailTitle || !dayList) return;

  detailTitle.textContent = `Lançamentos de ${dayNum} de ${monthName} de ${year}`;
  dayList.innerHTML = '';
  detailCard.style.display = 'block';

  if (txs.length === 0) {
    dayList.innerHTML = '<p class="empty" style="padding:10px 0;margin:0">Nenhum lançamento registrado para este dia.</p>';
    return;
  }

  dayList.innerHTML = txs.map(t => {
    const c = getCat(t.catId);
    const pn = getPay(t.payId);
    const sCls = t.status === 'Pago' || t.status === 'Recebido' ? 's-pago' : 's-pendente';
    
    const syncEnabled = q('#cbGoogleCalendarSync')?.checked;
    let googleCalBtn = '';
    if (syncEnabled) {
      const dateClean = t.data.replace(/-/g, '');
      const dObj = new Date(t.data + 'T12:00:00');
      dObj.setDate(dObj.getDate() + 1);
      const nextY = dObj.getFullYear();
      const nextM = String(dObj.getMonth() + 1).padStart(2, '0');
      const nextD = String(dObj.getDate()).padStart(2, '0');
      const dateEndClean = `${nextY}${nextM}${nextD}`;
      
      const eventTitle = encodeURIComponent(`[FinancePro] ${t.desc}`);
      const eventDetails = encodeURIComponent(`Lançamento: ${t.tipo}\nValor: ${fmt(t.val)}\nCategoria: ${c.name}\nConta: ${pn}\nStatus: ${t.status}`);
      const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${dateClean}/${dateEndClean}&details=${eventDetails}`;
      
      googleCalBtn = `<a href="${googleCalUrl}" target="_blank" class="bs sm" style="padding:5px 8px;font-size:11px;background:#4285f4;color:#ffffff;border-color:#4285f4;text-decoration:none;border-radius:6px;display:inline-flex;align-items:center;gap:4px" title="Adicionar à Google Agenda">📅 Agendar</a>`;
    }

    return `<div class="li" style="padding:10px 12px;border-radius:10px;background:var(--s2);display:flex;justify-content:space-between;align-items:center">
      <div class="li-l" style="display:flex;align-items:center;gap:10px">
        <span class="li-ico" style="font-size:18px">${c.icon}</span>
        <div>
          <div style="font-weight:600;font-size:13px;color:var(--tx)">${t.desc}</div>
          <div style="font-size:11px;color:var(--tx2)">${c.name} · ${pn}</div>
        </div>
      </div>
      <div class="li-r" style="display:flex;align-items:center;gap:10px">
        <span class="${t.tipo === 'Receita' ? 'amt-in' : 'amt-ex'}" style="font-weight:700;font-size:13px">${t.tipo === 'Receita' ? '+' : '−'} ${fmt(t.val)}</span>
        <span class="status-pill ${sCls}" style="font-size:10px;padding:3px 8px;cursor:pointer" onclick="toggleTxStatus('${t.id}'); renderCalendar(); reloadCurrentDayDetails('${t.data}', ${dayNum}, '${monthName}', ${year});" title="Alternar status">${t.status}</span>
        ${googleCalBtn}
      </div>
    </div>`;
  }).join('');
}
window.reloadCurrentDayDetails = function(dayIso, dayNum, monthName, year) {
  setTimeout(() => {
    const dayTxs = (S.transactions || []).filter(t => t.data === dayIso);
    showDayDetails(dayIso, dayNum, monthName, year, dayTxs);
  }, 100);
};

window.renderCalendar = renderCalendar;

export function renderPerfil() {
  renderAchievements();
  render52WeekChallenge();
}

export function renderAchievements() {
  const container = q('#achievements-list');
  const countEl = q('#achievements-count');
  if (!container) return;

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  
  let monthInc = 0;
  let monthExp = 0;
  if (Array.isArray(S.transactions)) {
    S.transactions.forEach(t => {
      const td = new Date(t.data + 'T00:00:00');
      if (td.getFullYear() === curYear && td.getMonth() === curMonth) {
        if (t.tipo === 'Receita') monthInc += t.val;
        else monthExp += t.val;
      }
    });
  }
  
  const savingRate = monthInc > 0 ? (monthInc - monthExp) / monthInc : 0;
  const isPoupadorFiel = monthInc > 0 && savingRate >= 0.20;

  let hasBudgets = Array.isArray(S.budgets) && S.budgets.length > 0;
  let allBudgetsUnderControl = hasBudgets;
  if (hasBudgets) {
    const budgetSpent = {};
    if (Array.isArray(S.transactions)) {
      S.transactions.forEach(t => {
        if (t.tipo === 'Despesa') {
          const td = new Date(t.data + 'T00:00:00');
          if (td.getFullYear() === curYear && td.getMonth() === curMonth) {
            budgetSpent[t.cat] = (budgetSpent[t.cat] || 0) + t.val;
          }
        }
      });
    }
    S.budgets.forEach(b => {
      const spent = budgetSpent[b.catId] || 0;
      if (spent > b.limit) {
        allBudgetsUnderControl = false;
      }
    });
  }

  const isCidadaoGlobal = Array.isArray(S.transactions) && S.transactions.some(t => t.moeda && t.moeda !== 'BRL');
  const isAgenteSecreto = localStorage.getItem('financepro_stealth_activated') === 'true' || localStorage.getItem('financeos_stealth_activated') === 'true' || localStorage.getItem('financepro_stealth') === 'true' || localStorage.getItem('financeos_stealth') === 'true';
  const hasVision = Array.isArray(S.goals) && S.goals.length >= 1;
  const txCount = (S.transactions || []).length;

  const badges = [
    { id: 'disciplinado', icon: '🛡️', title: 'Disciplinado', desc: 'Registrou 5+ transações', unlocked: txCount >= 5 },
    { id: 'poupador_fiel', icon: '💰', title: 'Poupador Fiel', desc: 'Taxa poupança >= 20% no mês', unlocked: isPoupadorFiel },
    { id: 'mestre_controle', icon: '🎯', title: 'Mestre do Controle', desc: 'Orçamentos sob controle no mês', unlocked: allBudgetsUnderControl },
    { id: 'cidadao_global', icon: '🌍', title: 'Cidadão Global', desc: 'Registrou transação multimoeda', unlocked: isCidadaoGlobal },
    { id: 'agente_secreto', icon: '🕶️', title: 'Agente Secreto', desc: 'Usou o Modo Stealth', unlocked: isAgenteSecreto },
    { id: 'visao_futuro', icon: '🚀', title: 'Visão de Futuro', desc: 'Criou 1+ metas de economia', unlocked: hasVision }
  ];

  const unlockedCount = badges.filter(b => b.unlocked).length;
  if (countEl) {
    countEl.textContent = `${unlockedCount}/${badges.length} Desbloqueados`;
  }

  container.innerHTML = badges.map(b => {
    return `<div class="achievement-card ${b.unlocked ? 'unlocked' : 'locked'}" title="${b.unlocked ? 'Conquista desbloqueada!' : 'Bloqueada'}">
      <div class="achievement-badge">${b.icon}</div>
      <div class="achievement-title">${b.title}</div>
      <div class="achievement-desc">${b.desc}</div>
    </div>`;
  }).join('');
}

export function render52WeekChallenge() {
  const selectMult = q('#challenge-multiplier');
  const progressText = q('#challenge-progress-text');
  const savedText = q('#challenge-saved-text');
  const progressBar = q('#challenge-progress-bar');
  const gridContainer = q('#challenge-weeks-grid');
  
  if (!gridContainer) return;
  if (!S.challenge52) {
    S.challenge52 = { multiplier: 1, checkedWeeks: [] };
  }

  const mult = S.challenge52.multiplier || 1;
  if (selectMult) {
    selectMult.value = mult;
  }

  const checkedCount = S.challenge52.checkedWeeks.length;
  const progressPct = Math.round((checkedCount / 52) * 100);

  if (progressText) {
    progressText.textContent = `Progresso: ${checkedCount}/52 Semanas (${progressPct}%)`;
  }

  if (progressBar) {
    progressBar.style.width = `${progressPct}%`;
  }

  let totalSaved = 0;
  S.challenge52.checkedWeeks.forEach(wIdx => {
    totalSaved += (wIdx + 1) * mult;
  });

  if (savedText) {
    savedText.textContent = `Total Acumulado: ${fmt(totalSaved)}`;
  }

  let gridHtml = '';
  for (let i = 0; i < 52; i++) {
    const isChecked = S.challenge52.checkedWeeks.includes(i);
    const val = (i + 1) * mult;
    gridHtml += `<div class="challenge-week ${isChecked ? 'checked' : ''}" onclick="toggleWeek52Challenge(${i})">
      <span class="challenge-week-num">Semana ${i + 1}</span>
      <span class="challenge-week-val">${fmt(val)}</span>
      ${isChecked 
        ? '<span style="font-size:10px; color:var(--gr); font-weight:bold;">✓ Pago</span>' 
        : `<button class="challenge-week-btn" onclick="event.stopPropagation(); depositChallengeWeek(${i}, ${val})">💰 Lançar</button>`
      }
    </div>`;
  }
  gridContainer.innerHTML = gridHtml;
}

export function renderSuporte() {
  const user = currentUser();
  const name = user ? (user.displayName || 'Usuário Sincronizado') : (S.userName || 'Usuário Local');
  const email = user ? (user.email || '—') : (S.userEmail || 'local@financepro.app');

  const nameInput = q('#support-name-input');
  const emailInput = q('#support-email-input');
  if (nameInput) nameInput.value = name;
  if (emailInput) emailInput.value = email;

  const countEl = q('#support-ticket-count');
  const tickets = S.supportTickets || [];
  if (countEl) {
    countEl.textContent = tickets.length === 1 ? '1 chamado aberto' : `${tickets.length} chamados abertos`;
  }

  const emailDisp = q('#support-email-display');
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'suporte@financepro.app';
  if (emailDisp) {
    emailDisp.textContent = supportEmail;
  }

  const listEl = q('#support-tickets-list');
  if (listEl) {
    if (tickets.length === 0) {
      listEl.innerHTML = `<p style="font-size:12px; color:var(--tx2); text-align:center; padding:20px 0; margin:0;">Nenhum chamado enviado ainda.</p>`;
    } else {
      listEl.innerHTML = tickets.map(t => {
        let badgeColor = '#64748b';
        if (t.category === 'bug') badgeColor = '#ef4444';
        if (t.category === 'sugestao') badgeColor = '#3b82f6';
        if (t.category === 'financeiro') badgeColor = '#10b981';

        return `
          <div style="background:var(--s2); border:1px solid var(--bd); padding:10px 12px; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:11px; font-weight:600; color:var(--tx2);">${t.date}</span>
              <span style="background:${badgeColor}22; color:${badgeColor}; font-size:10px; font-weight:700; padding:2px 6px; border-radius:10px; text-transform:uppercase;">
                ${t.category}
              </span>
            </div>
            <div style="font-size:13px; font-weight:700; color:var(--tx);">${escapeHtml(t.subject)}</div>
            <p style="font-size:12px; color:var(--tx2); margin:4px 0 0 0; line-height:1.4; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">
              ${escapeHtml(t.message)}
            </p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; border-top:1px dashed var(--bd); padding-top:6px;">
              <span style="font-size:10px; color:var(--tx2)">ID: <code style="font-family:monospace;">${t.id}</code></span>
              <button class="bs xs" onclick="copySupportTicketText('${t.id}')" style="padding:2px 6px; font-size:10.5px;">Copiar Detalhes</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

export function copySupportTicketText(id) {
  const tickets = S.supportTickets || [];
  const t = tickets.find(x => x.id === id);
  if (!t) return;

  let text = `=== CHAMADO DE SUPORTE ===\n`;
  text += `ID: ${t.id}\n`;
  text += `Data: ${t.date}\n`;
  text += `Nome: ${t.name}\n`;
  text += `E-mail: ${t.email}\n`;
  text += `Categoria: ${t.category}\n`;
  text += `Assunto: ${t.subject}\n\n`;
  text += `Mensagem:\n${t.message}\n\n`;
  if (t.logs) {
    text += `=== LOGS DO SISTEMA ===\n`;
    text += `${t.logs}\n`;
  }

  navigator.clipboard.writeText(text)
    .then(() => alert('Detalhes do chamado copiados para a área de transferência!'))
    .catch(err => alert('Erro ao copiar detalhes: ' + err));
}

window.renderPerfil = renderPerfil;
window.renderAchievements = renderAchievements;
window.render52WeekChallenge = render52WeekChallenge;
window.renderSuporte = renderSuporte;
window.copySupportTicketText = copySupportTicketText;
