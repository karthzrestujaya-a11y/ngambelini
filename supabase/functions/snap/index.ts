// NBN Snap & Earn: a member snaps a shop shelf price tag. Gemini reads item + price + shop.
// Clear, on-category, new photo -> approved (10 pts). Unclear -> 'review' (admin decides within 48h).
// Photo kept 30 days in the private 'snaps' bucket; old photos are cleaned up on each call.
// Secrets: GEMINI_API_KEY (already set). Optional: RESEND_API_KEY for payout receipts.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DAY_LIMIT = 30;          // snaps per member per day
const MONTH_CAP_PTS = 20000;   // RM20 per member per month
const PTS = 10;                // per approved snap (1,000 pts = RM1)
const MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64ToBytes(b64: string) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "login" }, 401);
    const body = await req.json().catch(() => ({}));

    // Admin: send payout receipt email (after marking paid in the app)
    if (body.action === "receipt") {
      const { data: isAdm } = await userClient.rpc("is_admin");
      if (!isAdm) return json({ error: "admins only" }, 403);
      const key = Deno.env.get("RESEND_API_KEY");
      if (!key) return json({ ok: false, error: "no RESEND_API_KEY" });
      const { data: p } = await admin.from("snap_payouts").select("id, user_id, month, amount_rm, payout_ref, status, duitnow").eq("id", body.payout_id).maybeSingle();
      if (!p || p.status !== "paid") return json({ error: "not paid" }, 400);
      const { data: u } = await admin.auth.admin.getUserById(p.user_id);
      const to = u?.user?.email; if (!to) return json({ error: "no email" }, 400);
      const mon = new Date(p.month).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
      const html = `<p>Hi,</p><p>Your NBN Snap &amp; Earn reward for <b>${mon}</b> has been paid.</p>
<p><b>Amount:</b> RM${Number(p.amount_rm).toFixed(2)}<br><b>Paid to DuitNow:</b> ${p.duitnow ?? ""}<br><b>Reference:</b> ${p.payout_ref ?? ""}</p>
<p>Terima kasih kerana membantu! — NBN Ngam Beli Ni · ngambelini.com</p>`;
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "NBN <hello@ngambelini.com>", to: [to], bcc: ["hello@ngambelini.com"], subject: `NBN Snap & Earn: RM${Number(p.amount_rm).toFixed(2)} paid`, html }) });
      return json({ ok: r.ok, status: r.status });
    }

    // Admin: short-lived link to view a snap photo
    if (body.action === "photo") {
      const { data: isAdm } = await userClient.rpc("is_admin");
      if (!isAdm) return json({ error: "admins only" }, 403);
      const { data } = await admin.storage.from("snaps").createSignedUrl(String(body.path), 300);
      return json({ url: data?.signedUrl ?? null });
    }

    // Settings + limits
    const { data: st } = await admin.from("app_settings").select("key, value").in("key", ["snap_enabled", "snap_category", "snap_budget_rm"]);
    const S = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
    const { data: isAdm } = await userClient.rpc("is_admin");
    if (S.snap_enabled !== "true" && !isAdm) return json({ error: "off" }, 403);
    const category = S.snap_category ?? "";

    const { image } = body as { image?: string };
    if (typeof image !== "string" || image.length < 100) return json({ error: "no image" }, 400);
    if (image.length > 2_800_000) return json({ error: "image too big" }, 413);

    const klNow = new Date(Date.now() + 8 * 3600e3);
    const d0 = new Date(Date.UTC(klNow.getUTCFullYear(), klNow.getUTCMonth(), klNow.getUTCDate()) - 8 * 3600e3).toISOString();
    const m0 = new Date(Date.UTC(klNow.getUTCFullYear(), klNow.getUTCMonth(), 1) - 8 * 3600e3).toISOString();
    const { count: today } = await admin.from("snaps").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", d0);
    if ((today ?? 0) >= DAY_LIMIT) return json({ error: "day_limit", limit: DAY_LIMIT }, 429);
    const { data: mrows } = await admin.from("snaps").select("points").eq("user_id", user.id).gte("created_at", m0);
    const monthPts = (mrows ?? []).reduce((a, r) => a + (r.points || 0), 0);
    const { data: allRows } = await admin.from("snaps").select("points").eq("status", "approved");
    const spentRm = (allRows ?? []).reduce((a, r) => a + (r.points || 0), 0) / 1000;
    const budgetLeft = spentRm < Number(S.snap_budget_rm ?? 1000);

    // Same photo twice?
    const hash = await sha256(image);
    const { data: dup } = await admin.from("snaps").select("id").eq("photo_hash", hash).maybeSingle();
    if (dup) return json({ error: "duplicate" }, 409);

    // Read the price tag
    const prompt = `You check photos of SHOP SHELF PRICE TAGS taken in Malaysian shops (supermarket, pharmacy, kedai runcit).
Return ONLY JSON: {"is_price_tag": boolean, "item": string, "brand": string, "pack": string, "price_rm": number|null,
 "shop": string, "category_match": boolean, "clear": boolean, "is_screenshot": boolean}.
"is_price_tag" true only for a real photo of a physical shelf price label or price sticker next to a product.
"is_screenshot" true if it is a screenshot of a phone/computer screen or online shop (not allowed).
"item" product name, "brand", "pack" size (e.g. "1.2kg", "40pcs"), "price_rm" the main shelf price in RM (number),
"shop" the store name if visible on the label/receipt/background, else "".
"category_match" true if the product belongs to this category: "${category}".
"clear" true if the item name and price are both easy to read.`;
    let out: Record<string, unknown> = {};
    for (const model of MODELS) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST", signal: AbortSignal.timeout(15000),
          headers: { "Content-Type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: image } }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.1, thinkingConfig: { thinkingLevel: "low" } } }),
        });
        if (!r.ok) { console.warn("snap model failed", model, r.status); continue; }
        const gj = await r.json();
        const text = (gj?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string; thought?: boolean }) => p.thought ? "" : (p.text ?? "")).join("");
        try { out = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); out = m ? JSON.parse(m[0]) : {}; }
        break;
      } catch (e) { console.warn("snap model error", model, String(e).slice(0, 120)); }
    }

    const price = typeof out.price_rm === "number" && out.price_rm > 0 && out.price_rm < 100000 ? Math.round(out.price_rm * 100) / 100 : null;
    let status: "approved" | "review" | "rejected" = "review"; let reason = "";
    if (out.is_screenshot === true) { status = "rejected"; reason = "Screenshot, not a shop photo"; }
    else if (out.is_price_tag === false) { status = "rejected"; reason = "No price tag found"; }
    else if (out.is_price_tag === true && out.clear === true && price !== null && out.category_match === true) status = "approved";
    else reason = out.category_match === false ? "Not this week's category — checking" : "Checking (within 48 hours)";
    if (status === "approved" && (monthPts + PTS > MONTH_CAP_PTS || !budgetLeft)) { status = "review"; reason = !budgetLeft ? "Pilot budget reached" : "Monthly limit (RM20) reached"; }

    // Keep the photo 30 days (not kept if rejected)
    let path: string | null = null;
    if (status !== "rejected") {
      path = `${user.id}/${Date.now()}.jpg`;
      const up = await admin.storage.from("snaps").upload(path, b64ToBytes(image), { contentType: "image/jpeg" });
      if (up.error) { console.warn("upload failed", up.error.message); path = null; }
    }
    const { data: row } = await admin.from("snaps").insert({
      user_id: user.id, category, photo_path: path, photo_hash: hash,
      item: String(out.item ?? "").slice(0, 120), brand: String(out.brand ?? "").slice(0, 60), pack: String(out.pack ?? "").slice(0, 40),
      shop: String(out.shop ?? "").slice(0, 80), price_rm: price, confidence: out.clear === true ? "high" : "low",
      status, reason: reason || null, points: status === "approved" ? PTS : 0,
    }).select("id").single();

    // Housekeeping: delete photos older than 30 days (price data stays)
    const old = new Date(Date.now() - 30 * 86400e3).toISOString();
    const { data: olds } = await admin.from("snaps").select("id, photo_path").lt("created_at", old).not("photo_path", "is", null).limit(50);
    if (olds && olds.length) {
      await admin.storage.from("snaps").remove(olds.map((o) => o.photo_path as string));
      await admin.from("snaps").update({ photo_path: null }).in("id", olds.map((o) => o.id));
    }

    return json({ id: row?.id, status, reason, points: status === "approved" ? PTS : 0, item: out.item ?? "", price_rm: price, shop: out.shop ?? "",
                  today: (today ?? 0) + 1, day_limit: DAY_LIMIT });
  } catch (e) {
    return json({ error: "server", detail: String(e).slice(0, 200) }, 500);
  }
});
