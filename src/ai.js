import { S, fmt, getCat, q, openM, save } from './state.js';

export let aiChatHistory = [];

export function getAIApiKey() {
  const localKey = localStorage.getItem('financepro_ai_api_key') || localStorage.getItem('financeos_ai_api_key');
  if (localKey && localKey.trim()) return localKey.trim();
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

window.sendAiQuick = sendAiQuick;

export function formatAiMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/\`(.*?)\`/g, '<code style="background:var(--s3);padding:2px 4px;border-radius:4px;font-family:monospace">$1</code>')
    .replace(/\n/g, '<br>');
}

/**
 * Motor Interno de Inteligência Financeira Avançada (0 Custo de API)
 * Analisa a pergunta do usuário junto aos dados reais do aplicativo.
 */
function generateInternalAiResponse(userText) {
  const text = userText.toLowerCase().trim();

  // 1. Dados Consolidados do Usuário
  let totalBalance = 0;
  (S.accounts || []).forEach(a => {
    if (a.type !== 'Investimentos') totalBalance += (a.balance || 0);
  });

  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth();
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  let pendingExpense = 0;
  const catTotals = {};
  const catItemCounts = {};
  const monthTransactions = [];

  (S.transactions || []).forEach(t => {
    const d = new Date(t.data + 'T00:00:00');
    if (d.getFullYear() === cy && d.getMonth() === cm) {
      monthTransactions.push(t);
      if (t.tipo === 'Receita' && t.status === 'Pago') {
        monthlyIncome += t.val;
      } else if (t.tipo === 'Despesa') {
        if (t.status === 'Pago') {
          monthlyExpense += t.val;
          catTotals[t.catId] = (catTotals[t.catId] || 0) + t.val;
          catItemCounts[t.catId] = (catItemCounts[t.catId] || 0) + 1;
        } else {
          pendingExpense += t.val;
        }
      }
    }
  });

  // Maior Categoria de Gasto
  let topCatId = '';
  let topCatVal = 0;
  Object.keys(catTotals).forEach(cid => {
    if (catTotals[cid] > topCatVal) {
      topCatVal = catTotals[cid];
      topCatId = cid;
    }
  });
  const topCatObj = topCatId ? getCat(topCatId) : null;
  const topCatName = topCatObj ? topCatObj.name : 'Outros';

  // Cartões de Crédito
  let totalCardLimit = 0;
  let totalCardUsed = 0;
  (S.cards || []).forEach(c => {
    totalCardLimit += (c.limit || 0);
    // Gastos no cartão este mês
    (S.transactions || []).forEach(t => {
      if (t.payId === c.id && t.tipo === 'Despesa') {
        const d = new Date(t.data + 'T00:00:00');
        if (d.getFullYear() === cy && d.getMonth() === cm) {
          totalCardUsed += t.val;
        }
      }
    });
  });

  // Dívidas Pendentes
  let totalDebts = 0;
  const activeDebts = (S.debts || []).filter(d => d.status !== 'Pago');
  activeDebts.forEach(d => totalDebts += (d.val || d.total || 0));

  // Guardado & Metas
  let totalSavings = 0;
  (S.savings || []).forEach(s => totalSavings += (s.val || 0));
  (S.goals || []).forEach(g => totalSavings += (g.cur || 0));

  const netBalance = monthlyIncome - monthlyExpense;
  const savingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0;

  // ════ 2. RESPOSTAS DINÂMICAS E INTELIGENTES POR CONTEXTO ════

  // Consulta Específica de Categoria (ex: "quanto gastei com mercado/alimentação/lazer/etc?")
  const foundCat = (S.categories || []).find(c => text.includes(c.name.toLowerCase()));
  if (foundCat) {
    const spentInCat = catTotals[foundCat.id] || 0;
    const countInCat = catItemCounts[foundCat.id] || 0;
    const catBudget = (S.budgets || []).find(b => b.catId === foundCat.id);

    let catMsg = `📌 **Gastos com ${foundCat.icon} ${foundCat.name} em ${MESES[cm]}**:
• **Total Gasto**: **${fmt(spentInCat)}** (${countInCat} lançamentos pagos)`;

    if (catBudget) {
      const pct = Math.round((spentInCat / catBudget.lim) * 100);
      const rest = catBudget.lim - spentInCat;
      catMsg += `\n• **Orçamento Definido**: ${fmt(catBudget.lim)} (${pct}% consumido)`;
      if (rest < 0) {
        catMsg += `\n⚠️ **Atenção**: Você ultrapassou seu limite de orçamento nesta categoria em **${fmt(Math.abs(rest))}**!`;
      } else {
        catMsg += `\n✅ Você ainda tem **${fmt(rest)}** disponíveis neste mês.`;
      }
    }

    // Listar últimas transações dessa categoria
    const catTxs = monthTransactions.filter(t => t.catId === foundCat.id).slice(-3);
    if (catTxs.length > 0) {
      catMsg += `\n\n📝 **Últimos Lançamentos**:`;
      catTxs.forEach(t => {
        catMsg += `\n• ${t.desc}: **${fmt(t.val)}** (${t.status})`;
      });
    }

    return catMsg;
  }

  // A) Saúde Financeira / Resumo do Mês
  if (text.includes('saúde') || text.includes('diagnóstico') || text.includes('como estou') || text.includes('resumo') || text.includes('situação') || text.includes('balanço') || text.includes('análise')) {
    let statusEmoji = '✅';
    let statusTitle = 'Sua Saúde Financeira está Equilibrada!';
    if (netBalance < 0) {
      statusEmoji = '🚨';
      statusTitle = 'Atenção: Suas despesas superaram suas receitas!';
    } else if (savingsRate >= 20) {
      statusEmoji = '🚀';
      statusTitle = 'Excelente! Você está conseguindo poupar acima de 20%!';
    }

    return `${statusEmoji} **${statusTitle}**

📊 **Resumo Financeiro de ${MESES[cm]}**:
• 💵 **Saldo Total em Contas**: ${fmt(totalBalance)}
• 🟢 **Receitas Confirmadas**: ${fmt(monthlyIncome)}
• 🔴 **Despesas Pagas**: ${fmt(monthlyExpense)}
• ⚖️ **Resultado Líquido**: **${netBalance >= 0 ? '+' : ''}${fmt(netBalance)}**
• 🐷 **Dinheiro Guardado/Metas**: ${fmt(totalSavings)}

💡 **Insight Pessoal**:
${netBalance < 0 
  ? `Você gastou **${fmt(Math.abs(netBalance))}** a mais do que recebeu. Seu maior impacto foi na categoria **${topCatName}** com ${fmt(topCatVal)}.` 
  : `Parabéns! Você tem um superávit de **${fmt(netBalance)}** este mês (${savingsRate}% da sua renda).`}`;
  }

  // B) Cartões de Crédito & Faturas
  if (text.includes('cartão') || text.includes('cartao') || text.includes('cartões') || text.includes('fatura') || text.includes('limite')) {
    const cardCount = (S.cards || []).length;
    if (cardCount === 0) {
      return `💳 **Cartões de Crédito**:
Você ainda não possui cartões cadastrados. Acesse **Contas & Cartões** no menu para adicionar seus cartões e controlar limites!`;
    }

    let msg = `💳 **Situação dos Seus Cartões de Crédito**:
• **Limite Total Disponível**: ${fmt(totalCardLimit)}
• **Uso de Cartão em ${MESES[cm]}**: **${fmt(totalCardUsed)}**\n`;

    (S.cards || []).forEach(c => {
      msg += `\n🔹 **${c.name}**: Limite de ${fmt(c.limit)} (Fecha dia ${c.close}, Vence dia ${c.due})`;
    });

    return msg;
  }

  // C) Dívidas & Quitação
  if (text.includes('dívida') || text.includes('divida') || text.includes('quitar') || text.includes('devendo') || text.includes('juros')) {
    if (totalDebts === 0) {
      return `🎉 **Você está livre de dívidas!**
Atualmente não há dívidas ou pendências de empréstimos registradas no seu sistema.`;
    }

    let msg = `💳 **Diagnóstico de Dívidas**:
Você possui **${activeDebts.length}** pendência(s) totalizando **${fmt(totalDebts)}**.\n`;
    activeDebts.forEach(d => {
      msg += `\n• **${d.name}**: ${fmt(d.val || d.total || 0)} (${d.status || 'Pendente'})`;
    });

    msg += `\n\n💡 **Dica de Quitação**: Recomendo focar na quitação da dívida com maior taxa de juros primeiro para economizar no longo prazo!`;
    return msg;
  }

  // D) Metas & Economia
  if (text.includes('meta') || text.includes('metas') || text.includes('objetivo') || text.includes('guardado') || text.includes('reserva') || text.includes('poupar') || text.includes('economizar')) {
    const goalsCount = (S.goals || []).length;
    let msg = `🎯 **Metas & Reserva Financeira**:
• **Total em Reserva/Metas**: **${fmt(totalSavings)}**\n`;

    if (goalsCount > 0) {
      msg += `\n📋 **Suas Metas Atuais**:`;
      (S.goals || []).forEach(g => {
        const pct = Math.min(100, Math.round(((g.cur || 0) / (g.tgt || 1)) * 100));
        msg += `\n• **${g.name}**: ${fmt(g.cur || 0)} de ${fmt(g.tgt || 0)} (**${pct}%** concluído)`;
      });
    } else {
      msg += `\nVocê ainda não definiu metas específicas. Vá em **Metas** no menu para cadastrar seus objetivos (ex: Viagem, Carro Novo, Reserva)!`;
    }

    return msg;
  }

  // E) Lançamentos Pendentes / Contas a Vencer
  if (text.includes('pendente') || text.includes('vencer') || text.includes('atrasado') || text.includes('contas')) {
    const pendingList = monthTransactions.filter(t => t.status === 'Pendente');
    if (pendingList.length === 0 && pendingExpense === 0) {
      return `✨ **Nenhuma conta pendente para este mês!** Todas as suas despesas registradas em ${MESES[cm]} já estão pagas.`;
    }

    let msg = `⏰ **Contas Pendentes em ${MESES[cm]}**:
• **Total a Pagar**: **${fmt(pendingExpense)}** (${pendingList.length} itens)\n`;
    pendingList.slice(0, 5).forEach(t => {
      msg += `\n• ${t.data.split('-').reverse().join('/')} - ${t.desc}: **${fmt(t.val)}**`;
    });

    return msg;
  }

  // F) Saudações e Conversa Genérica Amigável
  if (text.includes('oi') || text.includes('olá') || text.includes('ola') || text.includes('bom dia') || text.includes('boa tarde') || text.includes('boa noite') || text.includes('ajuda') || text.includes('quem é você')) {
    return `👋 **Olá! Sou o FinancesAI**, seu assistente financeiro inteligente.

Estou acompanhando suas finanças em tempo real! Aqui está seu panorama de hoje:
• 💵 **Saldo Atual**: ${fmt(totalBalance)}
• 🟢 **Receitas do Mês**: ${fmt(monthlyIncome)}
• 🔴 **Despesas do Mês**: ${fmt(monthlyExpense)}
• 🐷 **Total Guardado**: ${fmt(totalSavings)}

Como posso te ajudar agora? Você pode me perguntar sobre **gastos por categoria** (ex: *"quanto gastei com mercado?"*), **cartões**, **metas** ou pedir um **resumo do mês**!`;
  }

  // G) Resposta Inteligente Fallback com Análise dos Dados Reais
  return `💡 **Análise das Suas Finanças**:

Entendi sua pergunta! Consultando seus lançamentos de **${MESES[cm]}**:
• **Saldo Total em Contas**: ${fmt(totalBalance)}
• **Entradas no Mês**: ${fmt(monthlyIncome)}
• **Saídas no Mês**: ${fmt(monthlyExpense)}
• **Maior Categoria de Gasto**: **${topCatName}** (${fmt(topCatVal)})
• **Total Guardado em Metas**: ${fmt(totalSavings)}

Se quiser detalhes específicos, pode me perguntar:
1. *"Quanto gastei com [nome da categoria]?"*
2. *"Como estão minhas metas?"*
3. *"Quais minhas contas pendentes?"*`;
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
    alert('O Assistente de IA está disponível nos planos Plus e Pro. Escolha seu plano para liberar!');
    openM('paywall-overlay');
    return;
  }

  input.value = '';
  
  window.showGlobalLoader?.("IA FinanceOS está pensando...");
  
  const messagesContainer = q('#aiChatMessages');
  if (!messagesContainer) return;
  
  messagesContainer.innerHTML += `<div class="ai-msg user">${text}</div>`;
  scrollChatToBottom();
  
  const loadId = 'ai-load-' + Date.now();
  messagesContainer.innerHTML += `<div class="ai-msg model" id="${loadId}"><span class="sync-spinner" style="width:16px;height:16px;margin:0;display:inline-block;border-width:2px;vertical-align:middle;margin-right:6px"></span>Pensando...</div>`;
  scrollChatToBottom();
  
  const apiKey = getAIApiKey();

  // Se houver uma chave do Gemini configurada, tenta utilizar a API externa do Gemini
  if (apiKey) {
    let totalBalance = 0;
    if (Array.isArray(S.accounts)) S.accounts.forEach(a => totalBalance += a.balance);
    
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

    let totalSavings = 0;
    (S.savings || []).forEach(s => totalSavings += (s.val || 0));
    (S.goals || []).forEach(g => totalSavings += (g.cur || 0));
    let totalDebts = 0;
    (S.debts || []).filter(d => d.status !== 'Pago').forEach(d => totalDebts += (d.val || d.total || 0));

    const systemInstruction = `Você é o PoupaFy AI, um consultor financeiro pessoal altamente inteligente, especialista em finanças pessoais, economia, investimentos (CDB, Tesouro, Ações, FIIs), quitação estratégica de dívidas, orçamentos (metodologia 50/30/20 e orçamento base zero) e planejamento patrimonial.

DADOS REAIS DO USUÁRIO EM TEMPO REAL NO POUPAFY:
- Saldo Total em Contas Bancárias: ${fmt(totalBalance)}
- Receitas Confirmadas no Mês (${MESES[cm]}): ${fmt(monthlyIncome)}
- Despesas Pagas no Mês (${MESES[cm]}): ${fmt(monthlyExpense)}
- Resultado Líquido Mensal: ${fmt(monthlyIncome - monthlyExpense)}
- Dinheiro Guardado / Reserva / Metas: ${fmt(totalSavings)}
- Dívidas Pendentes Cadastradas: ${fmt(totalDebts)}

DIRETRIZES DE ATUAÇÃO E RESPOSTA:
1. Responda em Português do Brasil com tom humano, especialista, empático, claro e altamente prático.
2. Utilize SEMPRE os dados reais do usuário fornecidos acima para contextualizar suas respostas e cálculos.
3. Se o usuário perguntar sobre qualquer assunto de finanças (investimentos, inflação, imposto de renda, amortização, planejamento, corte de gastos), forneça uma explicação profunda, precisa e acionável.
4. Use formatação limpa em Markdown: títulos com negrito, listas com marcadores (•) e emojis elegantes.
5. Quando apropriado, forneça números exatos, simulações simples ou passos acionáveis de 1 a 3.`;

    aiChatHistory.push({ role: 'user', parts: [{ text }] });
    if (aiChatHistory.length > 10) aiChatHistory = aiChatHistory.slice(-10);

    const payload = {
      contents: aiChatHistory,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.4 }
    };

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
    let success = false;

    for (const modelName of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
          const reply = data.candidates[0].content.parts[0].text;
          aiChatHistory.push({ role: 'model', parts: [{ text: reply }] });

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
          return;
        }
      } catch (err) {
        console.warn(`External API notice (${modelName}):`, err);
      }
    }
  }

  // 💡 MOTOR INTERNO FINANCEIRO (0 CUSTO DE API PARA O DESENVOLVEDOR)
  setTimeout(() => {
    const reply = generateInternalAiResponse(text);

    if (S.subscription) {
      S.subscription.aiQueriesUsed = (S.subscription.aiQueriesUsed || 0) + 1;
      save();
    }

    const loadEl = document.getElementById(loadId);
    if (loadEl) {
      loadEl.innerHTML = formatAiMarkdown(reply);
      loadEl.removeAttribute('id');
    }
    window.hideGlobalLoader?.();
  }, 400);
}
