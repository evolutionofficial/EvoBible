import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Evo Bible: Cari Kisah. Pertanyaan bebas ("Yesus menampakkan diri di Perjanjian Lama", "nabi Elia ngapain")
// + kandidat dari katalog lokal -> urutan terbaik, alasan singkat, dan (opsional) saran rujukan di luar katalog.
// Balasan { ok, hasil:[{id, r, j, a, x}] }. id kosong = saran AI di luar katalog (klien memeriksa rujukannya).

const ORIGIN_RE = /^https:\/\/([a-z0-9]+-)?evobible\.evolution-official-id\.workers\.dev$|^https:\/\/(www\.)?evobible\.my\.id$|^https:\/\/evobible[a-z0-9-]*\.pages\.dev$|^https:\/\/evolutionofficial\.github\.io$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const DEFAULT_ORIGIN = "https://evobible.my.id";
const MODEL = Deno.env.get("GEMINI_KISAH_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-lite-latest";
const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SALT = Deno.env.get("HASH_SALT") ?? "evobible";
const LIMIT_DEV = 60, LIMIT_IP = 300, LIMIT_ALL = 6000; // pencarian per hari

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
async function kredit(d: string, ip: string): Promise<boolean> {
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const nd = await db.rpc("catat_pakai", { p_kunci: `${day}:kd:${await sha(d)}`, p_jumlah: 1 });
  if (nd.error) throw nd.error;
  if ((nd.data as number) > LIMIT_DEV) return false;
  const ni = await db.rpc("catat_pakai", { p_kunci: `${day}:ki:${await sha(ip)}`, p_jumlah: 1 });
  if (ni.error) throw ni.error;
  if ((ni.data as number) > LIMIT_IP) return false;
  const ng = await db.rpc("catat_pakai", { p_kunci: `${day}:kg`, p_jumlah: 1 });
  if (ng.error) throw ng.error;
  return (ng.data as number) <= LIMIT_ALL;
}

const PROMPT_ID =
  "Kamu pustakawan Alkitab untuk aplikasi Alkitab Indonesia (terjemahan AYT). Pengguna mencari KISAH, TOKOH, atau PERISTIWA di Alkitab dari deskripsi bebas (sering samar, dari ingatan). " +
  "Diberikan pertanyaan dan daftar KANDIDAT dari katalog aplikasi (id|rujukan|judul|ringkasan). Tugasmu:\n" +
  "1. Pilih kandidat yang benar-benar menjawab pertanyaan (maks 10) dan urutkan dari yang paling cocok. Jika pertanyaan tentang seorang tokoh, urutkan menurut urutan kitab dan jangan melewatkan kisah utama tokoh itu.\n" +
  "2. Beri alasan satu kalimat pendek mengapa cocok.\n" +
  "3. Boleh menambah paling banyak 4 saran di luar kandidat (id kosong) bila kamu YAKIN kisah itu ada di Alkitab dan cocok; tulis rujukannya dalam bentuk baku (mis. \"Daniel 3:19-27\", \"Kejadian 18:1-15\"). Jangan mengarang ayat; kalau tidak yakin, jangan tambahkan.\n" +
  "4. Tandai x=true bila kecocokannya hanya lewat penafsiran (mis. \"Yesus di Perjanjian Lama\": nama Yesus tidak muncul di teks, itu tafsiran Kristen). Beri tahu jelas di alasan bahwa itu tafsiran.\n" +
  "Jangan memuat ajaran atau fakta di luar Alkitab. Jika tidak ada yang cocok, kembalikan daftar kosong.";
const PROMPT_EN =
  "You are a Bible librarian for a Bible app. The user looks for a STORY, PERSON or EVENT in the Bible from a loose description. Given the question and CANDIDATES from the app's catalog (id|reference|title|summary): " +
  "pick the candidates that truly answer it (max 10) in best order (for a person, in Bible order); give a one-sentence reason in English; you may add at most 4 suggestions outside the candidates (empty id) only if you are SURE they exist, with standard references; " +
  "set x=true when the match is only by interpretation (say so in the reason). Never invent verses. Return an empty list if nothing fits.";
const SCHEMA = {
  type: "OBJECT",
  properties: { hasil: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, r: { type: "STRING" }, j: { type: "STRING" }, a: { type: "STRING" }, x: { type: "BOOLEAN" } }, required: ["id", "a"] } } },
  required: ["hasil"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method === "GET") return reply(req, { ok: true, hidup: true });
  if (req.method !== "POST") return reply(req, { ok: false, sebab: "metode" }, 405);
  let body: { q?: unknown; c?: unknown; d?: unknown; lang?: unknown };
  try { body = await req.json(); } catch { return reply(req, { ok: false, sebab: "format" }, 400); }
  const en = body.lang === "en";
  const d = typeof body.d === "string" ? body.d.slice(0, 64) : "";
  const q = typeof body.q === "string" ? body.q.trim().slice(0, 300) : "";
  if (d.length < 8 || q.length < 2) return reply(req, { ok: false, sebab: "format" }, 400);
  const c = Array.isArray(body.c) ? body.c.slice(0, 40).map((x) => Array.isArray(x) ? x.slice(0, 4).map((y) => String(y ?? "").slice(0, 260)) : []).filter((x) => x.length >= 3) : [];
  if (!KEY) return reply(req, { ok: false, sebab: "belum_siap" });
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0].trim();
  try { if (!(await kredit(d, ip))) return reply(req, { ok: false, sebab: "batas" }); }
  catch (e) { console.error("kredit error", (e as Error)?.message ?? e); return reply(req, { ok: false, sebab: "galat" }); }
  try {
    const daftar = c.map((x) => x.join("|")).join("\n");
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: (en ? PROMPT_EN : PROMPT_ID) + "\n\n=== PERTANYAAN ===\n" + q + "\n\n=== KANDIDAT ===\n" + (daftar || "(kosong)") }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.1, maxOutputTokens: 3000 },
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!r.ok) { console.error("gemini kisah status", r.status, (await r.text()).slice(0, 300)); return reply(req, { ok: false, sebab: r.status === 429 ? "batas" : "galat" }); }
    const j = await r.json();
    const parts = j?.candidates?.[0]?.content?.parts;
    const txt = Array.isArray(parts) ? parts.map((p: { text?: string }) => p?.text ?? "").join("") : "";
    const o = JSON.parse(txt || "{}");
    const ids = new Set(c.map((x) => x[0]));
    const hasil = (Array.isArray(o.hasil) ? o.hasil : []).slice(0, 14).map((h: { id?: string; r?: string; j?: string; a?: string; x?: boolean }) => ({
      id: ids.has(String(h.id ?? "")) ? String(h.id) : "", r: String(h.r ?? "").slice(0, 60), j: String(h.j ?? "").slice(0, 120), a: String(h.a ?? "").slice(0, 300), x: !!h.x,
    })).filter((h: { id: string; r: string }) => h.id || h.r);
    return reply(req, { ok: true, hasil });
  } catch (e) {
    console.error("gemini kisah error", (e as Error)?.name, (e as Error)?.message?.slice(0, 160));
    return reply(req, { ok: false, sebab: "galat" });
  }
});
