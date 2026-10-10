// Reads the NBN price sheet (Excel) into rows for admin_import_prices. Shared by the app and the test script.
const SHEET_CODES = {'Milk & Formula':'MILK','Baby & Diapers':'BABY','Laundry & Cleaning':'WASH','Drinks':'DRINK','Groceries & Pantry':'FOOD','Personal Care':'CARE','Household':'HOME','Toys & Kids':'TOYS'};
function priceSheetRows(XLSX, wb){
  const ws = wb.Sheets['Price List'];
  if(!ws) throw new Error('This file has no "Price List" tab. Use the NBN price sheet.');
  const grid = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:''});
  const hi = grid.findIndex(r => r.some(c => String(c).trim() === 'Item ID'));
  if(hi < 0) throw new Error('Could not find the header row (Item ID).');
  const H = grid[hi].map(c => String(c).trim().toLowerCase());
  const col = n => H.findIndex(h => h.startsWith(n));
  const ix = {id:col('item id'), cat:col('category'), brand:col('brand'), name:col('product name'), size:col('size'), unit:col('unit'),
    sp:col('shopee price'), sl:col('shopee link'), ss:col('shopee in stock'), lp:col('lazada price'), ll:col('lazada link'), ls:col('lazada in stock'),
    d:col('date checked'), kw:col('app keywords')};
  const num = v => { if(v === '' || v == null) return ''; const n = Number(String(v).replace(/rm/i,'').replace(/,/g,'').trim()); return isFinite(n) && n > 0 ? n : ''; };
  const day = v => {
    if(v === '' || v == null) return '';
    if(typeof v === 'number'){ const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` : ''; }
    const m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);   // 10/10/2026 = day/month/year
    if(m){ const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
    const t = Date.parse(v); return isNaN(t) ? '' : new Date(t).toISOString().slice(0,10);
  };
  const stock = v => String(v).trim().toUpperCase().startsWith('N') ? 'N' : 'Y';
  const counts = {}, rows = [], problems = [];
  grid.slice(hi + 1).forEach((r, k) => {
    const g = key => ix[key] >= 0 ? r[ix[key]] : '';
    const cat = String(g('cat')).trim(), product = String(g('name')).trim(), brandTxt = String(g('brand')).trim();
    const name = product && brandTxt && !product.toLowerCase().startsWith(brandTxt.toLowerCase()) ? brandTxt + ' ' + product : product;
    if(!cat || !name) return;
    const code = SHEET_CODES[cat];
    if(!code){ problems.push(`Row ${hi + k + 2}: unknown category "${cat}"`); return; }
    counts[code] = (counts[code] || 0) + 1;
    const id = String(g('id')).trim() || `${code}-${String(counts[code]).padStart(3,'0')}`;
    const row = { item_id:id, category:cat, brand:String(g('brand')).trim(), name, size:String(g('size')).trim(), unit:String(g('unit')).trim(),
      keywords:String(g('kw')).trim(),
      shopee_price:num(g('sp')), shopee_link:String(g('sl')).trim(), shopee_stock:stock(g('ss')),
      lazada_price:num(g('lp')), lazada_link:String(g('ll')).trim(), lazada_stock:stock(g('ls')),
      checked:day(g('d')) };
    for(const p of ['shopee','lazada']){
      if(row[p + '_price'] !== '' && !/^https?:\/\//i.test(row[p + '_link'])){ problems.push(`${id}: ${p} price has no product link`); }
      if(row[p + '_link'] && !(p === 'shopee' ? /shopee|shope\.ee/i : /lazada/i).test(row[p + '_link'])){ problems.push(`${id}: ${p} link is not a ${p} link`); row[p + '_link'] = ''; row[p + '_price'] = ''; }
    }
    rows.push(row);
  });
  return { rows, problems, priced: rows.filter(r => r.shopee_price !== '' || r.lazada_price !== '').length };
}
if(typeof module !== 'undefined') module.exports = { priceSheetRows };
