const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Page loaded successfully');
  
  // Test #btnNewTx
  try {
    await page.evaluate(() => document.querySelector('#btnNewTx').click());
    await new Promise(r => setTimeout(r, 300));
    const isTxVisible = await page.evaluate(() => {
      const modal = document.querySelector('#m-tx');
      return modal && !modal.hidden && window.getComputedStyle(modal).display !== 'none';
    });
    console.log('TX Modal visible via #btnNewTx:', isTxVisible);
    
    // Close modal
    await page.evaluate(() => window.closeM('m-tx'));
    await new Promise(r => setTimeout(r, 200));
  } catch (e) {
    console.log('Error testing #btnNewTx:', e.message);
  }
  
  // Test #btnNewSaving
  try {
    await page.evaluate(() => document.querySelector('#btnNewSaving').click());
    await new Promise(r => setTimeout(r, 300));
    const isSavingVisible = await page.evaluate(() => {
      const modal = document.querySelector('#m-saving');
      return modal && !modal.hidden && window.getComputedStyle(modal).display !== 'none';
    });
    console.log('Saving Modal visible via #btnNewSaving:', isSavingVisible);
    
    // Close modal
    await page.evaluate(() => window.closeM('m-saving'));
    await new Promise(r => setTimeout(r, 200));
  } catch (e) {
    console.log('Error testing #btnNewSaving:', e.message);
  }

  // Test #btnNewTx2
  try {
    await page.evaluate(() => document.querySelector('#btnNewTx2').click());
    await new Promise(r => setTimeout(r, 300));
    const isTx2Visible = await page.evaluate(() => {
      const modal = document.querySelector('#m-tx');
      return modal && !modal.hidden && window.getComputedStyle(modal).display !== 'none';
    });
    console.log('TX Modal visible via #btnNewTx2:', isTx2Visible);
  } catch (e) {
    console.log('Error testing #btnNewTx2:', e.message);
  }

  await browser.close();
  process.exit(0);
})();
