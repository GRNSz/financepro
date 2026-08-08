const transactions = [];
for(let i=0; i<10000; i++) {
  const y = 2020 + (i%5);
  const m = String(1 + (i%12)).padStart(2, '0');
  const d = String(1 + (i%28)).padStart(2, '0');
  transactions.push({ date: `${y}-${m}-${d}`, amount: 10, type: i%2===0?'income':'expense' });
}

function parseLocalDate(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

console.time('native');
let sum = 0;
for(let j=0; j<100; j++) {
  transactions.forEach(t => {
    const d = parseLocalDate(t.date);
    if (d.getFullYear() === 2024 && d.getMonth() === 5) {
      sum += t.amount;
    }
  });
}
console.timeEnd('native');

console.time('fast string');
let sum2 = 0;
for(let j=0; j<100; j++) {
  const target = '2024-06';
  transactions.forEach(t => {
    if (t.date.substring(0, 7) === target) {
      sum2 += t.amount;
    }
  });
}
console.timeEnd('fast string');

console.time('fast parse');
let sum3 = 0;
for(let j=0; j<100; j++) {
  transactions.forEach(t => {
    const ty = parseInt(t.date.substring(0,4), 10);
    const tm = parseInt(t.date.substring(5,7), 10) - 1;
    if (ty === 2024 && tm === 5) {
      sum3 += t.amount;
    }
  });
}
console.timeEnd('fast parse');
