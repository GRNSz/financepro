import Chart from 'chart.js/auto';
import { NotificationsListener } from 'capacitor-notifications-listener';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { initDevLogger, setupDevConsolePanel } from './devLogs.js';

if (typeof window !== 'undefined') {
  window.Chart = Chart;
  window.jsPDF = jsPDF;
  window.XLSX = XLSX;
  initDevLogger();
}

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
  setS,
  calendarState
} from './state.js';

import { hashPin, encryptData, decryptData } from './crypto.js';
import { syncPassword } from './firebase.js';
import { redirectToStripeCheckout, handleStripeReturn, openCancelSubscriptionModal, cancelStripeSubscription } from './stripe.js';

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

let paywallCheckedThisSession = false;

function checkPaywallAccess() {
  if (paywallCheckedThisSession) return;
  paywallCheckedThisSession = true;

  const plan = S.subscription?.plan || 'free';
  if (plan === 'free') {
    let count = parseInt(localStorage.getItem('financepro_access_count') || '0', 10);
    count += 1;
    localStorage.setItem('financepro_access_count', count);
    if (count % 3 === 0) {
      openM('paywall-overlay');
    }
  }
}

export function checkSubscriptionExpirationWarning() {
  const sub = S.subscription;
  if (!sub || sub.plan === 'free' || !sub.expiresAt || sub.isLifetime) return;

  const diffMs = sub.expiresAt - Date.now();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  if (daysLeft > 0 && daysLeft <= 5) {
    const warnedKey = `poupafy_exp_warned_${sub.plan}_${daysLeft}`;
    const alreadyWarned = sessionStorage.getItem(warnedKey);
    
    if (!alreadyWarned) {
      sessionStorage.setItem(warnedKey, 'true');
      setTimeout(() => {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:24px;left:24px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:16px 20px;border-radius:14px;font-size:13px;font-weight:700;box-shadow:0 12px 30px rgba(0,0,0,0.5);z-index:999999;animation:fadeup 0.4s ease;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.2);display:flex;flex-direction:column;gap:8px;max-width:340px;';
        toast.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span>⚠️ <b>Aviso: Assinatura Vencendo!</b></span>
            <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:#fff;font-weight:bold;cursor:pointer;">✕</button>
          </div>
          <div style="font-size:12px;font-weight:500;line-height:1.4;">
            Sua assinatura do plano <b>${sub.plan.toUpperCase()}</b> vence em <b>${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}</b>. Renove agora para manter seus recursos premium ativos!
          </div>
          <button onclick="openM('paywall-overlay'); this.parentElement.remove();" style="background:#fff;color:#d97706;border:none;padding:6px 12px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;align-self:flex-start;margin-top:4px;">Renovar Agora 🚀</button>
        `;
        document.body.appendChild(toast);
      }, 1200);
    }
  }
}

registerAuthCallback((user) => {
  window.financeCurrentUser = user;
  if (window.checkAdminView) window.checkAdminView();
  if (window.updateSyncStatusDot) window.updateSyncStatusDot();
  if (user) {
    processRecurringTransactions();
    updateUI();
    // Processar retorno do Stripe APÓS autenticação — garante sincronização com Firestore
    handleStripeReturn();
    checkSubscriptionExpirationWarning();
  }
  checkPaywallAccess();
  window.hideGlobalLoader?.();
});

function initBankNotificationListener() {
  if (typeof window === 'undefined' || !window.Capacitor || !window.Capacitor.isNativePlatform()) return;

  NotificationsListener.isListening().then((res) => {
    if (!res.value) {
      // Opcional: Aqui poderíamos pedir permissão. Mas para ser menos intrusivo, podemos 
      // deixar o usuário ativar manualmente nas configurações se avisarmos em alguma tela,
      // ou apenas chamar:
      NotificationsListener.requestPermission();
    }
  }).catch(e => console.log('Listener init error', e));

  NotificationsListener.addListener('notificationReceivedEvent', (info) => {
    const text = (info.text || info.title || '').toLowerCase();
    
    if (text.includes('aprovada') && (text.includes('compra') || text.includes('pagamento') || text.includes('transfer'))) {
      const match = text.match(/r\$ ?(\d+[.,]\d{2})/i);
      let valueStr = '';
      let valNum = 0;
      if (match) {
        valueStr = ` no valor de R$ ${match[1]}`;
        valNum = parseFloat(match[1].replace(',', '.'));
      }

      if (window.Swal) {
        window.Swal.fire({
          title: 'Transação Detectada!',
          text: `Notamos uma compra aprovada${valueStr}. Deseja lançar no app agora?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sim, lançar!',
          cancelButtonText: 'Não'
        }).then((result) => {
          if (result.isConfirmed) {
            if (window.fillCatSelect) window.fillCatSelect(document.getElementById('tx-cat'), 'Despesa');
            if (window.fillPaySelect) window.fillPaySelect(document.getElementById('tx-conta'));
            openM('m-tx');
            if (valNum > 0) document.getElementById('tx-val').value = valNum.toFixed(2);
            if (window.setTxType) window.setTxType('Despesa');
            else document.getElementById('tx-tipo').value = 'Despesa';
            document.getElementById('tx-desc').value = info.title || 'Compra Automática';
          }
        });
      } else {
        if (confirm(`Notamos uma compra aprovada${valueStr}. Deseja lançar no app agora?`)) {
          if (window.fillCatSelect) window.fillCatSelect(document.getElementById('tx-cat'), 'Despesa');
          if (window.fillPaySelect) window.fillPaySelect(document.getElementById('tx-conta'));
          openM('m-tx');
          if (valNum > 0) document.getElementById('tx-val').value = valNum.toFixed(2);
          if (window.setTxType) window.setTxType('Despesa');
          else document.getElementById('tx-tipo').value = 'Despesa';
          document.getElementById('tx-desc').value = info.title || 'Compra Automática';
        }
      }
    }
  });

  NotificationsListener.startListening({ cacheNotifications: false }).catch(e => console.log(e));
}

