import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Evo Bible: Catatan Ibadah.
// - mode "segmen": satu potongan rekaman khotbah (±5 menit, atau berkas impor) -> teks (transkrip), balasan { ok, teks }
// - mode "ringkas": transkrip lengkap -> judul, ringkasan, poin, ayat, penerapan, balasan { ok, hasil }
// Rekaman tidak disimpan; hanya hitungan pemakaian per hari yang dicatat.

const ORIGIN_RE = /^https:\/\/([a-z0-9]+-)?evobible\.evolution-official-id\.workers\.dev$|^https:\/\/(www\.)?evobible\.my\.id$|^https:\/\/evobible[a-z0-9-]*\.pages\.dev$|^https:\/\/evolutionofficial\.github\.io$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const DEFAULT_ORIGIN = "https://evobible.my.id";
const MODEL = Deno.env.get("GEMINI_IBADAH_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-lite-latest";
const MODEL_RINGKAS = Deno.env.get("GEMINI_RINGKAS_MODEL") ?? MODEL;
const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SALT = Deno.env.get("HASH_SALT") ?? "evobible";
const LIMIT_SEG_DEV = 60, LIMIT_SEG_IP = 400, LIMIT_SEG_ALL = 3000;   // potongan rekaman per hari
const LIMIT_RING_DEV = 20, LIMIT_RING_IP = 100, LIMIT_RING_ALL = 800; // ringkasan per hari
const MAX_SEG = 19000000;     // panjang base64 satu potongan (±14 MB berkas; batas inline Gemini 20 MB)
const MAX_TRANSKRIP = 160000; // karakter

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
// Gemini menerima audio/m4a, bukan audio/mp4 (iPhone merekam AAC dalam wadah MP4 = m4a).
function mimeGemini(m: string): string {
  const x = m.toLowerCase();
  if (x === "audio/mp4" || x === "audio/x-m4a" || x === "audio/m4a") return "audio/m4a";
  if (x === "audio/x-wav" || x === "audio/wave") return "audio/wav";
  if (x === "audio/mpeg") return "audio/mp3";
  return x;
}

const PROMPT_SEGMEN_ID =
  "Rekaman ini adalah potongan khotbah atau renungan di ibadah gereja, berbahasa Indonesia (kadang campur bahasa Inggris, bahasa daerah, atau kutipan ayat). " +
  "Tuliskan SELURUH yang diucapkan pengkhotbah sebagai teks yang rapi: beri tanda baca dan huruf kapital yang wajar, pisahkan menjadi paragraf, buang kata pengisi (\"eh\", \"emm\"), " +
  "tetapi jangan meringkas, menambah, menafsirkan, atau mengubah maknanya. Tulis nama kitab dan rujukan ayat dalam bentuk baku (misalnya \"Yohanes 3:16\") jika disebut. " +
  "Abaikan nyanyian, musik, dan percakapan jemaat yang tidak jelas. Bagian yang tidak terdengar jelas ditulis [tidak jelas]; jangan mengarang. " +
  "Jika tidak ada ucapan yang jelas, balas dengan teks kosong. Balas hanya dengan transkripnya, tanpa pembuka atau penutup.";
const PROMPT_SEGMEN_EN =
  "This recording is a segment of a sermon or devotional at a church service, usually in English. Write down EVERYTHING the speaker said as clean text: natural punctuation and capitalization, split into paragraphs, " +
  "drop fillers, but do not summarize, add, interpret or change the meaning. Write Bible references in standard form (e.g. \"John 3:16\") when mentioned. Ignore singing and music. Mark unclear parts as [unclear]; never invent text. " +
  "If there is no clear speech, reply with an empty text. Reply with the transcript only.";

const PROMPT_RINGKAS_ID =
  "Berikut transkrip lengkap sebuah khotbah dari ibadah gereja (hasil pengenalan suara, jadi mungkin ada salah dengar). " +
  "Susun catatan ibadah dalam bahasa Indonesia yang setia pada isi khotbah: jangan menambah ajaran, ayat, atau fakta yang tidak ada di transkrip. " +
  "Isi: judul (singkat, maks 70 karakter, sesuai isi khotbah), tema (satu kalimat), ringkasan (3-6 kalimat), poin (4-8 poin utama, tiap poin satu atau dua kalimat), " +
  "ayat (daftar rujukan ayat yang benar-benar disebut atau dibacakan, bentuk baku seperti \"Yohanes 3:16\" atau \"Roma 8:28-30\"; kosongkan bila tidak ada), " +
  "penerapan (2-4 ajakan atau pertanyaan renungan yang disebut atau jelas tersirat dari khotbah). Jika transkrip terlalu pendek atau tidak berisi khotbah, isi judul \"Catatan ibadah\" dan jelaskan singkat di ringkasan.";
const PROMPT_RINGKAS_EN =
  "Below is the full transcript of a sermon from a church service (speech recognition output, so some words may be misheard). " +
  "Write service notes in English that stay faithful to the sermon: do not add teaching, verses or facts that are not in the transcript. " +
  "Fields: judul (short title, max 70 chars), tema (one sentence), ringkasan (3-6 sentences), poin (4-8 main points, one or two sentences each), " +
  "ayat (Bible references actually mentioned or read, standard form such as \"John 3:16\"; empty if none), penerapan (2-4 applications or reflection questions mentioned or clearly implied). " +
  "If the transcript is too short or has no sermon, set judul to \"Service notes\" and explain briefly in ringkasan.";
const SCHEMA_RINGKAS = {
  type: "OBJECT",
  properties: {
    judul: { type: "STRING" }, tema: { type: "STRING" }, ringkasan: { type: "STRING" },
    poin: { type: "ARRAY", items: { type: "STRING" } },
    ayat: { type: "ARRAY", items: { type: "STRING" } },
    penerapan: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["judul", "tema", "ringkasan", "poin", "ayat", "penerapan"],
};

async function kredit(d: string, ip: string, jenis: "seg" | "ring"): Promise<boolean> {
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const [ld, li, la] = jenis === "seg" ? [LIMIT_SEG_DEV, LIMIT_SEG_IP, LIMIT_SEG_ALL] : [LIMIT_RING_DEV, LIMIT_RING_IP, LIMIT_RING_ALL];
  const nd = await db.rpc("catat_pakai", { p_kunci: `${day}:i${jenis}d:${await sha(d)}`, p_jumlah: 1 });
  if (nd.error) throw nd.error;
  if ((nd.data as number) > ld) return false;
  const ni = await db.rpc("catat_pakai", { p_kunci: `${day}:i${jenis}i:${await sha(ip)}`, p_jumlah: 1 });
  if (ni.error) throw ni.error;
  if ((ni.data as number) > li) return false;
  const ng = await db.rpc("catat_pakai", { p_kunci: `${day}:i${jenis}g`, p_jumlah: 1 });
  if (ng.error) throw ng.error;
  return (ng.data as number) <= la;
}

function strArr(v: unknown, n: number, len: number): string[] {
  return Array.isArray(v) ? v.map((x) => String(x ?? "").trim().slice(0, len)).filter(Boolean).slice(0, n) : [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method === "GET") return reply(req, { ok: true, hidup: true });
  if (req.method !== "POST") return reply(req, { ok: false, sebab: "metode" }, 405);
  let body: { k?: unknown; a?: unknown; m?: unknown; d?: unknown; t?: unknown; ay?: unknown; lang?: unknown };
  try { body = await req.json(); } catch { return reply(req, { ok: false, sebab: "format" }, 400); }
  const en = body.lang === "en";
  const d = typeof body.d === "string" ? body.d.slice(0, 64) : "";
  const ring = body.k === "ringkas";
  if (d.length < 8) return reply(req, { ok: false, sebab: "format" }, 400);
  if (!KEY) return reply(req, { ok: false, sebab: "belum_siap" });

  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0].trim();

  if (ring) {
    const t = typeof body.t === "string" ? body.t.trim() : "";
    if (t.length < 20 || t.length > MAX_TRANSKRIP) return reply(req, { ok: false, sebab: "format" }, 400);
    const ay = strArr(body.ay, 60, 60);
    try { if (!(await kredit(d, ip, "ring"))) return reply(req, { ok: false, sebab: "batas" }); }
    catch (e) { console.error("kredit error", (e as Error)?.message ?? e); return reply(req, { ok: false, sebab: "galat" }); }
    try {
      const petunjuk = ay.length ? "\n\nCatatan: selama ibadah, pendengar membuka ayat-ayat ini di aplikasi (petunjuk saja, belum tentu dibacakan pengkhotbah): " + ay.join("; ") + "." : "";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_RINGKAS}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: (en ? PROMPT_RINGKAS_EN : PROMPT_RINGKAS_ID) + petunjuk + "\n\n=== TRANSKRIP ===\n" + t }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA_RINGKAS, temperature: 0.2, maxOutputTokens: 3000 },
        }),
        signal: AbortSignal.timeout(100000),
      });
      if (!r.ok) { console.error("gemini ringkas status", r.status, (await r.text()).slice(0, 300)); return reply(req, { ok: false, sebab: r.status === 429 ? "batas" : "galat" }); }
      const j = await r.json();
      const parts = j?.candidates?.[0]?.content?.parts;
      const txt = Array.isArray(parts) ? parts.map((p: { text?: string }) => p?.text ?? "").join("") : "";
      const o = JSON.parse(txt || "{}");
      const hasil = {
        judul: String(o.judul ?? "").trim().slice(0, 100), tema: String(o.tema ?? "").trim().slice(0, 300),
        ringkasan: String(o.ringkasan ?? "").trim().slice(0, 2000), poin: strArr(o.poin, 10, 500),
        ayat: strArr(o.ayat, 40, 60), penerapan: strArr(o.penerapan, 6, 400),
      };
      if (!hasil.ringkasan && !hasil.poin.length) return reply(req, { ok: false, sebab: "galat" });
      return reply(req, { ok: true, hasil });
    } catch (e) {
      console.error("gemini ringkas error", (e as Error)?.name, (e as Error)?.message?.slice(0, 160));
      return reply(req, { ok: false, sebab: "galat" });
    }
  }

  // mode segmen
  const a = typeof body.a === "string" ? body.a : "";
  const m = typeof body.m === "string" && /^audio\/[a-z0-9.+-]+/i.test(body.m) ? mimeGemini(body.m.split(";")[0]) : "";
  if (!a || a.length > MAX_SEG || !m) return reply(req, { ok: false, sebab: "format" }, 400);
  try { if (!(await kredit(d, ip, "seg"))) return reply(req, { ok: false, sebab: "batas" }); }
  catch (e) { console.error("kredit error", (e as Error)?.message ?? e); return reply(req, { ok: false, sebab: "galat" }); }
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: m, data: a } }, { text: en ? PROMPT_SEGMEN_EN : PROMPT_SEGMEN_ID }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 16000 },
      }),
      signal: AbortSignal.timeout(110000),
    });
    if (!r.ok) { console.error("gemini segmen status", r.status, (await r.text()).slice(0, 300)); return reply(req, { ok: false, sebab: r.status === 429 ? "batas" : "galat" }); }
    const j = await r.json();
    const parts = j?.candidates?.[0]?.content?.parts;
    const txt = Array.isArray(parts) ? parts.map((p: { text?: string }) => p?.text ?? "").join("") : "";
    return reply(req, { ok: true, teks: txt.trim().slice(0, 60000) });
  } catch (e) {
    console.error("gemini segmen error", (e as Error)?.name, (e as Error)?.message?.slice(0, 160));
    return reply(req, { ok: false, sebab: "galat" });
  }
});
