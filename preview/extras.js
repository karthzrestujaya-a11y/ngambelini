// NBN preview (21 Oct 2026): "Rezeki kita, kita kongsi" layout. Loaded only by /preview/index.html.
(function(){
const L = window.NBN_LANGS || {};
const add = (lang, o) => { L[lang] = Object.assign(L[lang] || {}, o); };
add('en', { yourSavings:'Duit balik keluarga NBN', ttlItem:'Item', ttlBand:'⚖️ Compare per unit', ttlJoin:'Log in',
  bandBtn:'⚖️ Compare size / shop (price per unit)', bandAdd:'➕ Another size or shop? Add a link to compare',
  bandSub:'Paste 2–3 Shopee links, then type each price and size.', bandLink:'Shopee link (optional)', bandPrice:'Price (RM)', bandSize:'Size',
  bandMore:'➕ Add link 3', bandBest:'Best value', bandBuy:'👉 Buy link {n}', bandSave:'Save {a} per {u}', bandNeed:'Fill in price and size for at least 2 links.',
  bandBuyBtn:'Buy on Shopee through NBN', cbAvail:'✅ Cash back available for this item', howCb:'❓ How cash back works',
  tabCash:'💸 Cash back', tabAjak:'🤝 Invite friends', ajakT:'🤝 Invite friends, share the rezeki', ajakSub:'RM1 thank-you when your friend buys for the first time (min RM20, max 5 a day)',
  ajakPh:'Friend\'s phone: 01x-xxxxxxx', ajakSend:'📲 Send invite on WhatsApp', ajakPick:'or choose a friend in WhatsApp', ajakToday:'Today: {n}/5', ajakJoined:'Joined: {n}', ajakReward:'Reward: {a}',
  ajakLogin:'Log in to get your invite link', ajakMax:'You have sent 5 invites today. Try again tomorrow 🙏', ajakHowT:'How it works',
  ajakH1:'Send an invite to a friend', ajakH2:'Your friend signs up and buys for the first time (min RM20)', ajakH3:'When Shopee confirms the order, you get RM1',
  ajakMsg:'Hi! I use *NBN – Ngam Beli Ni* 🛒\nShop on Shopee as usual, but get *cash back*. Free!\n👉 {link}\nRezeki kita, kita kongsi 🤝', smallNote:'Pilot. Prices checked by hand. We share part of our commission with you.' });
add('ms', { yourSavings:'Duit balik keluarga NBN', ttlItem:'Barang', ttlBand:'⚖️ Banding harga seunit', ttlJoin:'Log masuk',
  bandBtn:'⚖️ Banding saiz / kedai (harga seunit)', bandAdd:'➕ Ada saiz / kedai lain? Tambah link untuk banding',
  bandSub:'Tampal 2–3 link Shopee, kemudian taip harga dan saiz.', bandLink:'Link Shopee (pilihan)', bandPrice:'Harga (RM)', bandSize:'Saiz',
  bandMore:'➕ Tambah link ke-3', bandBest:'Paling jimat', bandBuy:'👉 Beli link {n}', bandSave:'Jimat {a} se{u}', bandNeed:'Isi harga dan saiz untuk sekurang-kurangnya 2 link.',
  bandBuyBtn:'Beli di Shopee melalui NBN', cbAvail:'✅ Duit balik tersedia untuk barang ini', howCb:'❓ Macam mana duit balik berfungsi',
  tabCash:'💸 Duit balik', tabAjak:'🤝 Ajak kawan', ajakT:'🤝 Ajak kawan, kongsi rezeki', ajakSub:'RM1 terima kasih bila kawan anda beli kali pertama (min RM20, maks 5 sehari)',
  ajakPh:'No. telefon kawan: 01x-xxxxxxx', ajakSend:'📲 Hantar jemputan di WhatsApp', ajakPick:'atau pilih kawan dalam WhatsApp', ajakToday:'Hari ini: {n}/5', ajakJoined:'Berjaya: {n}', ajakReward:'Ganjaran: {a}',
  ajakLogin:'Log masuk untuk dapat link jemputan anda', ajakMax:'Anda dah hantar 5 jemputan hari ini. Cuba esok 🙏', ajakHowT:'Macam mana ia berfungsi',
  ajakH1:'Hantar jemputan kepada kawan', ajakH2:'Kawan daftar & beli kali pertama (min RM20)', ajakH3:'Bila Shopee sahkan pesanan, anda dapat RM1',
  ajakMsg:'Hi! Aku guna *NBN – Ngam Beli Ni* 🛒\nBeli kat Shopee macam biasa, tapi dapat *duit balik*. Percuma!\n👉 {link}\nRezeki kita, kita kongsi 🤝', smallNote:'Pilot. Harga disemak dengan tangan. Kami kongsi sebahagian komisen dengan anda.' });
['ta','zh'].forEach(l => add(l, { yourSavings:'Duit balik keluarga NBN' }));

const $ = id => document.getElementById(id);
const tt = (k, v) => t(k, v);
const mk = (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; };
const lsG = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsS = (k, v) => { try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(e){} };

// ---- Referral code from invite link (?ajak=CODE) ----
try{ const a = new URLSearchParams(location.search).get('ajak'); if(a && /^[a-z0-9]{6,12}$/i.test(a)) lsS('nbn-ajak', a.toLowerCase()); }catch(e){}
async function claimReferral(){
  const code = lsG('nbn-ajak'); if(!code || !sb || !USER) return;
  try{ await sb.rpc('set_referrer', { p_code: code }); }catch(e){}
  lsS('nbn-ajak', null);
}

// ---- Page titles in the slim header ----
const oldShow = window.show;
window.show = function(view){
  oldShow(view);
  const T = { compare: 'ttlItem', join: 'ttlJoin', banding: 'ttlBand' };
  if(view === 'banding'){ ['join','home','results','compare','wallet','me','admin','privacy'].forEach(v => { const e = $(v); if(e) e.hidden = true; }); const b = $('banding'); b.hidden = false; b.style.display = 'flex'; document.body.classList.remove('on-home'); }
  else if($('banding')) $('banding').hidden = true;
  if(T[view]){ $('pageTitle').textContent = tt(T[view]); document.body.classList.add('has-title'); }
  if(USER && lsG('nbn-ajak')) claimReferral();
};

// ---- Home: Banding button under the savings card ----
const bb = mk('button', 'bandbtn', `<span data-t="bandBtn">${tt('bandBtn')}</span><span>›</span>`); bb.type = 'button';
bb.onclick = () => openBanding();
$('miniSave').after(bb);

// ---- Item page: cash back badge + "add link to compare" ----
const oldOpen = window.openCompare;
window.openCompare = function(it){
  oldOpen(it);
  const c = $('compare');
  c.querySelectorAll('.note.warn, .soon, .note.bad').forEach(e => e.remove());
  const fines = c.querySelectorAll('p.fine'); if(fines.length) fines[fines.length - 1].textContent = tt('smallNote');
  c.querySelectorAll('#offers .offer a.btn.Shopee').forEach(a => { a.before(mk('div', 'cbbadge', tt('cbAvail'))); });
  const ad = mk('button', 'bandadd', tt('bandAdd')); ad.type = 'button';
  const s = [...it.offers].sort((a,b)=>perUnit(a)-perUnit(b))[0];
  ad.onclick = () => openBanding({ link: s && s.url ? s.url : '', price: s ? s.price : '', size: s && s.qty ? s.qty : '', unit: it.unit || 'kg', name: it.name + ' ' + it.size });
  $('offers').after(ad);
};

// ---- Banding page ----
const sec = mk('section', 'view', ''); sec.id = 'banding'; sec.hidden = true; sec.style.cssText = 'flex-direction:column;gap:12px';
document.querySelector('#compare').after(sec);
const UNITS = { g:['kg',0.001], kg:['kg',1], ml:['L',0.001], l:['L',1], pcs:['pc',1] };
function sizeFrom(txt){ const m = String(txt||'').toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|liter|litre|pcs|pc|biji|keping)\b/); if(!m) return null;
  let u = m[2]; if(/^(liter|litre)$/.test(u)) u='l'; if(/^(pc|biji|keping)$/.test(u)) u='pcs'; return { size: parseFloat(m[1].replace(',','.')), unit: u }; }
