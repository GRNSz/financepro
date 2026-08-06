/**
 * ofxParser.js — parse OFX/QFX bank statement files
 * Returns an array of normalized transaction objects.
 */
function parseOFX(text) {
  const results = [];

  // OFX files are often in SGML (not XML) format. Extract <STMTTRN> blocks.
  const blocks = text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];

  if (blocks.length > 0) {
    // XML-style OFX
    blocks.forEach(block => {
      const get = tag => {
        const m = block.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`, 'i'));
        return m ? m[1].trim() : null;
      };
      const rawDate = get('DTPOSTED') || get('DTTRADE');
      const rawAmt  = parseFloat(get('TRNAMT') || '0');
      const memo    = get('MEMO') || get('NAME') || 'Importado';

      if (!rawDate) return;
      const dateStr = rawDate.replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3');

      results.push({
        id: '_ofx_' + crypto.randomUUID(),
        type: rawAmt >= 0 ? 'income' : 'expense',
        description: memo,
        amount: Math.abs(rawAmt),
        date: dateStr,
      });
    });
  } else {
    // SGML-style OFX (flat lines)
    let current = {};
    text.split('\n').forEach(line => {
      line = line.trim();
      if (line === '<STMTTRN>') { current = {}; return; }
      if (line === '</STMTTRN>') {
        if (current.date && current.amount !== undefined) {
          results.push({
            id: '_ofx_' + crypto.randomUUID(),
            type: current.amount >= 0 ? 'income' : 'expense',
            description: current.memo || 'Importado',
            amount: Math.abs(current.amount),
            date: current.date,
          });
        }
        current = {};
        return;
      }
      const m = line.match(/^<([^>]+)>(.*)$/);
      if (!m) return;
      const [, tag, val] = m;
      if (tag === 'DTPOSTED' || tag === 'DTTRADE') {
        current.date = val.trim().replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3');
      } else if (tag === 'TRNAMT') {
        current.amount = parseFloat(val.trim().replace(',', '.'));
      } else if (tag === 'MEMO' || tag === 'NAME') {
        current.memo = val.trim();
      }
    });
  }

  return results;
}
