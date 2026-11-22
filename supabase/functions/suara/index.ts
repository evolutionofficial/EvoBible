import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Evo Bible: ubah rekaman suara menjadi teks lewat Gemini.
// - mode bawaan: rujukan ayat pendek (cari ayat dengan suara), balasan { teks, ref }
// - mode "cerita" (k: "cerita"): cerita untuk Renungan, maks ±60 detik, balasan { teks }
// Rekaman tidak disimpan; hanya hitungan pemakaian per hari yang dicatat.

const ORIGIN_RE = /^https:\/\/([a-z0-9]+-)?evobible\.evolution-official-id\.workers\.dev$|^https:\/\/(www\.)?evobible\.my\.id$|^https:\/\/evobible[a-z0-9-]*\.pages\.dev$|^https:\/\/evolutionofficial\.github\.io$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const DEFAULT_ORIGIN = "https://evobible.my.id";
const MODEL = Deno.env.get("GEMINI_SUARA_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-lite-latest";
const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SALT = Deno.env.get("HASH_SALT") ?? "evobible";
const LIMIT_DEV = 80, LIMIT_IP = 600, LIMIT_ALL = 4000;
const MAX_REF = 900000, MAX_CERITA = 2800000; // panjang base64 (±21 detik / ±60 detik WAV 16 kHz mono)

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function sha(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SALT + "|" + s));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ORIGIN_RE.test(o) ? o : DEFAULT_ORIGIN, "Access-Control-Allow-Headers": "content-type, authorization, apikey", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Vary": "Origin" };
}
function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

const PROMPT =
  "Rekaman ini berisi orang yang mengucapkan rujukan ayat Alkitab dalam bahasa Indonesia (kadang campur bahasa Inggris), misalnya \"Roma pasal dua ayat satu sampai tujuh\". " +
  "Tuliskan apa yang diucapkan (teks), lalu jika berisi rujukan ayat, tulis rujukannya dalam bentuk baku dengan nama kitab Indonesia dan angka, misalnya \"Roma 2:1-7\", \"1 Korintus 13\", \"Mazmur 23:1\" (ref). " +
  "Jika tidak ada rujukan ayat atau tidak terdengar jelas, isi ref dengan string kosong. Jangan mengarang.";
const SCHEMA = { type: "OBJECT", properties: { teks: { type: "STRING" }, ref: { type: "STRING" } }, required: ["teks", "ref"] };

const PROMPT_CERITA_ID =
  "Rekaman ini berisi seseorang yang bercerita tentang keadaan atau perasaannya hari ini, biasanya dalam bahasa Indonesia (kadang campur bahasa daerah atau Inggris). " +
  "Tuliskan persis apa yang diucapkan sebagai teks yang rapi: beri tanda baca dan huruf kapital yang wajar, buang kata pengisi seperti \"eh\" atau \"emm\", tetapi jangan meringkas, menambah, menjawab, atau mengubah maknanya. " +
  "Jika tidak ada ucapan yang jelas, isi teks dengan string kosong.";
const PROMPT_CERITA_EN =
  "This recording contains someone talking about how they feel or what is happening in their day, usually in English. " +
  "Write down exactly what was said as clean text: add natural punctuation and capitalization, drop fillers like \"uh\" or \"um\", but do not summarize, add, answer, or change the meaning. " +
  "If there is no clear speech, return an empty string for teks.";
const SCHEMA_CERITA = { type: "OBJECT", properties: { teks: { type: "STRING" } }, required: ["teks"] };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method === "GET") return reply(req, { ok: true, hidup: true });
  if (req.method !== "POST") return reply(req, { ok: false, sebab: "metode" }, 405);
  let body: { a?: unknown; m?: unknown; d?: unknown; k?: unknown; lang?: unknown };
  try { body = await req.json(); } catch { return reply(req, { ok: false, sebab: "format" }, 400); }
  const cerita = body.k === "cerita";
  const en = body.lang === "en";
  const a = typeof body.a === "string" ? body.a : "";
  const m = typeof body.m === "string" && /^audio\/[a-z0-9.+-]+/i.test(body.m) ? body.m.split(";")[0] : "";
  const d = typeof body.d === "string" ? body.d.slice(0, 64) : "";
  if (!a || a.length > (cerita ? MAX_CERITA : MAX_REF) || !m || d.length < 8) return reply(req, { ok: false, sebab: "format" }, 400);
  if (!KEY) return reply(req, { ok: false, sebab: "belum_siap" });

  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0].trim();
  try {
    const nd = await db.rpc("catat_pakai", { p_kunci: `${day}:sd:${await sha(d)}`, p_jumlah: 1 });
    if (nd.error) throw nd.error;
    if ((nd.data as number) > LIMIT_DEV) return reply(req, { ok: false, sebab: "batas" });
    const ni = await db.rpc("catat_pakai", { p_kunci: `${day}:si:${await sha(ip)}`, p_jumlah: 1 });
    if (ni.error) throw ni.error;
    if ((ni.data as number) > LIMIT_IP) return reply(req, { ok: false, sebab: "batas" });
    const ng = await db.rpc("catat_pakai", { p_kunci: `${day}:sg`, p_jumlah: 1 });
    if (ng.error) throw ng.error;
    if ((ng.data as number) > LIMIT_ALL) return reply(req, { ok: false, sebab: "batas" });
  } catch (e) {
    console.error("kredit error", (e as Error)?.message ?? e);
    return reply(req, { ok: false, sebab: "galat" });
  }

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: m, data: a } }, { text: cerita ? (en ? PROMPT_CERITA_EN : PROMPT_CERITA_ID) : PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: cerita ? SCHEMA_CERITA : SCHEMA, temperature: 0, maxOutputTokens: cerita ? 800 : 300 },
      }),
      signal: AbortSignal.timeout(cerita ? 25000 : 15000),
    });
    if (!r.ok) { console.error("gemini status", r.status, (await r.text()).slice(0, 300)); return reply(req, { ok: false, sebab: r.status === 429 ? "batas" : "galat" }); }
    const j = await r.json();
    const parts = j?.candidates?.[0]?.content?.parts;
    const txt = Array.isArray(parts) ? parts.map((p: { text?: string }) => p?.text ?? "").join("") : "";
    const out = JSON.parse(txt || "{}");
    if (cerita) return reply(req, { ok: true, teks: String(out.teks ?? "").slice(0, 500) });
    return reply(req, { ok: true, teks: String(out.teks ?? "").slice(0, 200), ref: String(out.ref ?? "").slice(0, 60) });
  } catch (e) {
    console.error("gemini error", (e as Error)?.name, (e as Error)?.message?.slice(0, 160));
    return reply(req, { ok: false, sebab: "galat" });
  }
});
