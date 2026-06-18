import { S, fmt, getCat, q, openM, save } from './state.js';

export let aiChatHistory = [];

export function getAIApiKey() {
  const localKey = localStorage.getItem('financepro_ai_api_key') || localStorage.getItem('financeos_ai_api_key');
  if (localKey && localKey.trim()) return localKey.trim();
  
  // Substituído em tempo de compilação pelo Vite (via plugin ou env nativo)
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && envKey !== '__' + 'VITE_GEMINI_API_KEY__' && envKey.trim() !== '') return envKey;
  
  return '';
}

export function scrollChatToBottom() {
  const container = q('#aiChatMessages');
  if (container) container.scrollTop = container.scrollHeight;
}

export function sendAiQuick(text) {
  const input = q('#aiChatInput');
  if (input) {
    input.value = text;
    sendAiMessage();
  }
}

// Bind helper globally
window.sendAiQuick = sendAiQuick;

export function formatAiMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/\`(.*?)\`/g, '<code style="background:var(--s3);padding:2px 4px;border-radius:4px;font-family:monospace">$1</code>')
    .replace(/\n/g, '<br>');
}

export async function sendAiMessage() {
  const input = q('#aiChatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  
  // Verificar limites de planos
  const plan = S.subscription?.plan || 'free';
  const currentResetMonth = new Date().toISOString().substring(0, 7);
  
  if (S.subscription) {
    if (typeof S.subscription.aiQueriesUsed !== 'number') S.subscription.aiQueriesUsed = 0;
    if (S.subscription.aiQueriesResetMonth !== currentResetMonth) {
      S.subscription.aiQueriesUsed = 0;
      S.subscription.aiQueriesResetMonth = currentResetMonth;
    }
  }

  if (plan === 'free') {
    alert('O Assistente de IA está disponível apenas nos planos Plus e Pro. Escolha o seu plano para começar!');
    openM('paywall-overlay');
    return;
  } else if (plan === 'plus') {
    if (S.subscription.aiQueriesUsed >= 5) {
      alert('Você atingiu o limite de 5 perguntas mensais do seu plano Plus. Faça upgrade para o Pro para obter perguntas ilimitadas!');
      openM('paywall-overlay');
      return;
    }
  }

  input.value = '';
  
  window.showGlobalLoader?.("IA FinancePro está pensando...");
  
  const messagesContainer = q('#aiChatMessages');
  if (!messagesContainer) return;
  
  messagesContainer.innerHTML += `<div class="ai-msg user">${text}</div>`;
  scrollChatToBottom();
  
  const loadId = 'ai-load-' + Date.now();
  messagesContainer.innerHTML += `<div class="ai-msg model" id="${loadId}"><span class="sync-spinner" style="width:16px;height:16px;margin:0;display:inline-block;border-width:2px;vertical-align:middle;margin-right:6px"></span>Pensando...</div>`;
  scrollChatToBottom();
  
  const apiKey = getAIApiKey();
  
  let totalBalance = 0;
  if (Array.isArray(S.accounts)) S.accounts.forEach(a => totalBalance += a.balance);
  if (Array.isArray(S.cards)) S.cards.forEach(c => totalBalance -= c.balance); // wait, let's check: in new schema card balances are invoices?
  
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth();
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  if (Array.isArray(S.transactions)) {
    S.transactions.forEach(t => {
      const d = new Date(t.data + 'T00:00:00');
      if (d.getFullYear() === cy && d.getMonth() === cm) {
        if (t.tipo === 'Receita') monthlyIncome += t.val;
        else monthlyExpense += t.val;
      }
    });
  }
  
  const recentTxs = Array.isArray(S.transactions) ? [...S.transactions].slice(0, 10).map(t => ({
    tipo: t.tipo,
    desc: t.desc,
    val: t.val,
    cat: getCat(t.catId).name,
    data: t.data,
    status: t.status
  })) : [];
  
  const systemInstruction = `Você é o FinancesAI, um assistente de inteligência artificial financeira pessoal de elite.
Você fala com base nos dados do usuário e responde em português de forma compacta, motivadora e inteligente.

DADOS FINANCEIROS ATUAIS DO USUÁRIO:
- Saldo Consolidado: ${fmt(totalBalance)}
- Receitas deste mês (${MESES[cm]} de ${cy}): ${fmt(monthlyIncome)}
- Despesas deste mês (${MESES[cm]} de ${cy}): ${fmt(monthlyExpense)}
- Contas & Cartões: ${JSON.stringify((S.accounts || []).map(a => ({ name: a.name, type: a.type, balance: a.balance })))}
- Lançamentos recentes (últimos 10): ${JSON.stringify(recentTxs)}
- Metas ativas: ${JSON.stringify((S.goals || []).map(g => ({ name: g.name, target: g.tgt, current: g.cur })))}
- Dívidas registradas: ${JSON.stringify((S.debts || []).map(d => ({ desc: d.nome || d.desc, val: d.val || d.total, status: d.status })))}

INSTRUÇÕES:
- Ajude a analisar gastos, planejar economias, tirar dúvidas de parcelas e sugerir planos de ação.
- Nunca invente contas ou lançamentos que não estão nos dados.
- Mantenha respostas curtas (máximo de 2-3 parágrafos curtos) para caber na janela de chat.
- Formate a resposta usando markdown básico (negrito e listas).`;

  aiChatHistory.push({
    role: 'user',
    parts: [{ text: text }]
  });
  
  if (aiChatHistory.length > 10) {
    aiChatHistory = aiChatHistory.slice(aiChatHistory.length - 10);
  }
  
  const payload = {
    contents: aiChatHistory,
    systemInstruction: {
      parts: [
        { text: systemInstruction }
      ]
    },
    generationConfig: {
      temperature: 0.4
    }
  };
  
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  let success = false;
  let lastErrorMsg = '';

  for (const modelName of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.error) {
        const msg = data.error.message || '';
        if (msg.includes('API key expired') || msg.includes('API key not valid') || msg.includes('invalid') || data.error.status === 'INVALID_ARGUMENT') {
          lastErrorMsg = 'Chave de API expirada ou inválida. Configure uma chave do Gemini ativa nas Configurações.';
          break;
        }

        if (data.error.code === 404 || msg.includes('not found') || msg.includes('not supported')) {
          console.warn(`Model ${modelName} not supported/found, trying next one...`);
          lastErrorMsg = `Erro da API: ${msg}`;
          continue;
        }

        lastErrorMsg = `Erro da API (${modelName}): ${msg}`;
        continue;
      }

      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        const reply = data.candidates[0].content.parts[0].text;

        aiChatHistory.push({
          role: 'model',
          parts: [{ text: reply }]
        });

        // Incrementar uso do plano
        if (S.subscription) {
          S.subscription.aiQueriesUsed = (S.subscription.aiQueriesUsed || 0) + 1;
          save();
        }

        const loadEl = document.getElementById(loadId);
        if (loadEl) {
          loadEl.innerHTML = formatAiMarkdown(reply);
          loadEl.removeAttribute('id');
        }
        success = true;
        window.hideGlobalLoader?.();
        break;
      }
    } catch (err) {
      console.error(`Fetch error with model ${modelName}:`, err);
      lastErrorMsg = 'Erro de rede ou conexão com a API do Gemini.';
    }
  }

  if (!success) {
    window.hideGlobalLoader?.();
    const loadEl = document.getElementById(loadId);
    if (loadEl) {
      loadEl.innerHTML = `<span style="color:var(--rd)">${lastErrorMsg || 'Não foi possível obter resposta da IA.'}</span>`;
    }
    aiChatHistory.pop();
  }
}