function row(i, d){
  d = d || {};
  const r = mk('div', 'bandrow', `<b>Link ${i}${d.name ? ' · ' + d.name.slice(0,40) : ''}</b>
    <input class="bl" type="url" placeholder="${tt('bandLink')}" value="${d.link || ''}">
    <div class="bandnums"><input class="bp" type="number" inputmode="decimal" step="0.01" placeholder="${tt('bandPrice')}" value="${d.price || ''}">
    <input class="bs" type="number" inputmode="decimal" step="0.01" placeholder="${tt('bandSize')}" value="${d.size || ''}">
    <select class="bu"><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">L</option><option value="pcs">pcs</option></select></div>
    <div class="bandres"></div>`);
  if(d.unit) r.querySelector('.bu').value = String(d.unit).toLowerCase() === 'l' ? 'l' : String(d.unit).toLowerCase();
  r.querySelector('.bl').addEventListener('change', e => { const n = (typeof nameFromLink === 'function') ? nameFromLink(e.target.value) : ''; const z = sizeFrom(n); if(z){ r.querySelector('.bs').value = z.size; r.querySelector('.bu').value = z.unit; } if(n){ r.querySelector('b').textContent = 'Link ' + i + ' · ' + n.slice(0,40); } calc(); });
  r.querySelectorAll('input,select').forEach(x => x.addEventListener('input', calc));
  return r;
}
function calc(){
  const rows = [...sec.querySelectorAll('.bandrow')]; const out = $('bandOut'); out.innerHTML = '';
  const vals = rows.map((r,i) => { const p = parseFloat(r.querySelector('.bp').value), s = parseFloat(r.querySelector('.bs').value), u = r.querySelector('.bu').value;
    r.classList.remove('win'); const res = r.querySelector('.bandres'); res.textContent = '';
    if(!(p > 0 && s > 0)) return null; const [lab, f] = UNITS[u]; const per = p / (s * f); res.textContent = 'RM' + per.toFixed(2) + ' / ' + lab; return { i: i+1, per, lab, r, link: r.querySelector('.bl').value.trim() }; }).filter(Boolean);
  if(vals.length < 2){ out.appendChild(mk('p','fine', tt('bandNeed'))); return; }
  const labs = new Set(vals.map(v => v.lab)); if(labs.size > 1){ out.appendChild(mk('p','fine','⚠️ g/kg, ml/L, pcs: pilih unit yang sama untuk semua link.')); return; }
  vals.sort((a,b) => a.per - b.per); const w = vals[0], n2 = vals[1];
  w.r.classList.add('win'); w.r.querySelector('.bandres').innerHTML += ` <span class="badge" style="background:var(--gold);color:#14563A">${tt('bandBest')}</span>`;
  out.appendChild(mk('div', 'verdict', `<b>${tt('bandBuy',{n:w.i})}</b><span class="num">${tt('bandSave',{a:'RM'+(n2.per-w.per).toFixed(2), u:w.lab})}</span>`));
  const a = mk('a', 'btn Shopee primary', tt('bandBuyBtn')); a.target = '_blank'; a.rel = 'noopener';
  a.href = /shopee|shope\.ee|shp\.ee/i.test(w.link) ? shopeeAff(w.link) : shopeeAff('https://shopee.com.my/');
  a.addEventListener('click', () => { try{ track('buy', 'banding link ' + w.i); }catch(e){} if(sb && !USER) toast(GUEST_TOAST[LANG]||GUEST_TOAST.en); });
  out.appendChild(mk('div','cbbadge', tt('cbAvail'))); out.appendChild(a);
}
window.openBanding = function(pre){
  sec.innerHTML = `<button class="back" type="button" data-go="home">${t('back')}</button><p class="muted" style="margin:0">${tt('bandSub')}</p><div id="bandRows" style="display:flex;flex-direction:column;gap:10px"></div>`;
  const R = sec.querySelector('#bandRows'); R.appendChild(row(1, pre)); R.appendChild(row(2));
  const more = mk('button', 'bandadd', tt('bandMore')); more.type = 'button'; more.onclick = () => { R.appendChild(row(3)); more.remove(); calc(); };
  sec.appendChild(more); const out = mk('div', null, ''); out.id = 'bandOut'; out.style.cssText = 'display:flex;flex-direction:column;gap:10px'; sec.appendChild(out);
  show('banding'); calc(); try{ track('compare', 'banding'); }catch(e){}
};

