const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Page loaded successfully');
  
  // 1. Initial page (Dashboard)
  const initialText = await page.evaluate(() => document.querySelector('#btnNewTx').innerText);
  console.log('Initial top-right button text:', initialText.trim());
  
  // 2. Navigate to 'guardado'
  await page.evaluate(() => window.navigate('guardado'));
  await new Promise(r => setTimeout(r, 300));
  
  const guardadoText = await page.evaluate(() => document.querySelector('#btnNewTx').innerText);
  console.log('Top-right button text on Dinheiro Guardado page:', guardadoText.trim());
  
  // Click top-right button on 'guardado'
  await page.evaluate(() => document.querySelector('#btnNewTx').click());
  await new Promise(r => setTimeout(r, 300));
  
  const isSavingModalVisible = await page.evaluate(() => {
    const modal = document.querySelector('#m-saving');
    return modal && !modal.hidden && window.getComputedStyle(modal).display !== 'none';
  });
  console.log('Saving Modal opened via dynamic header button:', isSavingModalVisible);
  
  await page.evaluate(() => window.closeM('m-saving'));
  await new Promise(r => setTimeout(r, 200));

  // 3. Navigate back to 'lancamentos'
  await page.evaluate(() => window.navigate('lancamentos'));
  await new Promise(r => setTimeout(r, 300));
  
  const lancamentosText = await page.evaluate(() => document.querySelector('#btnNewTx').innerText);
  console.log('Top-right button text on Lançamentos page:', lancamentosText.trim());

  await browser.close();
  process.exit(0);
})();