document.addEventListener('DOMContentLoaded', function() {
  // 1. Synchronously load state from LocalStorage to prevent crashes
  load();
  processRecurringTransactions();
  initBankNotificationListener();

  // 2. Configure Chart.js Defaults if present
  if (window.Chart) {
    window.Chart.defaults.color = '#7c849c';
    window.Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  }

  // 2b. Registro do PWA ServiceWorker & Instalação
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('PWA ServiceWorker registrado:', reg.scope))
      .catch(err => console.warn('Erro ao registrar ServiceWorker:', err));
  }

  let deferredPrompt;
  const btnInstallPWA = q('#btnInstallPWA');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstallPWA) {
      btnInstallPWA.style.display = 'inline-block';
    }
  });

  btnInstallPWA?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      if (btnInstallPWA) btnInstallPWA.style.display = 'none';
    }
    deferredPrompt = null;
  });

  // Seletor de meses da Projeção de Fluxo de Caixa
  q('#projecaoMonths')?.addEventListener('change', () => {
    if (window.renderProjecaoFluxoCaixa) window.renderProjecaoFluxoCaixa();
  });

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

  setupDevConsolePanel();

  // Mobile menu sidebar toggle
  q('#menuBtn')?.addEventListener('click', () => {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    sb?.classList.toggle('open');
    if (ov) ov.classList.toggle('open', sb?.classList.contains('open'));
  });

  // Close sidebar on overlay click (mobile viewports)
  q('#sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
  });

  // Close sidebar on outside click (mobile viewports)
  document.addEventListener('click', (e) => {
    const sb = document.getElementById('sidebar');
    const menuBtn = q('#menuBtn');
    const ov = document.getElementById('sidebar-overlay');
    if (window.innerWidth <= 768 && sb?.classList.contains('open') && !sb.contains(e.target) && e.target !== menuBtn && e.target !== ov) {
      sb.classList.remove('open');
      if (ov) ov.classList.remove('open');
    }
  });

  // 5. Modal Close Controls
  qa('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeM(btn.dataset.close));
  });

  qa('.mbd').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el) closeM(el.id);
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

  window.setTxType = function(type) {
    const hiddenSelect = q('#tx-tipo');
    if (hiddenSelect) hiddenSelect.value = type;
    
    const btnExp = q('#btnTypeExpense');
    const btnInc = q('#btnTypeIncome');
    const valInput = q('#tx-val');
    
    if (type === 'Despesa') {
      if (btnExp) {
        btnExp.style.background = 'rgba(239, 68, 68, 0.15)';
        btnExp.style.borderColor = 'var(--rd)';
        btnExp.style.color = 'var(--rd)';
      }
      if (btnInc) {
        btnInc.style.background = 'transparent';
        btnInc.style.borderColor = 'transparent';
        btnInc.style.color = 'var(--tx2)';
      }
      if (valInput) valInput.style.color = 'var(--rd)';
    } else {
      if (btnInc) {
        btnInc.style.background = 'rgba(16, 185, 129, 0.15)';
        btnInc.style.borderColor = 'var(--gr)';
        btnInc.style.color = 'var(--gr)';
      }
      if (btnExp) {
        btnExp.style.background = 'transparent';
        btnExp.style.borderColor = 'transparent';
        btnExp.style.color = 'var(--tx2)';
      }
      if (valInput) valInput.style.color = 'var(--gr)';
    }
    
    fillCatSelect(q('#tx-cat'), type);
    const statusEl = q('#tx-status');
    if (statusEl) {
      statusEl.value = type === 'Receita' ? 'Recebido' : 'Pago';
    }
    updateTxLivePreview();
  };

  window.setTxQuickDate = function(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().split('T')[0];
    const input = q('#tx-data');
    if (input) input.value = iso;
  };

  q('#tx-tipo')?.addEventListener('change', () => {
    const val = q('#tx-tipo').value;
    window.setTxType(val);
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

  q('#btnQuickAddCat')?.addEventListener('click', () => {
    const txType = q('#tx-tipo')?.value || 'Despesa';
    if (q('#cat-tipo')) q('#cat-tipo').value = txType === 'Receita' ? 'income' : 'expense';
    openM('m-cat');
  });

  q('#tx-cat')?.addEventListener('change', function() {
    if (this.value === '__NEW_CAT__') {
      const txType = q('#tx-tipo')?.value || 'Despesa';
      if (q('#cat-tipo')) q('#cat-tipo').value = txType === 'Receita' ? 'income' : 'expense';
      openM('m-cat');
      // Reseta para a primeira opção válida temporariamente até salvar
      const opts = Array.from(this.options);
      if (opts.length > 1) this.value = opts[0].value;
    }
  });

  ['#tx-val', '#tx-conta', '#tx-tipo', '#tx-cat', '#tx-status', '#tx-is-installment', '#tx-inst'].forEach(sel => {
    const el = q(sel);
    if (el) {
      el.addEventListener('input', updateTxLivePreview);
      el.addEventListener('change', updateTxLivePreview);
    }
  });

  // 📷 Função de Compressão Ultra-Leve em WebP (KBs mantendo nitidez de texto)
  function compressImageToWebP(file, maxDimension = 1000, quality = 0.72) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ dataUrl: e.target.result, sizeKb: Math.round(e.target.result.length / 1024) });
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let compressedDataUrl = canvas.toDataURL('image/webp', quality);
          if (!compressedDataUrl.startsWith('data:image/webp')) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          const sizeKb = Math.round((compressedDataUrl.length * 0.75) / 1024);
          resolve({ dataUrl: compressedDataUrl, sizeKb, width, height });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 📷 Leitor de Comprovante por Foto / OCR com Tesseract.js (IA de leitura de pixels)
  q('#btnScanReceipt')?.addEventListener('click', () => {
    q('#tx-scan-file')?.click();
  });

  q('#tx-scan-file')?.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const btn = q('#btnScanReceipt');
    if (btn) btn.textContent = '⚡ Otimizando imagem e extraindo dados por IA...';

    try {
      // 1. Comprime a imagem mantendo alta resolução e nitidez para OCR
      const { dataUrl, sizeKb } = await compressImageToWebP(file, 1200, 0.85);

      const receiptDataInput = q('#tx-receipt-data');
      if (receiptDataInput) receiptDataInput.value = dataUrl;
      const previewWrap = q('#tx-receipt-preview-wrap');
      const previewImg = q('#tx-receipt-preview-img');
      const receiptName = q('#tx-receipt-name');
      if (previewWrap && previewImg) {
        previewImg.src = dataUrl;
        previewWrap.style.display = 'flex';
        if (receiptName) receiptName.textContent = `Foto (${sizeKb} KB)`;
      }

      // 2. Importa e executa Tesseract OCR em Português
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('por');
      const ret = await worker.recognize(dataUrl);
      await worker.terminate();

      const extractedText = ret.data.text || '';
      console.log('📝 OCR Texto Extraído:', extractedText);

      // 3. Parser Inteligente do Conteúdo Lido na Imagem
      let val = '';
      let dateIso = '';
      let desc = '';
      let location = '';
      let tags = [];

      // A) Extração do Valor (R$)
      const valRegexes = [
        /(?:valor|total|pago|recebido|líquido|bruto|r\$)\s*[:=]?\s*r?\$?\s*(\d+[.,]\d{2})/i,
        /r\$\s*(\d+[.,]\d{2})/i,
        /(\d+[.,]\d{2})/g
      ];

      for (const reg of valRegexes) {
        const match = extractedText.match(reg);
        if (match) {
          if (Array.isArray(match) && !match[1]) {
            const nums = match.map(v => parseFloat(v.replace('.', '').replace(',', '.'))).filter(n => !isNaN(n) && n > 0);
            if (nums.length > 0) {
              val = Math.max(...nums).toFixed(2);
              break;
            }
          } else if (match[1]) {
            val = match[1].replace(/\./g, '').replace(',', '.');
            break;
          }
        }
      }

      // Fallback para nome do arquivo se não achar no texto
      if (!val) {
        const valMatchFile = file.name.match(/(?:R\$|R)?\s*(\d+[\.,]\d{2})/i);
        if (valMatchFile) val = valMatchFile[1].replace(',', '.');
      }

      // B) Extração de Data (DD/MM/YYYY ou DD/MM/YY)
      const dateMatch = extractedText.match(/(\d{2})[\/\.-](\d{2})[\/\.-](\d{4}|\d{2})/);
      if (dateMatch) {
        const d = dateMatch[1].padStart(2, '0');
        const m = dateMatch[2].padStart(2, '0');
        let y = dateMatch[3];
        if (y.length === 2) y = '20' + y;
        dateIso = `${y}-${m}-${d}`;
      }

      // C) Reconhecimento de Tipo, Estabelecimento e Tags
      const textUpper = (extractedText + ' ' + file.name).toUpperCase();

      if (textUpper.includes('PIX')) {
        desc = 'Pagamento Pix';
        tags.push('#pix');
      } else if (textUpper.includes('CARREFOUR') || textUpper.includes('MERCADO') || textUpper.includes('SUPERMERCADO') || textUpper.includes('EXTRA') || textUpper.includes('ASSAI') || textUpper.includes('ATACADAO')) {
        desc = 'Supermercado';
        location = 'Supermercado';
        tags.push('#mercado');
      } else if (textUpper.includes('POSTO') || textUpper.includes('SHELL') || textUpper.includes('IPIRANGA') || textUpper.includes('PETROBRAS') || textUpper.includes('GASOLINA')) {
        desc = 'Combustível';
        location = 'Posto de Gasolina';
        tags.push('#combustivel');
      } else if (textUpper.includes('IFOOD') || textUpper.includes('UBER EATS') || textUpper.includes('RESTAURANTE') || textUpper.includes('LANCHONETE')) {
        desc = 'Alimentação / Refeição';
        location = 'Restaurante';
        tags.push('#ifood', '#alimentacao');
      } else if (textUpper.includes('FARMACIA') || textUpper.includes('DROGARIA') || textUpper.includes('DROGASIL') || textUpper.includes('PAGUE MENOS')) {
        desc = 'Farmácia';
        location = 'Farmácia';
        tags.push('#saude', '#farmacia');
      } else if (textUpper.includes('UBER') || textUpper.includes('99') || textUpper.includes('TAXI')) {
        desc = 'Corrida Uber / 99';
        location = 'Uber';
        tags.push('#transporte');
      } else {
        const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 3 && !l.includes('HTTP'));
        if (lines.length > 0) {
          desc = lines[0].substring(0, 30);
          location = lines[0].substring(0, 25);
        } else {
          desc = 'Comprovante Pagamento';
        }
        tags.push('#comprovante');
      }

      // D) Preenchimento nos campos do formulário
      const valInput = q('#tx-val');
      if (valInput && val) valInput.value = val;

      const descInput = q('#tx-desc');
      if (descInput) descInput.value = desc;

      const locInput = q('#tx-location');
      if (locInput && location) locInput.value = location;

      const dateInput = q('#tx-data');
      if (dateInput && dateIso) dateInput.value = dateIso;

      const tagsInput = q('#tx-tags');
      if (tagsInput && tags.length > 0) {
        tagsInput.value = tags.join(' ');
      }

      if (btn) btn.textContent = `✨ Conteúdo lido com sucesso! (${sizeKb} KB)`;
      setTimeout(() => {
        if (btn) btn.textContent = '📷 Ler Comprovante por Foto (Preenchimento IA)';
      }, 4000);
    } catch (err) {
      console.error('Erro ao ler comprovante via OCR:', err);
      if (btn) btn.textContent = '📷 Ler Comprovante por Foto (Preenchimento IA)';
    }
  });

  // 📎 Anexo manual de comprovante
  q('#btnAttachReceipt')?.addEventListener('click', () => {
    q('#tx-receipt-input')?.click();
  });

  q('#tx-receipt-input')?.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { dataUrl, sizeKb } = await compressImageToWebP(file);
      const receiptDataInput = q('#tx-receipt-data');
      if (receiptDataInput) receiptDataInput.value = dataUrl;
      const previewWrap = q('#tx-receipt-preview-wrap');
      const previewImg = q('#tx-receipt-preview-img');
      const receiptName = q('#tx-receipt-name');
      if (previewWrap && previewImg) {
        previewImg.src = dataUrl;
        previewWrap.style.display = 'flex';
        if (receiptName) receiptName.textContent = `Foto (${sizeKb} KB)`;
      }
    } catch (err) {
      console.error('Erro ao comprimir anexo:', err);
    }
  });

  q('#btnRemoveReceipt')?.addEventListener('click', () => {
    const receiptDataInput = q('#tx-receipt-data');
    if (receiptDataInput) receiptDataInput.value = '';
    const previewWrap = q('#tx-receipt-preview-wrap');
    if (previewWrap) previewWrap.style.display = 'none';
    const receiptName = q('#tx-receipt-name');
    if (receiptName) receiptName.textContent = 'Sem foto';
    const fileInput = q('#tx-receipt-input');
    if (fileInput) fileInput.value = '';
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

    const location = q('#tx-location')?.value.trim() || '';
    const receiptData = q('#tx-receipt-data')?.value || null;

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
        t.location = location;
        t.receiptData = receiptData;
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
            desc: `${desc} (${i}/${inst})`,
            val: splitVal,
            origVal: splitOrigVal,
            currency,
            rate,
            tags,
            location,
            receiptData,
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
          location,
          receiptData,
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
      const maxAccounts = plan === 'pro' ? 5 : (plan === 'plus' ? 2 : 1);
      if (S.accounts.length >= maxAccounts) {
        const planName = plan === 'pro' ? 'Pro (máximo 5 contas)' : (plan === 'plus' ? 'Plus (máximo 2 contas)' : 'Grátis (máximo 1 conta)');
        alert(`Seu plano ${planName} atingiu o limite de ${maxAccounts} conta(s) bancária(s). Faça upgrade para aumentar seu limite!`);
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
    
    const newCatId = 'cc_' + uid();
    S.categories.push({ id: newCatId, name: nome, type: tipo, icon: ico, color: cor });
    save();
    closeM('m-cat');
    setActiveCT(tipo);
    qa('.ctab').forEach(t => t.classList.toggle('on', t.dataset.ct === tipo));
    renderCatGrid();

    // Se o modal de lançamento estiver visível, atualiza o dropdown e seleciona a nova categoria criada
    const txCatSelect = q('#tx-cat');
    const txModal = q('#m-tx');
    if (txCatSelect && txModal && !txModal.hidden) {
      const currentTxType = q('#tx-tipo')?.value || 'Despesa';
      fillCatSelect(txCatSelect, currentTxType);
      txCatSelect.value = newCatId;
    }
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
    const val = parseFloat(q('#sv-val').value) || 0;
    const data = q('#sv-data').value;
    const desc = q('#sv-desc').value.trim();

    S.savings.push({
      id: uid(),
      val: val,
      data: data,
      desc: desc
    });
    
    save();
    closeM('m-saving');
    renderGuardado();
    renderDashboard();

    if (val > 0) {
      if (window.Swal) {
        window.Swal.fire({
          title: 'Lançar Despesa?',
          text: `Deseja lançar essa reserva de R$ ${val.toFixed(2)} como uma despesa em seus Lançamentos?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sim',
          cancelButtonText: 'Não'
        }).then((result) => {
          if (result.isConfirmed) {
            if (window.fillCatSelect) window.fillCatSelect(q('#tx-cat'), 'Despesa');
            if (window.fillPaySelect) window.fillPaySelect(q('#tx-conta'));
            openM('m-tx');
            if (window.setTxType) window.setTxType('Despesa');
            else if (q('#tx-tipo')) q('#tx-tipo').value = 'Despesa';
            if (q('#tx-val')) q('#tx-val').value = val.toFixed(2);
            if (q('#tx-data')) q('#tx-data').value = data;
            if (q('#tx-desc')) q('#tx-desc').value = 'Dinheiro Guardado' + (desc ? ` - ${desc}` : '');
            if (q('#tx-status')) q('#tx-status').value = 'Pago';
          }
        });
      } else {
        if (confirm(`Deseja lançar essa reserva de R$ ${val.toFixed(2)} como uma despesa em seus Lançamentos?`)) {
          if (window.fillCatSelect) window.fillCatSelect(q('#tx-cat'), 'Despesa');
          if (window.fillPaySelect) window.fillPaySelect(q('#tx-conta'));
          openM('m-tx');
          if (window.setTxType) window.setTxType('Despesa');
          else if (q('#tx-tipo')) q('#tx-tipo').value = 'Despesa';
          if (q('#tx-val')) q('#tx-val').value = val.toFixed(2);
          if (q('#tx-data')) q('#tx-data').value = data;
          if (q('#tx-desc')) q('#tx-desc').value = 'Dinheiro Guardado' + (desc ? ` - ${desc}` : '');
          if (q('#tx-status')) q('#tx-status').value = 'Pago';
        }
      }
    }
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
    a.download = 'financepro-backup-' + isoToday() + '.json';
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

  q('#f-suporte-ticket')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const subject = q('#support-subject-input').value.trim();
    const category = q('#support-category-input').value;
    const message = q('#support-message-input').value.trim();
    const attachLogs = q('#support-attach-logs').checked;
    
    const name = q('#support-name-input')?.value.trim() || 'Usuário Local';
    const email = q('#support-email-input')?.value.trim() || 'local@financepro.app';
    
    let logsText = '';
    if (attachLogs && window.devLogs) {
      logsText = window.devLogs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.msg}`).join('\n');
    }
    
    const ticketId = 'tk_' + uid();
    const newTicket = {
      id: ticketId,
      name,
      email,
      subject,
      category,
      message,
      logs: logsText,
      date: new Date().toLocaleDateString('pt-BR'),
      status: 'Enviado'
    };
    
    if (!Array.isArray(S.supportTickets)) {
      S.supportTickets = [];
    }
    S.supportTickets.unshift(newTicket);
    save();
    
    const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'suporte@financepro.app';
    const emailSubject = `[FinancePro Suporte] [${category.toUpperCase()}] ${subject}`;
    
    let emailBody = `Olá, gostaria de abrir um chamado de suporte.\n\n`;
    emailBody += `=== DETALHES DO CHAMADO ===\n`;
    emailBody += `ID: ${ticketId}\n`;
    emailBody += `Data: ${newTicket.date}\n`;
    emailBody += `Nome: ${name}\n`;
    emailBody += `E-mail: ${email}\n`;
    emailBody += `Categoria: ${category}\n`;
    emailBody += `Assunto: ${subject}\n\n`;
    emailBody += `Mensagem:\n${message}\n\n`;
    
    if (attachLogs && logsText) {
      emailBody += `=== LOGS DO SISTEMA ===\n`;
      emailBody += `${logsText}\n`;
    }
    
    const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    window.open(mailtoUrl, '_blank');
    
    const statusMsg = q('#support-status-msg');
    if (statusMsg) {
      statusMsg.innerHTML = `<span style="color:#10b981">Chamado criado! Caso seu app de e-mail não abra, envie para ${supportEmail}.</span>`;
      setTimeout(() => {
        statusMsg.innerHTML = '';
      }, 6000);
    }
    
    q('#support-subject-input').value = '';
    q('#support-message-input').value = '';
    q('#support-attach-logs').checked = false;
    
    if (window.renderSuporte) {
      window.renderSuporte();
    }
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



  q('#btnConfirmImport')?.addEventListener('click', saveImportedTransactions);
  q('#btnCancelImport')?.addEventListener('click', () => {
    if (generalFileInput) generalFileInput.value = '';
    const previewArea = q('#import-preview-area');
    if (previewArea) previewArea.style.display = 'none';
    closeM('m-import-extrato');
  });
  q('#btnOpenImportExtrato')?.addEventListener('click', () => openM('m-import-extrato'));

  // 18. Theme Manager (Light/Dark and Premium Themes)
  function applyTheme(theme) {
    document.body.classList.remove('light', 'midnight', 'forest', 'sakura', 'cyberpunk');
    
    let icon = '🌙';
    if (theme === 'light') {
      document.body.classList.add('light');
      icon = '☀️';
      if (window.Chart) window.Chart.defaults.color = '#475569';
    } else if (theme === 'midnight') {
      document.body.classList.add('midnight');
      icon = '🌌';
      if (window.Chart) window.Chart.defaults.color = '#94a3b8';
    } else if (theme === 'forest') {
      document.body.classList.add('forest');
      icon = '🌲';
      if (window.Chart) window.Chart.defaults.color = '#a7f3d0';
    } else if (theme === 'sakura') {
      document.body.classList.add('sakura');
      icon = '🌸';
      if (window.Chart) window.Chart.defaults.color = '#be123c';
    } else if (theme === 'cyberpunk') {
      document.body.classList.add('cyberpunk');
      icon = '⚡';
      if (window.Chart) window.Chart.defaults.color = '#9b9bbd';
    } else { // default dark
      icon = '🌙';
      if (window.Chart) window.Chart.defaults.color = '#7c849c';
    }

    const sbIcon = q('#themeToggleSidebar .ni');
    if (sbIcon) sbIcon.textContent = icon;
    const ttBtn = q('#themeToggle');
    if (ttBtn) ttBtn.textContent = icon;
    
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

  qa('#themeToggle, #themeToggleSidebar').forEach(btn => {
    btn.addEventListener('click', () => {
      const themes = ['dark', 'light', 'midnight', 'forest', 'sakura', 'cyberpunk'];
      const currentTheme = localStorage.getItem('theme') || 'dark';
      let nextIdx = themes.indexOf(currentTheme) + 1;
      if (nextIdx >= themes.length) nextIdx = 0;
      const newTheme = themes[nextIdx];
      localStorage.setItem('theme', newTheme);
      applyTheme(newTheme);
    });
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
    calendarState.currentMonth--;
    if (calendarState.currentMonth < 0) {
      calendarState.currentMonth = 11;
      calendarState.currentYear--;
    }
    renderCalendar();
  });

  q('#calNextBtn')?.addEventListener('click', () => {
    calendarState.currentMonth++;
    if (calendarState.currentMonth > 11) {
      calendarState.currentMonth = 0;
      calendarState.currentYear++;
    }
    renderCalendar();
  });

  // Exportar para Google Agenda / Outlook / Apple Agenda via .ics
  q('#btnExportICS')?.addEventListener('click', () => {
    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PoupaFy//Controle Financeiro//PT\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:PoupaFy - Lançamentos e Contas\r\n";

    const txs = S.transactions || [];
    if (txs.length === 0) {
      alert("Nenhum lançamento encontrado para exportar para o Google Agenda.");
      return;
    }

    txs.forEach(t => {
      if (!t.data) return;
      const cleanDate = t.data.replace(/-/g, '');
      const uidStr = `poupafy-${t.id || Math.random().toString(36).substring(2)}`;
      const summary = `${t.tipo === 'Receita' ? '🟢' : '🔴'} ${t.desc} (${fmt(t.val)})`;
      const description = `Lançamento PoupaFy: ${t.tipo} de ${fmt(t.val)} - Status: ${t.status || 'Pendente'}`;

      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += `UID:${uidStr}\r\n`;
      icsContent += `DTSTART;VALUE=DATE:${cleanDate}\r\n`;
      icsContent += `DTEND;VALUE=DATE:${cleanDate}\r\n`;
      icsContent += `SUMMARY:${summary}\r\n`;
      icsContent += `DESCRIPTION:${description}\r\n`;
      icsContent += "STATUS:CONFIRMED\r\n";
      icsContent += "END:VEVENT\r\n";
    });

    icsContent += "END:VCALENDAR\r\n";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poupafy-google-agenda-${new Date().toISOString().substring(0, 10)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    alert("📅 Arquivo da Agenda (.ics) gerado com sucesso!\n\nNo Google Agenda (calendar.google.com):\n1. Clique na engrenagem ⚙️ (Configurações)\n2. Acesse 'Importar e Exportar'\n3. Selecione este arquivo para sincronizar todas as suas contas!");
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



  // 22. App reset
  q('#btnReset')?.addEventListener('click', () => {
    if (confirm('Apagar TODOS os dados? Isso não pode ser desfeito!')) {
      const cleanState = initState();
      setS(cleanState);
      save();
      
      if (db && currentUser && !currentUser.isAnonymous) {
        const resetPromise = syncPassword
          ? encryptData(JSON.stringify(cleanState), syncPassword)
              .then(encrypted => db.collection('users').doc(currentUser.uid).set(encrypted))
          : db.collection('users').doc(currentUser.uid).set(cleanState);
          
        resetPromise
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
    aiKeyInput.value = localStorage.getItem('financepro_ai_api_key') || localStorage.getItem('financeos_ai_api_key') || '';
  }

  q('#btnSaveAIKey')?.addEventListener('click', async () => {
    const key = q('#ai-api-key-input').value.trim();
    if (key) {
      localStorage.setItem('financepro_ai_api_key', key);
    } else {
      localStorage.removeItem('financepro_ai_api_key');
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

  // ─── NGROK REMOTE ACCESS TUNNEL ─────────────────────────────────────────────
  const btnToggleNgrok = q('#btnToggleNgrok');
  const btnCopyNgrokUrl = q('#btnCopyNgrokUrl');
  const ngrokStatusDesc = q('#ngrok-status-desc');
  const ngrokUrlContainer = q('#ngrok-url-container');
  const ngrokUrlInput = q('#ngrok-url-input');

  const isCapacitor = !!window.Capacitor && window.Capacitor.isNative;
  if (isCapacitor) {
    const ngrokCard = btnToggleNgrok?.closest('.card');
    if (ngrokCard) {
      ngrokCard.style.display = 'none';
    }
  }

  let ngrokActive = false;

  async function updateNgrokStatus() {
    try {
      const res = await fetch('/api/tunnel');
      if (res.ok) {
        const data = await res.json();
        if (data.active && data.url) {
          ngrokActive = true;
          if (btnToggleNgrok) {
            btnToggleNgrok.textContent = 'Parar Túnel';
            btnToggleNgrok.className = 'brd sm';
          }
          if (ngrokStatusDesc) {
            ngrokStatusDesc.innerHTML = `<span style="color:var(--gr); font-weight:bold;">● Ativo e acessível publicamente</span>`;
          }
          if (ngrokUrlContainer) ngrokUrlContainer.style.display = 'block';
          if (ngrokUrlInput) ngrokUrlInput.value = data.url;
        } else {
          ngrokActive = false;
          if (btnToggleNgrok) {
            btnToggleNgrok.textContent = 'Iniciar Túnel';
            btnToggleNgrok.className = 'bp sm';
          }
          if (ngrokStatusDesc) {
            ngrokStatusDesc.textContent = 'O túnel está inativo no momento.';
          }
          if (ngrokUrlContainer) ngrokUrlContainer.style.display = 'none';
          if (ngrokUrlInput) ngrokUrlInput.value = '';
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar status do túnel ngrok:', err);
    }
  }

  btnToggleNgrok?.addEventListener('click', async () => {
    btnToggleNgrok.disabled = true;
    const originalText = btnToggleNgrok.textContent;
    btnToggleNgrok.textContent = ngrokActive ? 'Parando...' : 'Iniciando...';

    try {
      const res = await fetch('/api/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: ngrokActive ? 'stop' : 'start' })
      });
      const data = await res.json();
      if (data.success) {
        if (!ngrokActive) {
          alert('Túnel ngrok criado com sucesso! Sua aplicação agora está visível publicamente.');
        } else {
          alert('Túnel ngrok encerrado.');
        }
        await updateNgrokStatus();
      } else {
        alert('Erro ao gerenciar o túnel ngrok: ' + (data.error || 'Erro desconhecido'));
        btnToggleNgrok.textContent = originalText;
      }
    } catch (err) {
      alert('Falha na comunicação com o servidor local.');
      btnToggleNgrok.textContent = originalText;
    } finally {
      btnToggleNgrok.disabled = false;
    }
  });

  btnCopyNgrokUrl?.addEventListener('click', () => {
    if (ngrokUrlInput && ngrokUrlInput.value) {
      navigator.clipboard.writeText(ngrokUrlInput.value)
        .then(() => alert('URL copiada para a área de transferência!'))
        .catch(err => alert('Falha ao copiar: ' + err));
    }
  });

  const btnSaveNgrokToken = q('#btnSaveNgrokToken');
  const ngrokTokenInput = q('#ngrok-token-input');

  if (ngrokTokenInput) {
    ngrokTokenInput.value = localStorage.getItem('financepro_ngrok_authtoken') || '';
  }

  btnSaveNgrokToken?.addEventListener('click', async () => {
    const token = ngrokTokenInput.value.trim();
    if (!token) {
      alert('Por favor, insira um token válido.');
      return;
    }

    btnSaveNgrokToken.disabled = true;
    btnSaveNgrokToken.textContent = 'Salvando...';

    try {
      const res = await fetch('/api/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-token', token })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('financepro_ngrok_authtoken', token);
        alert('Authtoken do ngrok configurado com sucesso no sistema local!');
      } else {
        alert('Erro ao salvar token: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      alert('Falha na comunicação com o servidor local.');
    } finally {
      btnSaveNgrokToken.disabled = false;
      btnSaveNgrokToken.textContent = 'Salvar';
    }
  });

  // Consultar status ao inicializar
  updateNgrokStatus();

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
  q('#btnForceUploadCloud')?.addEventListener('click', async () => {
    if (!db || !currentUser || currentUser.isAnonymous) {
      alert('Você não está conectado a uma conta na nuvem.');
      return;
    }
    if (confirm('Tem certeza que deseja SOBRESCREVER os dados da nuvem com os dados locais desta máquina? Esta ação substituirá o banco de dados na nuvem.')) {
      const btn = q('#btnForceUploadCloud');
      if (btn) btn.disabled = true;
      
      try {
        const dataToSave = syncPassword 
          ? await encryptData(JSON.stringify(S), syncPassword) 
          : S;
          
        await db.collection('users').doc(currentUser.uid).set(dataToSave);
        alert('Dados locais enviados para a nuvem com sucesso!');
      } catch (err) {
        console.error('Erro ao enviar dados para a nuvem:', err);
        alert('Erro ao enviar dados: ' + err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
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
        .then(async doc => {
          if (doc.exists) {
            const remoteData = doc.data();
            let stateToLoad = remoteData;
            
            if (remoteData.encrypted) {
              if (!syncPassword) {
                alert('Erro: Seus dados na nuvem estão criptografados, mas a senha de sincronização local não foi configurada.');
                return;
              }
              try {
                const decryptedStr = await decryptData(remoteData, syncPassword);
                stateToLoad = JSON.parse(decryptedStr);
              } catch (decErr) {
                console.error('Failed to decrypt data on manual download:', decErr);
                alert('Erro ao descriptografar os dados baixados: senha incorreta ou dados corrompidos.');
                return;
              }
            }
            
            setS(stateToLoad);
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



  loadFirebaseConfig();
  initFirebase();
  checkGuestLogin(updateUI);

  // 29b. Premium Features Init
  // Stealth Mode Toggle
  const btnStealth = q('#btnStealthToggle');
  let isStealth = (localStorage.getItem('financepro_stealth') || localStorage.getItem('financeos_stealth')) === 'true';
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
    localStorage.setItem('financepro_stealth', isStealth);
    if (isStealth) {
      localStorage.setItem('financepro_stealth_activated', 'true');
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
    exportCalendarICS(calendarState.currentYear, calendarState.currentMonth);
  });

  // Browser Notifications checkbox & request permission
  const chkNotif = q('#chkNotifications');
  if (chkNotif) {
    chkNotif.checked = (localStorage.getItem('financepro_notifications') || localStorage.getItem('financeos_notifications')) === 'true';
    chkNotif.addEventListener('change', function() {
      localStorage.setItem('financepro_notifications', this.checked);
      if (this.checked) {
        if ('Notification' in window) {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('FinancePro', {
                body: 'Notificações ativadas com sucesso! 🔔'
              });
            } else {
              alert('Permissão de notificação negada pelo navegador.');
              this.checked = false;
              localStorage.setItem('financepro_notifications', 'false');
            }
          });
         } else {
          alert('Este navegador não suporta notificações de área de trabalho.');
          this.checked = false;
          localStorage.setItem('financepro_notifications', 'false');
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
      chkPinEnabled.checked = (localStorage.getItem('financepro_pin_enabled') || localStorage.getItem('financeos_pin_enabled')) === 'true';
    }
  }
  updatePinCheckbox();

  // Configuração do PIN Modal
  btnConfigurePin?.addEventListener('click', () => {
    const hasPin = !!(localStorage.getItem('financepro_pin_code') || localStorage.getItem('financeos_pin_code'));
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
  btnDisablePin?.addEventListener('click', async () => {
    const storedPin = localStorage.getItem('financepro_pin_code') || localStorage.getItem('financeos_pin_code');
    const currentVal = pinCurrent ? pinCurrent.value : '';
    
    const hashedCurrent = await hashPin(currentVal);
    if (hashedCurrent !== storedPin) {
      alert('PIN atual incorreto!');
      return;
    }
    
    localStorage.removeItem('financepro_pin_code');
    localStorage.removeItem('financeos_pin_code');
    localStorage.setItem('financepro_pin_enabled', 'false');
    localStorage.setItem('financeos_pin_enabled', 'false');
    updatePinCheckbox();
    closeM('modal-config-pin');
    alert('Bloqueio por PIN desativado com sucesso.');
  });

  // Salvar PIN
  fConfigPin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const storedPin = localStorage.getItem('financepro_pin_code') || localStorage.getItem('financeos_pin_code');
    const currentVal = pinCurrent ? pinCurrent.value : '';
    const newPin1 = pinInput1 ? pinInput1.value : '';
    const newPin2 = pinInput2 ? pinInput2.value : '';

    if (storedPin) {
      const hashedCurrent = await hashPin(currentVal);
      if (hashedCurrent !== storedPin) {
        alert('PIN atual incorreto!');
        return;
      }
    }

    if (newPin1.length !== 4 || !/^\d{4}$/.test(newPin1)) {
      alert('O PIN deve conter exatamente 4 números.');
      return;
    }

    if (newPin1 !== newPin2) {
      alert('A confirmação do PIN não corresponde.');
      return;
    }

    const hashedNew = await hashPin(newPin1);
    localStorage.setItem('financepro_pin_code', hashedNew);
    localStorage.setItem('financepro_pin_enabled', 'true');
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

  async function handlePinInput(val) {
    if (typedPin.length >= 4) return;
    typedPin.push(val);
    updatePinDots();

    if (typedPin.length === 4) {
      const enteredPin = typedPin.join('');
      const storedPin = localStorage.getItem('financepro_pin_code') || localStorage.getItem('financeos_pin_code');
      const hashedEntered = await hashPin(enteredPin);

      if (hashedEntered === storedPin) {
        // Desbloquear
        typedPin = [];
        updatePinDots();
        if (pinLockScreen) pinLockScreen.style.display = 'none';
        sessionStorage.setItem('financepro_last_unlock', Date.now().toString());
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
  const pinEnabled = (localStorage.getItem('financepro_pin_enabled') || localStorage.getItem('financeos_pin_enabled')) === 'true';
  const storedPin = localStorage.getItem('financepro_pin_code') || localStorage.getItem('financeos_pin_code');
  const lastUnlock = sessionStorage.getItem('financepro_last_unlock') || sessionStorage.getItem('financeos_last_unlock');
  const unlockedRecently = lastUnlock && (Date.now() - parseInt(lastUnlock) < 10000);

  if (pinEnabled && storedPin && !unlockedRecently) {
    if (pinLockScreen) pinLockScreen.style.display = 'flex';
  }

  // Monitorar retorno do segundo plano e inatividade para auto-lock
  function checkAutoLock() {
    const pinEnabled = (localStorage.getItem('financepro_pin_enabled') || localStorage.getItem('financeos_pin_enabled')) === 'true';
    const storedPin = localStorage.getItem('financepro_pin_code') || localStorage.getItem('financeos_pin_code');
    if (!pinEnabled || !storedPin) return;

    const bgTimeStr = sessionStorage.getItem('financepro_background_time') || sessionStorage.getItem('financeos_background_time');
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
      sessionStorage.setItem('financepro_background_time', Date.now().toString());
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
      if (btnBuyPlus) btnBuyPlus.href = "https://link.mercadopago.com.br/financepro-plus-anual";
      if (btnBuyPro) btnBuyPro.href = "https://link.mercadopago.com.br/financepro-pro-anual";
      monthlyLbl?.classList.remove('active');
      yearlyLbl?.classList.add('active');
    } else {
      if (pricePlus) pricePlus.textContent = "14,90";
      if (periodPlus) periodPlus.textContent = "/mês";
      if (pricePro) pricePro.textContent = "29,90";
      if (periodPro) periodPro.textContent = "/mês";
      if (btnBuyPlus) btnBuyPlus.href = "https://link.mercadopago.com.br/financepro-plus-mensal";
      if (btnBuyPro) btnBuyPro.href = "https://link.mercadopago.com.br/financepro-pro-mensal";
      monthlyLbl?.classList.add('active');
      yearlyLbl?.classList.remove('active');
    }
  }

  billingCycleToggle?.addEventListener('change', updatePaywallPricing);
  updatePaywallPricing();

  // Abrir paywall do perfil
  q('#btnOpenChangePlan')?.addEventListener('click', () => {
    openM('paywall-overlay');
  });

  // 💳 Integração Stripe Checkout
  // handleStripeReturn() agora é chamado no registerAuthCallback para garantir que
  // o usuário esteja autenticado antes de ativar o plano e sincronizar com o Firestore.

  // Botões de Cancelamento de Assinatura
  q('#btnCancelPlan')?.addEventListener('click', () => {
    openCancelSubscriptionModal();
  });

  q('#btnConfirmCancelStripe')?.addEventListener('click', () => {
    cancelStripeSubscription();
  });

  // ── Rotina de Backup & Restauração PoupaFy ──
  q('#btnBackup')?.addEventListener('click', () => {
    const backupData = JSON.stringify(S, null, 2);
    const dateStr = new Date().toISOString().substring(0, 10);
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poupafy-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    alert(`✅ Backup do PoupaFy gerado com sucesso!\n\nVocê pode salvar o arquivo "poupafy-backup-${dateStr}.json" na pasta "poupafy-backup" no seu Google Drive.`);
  });

  const fileRestoreInput = q('#fileRestore');
  q('#btnRestore')?.addEventListener('click', () => {
    if (fileRestoreInput) fileRestoreInput.click();
  });

  fileRestoreInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (typeof data === 'object' && data !== null) {
          setS(data);
          save();
          alert('✅ Backup do PoupaFy restaurado com sucesso!');
          updateUI();
          if (window.renderDashboard) window.renderDashboard();
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch (err) {
        alert('Erro ao ler arquivo de backup JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    fileRestoreInput.value = '';
  });

  // Alterar Plano de Assinatura via Stripe Checkout
  q('#btn-select-free')?.addEventListener('click', () => {
    window.changeSubscriptionPlan('free');
  });

  q('#btn-buy-plus')?.addEventListener('click', (e) => {
    e.preventDefault();
    const isYearly = q('#billing-cycle-toggle')?.checked || false;
    redirectToStripeCheckout('plus', isYearly);
  });

  q('#btn-buy-pro')?.addEventListener('click', (e) => {
    e.preventDefault();
    const isYearly = q('#billing-cycle-toggle')?.checked || false;
    redirectToStripeCheckout('pro', isYearly);
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
    'PRODID:-//FinancePro//Calendar Export//PT',
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
    ics.push(`UID:${t.id}@financepro.app`);
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
  link.setAttribute('download', `financepro_agenda_${year}_${String(month + 1).padStart(2, '0')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function checkUpcomingBillsNotifications() {
  const notifEnabled = localStorage.getItem('financepro_notifications') || localStorage.getItem('financeos_notifications');
  if (notifEnabled !== 'true') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];
  
  const notifiedTxs = JSON.parse(sessionStorage.getItem('financepro_notified_txs') || sessionStorage.getItem('financeos_notified_txs') || '{}');
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
    sessionStorage.setItem('financepro_notified_txs', JSON.stringify(notifiedTxs));
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

window.openTutorial = function(card) {
  const title = card.querySelector('.tut-title').textContent;
  const content = card.querySelector('.tut-full-content').innerHTML;
  const viewTitle = document.getElementById('tut-view-title');
  const viewBody = document.getElementById('tut-view-body');
  
  if (viewTitle) viewTitle.textContent = title;
  if (viewBody) viewBody.innerHTML = content;
  
  openM('m-tutorial-view');
};
