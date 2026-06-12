import { q, qa, fmt } from './state.js';

let calcExpression = '';

export function pressCalc(key) {
  const display = q('#calc-display');
  if (!display) return;
  
  if (key === 'C') {
    calcExpression = '';
    display.textContent = '0';
  } else if (key === 'back') {
    calcExpression = calcExpression.slice(0, -1);
    display.textContent = calcExpression || '0';
  } else if (key === '=') {
    if (!calcExpression) return;
    try {
      const sanitized = calcExpression.replace(/[^0-9+\-*/.]/g, '');
      const result = Function('"use strict"; return (' + sanitized + ')')();
      calcExpression = String(result);
      display.textContent = calcExpression;
    } catch (err) {
      display.textContent = 'Erro';
      calcExpression = '';
    }
  } else {
    const operators = ['+', '*', '/'];
    if (operators.includes(key) && !calcExpression) return;
    if (['+', '-', '*', '/'].includes(key) && ['+', '-', '*', '/'].includes(calcExpression.slice(-1))) {
      calcExpression = calcExpression.slice(0, -1) + key;
    } else {
      calcExpression += key;
    }
    display.textContent = calcExpression;
  }
}

export function calculateOvertime() {
  const salario = parseFloat(q('#he-salario').value) || 0;
  const jornada = parseFloat(q('#he-jornada').value) || 220;
  const porcentagem = parseFloat(q('#he-porcentagem').value) || 50;
  const quantidade = parseFloat(q('#he-quantidade').value) || 0;
  const hasDsr = q('#he-has-dsr').checked;
  
  const diasUteis = parseInt(q('#he-dsr-uteis').value) || 25;
  const diasFolga = parseInt(q('#he-dsr-folgas').value) || 5;

  if (salario <= 0 || quantidade <= 0) {
    alert('Por favor, preencha o Salário e a Quantidade de Horas Extras!');
    return;
  }

  const valHoraNormal = salario / jornada;
  const valHoraExtra = valHoraNormal * (1 + (porcentagem / 100));
  const valExtraTotal = valHoraExtra * quantidade;
  
  let valDsr = 0;
  if (hasDsr) {
    valDsr = (valExtraTotal / diasUteis) * diasFolga;
  }
  
  const valTotal = valExtraTotal + valDsr;

  q('#he-res-normal').textContent = fmt(valHoraNormal);
  q('#he-res-extra-hora').textContent = fmt(valHoraExtra);
  q('#he-res-extra-total').textContent = fmt(valExtraTotal);
  
  const dsrRow = q('#he-res-dsr-row');
  if (dsrRow) {
    dsrRow.style.display = hasDsr ? 'flex' : 'none';
  }
  q('#he-res-dsr').textContent = fmt(valDsr);
  q('#he-res-total').textContent = fmt(valTotal);
  
  q('#he-results').style.display = 'flex';
}

export function switchCalcTab(tabName) {
  qa('.calc-pane').forEach(p => p.style.display = 'none');
  qa('.calc-tab-btn').forEach(b => {
    b.className = 'calc-tab-btn bs';
    b.style.background = 'transparent';
    b.style.borderColor = 'transparent';
    b.style.color = 'var(--tx2)';
  });
  
  const activePane = q('#calc-pane-' + tabName);
  if (activePane) activePane.style.display = 'block';
  
  const activeBtn = q(`.calc-tab-btn[data-tab="${tabName}"]`);
  if (activeBtn) {
    activeBtn.className = 'calc-tab-btn bp';
    activeBtn.style.background = 'var(--s3)';
    activeBtn.style.borderColor = 'var(--bd2)';
    activeBtn.style.color = 'var(--tx)';
  }
}

