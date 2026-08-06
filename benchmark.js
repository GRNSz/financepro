const fs = require('fs');

// Mock data
const S = {
  accounts: Array.from({ length: 100 }, (_, i) => ({ id: `acc_${i}`, balance: 1000 })),
  transactions: Array.from({ length: 10000 }, (_, i) => ({
    id: `tx_${i}`,
    payId: `acc_${i % 100}`,
    status: i % 10 === 0 ? 'Pendente' : 'Pago',
    tipo: i % 2 === 0 ? 'Receita' : 'Despesa',
    val: 50,
    data: '2023-10-01'
  }))
};

function original() {
  let saldoInicial = S.accounts.reduce((s, a) => s + a.balance, 0);
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
  return saldoInicial;
}

function optimized() {
  let saldoInicial = S.accounts.reduce((s, a) => s + a.balance, 0);
  let allNet = 0;
  const accMap = new Map(S.accounts.map(a => [a.id, a]));
  S.transactions.forEach(t => {
    if (t.status !== 'Pendente') {
      const acc = accMap.get(t.payId);
      if (acc) {
        allNet += (t.tipo === 'Receita' ? t.val : -t.val);
      }
    }
  });
  saldoInicial -= allNet;
  return saldoInicial;
}

const t1 = performance.now();
for (let i = 0; i < 1000; i++) original();
const t2 = performance.now();

const t3 = performance.now();
for (let i = 0; i < 1000; i++) optimized();
const t4 = performance.now();

console.log(`Original: ${(t2 - t1).toFixed(2)} ms`);
console.log(`Optimized: ${(t4 - t3).toFixed(2)} ms`);
