const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  
  try {
    await page.evaluate(() => document.querySelector('#btnNewTx').click());
    await new Promise(r => setTimeout(r, 500));
    
    const isTxModalVisible = await page.evaluate(() => {
      const modal = document.querySelector('#m-tx');
      return modal && !modal.hidden && window.getComputedStyle(modal).display !== 'none';
    });
    console.log('TX Modal visible:', isTxModalVisible);
  } catch (e) {
    console.log('Error clicking #btnNewTx:', e.message);
  }
  
  try {
    await page.evaluate(() => document.querySelector('#btnNewSaving').click());
    await new Promise(r => setTimeout(r, 500));
    
    const isSavingModalVisible = await page.evaluate(() => {
      const modal = document.querySelector('#m-saving');
      return modal && !modal.hidden && window.getComputedStyle(modal).display !== 'none';
    });
    console.log('Saving Modal visible:', isSavingModalVisible);
  } catch (e) {
    console.log('Error clicking #btnNewSaving:', e.message);
  }

  await browser.close();
  process.exit(0);
})();
