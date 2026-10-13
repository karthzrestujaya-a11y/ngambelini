// NBN photo search: reads a product photo/screenshot with Google Gemini and returns a search phrase.
// Secrets needed (Supabase > Edge Functions > Secrets): GEMINI_API_KEY. SUPABASE_URL / keys are provided automatically.
import { createClient } from "jsr:@supabase/supabase-js@2";

const FREE_PER_MONTH = 3;      // every member
const BONUS_PER_MONTH = 10;    // extra if they bought through NBN this month
const BONUS_MIN_SPEND = 20;    // RM spent through NBN links this month to unlock the bonus
const PILOT_UNLIMITED = true;  // pilot: no limit, but every photo is still counted
const MODELS = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-flash-latest"]; // fast stable model first (no thinking), then backups when busy

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    if (body && body.warm) return json({ ok: true, warm: true });   // app pings this on login so the first photo search is fast
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    // Admin self-test (Supabase dashboard "Test" button, service role only): runs the AI step without a member login
    // and without counting a search. The gateway has already verified the JWT signature.
    let role = "";
    try { role = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? ""; } catch { /* no token */ }
    const selfTest = body && body.selftest === true && role === "service_role";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = selfTest ? { data: { user: { id: "selftest" } } } : await userClient.auth.getUser();
    if (!user) return json({ error: "login", role }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Usage this calendar month (Malaysia time is close enough to UTC month start for a counter)
    const m0 = new Date(); m0.setUTCDate(1); m0.setUTCHours(0, 0, 0, 0);
    const tStart = Date.now();
    const { count: used } = selfTest ? { count: 0 } : await admin.from("photo_searches").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", m0.toISOString());
    const { data: buys } = selfTest ? { data: [] } : await admin.from("clicks").select("price_rm, status")
      .eq("user_id", user.id).gte("clicked_at", m0.toISOString()).in("status", ["confirmed", "paid"]);
    const spent = (buys ?? []).reduce((a, c) => a + Number(c.price_rm || 0), 0);
    const limit = FREE_PER_MONTH + (spent >= BONUS_MIN_SPEND ? BONUS_PER_MONTH : 0);
    if (!PILOT_UNLIMITED && (used ?? 0) >= limit) return json({ error: "limit", used, limit, spent }, 402);

    const { image } = body as { image?: string };
    if (typeof image !== "string" || image.length < 100) return json({ error: "no image" }, 400);
    if (image.length > 2_800_000) return json({ error: "image too big" }, 413);

    const prompt = `You identify products in photos or screenshots for a Malaysian price-comparison app (Shopee and Lazada).
Return ONLY JSON: {"query": string, "brand": string, "product": string, "variant": string, "confidence": "high"|"medium"|"low",
 "is_listing": boolean, "platform": "shopee"|"lazada"|"other"|"", "price_rm": number|null, "price_note": string, "shop": string, "pack": string}.
"is_listing" is true only if the image is a screenshot of an online shop product page or search result.
If it is a listing: "platform" is the shop app shown, "price_rm" is the main price shown for the product in RM (number only),
"price_note" says if that price is "after voucher", "flash sale", a price range, or "" if it is the normal price,
"shop" is the seller/shop name if visible, "pack" is the pack size or variant (e.g. "2kg", "L 40pcs"). Otherwise use false, "", null, "", "", "".
"query" is the best short search phrase a shopper would type on Shopee, e.g. "Casio MTP-1374D", "Dynamo detergent 3.9kg", "Milo 2kg refill".
Include model numbers and pack size when visible. If it is a book, use the title and author. If you cannot tell, use your best guess and confidence "low".`;
    // Model chain: the main model first, then backups if it is busy (503), over quota (429) or unavailable.
    // Each model gets the fastest thinking setting it accepts; a 400 on that setting retries once without it.
    const thinkFor = (m: string) => m.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
    const ask = (model: string, fast: boolean) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: image } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1,
          ...(fast ? { thinkingConfig: thinkFor(model) } : {}) },
      }),
    });
    let g: Response = new Response("no model tried", { status: 503 }); let usedModel = "";
    for (const model of MODELS) {
      try {
        g = await ask(model, true);
        if (g.status === 400) { const t = await g.text(); console.warn("thinking setting rejected", model, t.slice(0, 160)); g = await ask(model, false); }
      } catch (e) { console.warn("model timeout/network", model, String(e).slice(0, 120)); g = new Response(String(e), { status: 504 }); }
      if (g.ok) { usedModel = model; if (model !== MODELS[0]) console.log("used backup model", model); break; }
      if (![404, 429, 500, 503, 504].includes(g.status)) break;          // a real error: stop, don't hide it
      const t = await g.text(); console.warn("model failed, trying next", model, g.status, t.slice(0, 160));
      g = new Response(t, { status: g.status });
    }
    if (!g.ok) {
      const body = (await g.text()).slice(0, 500);
      console.error("gemini error", g.status, body);
      return json({ error: "ai", status: g.status, detail: body.slice(0, 200) }, 502);
    }
    const gj = await g.json();
    const parts = gj?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: { text?: string; thought?: boolean }) => p.thought ? "" : (p.text ?? "")).join("") || "{}";
    let out: Record<string, string> = {};
    try { out = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      try { out = m ? JSON.parse(m[0]) : {}; } catch { out = {}; }
      if (!out.query) { console.error("photo-search parse failed", gj?.candidates?.[0]?.finishReason, text.slice(0, 300)); out = { query: "", confidence: "low" }; }
    }
    const query = String(out.query || "").slice(0, 120);

    const o = out as Record<string, unknown>;
    const plat = String(o.platform ?? "").toLowerCase();
    const price = typeof o.price_rm === "number" && o.price_rm > 0 && o.price_rm < 100000 ? Math.round(o.price_rm * 100) / 100 : null;
    const listing = o.is_listing === true && (plat === "shopee" || plat === "lazada") && price !== null;
    if (!selfTest) await admin.from("photo_searches").insert({
      user_id: user.id, query, confidence: out.confidence ?? null,
      is_listing: listing, platform: listing ? plat : null, price_rm: listing ? price : null,
      price_note: listing ? String(o.price_note ?? "").slice(0, 60) : null,
      shop: listing ? String(o.shop ?? "").slice(0, 80) : null, pack: String(o.pack ?? "").slice(0, 40) || null,
    });
    console.log("photo-search ms", Date.now() - tStart);
    return json({ ...out, query, used: (used ?? 0) + 1, limit: PILOT_UNLIMITED ? null : limit, ms: Date.now() - tStart, model: usedModel });
  } catch (e) {
    return json({ error: "server", detail: String(e).slice(0, 200) }, 500);
  }
});