// ---- Earnings: "how cash back works" collapsed, + Ajak kawan tab ----
const steps = document.querySelector('#wallet .note.warn');
const how = mk('button', 'howrow', `<span>${tt('howCb')}</span><span>›</span>`); how.type = 'button';
steps.before(how); steps.style.display = 'none'; how.onclick = () => { steps.style.display = steps.style.display === 'none' ? '' : 'none'; };
const seg = $('wSeg'); const wa = mk('button', null, tt('tabAjak')); wa.type = 'button'; wa.id = 'wsAjak'; seg.appendChild(wa);
$('wsCash').textContent = tt('tabCash');
const aj = mk('div', 'ajak', ''); aj.id = 'ajakBox'; aj.hidden = true; seg.after(aj);
function ajTab(on){
  $('wsCash').classList.toggle('on', !on); wa.classList.toggle('on', on); aj.hidden = !on;
  const sv = document.querySelector('#wallet .savings'); if(sv) sv.hidden = on; how.hidden = on; if(on) steps.style.display = 'none';
  if(on) loadAjak();
}
wa.onclick = () => ajTab(true); $('wsCash').addEventListener('click', () => ajTab(false));
const dayKey = () => 'nbn-ajak-' + new Date().toISOString().slice(0,10);
async function loadAjak(){
  const sent = Number(lsG(dayKey()) || 0);
  if(!sb || !USER){ aj.innerHTML = `<b class="ajt">${tt('ajakT')}</b><p class="fine" style="margin:0">${tt('ajakSub')}</p><button type="button" class="btn-wide" id="ajLogin">${tt('ajakLogin')}</button>`; $('ajLogin').onclick = () => goLogin(); return; }
  let r = null; try{ ({ data: r } = await sb.rpc('my_referrals')); }catch(e){}
  const code = r && r.code ? r.code : USER.id.replace(/-/g,'').slice(0,10);
  const link = 'https://ngambelini.com/?ajak=' + code;
  aj.innerHTML = `<b class="ajt">${tt('ajakT')}</b><p class="fine" style="margin:0">${tt('ajakSub')}</p>
    <input id="ajPhone" type="tel" inputmode="tel" placeholder="${tt('ajakPh')}">
    <button type="button" class="wabtn" id="ajSend">${tt('ajakSend')}</button>
    <button type="button" class="link" id="ajPick" style="align-self:center;font-weight:700">${tt('ajakPick')}</button>
    <div class="ajstats"><span>${tt('ajakToday',{n:sent})}</span><span>${tt('ajakJoined',{n:r ? r.joined : 0})}</span><span>${tt('ajakReward',{a:'RM'+Number(r ? r.reward_rm : 0).toFixed(2)})}</span></div>
    <div class="note warn"><b>${tt('ajakHowT')}</b><ol style="margin:6px 0 0;padding-left:18px"><li>${tt('ajakH1')}</li><li>${tt('ajakH2')}</li><li>${tt('ajakH3')}</li></ol></div>`;
  const msg = encodeURIComponent(tt('ajakMsg', { link }));
  const go = num => { const n = Number(lsG(dayKey()) || 0); if(n >= 5){ toast(tt('ajakMax')); return; } lsS(dayKey(), String(n + 1)); try{ track('join', 'invite_sent'); }catch(e){} window.open('https://wa.me/' + (num || '') + '?text=' + msg, '_blank'); setTimeout(loadAjak, 800); };
  $('ajSend').onclick = () => { let p = ($('ajPhone').value || '').replace(/\D/g,''); if(p.startsWith('0')) p = '6' + p; if(p.length < 10){ $('ajPhone').focus(); return; } go(p); };
  $('ajPick').onclick = () => go('');
}
// Snap & Earn stays switched off in this layout
const ss = $('wsSnap'); if(ss){ ss.style.display = 'none'; }
const sc = $('snapCard'); if(sc){ sc.style.display = 'none'; }
window.loadSnap = function(){};

