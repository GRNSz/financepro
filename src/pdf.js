import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { S, fmt, fmtD, getCat, periodState } from './state.js';

/**
 * Modern PDF Generator Engine for FinanceOS using jsPDF + autoTable
 */
function generateModernPDF(activeTxs, periodLabel, subLabel, filename) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Ensure autoTable function is bound
  const runAutoTable = doc.autoTable || window.autoTable;

  // Calculate totals
  let totalRec = 0;
  let totalDesp = 0;
  activeTxs.forEach(t => {
    const val = Number(t.val) || 0;
    if (t.tipo === 'Receita') totalRec += val;
    else totalDesp += val;
  });
  const bal = totalRec - totalDesp;
  const savingsRate = totalRec > 0 ? Math.max(0, Math.round((bal / totalRec) * 100)) : 0;

  // 1. TOP HEADER BANNER (Slate Dark Modern Theme)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  // Accent Line
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 34.5, 210, 1.5, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PoupaFy', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(subLabel || 'Relatório de Gestão Financeira Consolidado', 14, 26);

  // Period Badge & Date Right Aligned
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(periodLabel, 196, 17, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 196, 25, { align: 'right' });

  // 2. EXECUTIVE SUMMARY CARDS (KPIs)
  const cardY = 42;
  const cardW = 42;
  const cardH = 22;
  const cardGap = 5.3;

  const kpis = [
    { title: 'RECEITAS', val: fmt(totalRec), color: [16, 185, 129], bg: [240, 253, 244] },
    { title: 'DESPESAS', val: fmt(totalDesp), color: [239, 68, 68], bg: [254, 242, 242] },
    { title: 'SALDO LÍQUIDO', val: (bal >= 0 ? '+' : '') + fmt(bal), color: bal >= 0 ? [16, 185, 129] : [239, 68, 68], bg: [248, 250, 252] },
    { title: 'TAXA POUPANÇA', val: `${savingsRate}%`, color: [139, 92, 246], bg: [245, 243, 255] }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardW + cardGap);
    
    // Fill card background
    doc.setFillColor(...kpi.bg);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, x + cardW / 2, cardY + 7, { align: 'center' });

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.val, x + cardW / 2, cardY + 16, { align: 'center' });
  });

  let currentY = 70;

  // 3. CATEGORY BREAKDOWN TABLE (Top Expenses)
  const catSpent = {};
  activeTxs.filter(t => t.tipo === 'Despesa').forEach(t => {
    const cid = t.catId || 'outros';
    catSpent[cid] = (catSpent[cid] || 0) + (Number(t.val) || 0);
  });

  const sortedCats = Object.entries(catSpent).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (sortedCats.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('📊 Top Categorias de Despesas', 14, currentY);

    const catTableRows = sortedCats.map(([catId, val]) => {
      const c = getCat(catId);
      const pct = totalDesp > 0 ? ((val / totalDesp) * 100).toFixed(1) + '%' : '0%';
      return [`${c.icon} ${c.name}`, fmt(val), pct];
    });

    if (runAutoTable) {
      runAutoTable.call(doc, {
        startY: currentY + 3,
        head: [['Categoria', 'Total Gasto', 'Representação (%)']],
        body: catTableRows,
        margin: { left: 14, right: 14 },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 'auto' },
          1: { halign: 'right' },
          2: { halign: 'right', fontStyle: 'bold' }
        }
      });
      currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY + 30) + 10;
    }
  }

  // 4. DETAILED TRANSACTIONS TABLE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`📑 Lançamentos Detalhados (${activeTxs.length})`, 14, currentY);

  const tableData = activeTxs.map(t => {
    const c = getCat(t.catId);
    let desc = t.desc || '—';
    if (desc.length > 35) desc = desc.slice(0, 32) + '...';
    
    return [
      fmtD(t.data),
      desc,
      `${c.icon} ${c.name}`,
      t.tipo,
      (t.tipo === 'Receita' ? '+ ' : '− ') + fmt(Math.abs(t.val || 0)),
      t.status || 'Pago'
    ];
  });

  if (runAutoTable) {
    runAutoTable.call(doc, {
      startY: currentY + 3,
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status']],
      body: tableData,
      margin: { left: 14, right: 14, bottom: 20 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { cellWidth: 42 },
        3: { cellWidth: 22, fontStyle: 'bold' },
        4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: function (data) {
        if (data.section === 'body') {
          // Color code Type column
          if (data.column.index === 3) {
            if (data.cell.raw === 'Receita') data.cell.styles.textColor = [16, 185, 129];
            else data.cell.styles.textColor = [239, 68, 68];
          }
          // Color code Value column
          if (data.column.index === 4) {
            const rawText = String(data.cell.raw);
            if (rawText.startsWith('+')) data.cell.styles.textColor = [16, 185, 129];
            else data.cell.styles.textColor = [239, 68, 68];
          }
          // Color code Status column
          if (data.column.index === 5) {
            const st = String(data.cell.raw);
            if (st === 'Pago' || st === 'Recebido') data.cell.styles.textColor = [16, 185, 129];
            else data.cell.styles.textColor = [217, 119, 6];
          }
        }
      },
      didDrawPage: function (data) {
        // Page number and footer brand on every page
        const totalPages = doc.internal.getNumberOfPages();
        const pageNum = data.pageNumber;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);

        // Footer top border line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(14, 285, 196, 285);

        doc.text('PoupaFy · Sistema de Gestão Financeira Pessoal', 14, 289);
        doc.text(`Página ${pageNum} de ${totalPages}`, 196, 289, { align: 'right' });
      }
    });
  }

  // 5. SAVE PDF FILE
  doc.save(filename);
}

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
  
  const week = weeks[weekIndex] || weeks[0];
  
  const activeTxs = (S.transactions || []).filter(t => {
    if (!t.data) return false;
    const d = new Date(t.data + 'T00:00:00');
    if (d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth) {
      const day = d.getDate();
      return day >= week.start && day <= week.end;
    }
    return false;
  }).sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  generateModernPDF(
    activeTxs,
    week.label,
    `Relatório Financeiro Semanal · ${mesName} de ${anoVal}`,
    `Relatorio_Semanal_Semana${weekIndex + 1}_${mesName}_${anoVal}.pdf`
  );
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
    activeTxs = (S.transactions || []).filter(t => {
      if (!t.data) return false;
      const d = new Date(t.data + 'T00:00:00');
      return d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth;
    });
  } else if (periodState.currentMode === 'yearly') {
    const anoVal = periodState.currentYear;
    periodLabel = `Ano ${anoVal}`;
    subLabel = 'Relatório Financeiro Anual';
    filename = `Relatorio_Financeiro_Anual_${anoVal}.pdf`;
    activeTxs = (S.transactions || []).filter(t => {
      if (!t.data) return false;
      const d = new Date(t.data + 'T00:00:00');
      return d.getFullYear() === periodState.currentYear;
    });
  } else {
    periodLabel = 'Todo o Período';
    subLabel = 'Relatório Financeiro Consolidado';
    filename = `Relatorio_Financeiro_Consolidado.pdf`;
    activeTxs = Array.isArray(S.transactions) ? [...S.transactions] : [];
  }

  // Sort transactions by date descending
  activeTxs.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  generateModernPDF(
    activeTxs,
    periodLabel,
    subLabel,
    filename
  );
}

if (typeof window !== 'undefined') {
  window.exportWeeklyPDF = exportWeeklyPDF;
  window.exportMonthlyPDF = exportMonthlyPDF;
}
