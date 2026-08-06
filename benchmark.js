const { performance } = require('perf_hooks');

const numAccounts = 500;
const numTransactions = 50000;

const accounts = [];
for (let i = 0; i < numAccounts; i++) {
  accounts.push({ id: `acc_${i}`, balance: 1000 });
}

const transactions = [];
for (let i = 0; i < numTransactions; i++) {
  transactions.push({
    id: `tx_${i}`,
    payId: `acc_${Math.floor(Math.random() * numAccounts)}`,
    data: '2023-10-01',
    status: 'Pago',
    tipo: Math.random() > 0.5 ? 'Receita' : 'Despesa',
    val: Math.random() * 100
  });
}

const endIso = '2023-01-01';

function calculateAfterNetA(endIso, transactions, accounts) {
    let totalBal = accounts.reduce((s,a)=>s+a.balance,0);
    if (endIso && Array.isArray(transactions)) {
      let afterNet = 0;
      transactions.forEach(t => {
        if (t.data > endIso && t.status !== 'Pendente') {
          const acc = accounts.find(a => a.id === t.payId);
          if (acc) {
            afterNet += (t.tipo === 'Receita' ? t.val : -t.val);
          }
        }
      });
      totalBal -= afterNet;
    }
    return totalBal;
}

function calculateAfterNetB(endIso, transactions, accounts) {
    let totalBal = accounts.reduce((s,a)=>s+a.balance,0);
    if (endIso && Array.isArray(transactions)) {
      let afterNet = 0;
      const accountMap = new Map();
      accounts.forEach(a => accountMap.set(a.id, a));
      transactions.forEach(t => {
        if (t.data > endIso && t.status !== 'Pendente') {
          const acc = accountMap.get(t.payId);
          if (acc) {
            afterNet += (t.tipo === 'Receita' ? t.val : -t.val);
          }
        }
      });
      totalBal -= afterNet;
    }
    return totalBal;
}

// warmup
for (let i = 0; i < 10; i++) {
  calculateAfterNetA(endIso, transactions, accounts);
  calculateAfterNetB(endIso, transactions, accounts);
}

const iter = 100;

const startA = performance.now();
for (let i = 0; i < iter; i++) calculateAfterNetA(endIso, transactions, accounts);
const endA = performance.now();

const startB = performance.now();
for (let i = 0; i < iter; i++) calculateAfterNetB(endIso, transactions, accounts);
const endB = performance.now();

console.log(`Baseline (O(N*M)): ${(endA - startA) / iter} ms per run`);
console.log(`Optimized (Map): ${(endB - startB) / iter} ms per run`);
console.log(`Speedup: ${((endA - startA) / (endB - startB)).toFixed(2)}x`);
