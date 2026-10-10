// NBN photo search: reads a product photo/screenshot with Google Gemini and returns a search phrase.
// Secrets needed (Supabase > Edge Functions > Secrets): GEMINI_API_KEY. SUPABASE_URL / keys are provided automatically.
import { createClient } from "jsr:@supabase/supabase-js@2";

const FREE_PER_MONTH = 3;      // every member
const BONUS_PER_MONTH = 10;    // extra if they bought through NBN this month
const BONUS_MIN_SPEND = 20;    // RM spent through NBN links this month to unlock the bonus
const PILOT_UNLIMITED = true;  // pilot: no limit, but every photo is still counted
const MODEL = "gemini-3.8-flash";

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
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "login" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Usage this calendar month (Malaysia time is close enough to UTC month start for a counter)
    const m0 = new Date(); m0.setUTCDate(1); m0.setUTCHours(0, 0, 0, 0);
    const { count: used } = await admin.from("photo_searches").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", m0.toISOString());
    const { data: buys } = await admin.from("clicks").select("price_rm, status")
      .eq("user_id", user.id).gte("clicked_at", m0.toISOString()).in("status", ["confirmed", "paid"]);
    const spent = (buys ?? []).reduce((a, c) => a + Number(c.price_rm || 0), 0);
    const limit = FREE_PER_MONTH + (spent >= BONUS_MIN_SPEND ? BONUS_PER_MONTH : 0);
    if (!PILOT_UNLIMITED && (used ?? 0) >= limit) return json({ error: "limit", used, limit, spent }, 402);

    const { image } = await req.json();
    if (typeof image !== "string" || image.length < 100) return json({ error: "no image" }, 400);
    if (image.length > 2_800_000) return json({ error: "image too big" }, 413);

    const prompt = `You identify products in photos or screenshots for a Malaysian price-comparison app (Shopee and Lazada).
Return ONLY JSON: {"query": string, "brand": string, "product": string, "variant": string, "confidence": "high"|"medium"|"low"}.
"query" is the best short search phrase a shopper would type on Shopee, e.g. "Casio MTP-1374D", "Dynamo detergent 3.9kg", "Milo 2kg refill".
Include model numbers and pack size when visible. If it is a book, use the title and author. If you cannot tell, use your best guess and confidence "low".`;
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: image } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    });
    if (!g.ok) {
      const body = (await g.text()).slice(0, 500);
      console.error("gemini error", g.status, body);
      return json({ error: "ai", status: g.status, detail: body.slice(0, 200) }, 502);
    }
    const gj = await g.json();
    const text = gj?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let out: Record<string, string> = {};
    try { out = JSON.parse(text); } catch { out = { query: "", confidence: "low" }; }
    const query = String(out.query || "").slice(0, 120);

    await admin.from("photo_searches").insert({ user_id: user.id, query, confidence: out.confidence ?? null });
    return json({ ...out, query, used: (used ?? 0) + 1, limit: PILOT_UNLIMITED ? null : limit });
  } catch (e) {
    return json({ error: "server", detail: String(e).slice(0, 200) }, 500);
  }
});
