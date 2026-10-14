// Copies the NBN web app from the repo root into mobile/www so it ships inside the iOS app.
// The app runs from the bundled files; only data (prices, login, photo search) goes over the network.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const copy = (rel) => { const s = path.join(root, rel), d = path.join(out, rel);
  if (fs.statSync(s).isDirectory()) { fs.mkdirSync(d, { recursive: true }); for (const f of fs.readdirSync(s)) copy(path.join(rel, f)); }
  else fs.copyFileSync(s, d); };
['index.html', 'pricesheet.js', 'manifest.webmanifest', 'icons', 'vendor'].forEach(copy);
// Inside the app there is no web origin: login emails must point back to the website, and no service worker is used.
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const before = html;
html = html.replace("emailRedirectTo: location.origin + location.pathname", "emailRedirectTo: 'https://ngambelini.com/'");
html = html.replace("if('serviceWorker' in navigator){", "if(false && 'serviceWorker' in navigator){");
if (html === before) { console.error('copy-web: expected patches not applied'); process.exit(1); }
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('copied web app to', out);