// ---- Paste any Shopee link -> item page with Buy through NBN (21 Oct 2026) ----
add('en', { pasteBtn:'📋 Paste Shopee link', pasteHelp:'Tap and hold the box, then tap Paste.', linkTitle:'Your Shopee item', linkSub:'Buy on Shopee as usual. Same price, same seller.',
  gateT:'Log in to get your cash back', gateS:'Takes 1 minute. No password, just a code to your email.', gateLogin:'Log in', gateSkip:'Continue without cash back', ttlLink:'Item', notShopee:'Please paste a Shopee link.' });
add('ms', { pasteBtn:'📋 Tampal link Shopee', pasteHelp:'Tekan lama dalam kotak, kemudian tekan Paste.', linkTitle:'Barang Shopee anda', linkSub:'Beli di Shopee macam biasa. Harga sama, kedai sama.',
  gateT:'Log masuk untuk dapat duit balik', gateS:'1 minit sahaja. Tiada kata laluan, hanya kod ke emel anda.', gateLogin:'Log masuk', gateSkip:'Teruskan tanpa duit balik', ttlLink:'Barang', notShopee:'Sila tampal link Shopee.' });

const lp = mk('section', 'view', ''); lp.id = 'linkpage'; lp.hidden = true; lp.style.cssText = 'flex-direction:column;gap:12px';
sec.after(lp);
const gate = mk('div', '', ''); gate.id = 'nbnGate';
gate.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center;z-index:999';
gate.innerHTML = `<div style="background:#fff;border-radius:20px 20px 0 0;padding:20px 18px 26px;width:100%;max-width:520px;display:flex;flex-direction:column;gap:10px">
  <b style="font-size:17px;color:#14563A" id="gT"></b><p class="fine" style="margin:0" id="gS"></p>
  <button type="button" class="btn-wide" id="gLogin"></button>
  <button type="button" class="link" id="gSkip" style="align-self:center;font-weight:700;padding:6px"></button></div>`;
