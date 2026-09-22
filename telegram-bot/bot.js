import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { analyzeFoodPhoto, analyzeFoodText } from "./gemini.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN belum dikonfigurasi.");

const bot = new Telegraf(token);
const allowedId = process.env.ALLOWED_TELEGRAM_ID ? Number(process.env.ALLOWED_TELEGRAM_ID) : null;
const apiUrl = (process.env.CALORA_API_URL || "http://localhost:3005").replace(/\/$/, "");
const apiToken = process.env.CALORA_WEBHOOK_TOKEN;
const pending = new Map();
const editing = new Map();
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function apiHeaders() {
  if (!apiToken) throw new Error("CALORA_WEBHOOK_TOKEN belum dikonfigurasi.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` };
}

async function readLogs(telegramUserId) {
  const response = await fetch(`${apiUrl}/api/telegram/food?telegramUserId=${encodeURIComponent(telegramUserId)}`, { headers: apiHeaders() });
  if (!response.ok) throw new Error(`Calora API HTTP ${response.status}`);
  return response.json();
}

async function saveLog(entry, telegramUserId) {
  const response = await fetch(`${apiUrl}/api/telegram/food`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ telegramUserId, food: { ...entry, meal: entry.mealName, source: entry.source || "AI_ESTIMATE" } })
  });
  if (!response.ok) throw new Error((await response.json()).error || `Calora API HTTP ${response.status}`);
  return response.json();
}

async function ensureConnected(ctx) {
  const response = await fetch(`${apiUrl}/api/telegram/food?telegramUserId=${encodeURIComponent(ctx.from.id)}`, { headers: apiHeaders() });
  if (response.ok) return true;
  if (response.status === 404) {
    await ctx.reply("Akun Telegram ini belum terhubung. Buka Calora → Nutrition Profile → Connect Telegram, lalu tekan Start dari link tersebut.");
    return false;
  }
  throw new Error(`Calora API HTTP ${response.status}`);
}

async function showAnalysis(ctx, analysis, source) {
  const id = `${ctx.from.id}_${Date.now()}`;
  pending.set(id, { ...analysis, source, telegramUserId: ctx.from.id, id, createdAt: new Date().toISOString() });
  await ctx.reply(
    `${analysis.mealName}\n🔥 ${analysis.kcal || 0} kcal\n🥩 P ${analysis.protein || 0}g | C ${analysis.carbs || 0}g | F ${analysis.fat || 0}g\nConfidence: ${Math.round((analysis.confidence || 0) * 100)}%\n\n${analysis.summary || ""}\n${analysis.advice || ""}\n\nIni estimasi AI. Tinjau atau edit sebelum disimpan.`,
    Markup.inlineKeyboard([[Markup.button.callback("Simpan", `save_food:${id}`), Markup.button.callback("Edit Nilai", `edit_food:${id}`), Markup.button.callback("Batal", `cancel_food:${id}`)]])
  );
}

bot.use(async (ctx, next) => {
  if (allowedId && ctx.from?.id !== allowedId) return ctx.reply("Unauthorized access.");
  return next();
});

bot.start(async (ctx) => {
  if (ctx.startPayload?.startsWith("bind_")) {
    const response = await fetch(`${apiUrl}/api/telegram/bind`, { method: "POST", headers: apiHeaders(), body: JSON.stringify({ token: ctx.startPayload.slice(5), telegramUserId: ctx.from.id }) });
    if (!response.ok) return ctx.reply((await response.json()).error || "Link koneksi tidak valid.");
    return ctx.reply("Telegram berhasil terhubung ke akun Calora Anda. Sekarang kirim foto makanan untuk dicatat.");
  }
  return ctx.reply("Buka Calora → Integrations untuk menghubungkan akun ini. Setelah terhubung, kirim foto makanan atau label nutrisi.");
});

