import { S, save, uid, fmt, fmtD, q, qa, isoToday, closeM } from './state.js';

export let importedTxs = [];

export function predictCategory(desc, type) {
  const cleanDesc = desc.toLowerCase();
  const match = S.transactions.find(t => {
    return t.desc.toLowerCase().includes(cleanDesc) || cleanDesc.includes(t.desc.toLowerCase());
  });
  if (match) return match.catId;
  
  if (cleanDesc.includes('mercado') || cleanDesc.includes('alimento') || cleanDesc.includes('ifood') || cleanDesc.includes('restaurante') || cleanDesc.includes('padaria')) {
    return 'c_alim';
  }
  if (cleanDesc.includes('uber') || cleanDesc.includes('gasolina') || cleanDesc.includes('posto') || cleanDesc.includes('taxi') || cleanDesc.includes('ônibus') || cleanDesc.includes('metrô')) {
    return 'c_trsp';
  }
  if (cleanDesc.includes('aluguel') || cleanDesc.includes('condominio') || cleanDesc.includes('luz') || cleanDesc.includes('energia') || cleanDesc.includes('água') || cleanDesc.includes('gas')) {
    return 'c_mor';
  }
  if (cleanDesc.includes('cinema') || cleanDesc.includes('netflix') || cleanDesc.includes('spotify') || cleanDesc.includes('show') || cleanDesc.includes('jogos') || cleanDesc.includes('steam')) {
    return 'c_laz';
  }
  if (cleanDesc.includes('farmacia') || cleanDesc.includes('drogaria') || cleanDesc.includes('medico') || cleanDesc.includes('hospital') || cleanDesc.includes('consulta')) {
    return 'c_sau';
  }
  if (cleanDesc.includes('curso') || cleanDesc.includes('escola') || cleanDesc.includes('faculdade') || cleanDesc.includes('livro') || cleanDesc.includes('mensalidade')) {
    return 'c_edu';
  }
  if (cleanDesc.includes('shopping') || cleanDesc.includes('loja') || cleanDesc.includes('amazon') || cleanDesc.includes('mercado livre') || cleanDesc.includes('compra')) {
    return 'c_comp';
  }
  return type === 'income' ? 'c_outr' : 'c_out';
}

