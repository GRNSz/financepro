import { S, fmt, fmtD, getCat, periodState } from './state.js';

export function exportWeeklyPDF(weekIndex) {
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesName = MESES[periodState.currentMonth];
  const anoVal = periodState.currentYear;
  const totalDays = new Date(periodState.currentYear, periodState.currentMonth + 1, 0).getDate();
  
  const weeks = [
    { start: 1, end: 7, label: 'Semana 1 (01 a 07)' },
    { start: 8, end: 14, label: 'Semana 2 (08 a 14)' },
    { start: 15, end: 21, label: 'Semana 3 (15 a 21)' },
    { start: 22, end: totalDays, label: `Semana 4 (22 a ${totalDays})` }
  ];
  
  const week = weeks[weekIndex];
  
  const activeTxs = S.transactions.filter(t => {
    const d = new Date(t.data + 'T00:00:00');
    if (d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth) {
      const day = d.getDate();
      return day >= week.start && day <= week.end;
    }
    return false;
  });
  
  let totalRec = 0;
  let totalDesp = 0;
  activeTxs.forEach(t => {
    if (t.tipo === 'Receita') totalRec += t.val;
    else totalDesp += t.val;
  });
  const bal = totalRec - totalDesp;
  
  const reportDiv = document.createElement('div');
  reportDiv.style.padding = '40px';
  reportDiv.style.fontFamily = "'Inter', sans-serif";
  reportDiv.style.color = '#1e293b';
  reportDiv.style.background = '#ffffff';
  reportDiv.style.display = 'flex';
  reportDiv.style.flexDirection = 'column';
  reportDiv.style.gap = '24px';
  
  const tableStyles = `width: 100%; border-collapse: collapse; margin-top: 10px;`;
  const thStyles = `background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 8px 12px; text-align: left; border-bottom: 2px solid #cbd5e1;`;
  const tdStyles = `padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px;`;
  
  const txHtml = activeTxs.map(t => {
    const c = getCat(t.catId);
    const dateFormatted = fmtD(t.data);
    return `
      <tr>
        <td style="${tdStyles}">${dateFormatted}</td>
        <td style="${tdStyles}"><b>${t.desc}</b></td>
        <td style="${tdStyles}">${c.icon} ${c.name}</td>
        <td style="${tdStyles};color:${t.tipo === 'Receita' ? '#10b981' : '#ef4444'}">${t.tipo}</td>
        <td style="${tdStyles};font-weight:600">${fmt(t.val)}</td>
        <td style="${tdStyles}"><span style="font-size:10.5px;padding:2px 6px;border-radius:4px;background:${t.status === 'Pago' || t.status === 'Recebido' ? '#dcfce7;color:#15803d' : '#fef3c7;color:#92400e'}">${t.status}</span></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6" style="padding:20px;text-align:center;color:#64748b;font-size:12px">Nenhum lançamento nesta semana.</td></tr>';
  
  reportDiv.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #ef4444;padding-bottom:16px">
      <div>
        <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.5px">💸 FinanceOS</h1>
        <p style="font-size:12px;color:#64748b;margin:4px 0 0">Relatório Financeiro Semanal</p>
      </div>
      <div style="text-align:right">
        <h3 style="font-size:18px;font-weight:750;color:#ef4444;margin:0">${week.label}</h3>
        <p style="font-size:11px;color:#64748b;margin:4px 0 0">${mesName} de ${anoVal}</p>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin-top:10px">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
        <p style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin:0 0 6px">Receitas Semanais</p>
        <h2 style="font-size:20px;color:#10b981;margin:0">${fmt(totalRec)}</h2>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
        <p style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin:0 0 6px">Despesas Semanais</p>
        <h2 style="font-size:20px;color:#ef4444;margin:0">${fmt(totalDesp)}</h2>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
        <p style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin:0 0 6px">Balanço Semanal</p>
        <h2 style="font-size:20px;color:${bal >= 0 ? '#10b981' : '#ef4444'};margin:0">${bal >= 0 ? '+' : ''}${fmt(bal)}</h2>
      </div>
    </div>
    
    <div style="margin-top:10px">
      <h3 style="font-size:14px;font-weight:750;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin:0 0 10px">📋 Histórico de Lançamentos da Semana</h3>
      <table style="${tableStyles}">
        <thead>
          <tr>
            <th style="${thStyles}">Data</th>
            <th style="${thStyles}">Descrição</th>
            <th style="${thStyles}">Categoria</th>
            <th style="${thStyles}">Tipo</th>
            <th style="${thStyles}">Valor</th>
            <th style="${thStyles}">Status</th>
          </tr>
        </thead>
        <tbody>
          ${txHtml}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top:auto;border-top:1px solid #cbd5e1;padding-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">
      Este relatório foi gerado automaticamente pelo aplicativo FinanceOS. Guarde em local seguro.
    </div>
  `;
  
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `Relatorio_Semanal_Semana${weekIndex + 1}_${mesName}_${anoVal}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  reportDiv.style.position = 'fixed';
  reportDiv.style.left = '0';
  reportDiv.style.top = '0';
  reportDiv.style.zIndex = '-9999';
  reportDiv.style.opacity = '0.01';
  reportDiv.style.width = '790px';
  document.body.appendChild(reportDiv);
  
  if (window.html2pdf) {
    window.html2pdf().set(opt).from(reportDiv).save().then(() => {
      document.body.removeChild(reportDiv);
    }).catch(err => {
      console.error('Erro ao gerar PDF Semanal:', err);
      document.body.removeChild(reportDiv);
    });
  } else {
    alert('Erro: Biblioteca de geração de PDF não carregada. Verifique sua conexão.');
    document.body.removeChild(reportDiv);
  }
}

export function exportMonthlyPDF() {
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  let activeTxs = [];
  let periodLabel = '';
  let subLabel = '';
  let filename = '';

  if (periodState.currentMode === 'monthly') {
    const mesName = MESES[periodState.currentMonth];
    const anoVal = periodState.currentYear;
    periodLabel = `${mesName} de ${anoVal}`;
    subLabel = 'Relatório Financeiro Mensal';
    filename = `Relatorio_Financeiro_${mesName}_${anoVal}.pdf`;
    activeTxs = S.transactions.filter(t => {
      const d = new Date(t.data + 'T00:00:00');
      return d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth;
    });
  } else if (periodState.currentMode === 'yearly') {
    const anoVal = periodState.currentYear;
    periodLabel = `Ano ${anoVal}`;
    subLabel = 'Relatório Financeiro Anual';
    filename = `Relatorio_Financeiro_Anual_${anoVal}.pdf`;
    activeTxs = S.transactions.filter(t => {
      const d = new Date(t.data + 'T00:00:00');
      return d.getFullYear() === periodState.currentYear;
    });
  } else {
    periodLabel = 'Todo o Período';
    subLabel = 'Relatório Financeiro Consolidado';
    filename = `Relatorio_Financeiro_Consolidado.pdf`;
    activeTxs = [...S.transactions];
  }

  // Sort transactions by date descending
  activeTxs.sort((a, b) => b.data.localeCompare(a.data));

  let totalRec = 0;
  let totalDesp = 0;
  activeTxs.forEach(t => {
    if (t.tipo === 'Receita') totalRec += t.val;
    else totalDesp += t.val;
  });
  const bal = totalRec - totalDesp;
  
  const catSpent = {};
  activeTxs.filter(t => t.tipo === 'Despesa').forEach(t => {
    catSpent[t.catId] = (catSpent[t.catId] || 0) + t.val;
  });
  
  const reportDiv = document.createElement('div');
  reportDiv.style.padding = '40px';
  reportDiv.style.fontFamily = "'Inter', sans-serif";
  reportDiv.style.color = '#1e293b';
  reportDiv.style.background = '#ffffff';
  reportDiv.style.display = 'flex';
  reportDiv.style.flexDirection = 'column';
  reportDiv.style.gap = '24px';
  
  const tableStyles = `width: 100%; border-collapse: collapse; margin-top: 10px;`;
  const thStyles = `background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 8px 12px; text-align: left; border-bottom: 2px solid #cbd5e1;`;
  const tdStyles = `padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px;`;
  
  const catHtml = Object.entries(catSpent).map(([catId, val]) => {
    const c = getCat(catId);
    return `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e2e8f0;font-size:12.5px">
        <span>${c.icon} <b>${c.name}</b></span>
        <span>${fmt(val)}</span>
      </div>
    `;
  }).join('') || '<p style="font-size:12.5px;color:#64748b;margin:0">Nenhuma despesa registrada.</p>';
  
  const txHtml = activeTxs.map(t => {
    const c = getCat(t.catId);
    const dateFormatted = fmtD(t.data);
    return `
      <tr>
        <td style="${tdStyles}">${dateFormatted}</td>
        <td style="${tdStyles}"><b>${t.desc}</b></td>
        <td style="${tdStyles}">${c.icon} ${c.name}</td>
        <td style="${tdStyles};color:${t.tipo === 'Receita' ? '#10b981' : '#ef4444'}">${t.tipo}</td>
        <td style="${tdStyles};font-weight:600">${fmt(t.val)}</td>
        <td style="${tdStyles}"><span style="font-size:10.5px;padding:2px 6px;border-radius:4px;background:${t.status === 'Pago' || t.status === 'Recebido' ? '#dcfce7;color:#15803d' : '#fef3c7;color:#92400e'}">${t.status}</span></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6" style="padding:20px;text-align:center;color:#64748b;font-size:12px">Nenhum lançamento neste período.</td></tr>';
  
  reportDiv.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #6366f1;padding-bottom:16px">
      <div>
        <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.5px">💸 FinanceOS</h1>
        <p style="font-size:12px;color:#64748b;margin:4px 0 0">${subLabel}</p>
      </div>
      <div style="text-align:right">
        <h3 style="font-size:18px;font-weight:750;color:#6366f1;margin:0">${periodLabel}</h3>
        <p style="font-size:11px;color:#64748b;margin:4px 0 0">Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin-top:10px">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
        <p style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin:0 0 6px">Receitas</p>
        <h2 style="font-size:20px;color:#10b981;margin:0">${fmt(totalRec)}</h2>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
        <p style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin:0 0 6px">Despesas</p>
        <h2 style="font-size:20px;color:#ef4444;margin:0">${fmt(totalDesp)}</h2>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
        <p style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin:0 0 6px">Balanço Líquido</p>
        <h2 style="font-size:20px;color:${bal >= 0 ? '#10b981' : '#ef4444'};margin:0">${bal >= 0 ? '+' : ''}${fmt(bal)}</h2>
      </div>
    </div>
    
    <div style="margin-top:10px">
      <h3 style="font-size:14px;font-weight:750;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin:0 0 10px">📊 Despesas por Categoria</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div>${catHtml}</div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
          <p style="font-size:12px;color:#64748b;margin:0 0 6px">Taxa de Poupança</p>
          <h2 style="font-size:26px;font-weight:800;color:#6366f1;margin:0">${totalRec > 0 ? Math.round((bal / totalRec) * 100) : 0}%</h2>
          <p style="font-size:11px;color:#64748b;margin:4px 0 0">dos rendimentos economizados</p>
        </div>
      </div>
    </div>
    
    <div style="margin-top:10px">
      <h3 style="font-size:14px;font-weight:750;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin:0 0 10px">📋 Histórico de Lançamentos</h3>
      <table style="${tableStyles}">
        <thead>
          <tr>
            <th style="${thStyles}">Data</th>
            <th style="${thStyles}">Descrição</th>
            <th style="${thStyles}">Categoria</th>
            <th style="${thStyles}">Tipo</th>
            <th style="${thStyles}">Valor</th>
            <th style="${thStyles}">Status</th>
          </tr>
        </thead>
        <tbody>
          ${txHtml}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top:auto;border-top:1px solid #cbd5e1;padding-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">
      Este relatório foi gerado automaticamente pelo aplicativo FinanceOS. Guarde em local seguro.
    </div>
  `;
  
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  reportDiv.style.position = 'fixed';
  reportDiv.style.left = '0';
  reportDiv.style.top = '0';
  reportDiv.style.zIndex = '-9999';
  reportDiv.style.opacity = '0.01';
  reportDiv.style.width = '790px';
  document.body.appendChild(reportDiv);
  
  if (window.html2pdf) {
    window.html2pdf().set(opt).from(reportDiv).save().then(() => {
      document.body.removeChild(reportDiv);
    }).catch(err => {
      console.error('Erro ao gerar PDF:', err);
      document.body.removeChild(reportDiv);
    });
  } else {
    alert('Erro: Biblioteca de geração de PDF não carregada. Verifique sua conexão.');
    document.body.removeChild(reportDiv);
  }
}

// Bind PDF helper to window so inline onclicks can call it
window.exportWeeklyPDF = exportWeeklyPDF;
