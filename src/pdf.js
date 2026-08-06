import { S, fmt, fmtD, getCat, periodState } from './state.js';

function generateVectorPDF(activeTxs, periodLabel, subLabel, filename) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Calculate totals
  let totalRec = 0;
  let totalDesp = 0;
  activeTxs.forEach(t => {
    if (t.tipo === 'Receita') totalRec += t.val;
    else totalDesp += t.val;
  });
  const bal = totalRec - totalDesp;

  // 1. Draw Header Bar (Clean Apple/Notion Style)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 32, 'F');
  
  // Header bottom border
  doc.setDrawColor(229, 229, 234);
  doc.setLineWidth(0.4);
  doc.line(15, 32, 195, 32);

  doc.setTextColor(29, 29, 31);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('💸 PoupaFy', 15, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(134, 134, 139);
  doc.text(subLabel, 15, 25);

  // Header Right Period info
  doc.setTextColor(29, 29, 31);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(periodLabel, 195, 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(134, 134, 139);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 195, 25, { align: 'right' });

  // 2. KPI Metrics Section (Y = 40)
  // Widths: 53mm each, gaps: 10.5mm
  // Card 1: 15 to 68
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, 40, 53, 22, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEITAS', 41.5, 47, { align: 'center' });
  doc.setTextColor(16, 185, 129); // green
  doc.setFontSize(13);
  doc.text(fmt(totalRec), 41.5, 56, { align: 'center' });

  // Card 2: 78.5 to 131.5
  doc.setFillColor(248, 250, 252);
  doc.rect(78.5, 40, 53, 22, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.text('DESPESAS', 105, 47, { align: 'center' });
  doc.setTextColor(239, 68, 68); // red
  doc.setFontSize(13);
  doc.text(fmt(totalDesp), 105, 56, { align: 'center' });

  // Card 3: 142 to 195
  doc.setFillColor(248, 250, 252);
  doc.rect(142, 40, 53, 22, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.text('BALANÇO LÍQUIDO', 168.5, 47, { align: 'center' });
  doc.setTextColor(bal >= 0 ? 16 : 239, bal >= 0 ? 185 : 68, bal >= 0 ? 129 : 68);
  doc.setFontSize(13);
  doc.text((bal >= 0 ? '+' : '') + fmt(bal), 168.5, 56, { align: 'center' });

  // 3. Category & Savings Rate Cards (Only if not weekly)
  const isWeekly = subLabel.includes('Semanal');
  let tableStartY = 72;

  if (!isWeekly) {
    // Calculate category spending
    const catSpent = {};
    activeTxs.filter(t => t.tipo === 'Despesa').forEach(t => {
      catSpent[t.catId] = (catSpent[t.catId] || 0) + t.val;
    });
    
    // Sort and slice top 4 categories
    const sortedCats = Object.entries(catSpent).sort((a, b) => b[1] - a[1]).slice(0, 4);
    
    // Draw Category Breakdown Card: 15 to 120
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, 72, 105, 42, 'FD');
    
    doc.setTextColor(15, 17, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('DESPESAS POR CATEGORIA (TOP 4)', 20, 79);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    
    let catY = 86;
    if (sortedCats.length === 0) {
      doc.text('Nenhuma despesa registrada no período.', 20, 92);
    } else {
      sortedCats.forEach(([catId, val]) => {
        const c = getCat(catId);
        doc.text(`${c.icon} ${c.name}`, 20, catY);
        doc.text(fmt(val), 115, catY, { align: 'right' });
        catY += 6.5;
      });
    }
    
    // Draw Savings Rate Card: 130 to 195
    doc.setFillColor(248, 250, 252);
    doc.rect(130, 72, 65, 42, 'FD');
    
    doc.setTextColor(15, 17, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('TAXA DE POUPANÇA', 162.5, 79, { align: 'center' });
    
    const savingsPct = totalRec > 0 ? Math.round((bal / totalRec) * 100) : 0;
    doc.setFontSize(20);
    doc.setTextColor(99, 102, 241); // Indigo color
    doc.text(`${savingsPct}%`, 162.5, 94, { align: 'center' });
    
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('dos rendimentos economizados', 162.5, 103, { align: 'center' });
    
    tableStartY = 122;
  }

  // 4. Draw Table Header Row
  doc.setFillColor(15, 17, 26); // dark row
  doc.rect(15, tableStartY, 180, 8, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Data', 18, tableStartY + 5.5);
  doc.text('Descrição', 42, tableStartY + 5.5);
  doc.text('Categoria', 100, tableStartY + 5.5);
  doc.text('Tipo', 142, tableStartY + 5.5);
  doc.text('Valor', 165, tableStartY + 5.5);
  doc.text('Status', 185, tableStartY + 5.5);

  let currentY = tableStartY + 8;

  // 5. Draw Transactions List
  activeTxs.forEach(t => {
    // Page break handling
    if (currentY + 8 > 275) {
      doc.addPage();
      
      // Draw new page table header
      doc.setFillColor(15, 17, 26);
      doc.rect(15, 15, 180, 8, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Data', 18, 20.5);
      doc.text('Descrição', 42, 20.5);
      doc.text('Categoria', 100, 20.5);
      doc.text('Tipo', 142, 20.5);
      doc.text('Valor', 165, 20.5);
      doc.text('Status', 185, 20.5);
      
      currentY = 23;
    }

    const c = getCat(t.catId);
    const dateFormatted = fmtD(t.data);

    // Row separator line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.1);
    doc.line(15, currentY, 195, currentY);

    // Row Text
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    doc.text(dateFormatted, 18, currentY + 5.5);

    // Truncate desc if needed
    let desc = t.desc;
    if (desc.length > 30) desc = desc.slice(0, 28) + '...';
    doc.text(desc, 42, currentY + 5.5);

    // Truncate category if needed
    let catText = `${c.icon} ${c.name}`;
    if (catText.length > 22) catText = catText.slice(0, 20) + '...';
    doc.text(catText, 100, currentY + 5.5);

    // Color code Type column
    if (t.tipo === 'Receita') {
      doc.setTextColor(16, 185, 129); // green
    } else {
      doc.setTextColor(239, 68, 68); // red
    }
    doc.text(t.tipo, 142, currentY + 5.5);

    doc.setTextColor(51, 65, 85);
    doc.text(fmt(t.val), 165, currentY + 5.5);

    // Color code Status column
    if (t.status === 'Pago' || t.status === 'Recebido') {
      doc.setTextColor(21, 128, 61); // dark green text
    } else {
      doc.setTextColor(146, 64, 14); // dark amber text
    }
    doc.text(t.status, 185, currentY + 5.5);

    currentY += 7;
  });

  // Draw bottom line of table
  doc.setDrawColor(226, 232, 240);
  doc.line(15, currentY, 195, currentY);

  // 6. Draw page numbers and footnote on all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`PoupaFy · Relatório Financeiro · Página ${i} de ${pageCount}`, 105, 288, { align: 'center' });
  }

  // Save the PDF
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
  
  const week = weeks[weekIndex];
  
  const activeTxs = S.transactions.filter(t => {
    const d = new Date(t.data + 'T00:00:00');
    if (d.getFullYear() === periodState.currentYear && d.getMonth() === periodState.currentMonth) {
      const day = d.getDate();
      return day >= week.start && day <= week.end;
    }
    return false;
  });

  // Sort by date descending
  activeTxs.sort((a, b) => b.data.localeCompare(a.data));

  generateVectorPDF(
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

  generateVectorPDF(
    activeTxs,
    periodLabel,
    subLabel,
    filename
  );
}

window.exportWeeklyPDF = exportWeeklyPDF;
window.exportMonthlyPDF = exportMonthlyPDF;