export function calculateAmortization() {
  const valor = parseFloat(q('#am-valor').value) || 0;
  const jurosAnual = parseFloat(q('#am-juros').value) || 0;
  const prazo = parseInt(q('#am-prazo').value) || 0;

  if (valor <= 0 || jurosAnual <= 0 || prazo <= 0) {
    alert('Por favor, preencha todos os campos do financiamento com valores maiores que zero!');
    return;
  }

  const i = (jurosAnual / 12) / 100; // Taxa mensal linear
  const n = prazo;

  // 1. SAC
  const sacAmort = valor / n;
  let sacTotalInterest = 0;
  let sdSac = valor;
  for (let k = 0; k < n; k++) {
    const interest = sdSac * i;
    sacTotalInterest += interest;
    sdSac -= sacAmort;
  }
  const sacP1 = sacAmort + (valor * i);
  const sacPn = sacAmort + (sacAmort * i);
  const sacTotal = valor + sacTotalInterest;

  // 2. PRICE
  let priceP = 0;
  if (i === 0) {
    priceP = valor / n;
  } else {
    priceP = valor * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  }
  const priceTotal = priceP * n;
  const priceTotalInterest = priceTotal - valor;
  const priceJ1 = valor * i;

  // Render results
  q('#am-sac-p1').textContent = fmt(sacP1);
  q('#am-sac-pn').textContent = fmt(sacPn);
  q('#am-sac-amort').textContent = fmt(sacAmort);
  q('#am-sac-juros').textContent = fmt(sacTotalInterest);
  q('#am-sac-total').textContent = fmt(sacTotal);

  q('#am-price-p').textContent = fmt(priceP);
  q('#am-price-j1').textContent = fmt(priceJ1);
  q('#am-price-juros').textContent = fmt(priceTotalInterest);
  q('#am-price-total').textContent = fmt(priceTotal);

  // Comparison Text
  const diffJuros = Math.abs(priceTotalInterest - sacTotalInterest);
  const compBox = q('#am-comparison-box');
  if (compBox) {
    if (sacTotalInterest < priceTotalInterest) {
      compBox.innerHTML = `
        <strong>💡 Recomendação:</strong> O sistema <strong>SAC</strong> economizará <strong>${fmt(diffJuros)}</strong> em juros no total se comparado à tabela <strong>PRICE</strong>.<br>
        <span style="font-size: 11.5px; color: var(--tx2); margin-top: 4px; display: block;">No entanto, a primeira parcela do SAC é de <strong>${fmt(sacP1)}</strong>, enquanto a PRICE tem parcelas fixas de <strong>${fmt(priceP)}</strong> durante todo o contrato.</span>
      `;
    } else {
      compBox.innerHTML = `
        <strong>💡 Recomendação:</strong> Ambos os modelos possuem custos de juros equivalentes sob as taxas informadas. A tabela <strong>PRICE</strong> oferece parcelas fixas de <strong>${fmt(priceP)}</strong>.
      `;
    }
  }

  q('#am-results').style.display = 'flex';
}

export function calculateFire() {
  const custo = parseFloat(q('#fire-custo').value) || 0;
  const atual = parseFloat(q('#fire-atual').value) || 0;
  const aporte = parseFloat(q('#fire-aporte').value) || 0;
  const taxaAnual = parseFloat(q('#fire-taxa').value) || 0;

  if (custo <= 0 || taxaAnual <= 0) {
    alert('Por favor, preencha o Custo de Vida Mensal e a Taxa de Retorno Real!');
    return;
  }

  const R = taxaAnual / 100;
  const target = (custo * 12) / R;
  const rendaSegura = (target * R) / 12;

  const im = Math.pow(1 + R, 1/12) - 1;

  let months = 0;
  let val = atual;
  let totalAportes = 0;

  if (aporte <= 0 && val * im <= 0) {
    q('#fire-res-tempo').textContent = 'Nunca (sem aportes / rendimento zero)';
    q('#fire-res-aportes').textContent = fmt(0);
    q('#fire-res-juros').textContent = fmt(0);
    q('#fire-summary-text').innerHTML = `Sua taxa de juros real ou aportes mensais estão zerados. É necessário poupar ou obter rendimentos acima da inflação para atingir a meta.`;
    q('#fire-meta-val').textContent = fmt(target);
    q('#fire-res-renda').textContent = fmt(rendaSegura);
    q('#fire-results').style.display = 'flex';
    return;
  }

  while (val < target && months < 1200) {
    val = (val + aporte) * (1 + im);
    totalAportes += aporte;
    months++;
  }

  q('#fire-meta-val').textContent = fmt(target);
  q('#fire-res-renda').textContent = fmt(rendaSegura);
  q('#fire-res-aportes').textContent = fmt(totalAportes);
  
  const jurosAcumulados = Math.max(0, val - atual - totalAportes);
  q('#fire-res-juros').textContent = fmt(jurosAcumulados);

  let tempoText = '';
  if (months >= 1200) {
    tempoText = 'Mais de 100 anos';
  } else {
    const anos = Math.floor(months / 12);
    const restos = months % 12;
    if (anos > 0) {
      tempoText = `${anos} ano(s) ${restos > 0 ? `e ${restos} mês(es)` : ''}`;
    } else {
      tempoText = `${restos} mês(es)`;
    }
  }
  q('#fire-res-tempo').textContent = tempoText;

  const summary = q('#fire-summary-text');
  if (summary) {
    if (months >= 1200) {
      summary.innerHTML = `Com as taxas informadas, o seu patrimônio não cresce o suficiente para atingir a meta de <strong>${fmt(target)}</strong> em menos de 100 anos. Considere aumentar o seu aporte mensal ou buscar investimentos com maior rentabilidade real.`;
    } else {
      summary.innerHTML = `Parabéns! Em <strong>${tempoText}</strong> de aportes constantes de <strong>${fmt(aporte)}</strong>, seu patrimônio atingirá <strong>${fmt(target)}</strong>. Desse valor, <strong>${fmt(jurosAcumulados)}</strong> virá puramente de rendimentos acumulados (efeito dos juros compostos).`;
    }
  }

  q('#fire-results').style.display = 'flex';
}

window.pressCalc = pressCalc;
window.calculateOvertime = calculateOvertime;
window.switchCalcTab = switchCalcTab;
window.calculateAmortization = calculateAmortization;
window.calculateFire = calculateFire;
