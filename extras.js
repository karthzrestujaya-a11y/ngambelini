// NBN preview (21 Oct 2026): "Rezeki kita, kita kongsi" layout. Loaded only by /preview/index.html.
(function(){
const L = window.NBN_LANGS || {};
const add = (lang, o) => { L[lang] = Object.assign(L[lang] || {}, o); };
add('en', { yourSavings:'Duit balik keluarga NBN', ttlItem:'Item', ttlBand:'⚖️ Compare per unit', ttlJoin:'Log in',
  bandBtn:'⚖️ Compare size / shop (price per unit)', bandAdd:'➕ Another size or shop? Add a link to compare',
  bandSub:'Paste 2–3 Shopee links, then type each price and size.', bandLink:'Shopee link (optional)', bandPrice:'Price (RM)', bandSize:'Size',
  bandMore:'➕ Add link 3', bandBest:'Best value', bandBuy:'👉 Buy link {n}', bandSave:'Save {a} per {u}', bandNeed:'Fill in price and size for at least 2 links.',
  bandBuyBtn:'Buy on Shopee through NBN', cbAvail:'✅ Cash back available for this item', howCb:'❓ How cash back works',
  tabCash:'💸 Cash back', tabAjak:'🤝 Invite friends', ajakT:'🤝 Invite friends, share the rezeki', ajakSub:'RM1 goes into your coin box when your friend makes their first order (min RM30). Take it out once you reach RM5.',
  ajakPh:'Friend\'s phone: 01x-xxxxxxx', ajakSend:'📲 Send invite on WhatsApp', ajakPick:'or choose a friend in WhatsApp', ajakToday:'Today: {n}/5', ajakJoined:'Joined: {n}', ajakReward:'Coin box: {a}',
  ajakLogin:'Log in to get your invite link', ajakMax:'You have sent 5 invites today. Try again tomorrow 🙏', ajakHowT:'How it works',
  ajakH1:'Send an invite to a friend', ajakH2:'Your friend signs up and buys for the first time (min RM30)', ajakH3:'When Shopee confirms the order, RM1 goes into your coin box (paid out from RM5)',
  ajakMsg:'Hi! I use *NBN – Ngam Beli Ni* 🛒\nShop on Shopee as usual, but get *cash back*. Free!\n👉 {link}\nRezeki kita, kita kongsi 🤝', smallNote:'Pilot. Prices checked by hand. We share part of our commission with you.' });
add('ms', { yourSavings:'Duit balik keluarga NBN', ttlItem:'Barang', ttlBand:'⚖️ Banding harga seunit', ttlJoin:'Log masuk',
  bandBtn:'⚖️ Banding saiz / kedai (harga seunit)', bandAdd:'➕ Ada saiz / kedai lain? Tambah link untuk banding',
  bandSub:'Tampal 2–3 link Shopee, kemudian taip harga dan saiz.', bandLink:'Link Shopee (pilihan)', bandPrice:'Harga (RM)', bandSize:'Saiz',
  bandMore:'➕ Tambah link ke-3', bandBest:'Paling jimat', bandBuy:'👉 Beli link {n}', bandSave:'Jimat {a} se{u}', bandNeed:'Isi harga dan saiz untuk sekurang-kurangnya 2 link.',
  bandBuyBtn:'Beli di Shopee melalui NBN', cbAvail:'✅ Duit balik tersedia untuk barang ini', howCb:'❓ Macam mana duit balik berfungsi',
  tabCash:'💸 Duit balik', tabAjak:'🤝 Ajak kawan', ajakT:'🤝 Ajak kawan, kongsi rezeki', ajakSub:'RM1 masuk Tabung Syiling bila kawan anda buat pesanan pertama (min RM30). Keluarkan bila cukup RM5.',
  ajakPh:'No. telefon kawan: 01x-xxxxxxx', ajakSend:'📲 Hantar jemputan di WhatsApp', ajakPick:'atau pilih kawan dalam WhatsApp', ajakToday:'Hari ini: {n}/5', ajakJoined:'Berjaya: {n}', ajakReward:'Tabung Syiling: {a}',
  ajakLogin:'Log masuk untuk dapat link jemputan anda', ajakMax:'Anda dah hantar 5 jemputan hari ini. Cuba esok 🙏', ajakHowT:'Macam mana ia berfungsi',
  ajakH1:'Hantar jemputan kepada kawan', ajakH2:'Kawan daftar & beli kali pertama (min RM30)', ajakH3:'Bila Shopee sahkan pesanan, RM1 masuk Tabung Syiling anda (boleh keluarkan bila cukup RM5)',
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
  w.r.classList.add('win'); w.r.querySelector('.bandres').innerHTML += ` <span class="badge" style="background:var(--gold);color:#0A2A66">${tt('bandBest')}</span>`;
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
    <div class="ajstats"><span>${tt('ajakToday',{n:sent})}</span><span>${tt('ajakJoined',{n:r ? r.joined : 0})}</span><span>${tt('ajakReward',{a:'RM'+Number(r ? (r.ready_rm!=null ? Number(r.ready_rm)+Number(r.paid_rm||0) : r.reward_rm) : 0).toFixed(2)})}</span></div>
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
  <b style="font-size:17px;color:#0A2A66" id="gT"></b><p class="fine" style="margin:0" id="gS"></p>
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
  $('gSkip').onclick = () => { gate.style.display = 'none'; try{ track('buy', 'link guest'); }catch(e){} lsS('nbn-pending', null); openShopee(CUR.full || CUR.url); };
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
pb.style.cssText = 'margin-top:8px;justify-content:center;gap:8px;background:#1E4A8A;color:#fff;border-color:#1E4A8A';
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

// ---- 22 Oct: choose language after first log in + new "How to use" video ----
add('en', { howBtn:'▶️ How to use NBN (short video)', howT:'How to use NBN', pickT:'Choose your language' });
add('ms', { howBtn:'▶️ Cara guna NBN (video pendek)', howT:'Cara guna NBN', pickT:'Pilih bahasa anda' });
add('ta', { howBtn:'▶️ How to use NBN (short video)', howT:'How to use NBN', pickT:'Choose your language' });
add('zh', { howBtn:'▶️ How to use NBN (short video)', howT:'How to use NBN', pickT:'Choose your language' });
const HOWV = 3; // bump when the video files change
const howSrc = () => '/howto/NBN_howto_v' + HOWV + '_' + (LANG === 'ms' ? 'ms' : 'en') + '.mp4';
// old login-page video (18 Oct) is retired
if($('howto')) $('howto').remove();

function openHow(src, poster, title){
  if(typeof src!=='string'){ src=howSrc(); poster='/howto/poster_v'+HOWV+'_'+(LANG==='ms'?'ms':'en')+'.jpg'; title=tt('howT'); }
  const o = mk('div', 'nbnHow', `<div class="nbnHowBox"><div class="nbnHowTop"><b>${title}</b><button type="button" aria-label="Close">✕</button></div>
    <video controls playsinline autoplay src="${src}" poster="${poster}"></video></div>`);
  o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,40,25,.82);display:flex;align-items:center;justify-content:center;padding:16px';
  const box = o.firstChild; box.style.cssText = 'background:#fff;border-radius:18px;padding:12px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px';
  const top = box.firstChild; top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;color:#0A2A66;font-size:16px';
  top.lastChild.style.cssText = 'border:0;background:#F3EED9;border-radius:50%;width:34px;height:34px;font-size:16px;cursor:pointer';
  const v = box.querySelector('video'); v.style.cssText = 'width:100%;border-radius:12px;background:#0A2A66;aspect-ratio:9/16;max-height:70vh';
  const close = () => { try{ v.pause(); }catch(e){} o.remove(); };
  top.lastChild.onclick = close; o.onclick = e => { if(e.target === o) close(); };
  document.body.appendChild(o);
}
window.openHow = openHow;
const hb = mk('button', 'bandbtn', `<span data-t="howBtn">${tt('howBtn')}</span><span>›</span>`); hb.type = 'button';
hb.style.marginTop = '10px'; hb.onclick = () => openHow();
bb.after(hb);
// also on the log-in page, under the form
if($('joinForm')){ const hj = hb.cloneNode(true); hj.onclick = () => openHow(); $('joinForm').after(hj);
  const mkI = (label,k,t) => { const b = hb.cloneNode(false); b.type='button'; b.className = hb.className; b.style.marginTop='10px'; b.innerHTML = '<span>'+label+'</span><span>›</span>'; b.onclick = () => openHow('/howto/NBN_pasang_'+k+'.mp4','/howto/poster_pasang_'+k+'.jpg',t); return b; };
  const bi = mkI('▶️ How to install: iPhone','ios','How to install: iPhone'), ba = mkI('▶️ How to install: Android','and','How to install: Android');
  hj.after(bi); bi.after(ba); }

// ---- 22 Oct: "Kedai lain" page (coming soon), split by cash back ----
add('en', { storesBtn:'🏬 Other shops (coming soon)', storesT:'Other shops', storesLive:'Live now', storesCb:'✅ With cash back · coming soon', storesNo:'❌ No cash back · price check only · coming soon',
  storesNote:'Today NBN works with Shopee only. Other shops will be added step by step. Cash back depends on each shop\'s rules.', storesActive:'Cash back · active', storesSoon:'Coming soon' });
add('ms', { storesBtn:'🏬 Kedai lain (akan datang)', storesT:'Kedai lain', storesLive:'Aktif sekarang', storesCb:'✅ Ada duit balik · akan datang', storesNo:'❌ Tiada duit balik · semak harga sahaja · akan datang',
  storesNote:'Buat masa ini NBN guna Shopee sahaja. Kedai lain akan ditambah satu demi satu. Duit balik ikut peraturan setiap kedai.', storesActive:'Duit balik · aktif', storesSoon:'Akan datang' });
['ta','zh'].forEach(l => add(l, { storesBtn:'🏬 Other shops (coming soon)', storesT:'Other shops', storesLive:'Live now', storesCb:'✅ With cash back · coming soon', storesNo:'❌ No cash back · price check only · coming soon', storesNote:'Today NBN works with Shopee only. Other shops will be added step by step. Cash back depends on each shop\'s rules.', storesActive:'Cash back · active', storesSoon:'Coming soon' }));
const STORES_CB = [['TikTok Shop','#111111'],["Lotus's",'#00A19B'],['Watsons','#00A3AD'],['Sephora','#111111'],['Zalora','#111111'],['Uniqlo','#E60012'],['H&M','#E50010'],['iHerb','#458500'],['Xiaomi','#FF6900'],['Pets Wonderland','#7A3E9D'],['AliExpress','#E62E04'],['Shein','#111111']];
const STORES_NO = [['Lazada','#0F146D']];
function storeChip(n, c, soon){ return `<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid #EDE3C3;border-radius:14px;padding:10px 12px">
  <div style="width:40px;height:40px;border-radius:10px;background:${c};color:#fff;font-weight:900;font-size:16px;display:flex;align-items:center;justify-content:center;flex:none">${n.replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()}</div>
  <div style="flex:1;font-weight:800;color:#0A2A66;font-size:15px">${n}</div><div style="font-size:11px;font-weight:700;color:${soon?'#8A7A3D':'#1E4A8A'};background:${soon?'#FFF6D6':'#E6EDFA'};border-radius:8px;padding:3px 7px">${soon?tt('storesSoon'):tt('storesActive')}</div></div>`; }
function openStores(){
  const o = mk('div', '', ''); o.id = 'storesPage';
  o.style.cssText = 'position:fixed;inset:0;z-index:9990;background:#FFFBEF;overflow:auto;padding:16px 16px 40px';
  const grid = a => `<div style="display:grid;gap:8px">${a.map(x=>storeChip(x[0],x[1],true)).join('')}</div>`;
  o.innerHTML = `<div style="max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:14px">
   <div style="display:flex;align-items:center;gap:10px"><button type="button" id="storesBack" style="border:0;background:#F3EED9;border-radius:50%;width:38px;height:38px;font-size:18px;cursor:pointer">‹</button><h2 style="margin:0;color:#0A2A66">${tt('storesT')}</h2></div>
   <div style="font-weight:800;color:#0A2A66">${tt('storesLive')}</div>${storeChip('Shopee','#EE4D2D',false)}
   <div style="font-weight:800;color:#0A2A66;margin-top:6px">${tt('storesCb')}</div>${grid(STORES_CB)}
   <div style="font-weight:800;color:#8A2B2B;margin-top:6px">${tt('storesNo')}</div>${grid(STORES_NO)}
   <p class="fine" style="margin:6px 0 0;color:#5b665f;font-size:13px">${tt('storesNote')}</p></div>`;
  document.body.appendChild(o); o.querySelector('#storesBack').onclick = () => o.remove();
}
window.openStores = openStores;
const sb2 = mk('button', 'bandbtn', `<span data-t="storesBtn">${tt('storesBtn')}</span><span>›</span>`); sb2.type = 'button';
sb2.style.marginTop = '10px'; sb2.onclick = openStores; hb.after(sb2);
// v3 launch layout: Shopee only, so hide the compare and other-shops buttons (code kept for later)
bb.style.display = 'none'; sb2.style.display = 'none';

// ---- 22 Oct: Shop by category (items picked from Shopee affiliate offers, data in /cats.json) ----
add('en', { catT:'🛒 Shop by category', catSub:'Popular items with cash back. Tap to buy on Shopee.', catNote:'Prices from Shopee, checked {d}. Price may change: Shopee shows the final price. Cash back is an estimate, paid after Shopee confirms the order.',
  catCb:'💸 Est. cash back ~{a}', catCbNo:'💸 Cash back available', catBuy:'Buy on Shopee', catSold:'{n} sold', catLoad:'Loading…', catErr:'Could not load. Check your internet and try again.',
  c_xtra:'🔥 Highest cash back', c_laris:'⭐ Best sellers', c_dapur:'🍚 Kitchen', c_bayi:'👶 Baby & kids', c_rumah:'🏠 Home', c_cantik:'💄 Health & beauty', c_elektrik:'⚡ Appliances', c_dobi:'🧺 Laundry & cleaning', c_kereta:'🚗 Car', c_sekolah:'🎒 School', c_raya:'🪔 Deepavali' });
add('ms', { catT:'🛒 Beli ikut kategori', catSub:'Barang popular yang ada duit balik. Tekan untuk beli di Shopee.', catNote:'Harga dari Shopee, disemak {d}. Harga boleh berubah: harga akhir ikut Shopee. Duit balik ialah anggaran, dibayar selepas Shopee sahkan pesanan.',
  catCb:'💸 Anggaran duit balik ~{a}', catCbNo:'💸 Ada duit balik', catBuy:'Beli di Shopee', catSold:'{n} terjual', catLoad:'Sedang buka…', catErr:'Tak dapat buka. Semak internet dan cuba lagi.',
  c_xtra:'🔥 Duit balik tinggi', c_laris:'⭐ Paling laris', c_dapur:'🍚 Dapur', c_bayi:'👶 Bayi & kanak-kanak', c_rumah:'🏠 Rumah', c_cantik:'💄 Kesihatan & kecantikan', c_elektrik:'⚡ Elektrik', c_dobi:'🧺 Dobi & cuci', c_kereta:'🚗 Kereta', c_sekolah:'🎒 Sekolah', c_raya:'🪔 Deepavali' });
['ta','zh'].forEach(l => add(l, Object.assign({}, L.en, L[l] || {}, { yourSavings:'Duit balik keluarga NBN' })));
const CATS = ['xtra','laris','dapur','bayi','rumah','cantik','elektrik','dobi'];
let CATDATA = null;
const rm = v => 'RM' + (v < 10 ? v.toFixed(2) : v.toFixed(v % 1 ? 2 : 0));
const soldTxt = n => n >= 1000 ? (Math.floor(n/100)/10).toString().replace(/\.0$/,'') + 'k+' : String(n);
async function catData(){ if(CATDATA) return CATDATA; const r = await fetch('/cats.json?v=' + (window.CATV || 1)); CATDATA = await r.json(); return CATDATA; }
function catCard(x, key){
  const cb = x.p * x.cr / 100 * CUSTOMER_SHARE; const cbShow = Math.floor(cb * 10 + 1e-9) / 10;
  const img = 'https://down-my.img.susercontent.com/file/' + x.img + '_tn';
  const disc = x.d > 0 && x.pb > x.p ? `<s style="color:#9aa39d;font-size:12px;margin-left:6px">${rm(x.pb)}</s><span style="color:#D0021B;font-size:12px;font-weight:800;margin-left:4px">-${x.d}%</span>` : '';
  return `<div style="display:flex;gap:10px;background:#fff;border:1.5px solid #EDE3C3;border-radius:14px;padding:10px">
    <img src="${img}" alt="" referrerpolicy="no-referrer" style="width:84px;height:84px;border-radius:10px;object-fit:cover;flex:none;background:#F3EED9">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
      <div style="font-size:13px;font-weight:700;color:#1d2a22;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${x.n.replace(/</g,'&lt;')}</div>
      <div><b style="color:#EE4D2D;font-size:16px">${rm(x.p)}</b>${disc}</div>
      <div style="font-size:11.5px;color:#5b665f">⭐ ${x.r.toFixed(1)} · ${tt('catSold',{n:soldTxt(x.sold)})}${x.mall ? ' · <b style="color:#D0011B">Mall</b>' : ''}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:2px">
        <span style="font-size:12px;font-weight:800;color:#1E4A8A;background:#E6EDFA;border-radius:8px;padding:3px 7px">${cbShow >= 0.1 ? tt('catCb',{a:rm(cbShow)}) : tt('catCbNo')}</span>
        <button type="button" data-cbuy="${x.id}" data-ck="${key}" style="border:0;background:#EE4D2D;color:#fff;font-weight:800;font-size:13px;border-radius:10px;padding:8px 10px;cursor:pointer;white-space:nowrap">${tt('catBuy')} ›</button>
      </div></div></div>`;
}
async function openCat(key){
  const o = mk('div', '', ''); o.id = 'catPage';
  o.style.cssText = 'position:fixed;inset:0;z-index:9990;background:#FFFBEF;overflow:auto;padding:16px 16px 40px';
  const head = `<div style="display:flex;align-items:center;gap:10px"><button type="button" id="catBack" style="border:0;background:#F3EED9;border-radius:50%;width:38px;height:38px;font-size:18px;cursor:pointer;flex:none">‹</button><h2 style="margin:0;color:#0A2A66;font-size:20px">${tt('c_' + key)}</h2></div>`;
  o.innerHTML = `<div style="max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:10px">${head}<p style="margin:0;color:#5b665f">${tt('catLoad')}</p></div>`;
  document.body.appendChild(o); o.querySelector('#catBack').onclick = () => o.remove();
  track('cat_open', key);
  let d; try{ d = await catData(); }catch(e){ o.querySelector('p').textContent = tt('catErr'); return; }
  const items = (d.cats[key] || []);
  o.firstChild.innerHTML = head + items.map(x => catCard(x, key)).join('') + `<p class="fine" style="margin:6px 0 0;color:#5b665f;font-size:12.5px">${tt('catNote',{d:d.date})}</p>`;
  o.querySelector('#catBack').onclick = () => o.remove();
  o.onclick = e => {
    const b = e.target.closest('[data-cbuy]'); if(!b) return;
    const x = items.find(i => i.id === b.dataset.cbuy); if(!x) return;
    track('cat_buy', key + ':' + x.id);
    if(sb && USER) sb.from('clicks').insert({ user_id: USER.id, platform: 'Shopee', search_term: ('cat:' + key + ': ' + x.n).slice(0,120), price_rm: x.p, saving_rm: 0 }).then(()=>{});
    openShopee('https://shopee.com.my/product/' + x.shop + '/' + x.id);
  };
}
window.openCat = openCat;
const catBox = mk('div', '', '');
catBox.style.cssText = 'margin-top:12px;background:#fff;border:1.5px solid #C9A227;border-radius:16px;padding:12px';
function drawCats(){
  const tile = (k, wide) => `<button type="button" data-cat="${k}" style="border:1.5px solid #EDE3C3;background:${wide ? '#FFF6D6' : '#FFFDF6'};border-radius:12px;padding:10px 6px;font-weight:800;font-size:12.5px;color:#0A2A66;cursor:pointer;line-height:1.25;${wide ? 'grid-column:span 3;font-size:14px;text-align:left;padding:11px 12px' : ''}">${tt('c_' + k)}</button>`;
  catBox.innerHTML = `<div style="font-weight:900;color:#0A2A66;font-size:16px">${tt('catT')}</div><div style="font-size:12.5px;color:#5b665f;margin:2px 0 10px">${tt('catSub')}</div>
   <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${tile('xtra',1)}${tile('laris',1)}${CATS.slice(2).map(k => tile(k)).join('')}</div>`;
}
drawCats();
catBox.onclick = e => { const b = e.target.closest('[data-cat]'); if(b) openCat(b.dataset.cat); };
$('miniSave').after(catBox);
const applyLang2 = window.applyLang;
if(typeof applyLang2 === 'function') window.applyLang = function(){ applyLang2.apply(this, arguments); drawCats(); };

function langPicker(){
  if($('langPick')) return;
  const o = mk('div', '', ''); o.id = 'langPick';
  o.style.cssText = 'position:fixed;inset:0;z-index:9998;background:linear-gradient(160deg,#C99A2E,#F3DE8A 55%,#fff 55%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px';
  o.innerHTML = `<div style="font-size:44px">🤝</div><div style="font-size:24px;font-weight:900;color:#0A2A66;text-align:center">Choose your language<br><span style="font-size:18px">Pilih bahasa anda</span></div>`;
  for(const k in NBN_LANGS){
    const b = mk('button', '', NBN_LANGS[k].name); b.type = 'button';
    b.style.cssText = 'width:100%;max-width:320px;padding:16px;border-radius:14px;border:2px solid #1E4A8A;background:#fff;color:#0A2A66;font-size:18px;font-weight:800;cursor:pointer';
    b.onclick = () => { LANG = k; lsS('nbn_lang', k); lsS('nbn-lang-chosen', '1'); applyLang(); o.remove(); setTimeout(() => { if(typeof welcome === 'function') welcome(); }, 400); };
    o.appendChild(b);
  }
  document.body.appendChild(o);
}
const show3 = window.show;
window.show = function(view){
  show3(view);
  if(view === 'home' && USER && lsG('nbn-lang-chosen') !== '1') langPicker();
};


// ---- 24 Oct 2026: More shops page (Involve links, member id as aff_sub) ----
const MS_LIVE = [
  ['💄 Beauty', [['Sephora','https://invl.me/clo5mes','#111111'],['Watsons','https://invl.me/clo5mf2','#00A3AD']]],
  ['👟 Sports & fashion', [['JD Sports','https://invl.me/clo5mfc','#111111']]],
  ['📱 Phones & tech', [['Xiaomi','https://invl.me/clo5mfg','#FF6900']]] ];
const MS_WAIT = [['PUMA','#111111'],['Adidas','#111111'],['Shein','#111111'],['Huawei','#C7000B'],["Lotus's",'#00A19B'],['Traveloka','#0770CD']];
function msLink(u, shop){ const id = (typeof subId === 'function') ? subId() : 'guest'; return u + '?aff_sub=' + encodeURIComponent(id) + '&aff_sub2=' + encodeURIComponent('app-' + shop.toLowerCase().replace(/[^a-z]/g,'')); }
function msLogo(n, c){ return `<div style="width:40px;height:40px;border-radius:10px;background:${c};color:#fff;font-weight:900;font-size:16px;display:flex;align-items:center;justify-content:center;flex:none">${n.replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()}</div>`; }
function msGo(name, url){
  const d = mk('div', '', ''); d.style.cssText = 'position:fixed;inset:0;z-index:9995;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px';
  d.innerHTML = `<div style="background:#FFFBEF;border-radius:18px;padding:18px;max-width:340px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.25)">
    <div style="font-weight:900;color:#0A2A66;font-size:17px">Going to ${name}</div>
    <p style="margin:8px 0 14px;color:#3b4a41;font-size:14px;line-height:1.4">Buy through this button and your cash back is tracked for you. Cash back is paid after ${name} confirms your order.</p>
    <button type="button" id="msCont" style="width:100%;border:0;border-radius:12px;background:linear-gradient(135deg,#F7E08A,#C9A227);color:#0A2A66;font-weight:900;font-size:15px;padding:12px;cursor:pointer">Continue</button>
    <button type="button" id="msCancel" style="width:100%;border:0;background:none;color:#6b756f;font-size:14px;padding:10px;cursor:pointer">Cancel</button></div>`;
  document.body.appendChild(d);
  d.querySelector('#msCancel').onclick = () => d.remove();
  d.querySelector('#msCont').onclick = () => {
    try{ if(typeof sb !== 'undefined' && sb && typeof USER !== 'undefined' && USER) sb.from('clicks').insert({ user_id: USER.id, platform: name, search_term: 'moreshops:' + name, saving_rm: 0 }).then(()=>{}); if(typeof track === 'function') track('moreshops_tap', name); }catch(err){}
    window.open(msLink(url, name), '_blank', 'noopener'); d.remove(); };
}
function openMoreShops(){
  const o = mk('div', '', ''); o.id = 'moreShopsPage';
  o.style.cssText = 'position:fixed;inset:0;z-index:9990;background:#FFFBEF;overflow:auto;padding:16px 16px 40px';
  const live = MS_LIVE.map(g => `<div style="font-weight:800;color:#0A2A66;margin-top:10px">${g[0]}</div><div style="display:grid;gap:8px;margin-top:6px">${g[1].map(s => `<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid #EDE3C3;border-radius:14px;padding:10px 12px">${msLogo(s[0], s[2])}<div style="flex:1;font-weight:800;color:#0A2A66;font-size:15px">${s[0]}</div><button type="button" data-shop="${s[0]}" data-url="${s[1]}" style="border:0;border-radius:10px;background:linear-gradient(135deg,#F7E08A,#C9A227);color:#0A2A66;font-weight:900;font-size:13px;padding:8px 14px;cursor:pointer">Shop</button></div>`).join('')}</div>`).join('');
  const wait = MS_WAIT.map(s => `<div style="display:flex;align-items:center;gap:10px;background:#f4f1e6;border:1.5px dashed #d9cfa6;border-radius:14px;padding:10px 12px;opacity:.75">${msLogo(s[0], s[1])}<div style="flex:1;font-weight:800;color:#6b756f;font-size:15px">${s[0]}</div><div style="font-size:11px;font-weight:700;color:#8A7A3D;background:#FFF6D6;border-radius:8px;padding:3px 7px">Coming soon</div></div>`).join('');
  o.innerHTML = `<div style="max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:6px">
    <div style="display:flex;align-items:center;gap:10px"><button type="button" id="msBack" style="border:0;background:#F3EED9;border-radius:50%;width:38px;height:38px;font-size:18px;cursor:pointer">‹</button><h2 style="margin:0;color:#0A2A66">More shops</h2></div>
    <p style="margin:6px 0 0;color:#3b4a41;font-size:14px">Shop through these buttons for cash back. Rezeki kita, kita kongsi.</p>
    ${live}
    <div style="font-weight:800;color:#8A7A3D;margin-top:16px">⏳ Waiting for approval</div><div style="display:grid;gap:8px;margin-top:6px">${wait}</div>
    <p class="fine" style="margin:10px 0 0;color:#5b665f;font-size:13px">Pilot terms may change. Cash back is paid after the shop confirms your order. Some links earn NBN a small commission at no extra cost to you.</p></div>`;
  document.body.appendChild(o);
  o.querySelector('#msBack').onclick = () => o.remove();
  o.querySelectorAll('button[data-shop]').forEach(b => b.onclick = () => msGo(b.dataset.shop, b.dataset.url));
}
window.openMoreShops = openMoreShops;
const msCard = document.querySelector('#soon .soon-card'); if(msCard){ msCard.style.cursor = 'pointer'; msCard.onclick = openMoreShops; }


/* Search suggestions (typeahead) from suggest.json - lazy loaded, tap = run normal search -> Shopee link */
(function(){
  const q=document.getElementById('q'), form=document.getElementById('searchForm'); if(!q||!form) return;
  let DATA=null, loading=false;
  const box=document.createElement('div'); box.id='sugBox'; box.hidden=true;
  box.style.cssText='position:absolute;left:0;right:0;top:100%;margin-top:4px;background:var(--surface,#fff);border:1px solid var(--line,#ddd);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:50;max-height:260px;overflow:auto';
  form.style.position='relative'; form.appendChild(box);
  function load(){ if(DATA||loading) return; loading=true; fetch('/suggest.json?v=1').then(r=>r.json()).then(d=>{DATA=d.map(x=>[x[0],x[0].toLowerCase()]);show();}).catch(()=>{loading=false;}); }
  function show(){
    const v=q.value.trim().toLowerCase();
    if(!DATA||v.length<2||/^https?:/.test(v)){box.hidden=true;return;}
    const ws=v.split(/\s+/); const out=[];
    for(const d of DATA){ if(ws.every(w=>d[1].includes(w))){ out.push(d[0]); if(out.length>=6) break; } }
    box.innerHTML='';
    out.forEach(n=>{ const b=document.createElement('button'); b.type='button'; b.textContent=n; b.style.cssText='display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:0;border-bottom:1px solid var(--line,#eee);font:inherit;color:inherit;cursor:pointer';
      b.onmousedown=e=>e.preventDefault();
      b.onclick=()=>{ q.value=n; box.hidden=true; if(typeof search==='function') search(n); else form.requestSubmit(); };
      box.appendChild(b); });
    box.hidden=!out.length;
  }
  q.addEventListener('focus',load); q.addEventListener('input',()=>{load();show();});
  q.addEventListener('blur',()=>setTimeout(()=>{box.hidden=true;},150));
  form.addEventListener('submit',()=>{box.hidden=true;});
})();


/* Guest taps Buy -> after they go to Shopee, gently offer login so cash back can be tracked (never blocks the purchase) */
(function(){
  function offer(){
    try{
      if(typeof USER!=='undefined' && USER) return;
      if(sessionStorage.getItem('nbn_trk')) return;
      sessionStorage.setItem('nbn_trk','1');
    }catch(e){}
    setTimeout(()=>{
      if(typeof USER!=='undefined' && USER) return;
      const bar=document.createElement('div');
      bar.style.cssText='position:fixed;left:12px;right:12px;bottom:76px;z-index:90;background:#0A2A66;color:#fff;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.3);font-size:14px';
      const m=document.createElement('span'); m.style.flex='1'; m.textContent=t('trackMsg');
      const y=document.createElement('button'); y.textContent=t('trackYes'); y.style.cssText='background:#f5b82e;color:#222;border:0;border-radius:10px;padding:9px 14px;font:inherit;font-weight:700;cursor:pointer';
      const n=document.createElement('button'); n.textContent=t('trackNo'); n.style.cssText='background:none;color:#fff;border:0;font:inherit;opacity:.8;cursor:pointer';
      y.onclick=()=>{bar.remove(); if(typeof goLogin==='function') goLogin();}; n.onclick=()=>bar.remove();
      bar.append(m,y,n); document.body.appendChild(bar);
    },1500);
  }
  document.addEventListener('click',e=>{ const a=e.target.closest&&e.target.closest('a'); if(!a) return; if(a.id==='goShopee'||(/shopee|involve|s\.shopee/i.test(a.href||'')&&a.closest('#resultsList,#elsewhere'))) offer(); },true);
})();


/* One-tap popular items under the search box: tap = normal search -> Shopee link, no typing */
(function(){
  const form=document.getElementById('searchForm'); if(!form||document.getElementById('quickItems')) return;
  const items=[['🥛','susu tepung'],['🍚','beras'],['🛢️','minyak masak'],['👶','lampin bayi'],['🥚','telur'],['☕','kopi'],['🧴','sabun basuh'],['🧻','tisu']];
  const box=document.createElement('div'); box.id='quickItems';
  box.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:-6px';
  items.forEach(([e,term])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=e+' '+term;
    b.style.cssText='background:var(--surface,#fff);border:1.5px solid var(--line,#ddd);border-radius:999px;padding:8px 13px;font:inherit;font-size:14px;color:inherit;cursor:pointer';
    b.onclick=()=>{ const q=document.getElementById('q'); if(q) q.value=term; if(typeof search==='function') search(term); };
    box.appendChild(b); });
  form.insertAdjacentElement('afterend',box);
})();


// ---- 27 Oct 2026: more attractive home: money first, guide Dayang, welcome moment ----
const A27 = {
 en:{ topT:'🔥 Top cash back today', topSub:'Tap Buy. We track your cash back.', gHi:'Paste your Shopee link above 👆 then buy as usual. I track your cash back!', gName:'Dayang · AI guide', wT:'Welcome to NBN 🎉', wB:"Hi, I'm Dayang! Paste a Shopee link and buy as usual. We track your cash back and it fills this jar.", wGo:"Let's go" },
 ms:{ topT:'🔥 Duit balik tinggi hari ni', topSub:'Tekan Beli. Duit balik kita track untuk anda.', gHi:'Tampal link Shopee kat atas 👆 lepas tu beli macam biasa. Saya track duit balik anda!', gName:'Dayang · Panduan AI', wT:'Selamat datang ke NBN 🎉', wB:'Hai, saya Dayang! Tampal link Shopee, beli macam biasa. Duit balik kita track dan masuk dalam tabung ni.', wGo:'Jom mula' } };
add('en', A27.en); add('ms', A27.ms); ['ta','zh'].forEach(l => add(l, A27.en));

const dGuide = mk('div', '', ''); dGuide.id = 'dayangGuide';
dGuide.style.cssText = 'display:flex;gap:10px;align-items:center;background:#fff;border:1.5px solid #EDE3C3;border-radius:16px;padding:8px 12px 8px 8px';
function drawGuide(){ dGuide.innerHTML = `<img src="/icons/dayang.webp" alt="" width="46" height="46" style="border-radius:50%;flex:none;border:2px solid #C9A227;object-fit:cover"><div style="flex:1"><div style="font-size:13.5px;color:#1d2a22;line-height:1.35;font-weight:600">${tt('gHi')}</div><div style="font-size:11px;color:#8a948d;margin-top:2px">${tt('gName')}</div></div>`; }
if($('linkHint')) $('linkHint').after(dGuide);
drawGuide();

const topBox = mk('div', '', ''); topBox.id = 'topCb';
topBox.style.cssText = 'margin-top:12px;display:flex;flex-direction:column;gap:8px';
let topItems = [];
async function drawTop(){
  try{
    const d = await catData(); const seen = new Set();
    topItems = [].concat(d.cats.xtra || [], d.cats.laris || []).filter(x => x && !seen.has(x.id) && seen.add(x.id))
      .map(x => ({ x, cb: x.p * x.cr / 100 * CUSTOMER_SHARE })).sort((a, b) => b.cb - a.cb).slice(0, 3).map(o => o.x);
    topBox.innerHTML = `<div><div style="font-weight:900;color:#0A2A66;font-size:16px">${tt('topT')}</div><div style="font-size:12.5px;color:#5b665f">${tt('topSub')}</div></div>` + topItems.map(x => catCard(x, 'top')).join('');
  }catch(e){ topBox.innerHTML = ''; }
}
topBox.onclick = e => {
  const b = e.target.closest('[data-cbuy]'); if(!b) return;
  const x = topItems.find(i => i.id === b.dataset.cbuy); if(!x) return;
  track('cat_buy', 'top:' + x.id);
  if(sb && USER) sb.from('clicks').insert({ user_id: USER.id, platform: 'Shopee', search_term: ('cat:top: ' + x.n).slice(0,120), price_rm: x.p, saving_rm: 0 }).then(()=>{});
  openShopee('https://shopee.com.my/product/' + x.shop + '/' + x.id);
};
catBox.before(topBox); drawTop();

function welcome(){
  if(!USER || lsG('nbn-welcome-1') === '1' || lsG('nbn-lang-chosen') !== '1' || $('welcomeM')) return;
  lsS('nbn-welcome-1', '1');
  const o = mk('div', '', ''); o.id = 'welcomeM';
  o.style.cssText = 'position:fixed;inset:0;z-index:9996;background:rgba(10,40,25,.55);display:flex;align-items:center;justify-content:center;padding:20px';
  let jar = ''; try{ window.__tbDrop = true; jar = tbJarSvg(1); }catch(e){}
  o.innerHTML = `<div style="background:#FFFBEF;border-radius:22px;padding:18px;max-width:340px;width:100%;text-align:center;box-shadow:0 14px 40px rgba(0,0,0,.3)">
    <img src="/icons/dayang.webp" alt="" width="64" height="64" style="border-radius:50%;border:3px solid #C9A227;object-fit:cover">
    <div style="font-weight:900;color:#0A2A66;font-size:20px;margin:8px 0 2px">${tt('wT')}</div>
    <div style="width:120px;margin:4px auto">${jar}</div>
    <p style="margin:6px 0 14px;color:#3b4a41;font-size:14.5px;line-height:1.45">${tt('wB')}</p>
    <button type="button" id="wGo" style="width:100%;border:0;border-radius:12px;background:linear-gradient(135deg,#F7E08A,#C9A227);color:#0A2A66;font-weight:900;font-size:16px;padding:13px;cursor:pointer">${tt('wGo')}</button>
    <div style="font-size:10.5px;color:#9aa39d;margin-top:8px">${tt('gName')}</div></div>`;
  document.body.appendChild(o);
  o.querySelector('#wGo').onclick = () => { o.remove(); window.__tbDrop = false; };
  try{ track('welcome_shown'); }catch(e){}
}
const show4 = window.show;
window.show = function(view){ show4.apply(this, arguments); if(view === 'home') setTimeout(welcome, 500); };
const applyLang3 = window.applyLang;
if(typeof applyLang3 === 'function') window.applyLang = function(){ applyLang3.apply(this, arguments); drawGuide(); drawTop(); };

if(typeof applyLang === 'function') applyLang();
})();