document.body.appendChild(gate);
gate.addEventListener('click', e => { if(e.target === gate) gate.style.display = 'none'; });

let CUR = null;   // { url, name, href }
async function resolveLink(url){
  if(!(sb && USER)) return null;
  try{ const { data } = await sb.functions.invoke('resolve-link', { body: { link: url } }); return data || null; }catch(e){ return null; }
}
function buyHref(){ return shopeeAff(CUR.full || CUR.url); }
function openLinkPage(url){
  const name = (typeof nameFromLink === 'function' ? nameFromLink(url) : '') || '';
  CUR = { url, name, full: /^(https?:\/\/)?(s\.|my\.shp\.ee|shp\.ee|shope\.ee)/i.test(url) ? '' : url };
  lp.innerHTML = `<button class="back" type="button" data-go="home">${t('back')}</button>
    <div class="bandrow" style="gap:6px"><span style="font-size:30px">🛍️</span><b style="font-size:16px" id="lpName">${name || tt('linkTitle')}</b>
    <span class="fine" style="word-break:break-all">${url.replace(/^https?:\/\//,'').slice(0,60)}</span></div>
    <p class="muted" style="margin:0">${tt('linkSub')}</p>
    <div class="cbbadge">${tt('cbAvail')}</div>
    <a class="btn Shopee primary" id="lpBuy" target="_blank" rel="noopener">${tt('bandBuyBtn')}</a>
    <button type="button" class="bandadd" id="lpAdd">${tt('bandAdd')}</button>
    <p class="fine" style="margin:0">${tt('smallNote')}</p>`;
  const buy = lp.querySelector('#lpBuy'); buy.href = buyHref();
  buy.addEventListener('click', e => {
    if(sb && !USER){ e.preventDefault(); openGate(); return; }
    buy.href = buyHref();
    try{ track('buy', 'link ' + (CUR.name || CUR.url).slice(0,80)); }catch(_){}
    if(sb && USER){ sb.from('clicks').insert({ user_id: USER.id, platform: 'shopee', search_term: (CUR.name || CUR.url).slice(0,120), saving_rm: 0 }).then(()=>{}); }
    lsS('nbn-pending', null);
  });
  lp.querySelector('#lpAdd').onclick = () => openBanding({ link: url, name: CUR.name });
  show('linkpage'); try{ track('compare', 'link'); }catch(e){}
  resolveLink(url).then(d => { if(!d || CUR.url !== url) return; if(d.resolved) CUR.full = d.resolved; if(d.name){ CUR.name = d.name; const n = $('lpName'); if(n) n.textContent = d.name; } buy.href = buyHref(); });
}
function openGate(){
  $('gT').textContent = tt('gateT'); $('gS').textContent = tt('gateS'); $('gLogin').textContent = tt('gateLogin'); $('gSkip').textContent = tt('gateSkip');
  gate.style.display = 'flex';
  $('gLogin').onclick = () => { gate.style.display = 'none'; lsS('nbn-pending', CUR.url); goLogin(); };
  $('gSkip').onclick = () => { gate.style.display = 'none'; try{ track('buy', 'link guest'); }catch(e){} lsS('nbn-pending', null); window.open(buyHref(), '_blank'); };
}
window.searchLink = async function(link){
  const m = String(link).match(/https?:\/\/\S+/i) || String(link).match(/\b(?:s\.shopee\.com\.my|shopee\.com\.my|my\.shp\.ee|shp\.ee|shope\.ee)\/\S*/i);
  if(!m) return false;
  let url = m[0]; if(!/^https?:/i.test(url)) url = 'https://' + url;
  let host = ''; try{ host = new URL(url).hostname; }catch(e){ return false; }
  if(!/shopee\.com\.my|shope\.ee|shp\.ee/i.test(host)){ toast(tt('notShopee')); return true; }
  $('q').value = ''; $('q').blur(); openLinkPage(url); return true;
};
// also catch links typed/pasted without https://
const oldSearch = window.search;
window.search = function(term, done){ if(!done && /(shopee\.com\.my|shp\.ee|shope\.ee)\//i.test(term || '')){ window.searchLink(term); return; } return oldSearch(term, done); };

// Paste button under the box (iPhone shows its own "Allow Paste" prompt: that's normal)
const pb = mk('button', 'bandbtn', `<span>${tt('pasteBtn')}</span><span>›</span>`); pb.type = 'button';
pb.style.cssText = 'margin-top:8px;justify-content:center;gap:8px;background:#14774A;color:#fff;border-color:#14774A';
pb.onclick = async () => {
  try{ const txt = await navigator.clipboard.readText(); if(txt && await window.searchLink(txt)) return; toast(tt('notShopee')); }
  catch(e){ $('q').focus(); toast(tt('pasteHelp')); }
};
$('searchForm').after(pb);

// views: page title + link page visibility; reopen the pasted link after login
const show2 = window.show;
window.show = function(view){
  if(view === 'linkpage'){ show2('home'); ['join','home','results','compare','wallet','me','admin','privacy','banding'].forEach(v => { const e = $(v); if(e) e.hidden = true; });
    lp.hidden = false; lp.style.display = 'flex'; document.body.classList.remove('on-home'); $('pageTitle').textContent = tt('ttlLink'); document.body.classList.add('has-title'); window.scrollTo(0,0); return; }
  lp.hidden = true; show2(view);
  if(view === 'home' && USER){ const p = lsG('nbn-pending'); if(p){ lsS('nbn-pending', null); setTimeout(() => openLinkPage(p), 50); } }
};

if(typeof applyLang === 'function') applyLang();
})();