bot.command("gizi", async (ctx) => {
  if (!(await ensureConnected(ctx))) return;
  const today = new Date().toISOString().slice(0, 10);
  const entries = (await readLogs(ctx.from.id)).filter((item) => String(item.createdAt || "").startsWith(today));
  if (!entries.length) return ctx.reply("Belum ada makanan tercatat hari ini.");
  const total = entries.reduce((acc, item) => ({
    kcal: acc.kcal + Number(item.kcal || 0), protein: acc.protein + Number(item.protein || 0),
    carbs: acc.carbs + Number(item.carbs || 0), fat: acc.fat + Number(item.fat || 0)
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  return ctx.reply(`Log hari ini: ${entries.length} item\n🔥 ${total.kcal} kcal\n🥩 Protein ${total.protein}g | Karbo ${total.carbs}g | Lemak ${total.fat}g`);
});

bot.on("photo", async (ctx) => {
  try {
    if (!(await ensureConnected(ctx))) return;
    await ctx.reply("Menganalisis foto makanan...");
    const photo = ctx.message.photo.at(-1);
    const url = await ctx.telegram.getFileLink(photo.file_id);
    const response = await fetch(url.href);
    if (!response.ok) throw new Error("Gagal mengunduh foto Telegram.");
    const image = Buffer.from(await response.arrayBuffer());
    if (image.length > MAX_IMAGE_BYTES) throw new Error("Foto terlalu besar. Maksimum 5 MB.");
    const analysis = await analyzeFoodPhoto(image, "image/jpeg", ctx.message.caption || "");
    await showAnalysis(ctx, analysis, "PHOTO_ESTIMATE");
  } catch (error) {
    console.error(error);
    await ctx.reply(`Foto tidak bisa dianalisis: ${error.message}`);
  }
});

bot.action(/^edit_food:(.+)$/, async (ctx) => {
  const entry = pending.get(ctx.match[1]);
  if (!entry || entry.telegramUserId !== ctx.from.id) return ctx.answerCbQuery("Sesi sudah kedaluwarsa.");
  editing.set(ctx.from.id, ctx.match[1]);
  await ctx.answerCbQuery();
  await ctx.reply("Kirim koreksi dengan format: kalori,protein,karbo,lemak\nContoh: 520,35,55,18");
});

bot.on("text", async (ctx, next) => {
  const id = editing.get(ctx.from.id);
  if (!id) {
    if (ctx.message.text.startsWith("/")) return next();
    try {
      if (!(await ensureConnected(ctx))) return;
      await ctx.reply("Menganalisis deskripsi makanan...");
      return showAnalysis(ctx, await analyzeFoodText(ctx.message.text), "TEXT_ESTIMATE");
    } catch (error) {
      console.error(error);
      return ctx.reply(`Deskripsi tidak bisa dianalisis: ${error.message}`);
    }
  }
  const values = ctx.message.text.split(",").map(value => Number(value.trim()));
  if (values.length !== 4 || values.some(value => !Number.isFinite(value) || value < 0)) {
    return ctx.reply("Format belum benar. Gunakan: kalori,protein,karbo,lemak");
  }
  const entry = pending.get(id);
  if (!entry || entry.telegramUserId !== ctx.from.id) return ctx.reply("Sesi sudah kedaluwarsa.");
  [entry.kcal, entry.protein, entry.carbs, entry.fat] = values;
  editing.delete(ctx.from.id);
  await ctx.reply(
    `Nilai diperbarui: ${entry.kcal} kcal · P ${entry.protein}g · C ${entry.carbs}g · F ${entry.fat}g`,
    Markup.inlineKeyboard([[Markup.button.callback("Simpan", `save_food:${id}`), Markup.button.callback("Batal", `cancel_food:${id}`)]])
  );
});

bot.action(/^save_food:(.+)$/, async (ctx) => {
  const entry = pending.get(ctx.match[1]);
  if (!entry || entry.telegramUserId !== ctx.from.id) return ctx.answerCbQuery("Sesi sudah kedaluwarsa.");
  await saveLog(entry, ctx.from.id);
  pending.delete(ctx.match[1]);
  await ctx.answerCbQuery("Tersimpan.");
  await ctx.editMessageText(`Tersimpan di CaloraAI: ${entry.mealName} (${entry.kcal || 0} kcal).`);
});

bot.action(/^cancel_food:(.+)$/, async (ctx) => {
  const entry = pending.get(ctx.match[1]);
  if (!entry || entry.telegramUserId !== ctx.from.id) return ctx.answerCbQuery("Sesi sudah kedaluwarsa.");
  pending.delete(ctx.match[1]);
  editing.delete(ctx.from.id);
  await ctx.answerCbQuery("Dibatalkan.");
  await ctx.editMessageText("Pencatatan makanan dibatalkan.");
});

bot.launch();
console.log("CaloraAI Telegram bot running.");
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
