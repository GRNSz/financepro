// Mock S object
const S = {
  accounts: [],
  transactions: []
};

// Generate large number of accounts and transactions
for (let i = 0; i < 1000; i++) {
  S.accounts.push({ id: `acc_${i}`, balance: 100 });
}

for (let i = 0; i < 100000; i++) {
  S.transactions.push({
    id: `tx_${i}`,
    payId: `acc_${Math.floor(Math.random() * 1000)}`,
    data: '2023-10-15',
    status: 'Concluído',
    tipo: i % 2 === 0 ? 'Receita' : 'Despesa',
    val: Math.random() * 100
  });
}

function runBaseline() {
  const startIso = '2023-01-01';
  let saldoInicial = Array.isArray(S.accounts) ? S.accounts.reduce((s, a) => s + a.balance, 0) : 0;

  const startTime = process.hrtime.bigint();

  if (startIso && Array.isArray(S.transactions)) {
    let afterStartNet = 0;
    S.transactions.forEach(t => {
      if (t.data >= startIso && t.status !== 'Pendente') {
        const acc = S.accounts.find(a => a.id === t.payId);
        if (acc) {
          afterStartNet += (t.tipo === 'Receita' ? t.val : -t.val);
        }
      }
    });
    saldoInicial -= afterStartNet;
  }

  const endTime = process.hrtime.bigint();
  return Number(endTime - startTime) / 1e6; // in milliseconds
}

function runOptimized() {
  const startIso = '2023-01-01';
  let saldoInicial = Array.isArray(S.accounts) ? S.accounts.reduce((s, a) => s + a.balance, 0) : 0;

  const startTime = process.hrtime.bigint();

  if (startIso && Array.isArray(S.transactions)) {
    let afterStartNet = 0;
    const accountsMap = new Map(S.accounts.map(a => [a.id, a]));
    S.transactions.forEach(t => {
      if (t.data >= startIso && t.status !== 'Pendente') {
        const acc = accountsMap.get(t.payId);
        if (acc) {
          afterStartNet += (t.tipo === 'Receita' ? t.val : -t.val);
        }
      }
    });
    saldoInicial -= afterStartNet;
  }

  const endTime = process.hrtime.bigint();
  return Number(endTime - startTime) / 1e6; // in milliseconds
}

// Warmup
for (let i = 0; i < 5; i++) {
  runBaseline();
  runOptimized();
}

let baselineTotal = 0;
let optimizedTotal = 0;
const iterations = 20;

for (let i = 0; i < iterations; i++) {
  baselineTotal += runBaseline();
  optimizedTotal += runOptimized();
}

console.log(`Baseline Average: ${(baselineTotal / iterations).toFixed(2)} ms`);
console.log(`Optimized Average: ${(optimizedTotal / iterations).toFixed(2)} ms`);
console.log(`Improvement: ${((baselineTotal - optimizedTotal) / baselineTotal * 100).toFixed(2)}% faster`);
