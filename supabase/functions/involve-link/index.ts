// NBN involve-link: turns a Shopee address into an Involve Asia tracking link (property NBN - Ngam Beli Ni).
// Needs secrets INVOLVE_KEY and INVOLVE_SECRET (set by the owner in Supabase > Edge Functions > Secrets).
// The member id is NOT sent to Involve here: the app adds ?aff_sub=<member> to the returned link,
// so one cached link per product address serves every member (keeps us under the monthly link limit).
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const API = "https://api.involve.asia/api";
const OFFER_NAME = "Shopee MY - CPS";
const ALLOWED = /(^|\.)(shopee\.com\.my)$/i;

let token = "", tokenAt = 0, offerId = 0;

async function involveToken(): Promise<string> {
  if (token && Date.now() - tokenAt < 100 * 60 * 1000) return token;
  const r = await fetch(`${API}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: Deno.env.get("INVOLVE_KEY")!, secret: Deno.env.get("INVOLVE_SECRET")! }),
  });
  const j = await r.json();
  token = j?.data?.token || "";
  if (!token) throw new Error("involve auth failed");
  tokenAt = Date.now();
  return token;
}

async function shopeeOfferId(t: string): Promise<number> {
  if (offerId) return offerId;
  const r = await fetch(`${API}/offers/all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ limit: "100", "filters[offer_name]": "Shopee" }),
  });
  const j = await r.json();
  const list = j?.data?.data || [];
  const hit = list.find((o: any) => String(o.offer_name).trim() === OFFER_NAME) || list.find((o: any) => /shopee/i.test(o.offer_name) && /malaysia|my/i.test(o.offer_name));
  if (!hit) throw new Error("shopee offer not found");
  offerId = Number(hit.offer_id);
  return offerId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "login" }, 401);

    const body = await req.json();
    let target: URL;
    try { target = new URL(String(body?.url || "").trim()); } catch { return json({ error: "not a link" }, 400); }
    if (!ALLOWED.test(target.hostname)) return json({ error: "only Shopee MY addresses" }, 400);
    target.hash = "";
    const clean = target.toString();

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cached = await admin.from("involve_links").select("tracking_link").eq("url", clean).maybeSingle();
    if (cached.data?.tracking_link) return json({ link: cached.data.tracking_link, cached: true });

    const t = await involveToken();
    const oid = await shopeeOfferId(t);
    const r = await fetch(`${API}/deeplink/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ offer_id: String(oid), url: clean, aff_sub: "app" }),
    });
    const j = await r.json();
    const link = j?.data?.tracking_link;
    if (!link) { console.error("involve-link: no link", JSON.stringify(j).slice(0, 300)); return json({ error: "no link" }, 502); }
    await admin.from("involve_links").upsert({ url: clean, tracking_link: link });
    return json({ link, cached: false });
  } catch (e) {
    console.error("involve-link error", e);
    return json({ error: "failed" }, 500);
  }
});
