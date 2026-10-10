// NBN resolve-link: a member pastes a Shopee/Lazada share link (often a short link like s.shopee.com.my/xxxx).
// We follow only the redirect headers (never download the page) to get the full product address,
// save it for the admin, and return it so the app can read the product name from the address.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ALLOWED = /(^|\.)(shopee\.com\.my|shope\.ee|shp\.ee|lazada\.com\.my)$/i;
const platformOf = (h: string) => /lazada/i.test(h) ? "lazada" : /(shope|shp\.ee)/i.test(h) ? "shopee" : "";

function nameFrom(u: URL): string {
  let seg = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
  seg = seg.replace(/-i\.\d+\.\d+$/, "").replace(/-i\d+(-s\d+)?\.html$/, "").replace(/\.html$/, "").replace(/[-_]+/g, " ").trim();
  if (!seg || /^[A-Za-z0-9.]{3,14}$/.test(seg) || /^\d+$/.test(seg)) return "";
  return seg.split(" ").slice(0, 10).join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "login" }, 401);

    const { link } = await req.json();
    let cur: URL;
    try { cur = new URL(String(link || "").trim()); } catch { return json({ error: "not a link" }, 400); }
    if (!ALLOWED.test(cur.hostname)) return json({ error: "only Shopee or Lazada links" }, 400);
    const original = cur.toString();

    // Follow up to 5 redirects, staying on Shopee/Lazada addresses. Headers only.
    for (let i = 0; i < 5; i++) {
      const r = await fetch(cur.toString(), { method: "GET", redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) NBN-link-check" } });
      try { await r.body?.cancel(); } catch { /* ignore */ }
      const loc = r.headers.get("location");
      if (!(r.status >= 300 && r.status < 400 && loc)) break;
      const next = new URL(loc, cur);
      if (!ALLOWED.test(next.hostname)) break;
      cur = next;
    }
    const clean = new URL(cur.toString());
    clean.search = "";   // drop tracking parameters
    const resolved = clean.toString();
    const platform = platformOf(clean.hostname) || platformOf(new URL(original).hostname);
    const name = nameFrom(clean);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("shared_links").insert({ user_id: user.id, original_url: original, resolved_url: resolved, platform, name: name || null });
    return json({ resolved, platform, name });
  } catch (e) {
    console.error("resolve-link error", e);
    return json({ error: "failed" }, 500);
  }
});