export function parseXLS(data) {
  const results = [];
  try {
    const workbook = window.XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (rows.length < 2) return [];
    
    const firstRow = rows[0].map(cell => String(cell || '').trim().toLowerCase());
    
    let dateIdx = -1;
    let descIdx = -1;
    let amountIdx = -1;
    let typeIdx = -1;
    
    firstRow.forEach((val, idx) => {
      if (val.includes('data') || val.includes('date') || val.includes('vencimento')) dateIdx = idx;
      else if (val.includes('desc') || val.includes('hist') || val.includes('memo') || val.includes('detalhe') || val.includes('nome')) descIdx = idx;
      else if (val.includes('val') || val.includes('quant') || val.includes('amt') || val.includes('montante') || val.includes('preço')) amountIdx = idx;
      else if (val.includes('tipo') || val.includes('type')) typeIdx = idx;
    });
    
    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = Math.min(1, firstRow.length - 1);
    if (amountIdx === -1) amountIdx = Math.min(2, firstRow.length - 1);
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const rawDate = row[dateIdx];
      const rawDesc = row[descIdx];
      const rawAmt = row[amountIdx];
      
      if (!rawDate || rawAmt === undefined || rawAmt === '') continue;
      
      let dateStr = '';
      if (typeof rawDate === 'number') {
        const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
        if (!isNaN(dateObj.getTime())) {
          dateStr = dateObj.toISOString().split('T')[0];
        }
      } else {
        const strDate = String(rawDate).trim();
        if (strDate.includes('/')) {
          const parts = strDate.split('/');
          if (parts[2] && parts[2].length === 4) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else if (parts[0] && parts[0].length === 4) {
            dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        } else if (strDate.includes('-')) {
          dateStr = strDate.substring(0, 10);
        }
      }
      
      if (!dateStr) dateStr = isoToday();
      
      let val = Math.abs(parseFloat(String(rawAmt).replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.')) || 0);
      if (isNaN(val)) continue;
      
      let type = 'expense';
      if (typeIdx !== -1 && row[typeIdx]) {
        const tStr = String(row[typeIdx]).toLowerCase();
        if (tStr.includes('rec') || tStr.includes('ent') || tStr.includes('inc') || tStr.includes('cred')) {
          type = 'income';
        }
      } else {
        const numAmt = parseFloat(String(rawAmt).replace('R$', '').replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(numAmt) && numAmt >= 0) {
          type = 'income';
        }
      }
      
      results.push({
        id: '_xls_' + Math.random().toString(36).slice(2),
        type: type,
        description: rawDesc ? String(rawDesc).trim() : 'Lançamento Importado',
        amount: val,
        date: dateStr
      });
    }
  } catch (err) {
    console.error('Error parsing Excel file:', err);
  }
  return results;
}

export function parseOFX(text) {
  const results = [];
  const blocks = text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];

  if (blocks.length > 0) {
    blocks.forEach(block => {
      const get = tag => {
        const m = block.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`, 'i'));
        return m ? m[1].trim() : null;
      };
      const rd = get('DTPOSTED') || get('DTTRADE');
      const ra = parseFloat(get('TRNAMT') || '0');
      if (!rd) return;
      const ds = rd.replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3');
      results.push({
        id: uid(),
        type: ra >= 0 ? 'income' : 'expense',
        description: get('MEMO') || get('NAME') || 'Importado',
        amount: Math.abs(ra),
        date: ds
      });
    });
  } else {
    let cur = {};
    text.split('\n').forEach(line => {
      line = line.trim();
      if (line === '<STMTTRN>') {
        cur = {};
        return;
      }
      if (line === '</STMTTRN>') {
        if (cur.date && cur.amount !== undefined) {
          results.push({
            id: uid(),
            type: cur.amount >= 0 ? 'income' : 'expense',
            description: cur.description || 'Importado',
            amount: Math.abs(cur.amount),
            date: cur.date
          });
        }
        cur = {};
        return;
      }
      const m = line.match(/^<([^>]+)>(.*)$/);
      if (!m) return;
      const [, tag, val] = m;
      if (tag === 'DTPOSTED' || tag === 'DTTRADE') {
        cur.date = val.trim().replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3');
      } else if (tag === 'TRNAMT') {
        cur.amount = parseFloat(val.trim().replace(',', '.'));
      } else if (tag === 'MEMO' || tag === 'NAME') {
        cur.description = val.trim();
      }
    });
  }
  return results;
}

export function parseCSV(text) {
  const results = [];
  text.split('\n').forEach(line => {
    const cols = line.split(/[;,]/);
    if (cols.length < 3) return;
    const m = cols[0].trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return;
    const ds = `${m[3]}-${m[2]}-${m[1]}`;
    const v = parseFloat(cols[2].trim().replace(/\./g, '').replace(',', '.'));
    if (isNaN(v) || v === 0) return;
    results.push({
      id: uid(),
      type: v >= 0 ? 'income' : 'expense',
      description: cols[1].trim(),
      amount: Math.abs(v),
      date: ds
    });
  });
  return results;
}

export function populateImportPaymentOptions() {
  const el = q('#import-payment-select');
  if (!el) return;
  el.innerHTML = 
    S.accounts.map(a => `<option value="${a.id}">🏦 ${a.name}</option>`).join('') +
    S.cards.map(c => `<option value="${c.id}">💳 ${c.name}</option>`).join('');
}

export function renderImportPreview(txs) {
  importedTxs = txs;
  populateImportPaymentOptions();
  q('#import-count').textContent = `${txs.length} lançamento(s) encontrado(s)`;
  
  const listEl = q('#import-list');
  if (!listEl) return;
  
  listEl.innerHTML = txs.map((t, idx) => {
    const predictedCat = predictCategory(t.description, t.type);
    const catOptions = S.categories.map(c => {
      const selected = c.id === predictedCat ? 'selected' : '';
      return `<option value="${c.id}" ${selected}>${c.icon} ${c.name}</option>`;
    }).join('');
    
    const color = t.type === 'income' ? 'var(--gr)' : 'var(--rd)';
    const prefix = t.type === 'income' ? '+' : '-';
    
    return `
      <div class="li" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--s3); border: 1px solid var(--bd2); border-radius: 8px;">
        <input type="checkbox" id="chk-import-${idx}" checked style="width: 16px; height: 16px; accent-color: var(--ac); cursor: pointer;">
        
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <span style="font-size: 13px; font-weight: 700; color: var(--tx); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.description}</span>
            <span style="font-size: 13px; font-weight: 800; color: ${color}; white-space: nowrap;">${prefix} ${fmt(t.amount)}</span>
          </div>
          
          <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap;">
            <span style="font-size: 10.5px; color: var(--tx2);">${fmtD(t.date)}</span>
            <span style="color: var(--bd2);">|</span>
            <select id="cat-import-${idx}" class="inp" style="padding: 3px 6px; font-size: 11px; height: auto; width: auto; min-width: 130px; background: var(--s2);">
              ${catOptions}
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  q('#import-preview-area').style.display = 'block';
}

export function selectAllImport(val) {
  importedTxs.forEach((_, idx) => {
    const chk = q(`#chk-import-${idx}`);
    if (chk) chk.checked = val;
  });
}

export function saveImportedTransactions() {
  const payId = q('#import-payment-select').value;
  
  if (!payId) {
    alert('Selecione uma conta ou cartão de destino!');
    return;
  }
  
  const toAdd = [];
  
  importedTxs.forEach((t, idx) => {
    const chk = q(`#chk-import-${idx}`);
    if (chk && chk.checked) {
      const catId = q(`#cat-import-${idx}`).value;
      const tipo = t.type === 'income' ? 'Receita' : 'Despesa';
      const status = tipo === 'Receita' ? 'Recebido' : 'Pago';
      
      toAdd.push({
        id: uid(),
        tipo: tipo,
        desc: t.description,
        val: t.amount,
        catId: catId,
        payId: payId,
        data: t.date,
        status: status,
        inst: null,
        total: null
      });
    }
  });
  
  if (toAdd.length === 0) {
    alert('Nenhum lançamento selecionado para importação!');
    return;
  }
  
  toAdd.forEach(t => {
    S.transactions.unshift(t);
    if (t.status !== 'Pendente') {
      const acc = S.accounts.find(a => a.id === payId);
      if (acc) acc.balance += (t.tipo === 'Receita' ? t.val : -t.val);
    }
  });
  
  save();
  alert(`${toAdd.length} lançamento(s) importado(s) com sucesso!`);
  
  importedTxs = [];
  q('#import-file-input').value = '';
  q('#import-preview-area').style.display = 'none';
  closeM('m-import-extrato');
  
  if (window.applyFilters) window.applyFilters();
  if (window.renderDashboard) window.renderDashboard();
}

export function handleImportFile(file) {
  const reader = new FileReader();
  const extension = file.name.split('.').pop().toLowerCase();
  
  reader.onload = function(e) {
    let parsed = [];
    
    if (extension === 'xls' || extension === 'xlsx') {
      parsed = parseXLS(e.target.result);
    } else {
      const text = e.target.result;
      if (extension === 'ofx' || extension === 'qfx') {
        parsed = parseOFX(text);
      } else if (extension === 'csv') {
        parsed = parseCSV(text);
      }
    }
    
    if (parsed.length === 0) {
      alert('Nenhuma transação encontrada no arquivo ou formato inválido!');
      return;
    }
    
    renderImportPreview(parsed);
  };
  
  if (extension === 'xls' || extension === 'xlsx') {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
}

window.handleImportFile = handleImportFile;
window.selectAllImport = selectAllImport;
window.saveImportedTransactions = saveImportedTransactions;
