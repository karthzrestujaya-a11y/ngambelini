// NBN involve-sync: pulls Involve Asia conversions (orders), matches them to members by the member id we add to every link
// (aff_sub), and fills the cash back stages: pending -> waiting, approved -> confirmed (with commission), rejected -> expired.
// Safe to call from cron with the anon key: it only talks to Involve and our own tables, and returns counts only.
// Needs secrets INVOLVE_KEY and INVOLVE_SECRET. Run SQL supabase/involve_sync.sql first.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const API = "https://api.involve.asia/api";
const form = { "Content-Type": "application/x-www-form-urlencoded" };

async function token(): Promise<string> {
  const r = await fetch(`${API}/authenticate`, {
    method: "POST", headers: form,
    body: new URLSearchParams({ key: Deno.env.get("INVOLVE_KEY")!, secret: Deno.env.get("INVOLVE_SECRET")! }),
  });
  const j = await r.json();
  const t = j?.data?.token || j?.token || j?.data?.access_token || "";
  if (!t) { console.error("involve-sync auth resp", JSON.stringify(j).slice(0, 300)); throw new Error("auth failed"); }
  return t;
}

const pick = (o: any, keys: string[]) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; return null; };
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : null; };

function mapStatus(s: string): "waiting" | "confirmed" | "expired" {
  const v = (s || "").toLowerCase();
  if (/approv|confirm|valid|paid|complete/.test(v)) return "confirmed";
  if (/reject|declin|cancel|invalid|expire/.test(v)) return "expired";
  return "waiting";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // throttle: at most one run every 10 minutes
    const st = await admin.from("involve_sync_state").select("last_run").eq("id", 1).maybeSingle();
    if (st.data?.last_run && Date.now() - new Date(st.data.last_run).getTime() < 10 * 60 * 1000) return json({ skipped: "ran recently" });
    await admin.from("involve_sync_state").update({ last_run: new Date().toISOString() }).eq("id", 1);

    const t = await token();
    const end = new Date(); const start = new Date(Date.now() - 90 * 86400 * 1000);
    const d = (x: Date) => x.toISOString().slice(0, 10);
    const rows: any[] = [];
    let page = 1, sampleKeys: string[] = [], apiNote = "";
    for (; page <= 10; page++) {
      const r = await fetch(`${API}/conversions/all`, {
        method: "POST", headers: { ...form, Authorization: `Bearer ${t}` },
        body: new URLSearchParams({ page: String(page), limit: "100", start_date: d(start), end_date: d(end), "filters[start_date]": d(start), "filters[end_date]": d(end) }),
      });
      const j = await r.json();
      const list = j?.data?.data || j?.data || [];
      if (!Array.isArray(list)) { apiNote = JSON.stringify(j).slice(0, 300); console.error("involve-sync unexpected", apiNote); break; }
      if (page === 1 && list[0]) sampleKeys = Object.keys(list[0]);
      rows.push(...list);
      const next = j?.data?.nextPage ?? j?.data?.next_page_url ?? null;
      if (!next || list.length < 100) break;
    }

    let matched = 0, created = 0, updated = 0, unmatched = 0;
    for (const o of rows) {
      const cid = String(pick(o, ["conversion_id", "id", "order_id", "conversionId"]) ?? "");
      if (!cid) continue;
      const subs = [1, 2, 3, 4, 5].map((i) => String(pick(o, [`aff_sub${i}`, i === 1 ? "aff_sub" : `aff_sub${i}`, `sub_id${i}`]) ?? ""));
      const offer = String(pick(o, ["offer_name", "merchant_name", "advertiser_name", "offer"]) ?? "");
      const sale = num(pick(o, ["sale_amount", "sales_amount", "order_amount", "order_value", "amount"]));
      const comm = num(pick(o, ["payout", "commission", "publisher_commission", "commission_amount", "payout_amount"]));
      const inv = String(pick(o, ["conversion_status", "status", "payout_status"]) ?? "");
      const at = String(pick(o, ["datetime_conversion", "conversion_time", "datetime", "created_at", "date"]) ?? "");
      const when = at ? new Date(at.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(at) ? "" : "+08:00")) : new Date();
      const whenIso = isFinite(when.getTime()) ? when.toISOString() : new Date().toISOString();

      // member = the sub id that is 12 hex characters of a user id
      let userId: string | null = null;
      for (const s of subs) {
        if (/^[0-9a-f]{12}$/i.test(s)) {
          const u = await admin.rpc("involve_user_by_sub", { p_sub: s.toLowerCase() });
          if (u.data) { userId = u.data as string; break; }
        }
      }

      const prev = await admin.from("involve_conversions").select("click_id,user_id").eq("conversion_id", cid).maybeSingle();
      let clickId: number | null = prev.data?.click_id ?? null;
      const status = mapStatus(inv);
      const platform = /shopee/i.test(offer) ? "Shopee" : (offer.replace(/\s*(MY|Malaysia).*$/i, "").trim() || "Involve");

      if (userId && !clickId) {
        // match the member's oldest open tap in the 7 days before the order (cookie window), else create a row
        const lo = new Date(new Date(whenIso).getTime() - 7 * 86400 * 1000).toISOString();
        const c = await admin.from("clicks").select("id,platform,status").eq("user_id", userId).eq("status", "waiting")
          .gte("clicked_at", lo).lte("clicked_at", whenIso).order("clicked_at", { ascending: true }).limit(20);
        const claimed = await admin.from("involve_conversions").select("click_id").not("click_id", "is", null).eq("user_id", userId);
        const used = new Set((claimed.data || []).map((x: any) => x.click_id));
        const pickRow = (c.data || []).find((x: any) => !used.has(x.id) && (x.platform || "").toLowerCase().includes(platform.toLowerCase())) ||
                        (c.data || []).find((x: any) => !used.has(x.id));
        if (pickRow) { clickId = pickRow.id; matched++; }
        else {
          const ins = await admin.from("clicks").insert({ user_id: userId, platform, search_term: "involve:" + cid, price_rm: sale, saving_rm: 0, status: "waiting", clicked_at: whenIso }).select("id").maybeSingle();
          if (ins.data?.id) { clickId = ins.data.id; created++; }
        }
      }
      if (!userId) unmatched++;

      if (clickId) {
        const cur = await admin.from("clicks").select("status").eq("id", clickId).maybeSingle();
        const s = cur.data?.status;
        if (s && s !== "received" && s !== "paid") {
          const patch: any = { price_rm: sale ?? undefined };
          if (status === "confirmed") { patch.status = "confirmed"; patch.confirmed_at = new Date().toISOString(); patch.commission_rm = comm ?? 0; }
          else if (status === "expired") { patch.status = "expired"; }
          else { patch.status = "waiting"; }
          await admin.from("clicks").update(patch).eq("id", clickId); updated++;
        }
      }

      await admin.from("involve_conversions").upsert({
        conversion_id: cid, offer_name: offer, aff_sub: subs[0], aff_sub2: subs[1], aff_sub3: subs[2], aff_sub4: subs[3], aff_sub5: subs[4],
        sale_amount: sale, commission_rm: comm, involve_status: inv, converted_at: whenIso, user_id: userId, click_id: clickId, raw: o, updated_at: new Date().toISOString(),
      });
    }

    const result = { fetched: rows.length, matched, created, updated, unmatched, sample_keys: sampleKeys, note: apiNote || undefined };
    await admin.from("involve_sync_state").update({ last_result: result }).eq("id", 1);
    return json(result);
  } catch (e) {
    console.error("involve-sync error", e);
    return json({ error: "failed" }, 500);
  }
});
