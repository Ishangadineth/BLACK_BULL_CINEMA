/**
 * v 0.0.26 - BLACK BULL Cinema Manager Bot
 * High-Performance Telegram Group Manager & Movie Search Bot
 * using Cloudflare Workers
 * manual edit
 */

import { handleDashboardRequest } from './Web_Dashboard/api.js';

const botUsernamesCache = {}; // Global Cache for Performance

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // ── Web Dashboard Routing ──
    if (url.pathname.startsWith('/admin')) {
        return handleDashboardRequest(request, env);
    }

    if (request.method !== "POST") return new Response("Black Bull Cinema Manager Active ✅");

    try {
      const payload = await request.json();

      if (payload.callback_query) {
        ctx.waitUntil(handleCallback(payload.callback_query, env, ctx));
      }
      if (payload.message) {
        ctx.waitUntil(handleMessage(payload.message, env, ctx));
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("Worker error:", err.message);
      return new Response("Error", { status: 500 });
    }
  }
};

// ══════════════════════════════════════════════
// MANAGER CONTROLLER LOGIC
// ══════════════════════════════════════════════

async function handleMessage(msg, env, ctx) {
  const text = msg.text ? msg.text.trim() : "";
  const chatId = msg.chat.id;
  const msgId = msg.message_id;

  if (!text && msg.chat.type !== "private") {
    return;
  }

  const bots = [
    env.BOT_TOKEN_1, env.BOT_TOKEN_2, env.BOT_TOKEN_3, env.BOT_TOKEN_4,
    env.BOT_TOKEN_5, env.BOT_TOKEN_6, env.BOT_TOKEN_7
  ].filter(Boolean);

  if (bots.length === 0) {
    console.error("No valid bots available!");
    return;
  }

  if (msg.chat.type === "private") {
    if (text.startsWith("/start ")) {
      const payload = text.replace("/start ", "").trim();
      if (payload) return handleStartCommand(chatId, payload, env, bots);
    }

    if (!env.ADMIN_ID || chatId.toString() !== String(env.ADMIN_ID)) {
      return sendWelcomeMessage(bots[0], chatId, msg.from?.id || chatId, env);
    }
    return handleAdminLogic(msg, env);
  }

  if (text.startsWith("/lang")) {
    const kb = {
      inline_keyboard: [
        [{ text: "🇱🇰 Sinhala (Default)", callback_data: "setlang_si" }],
        [{ text: "🇬🇧 English", callback_data: "setlang_en" }, { text: "🇮🇳 Hindi", callback_data: "setlang_hi" }],
        [{ text: "🇪🇸 Spanish", callback_data: "setlang_es" }, { text: "🇮🇳 Tamil", callback_data: "setlang_ta" }]
      ]
    };
    const res = await fetch(`https://api.telegram.org/bot${bots[0]}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "🌐 <b>Select your preferred language:</b>", parse_mode: "HTML", reply_markup: kb })
    });
    const data = await res.json();
    if (data.ok && ctx) {
      const lid = data.result.message_id;
      ctx.waitUntil((async () => {
        await new Promise(r => setTimeout(r, 25000));
        await fetch(`https://api.telegram.org/bot${bots[0]}/deleteMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: lid })
        }).catch(() => {});
      })());
    }
    return;
  }

  if (text === "/list") {
    const list = await env.BLACK_BULL_CINEMA.list();
    const movieKeys = list.keys.filter(k => !k.name.startsWith("admin_") && !k.name.startsWith("site_") && !k.name.startsWith("verified_") && !k.name.startsWith("idx_"));

    if (movieKeys.length === 0) {
      await fetch(`https://api.telegram.org/bot${bots[0]}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "📂 <b>No movies available yet.</b>", parse_mode: "HTML" })
      });
      return;
    }

    const listText = `📂 <b>Available Movies List:</b>\n\n` +
      movieKeys.map((k, i) => `${i + 1}. <code>${k.name}</code>`).join("\n") +
      `\n\n<i>Tap a movie name to copy it, then paste it to search!</i>`;

    const res = await fetch(`https://api.telegram.org/bot${bots[0]}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: listText, parse_mode: "HTML" })
    });
    const data = await res.json();
    if (data.ok && ctx) {
      const lid = data.result.message_id;
      ctx.waitUntil((async () => {
        await new Promise(r => setTimeout(r, 25000));
        await fetch(`https://api.telegram.org/bot${bots[0]}/deleteMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: lid })
        }).catch(() => {});
      })());
    }
    return;
  }

  if (text === "/watchlist") {
    let watchlistStr = await env.BLACK_BULL_CINEMA.get(`watch_${chatId}`);
    let watchlist = watchlistStr ? JSON.parse(watchlistStr) : [];
    
    if (watchlist.length === 0) {
      await fetch(`https://api.telegram.org/bot${bots[0]}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "📝 <b>Your Watchlist is empty.</b>", parse_mode: "HTML" })
      });
      return;
    }

    const keyboard = [];
    for (const movieId of watchlist) {
      let searchKey = null;
      if (env.BLACK_BULL_CINEMA_FILEID) searchKey = await env.BLACK_BULL_CINEMA_FILEID.get(`idx_${movieId}`);
      if (!searchKey) searchKey = await env.BLACK_BULL_CINEMA.get(`idx_${movieId}`);
      if (searchKey) {
        const dataStr = await env.BLACK_BULL_CINEMA.get(searchKey);
        if (dataStr) {
          const movie = JSON.parse(dataStr);
          const prefix = movie.is_series ? "📺" : "🎬";
          keyboard.push([{ text: `${prefix} ${movie.title} (${movie.year})`, callback_data: `view_${movieId}|watch|${chatId}` }]);
        }
      }
    }

    if (keyboard.length === 0) {
       await fetch(`https://api.telegram.org/bot${bots[0]}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "📝 <b>No valid movies found in your Watchlist.</b>", parse_mode: "HTML" })
      });
      return;
    }

    const res = await fetch(`https://api.telegram.org/bot${bots[0]}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "❤️ <b>My Watchlist:</b>\n\nClick a movie below to view it.", parse_mode: "HTML", reply_markup: { inline_keyboard: keyboard } })
    });
    return;
  }

  if (text.startsWith("/") && msg.chat.type !== "private") {
    if (!text.startsWith("/lang") && !text.startsWith("/list") && !text.startsWith("/watchlist")) return;
  }

  // IGNORE VIOLATIONS (URLs, Emojis, Locations) in Groups so we don't reply with "Not Found"
  if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
    const hasUrl = /https?:\/\/[^\s]+|t\.me\/[^\s]+/.test(text);
    const hasEmoji = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/.test(text);
    const hasLocation = !!msg.location;

    if (hasUrl || hasEmoji || hasLocation) return; 
  }

  const botIndex = msgId % bots.length;
  const selectedToken = bots[botIndex];

  const results = await searchMovieInKV(text, env.BLACK_BULL_CINEMA);

  // Async log search to KV for Dashboard Analytics
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(logSearchStats(env.BLACK_BULL_CINEMA, text, results && results.length > 0));
  }

  if (results && results.length > 0) {
    const userFirstName = msg.from?.first_name || msg.chat?.first_name || "User";
    // Passing the array of bots to allow retry fallback if needed later, though for new msgs selectedToken is fine
    await sendSearchResults([selectedToken], chatId, msg.from?.id || chatId, msgId, text, results, "all", env, null, userFirstName);
  } else {
    const langCode = await getUserLang(msg.from?.id || chatId, env);
    const T = LANGS[langCode] || LANGS.si;
    const notFoundText = T.not_found.replace("{query}", text);
    const kb = { inline_keyboard: [[{ text: T.req_btn, callback_data: `req_${text.substring(0, 40)}` }]] };
    const res = await fetch(`https://api.telegram.org/bot${selectedToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: notFoundText, parse_mode: "HTML", reply_markup: kb })
    });

    const data = await res.json();
    if (data.ok && ctx) {
      const nfMsgId = data.result.message_id;
      ctx.waitUntil((async () => {
        await new Promise(r => setTimeout(r, 25000)); // 25 seconds
        await fetch(`https://api.telegram.org/bot${selectedToken}/deleteMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: nfMsgId })
        }).catch(() => {});
      })());
    }
  }
}

// ══════════════════════════════════════════════
// ADMIN UPLOADER LOGIC (PRIVATE CHAT)
// ══════════════════════════════════════════════

async function handleAdminLogic(msg, env) {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : "";
  const kv = env.BLACK_BULL_CINEMA;

  const sendMsg = async (msgText) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: "HTML" })
  });

  let state = {};
  const stateStr = await kv.get(`admin_state_${chatId}`);
  if (stateStr) state = JSON.parse(stateStr);

  if (text.startsWith("/seturl ")) {
    const newUrl = text.split(" ")[1];
    if (newUrl && newUrl.startsWith("http")) {
      await kv.put("config_gateway_url", newUrl);
      return sendMsg(`✅ <b>Gateway URL updated to:</b>\n<code>${newUrl}</code>`);
    } else {
      return sendMsg("❌ Invalid URL format. Example: <code>/seturl https://mygateway.com/</code>");
    }
  }

  if (text === "/nowurl") {
    let currentUrl = await kv.get("config_gateway_url");
    if (!currentUrl) currentUrl = "https://idsmovieplanet.ishangadineth.online/";
    return sendMsg(`🔗 <b>Current Gateway URL:</b>\n<code>${currentUrl}</code>`);
  }

  if (text === "/deleteurl") {
    await kv.delete("config_gateway_url");
    return sendMsg("🗑 <b>Gateway URL deleted.</b> System will use the default URL.");
  }

  if (text === "/cancel") {
    await kv.delete(`admin_state_${chatId}`);
    return sendMsg("❌ <b>Upload Cancelled.</b> Send a new video to start again.");
  }

  let fileId = null;
  let fileType = "file";
  let fileSize = 0;

  if (msg.video) { fileId = msg.video.file_id; fileType = "video"; fileSize = msg.video.file_size; }
  else if (msg.document) { fileId = msg.document.file_id; fileType = "document"; fileSize = msg.document.file_size; }
  else if (msg.audio) { fileId = msg.audio.file_id; fileType = "audio"; fileSize = msg.audio.file_size; }
  else if (msg.photo) { fileId = msg.photo[msg.photo.length - 1].file_id; fileType = "photo"; fileSize = msg.photo[msg.photo.length - 1].file_size; }

  if (fileId) {
    if (!state.step || state.step === "accumulate") {
      state.step = "accumulate";
      await kv.put(`admin_state_${chatId}`, JSON.stringify(state));

      const dbChannelId = "-1003759058179";
      const copyUrl = `https://api.telegram.org/bot${env.BOT_TOKEN_1}/copyMessage`;
      const copyRes = await fetch(copyUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: dbChannelId, from_chat_id: chatId, message_id: msg.message_id })
      });
      const copyData = await copyRes.json();

      if (!copyData.ok) {
        return sendMsg(`❌ <b>Failed to copy to Database Channel!</b>\nError: <code>${copyData.description}</code>\n\n<i>Did you add the Manager Bot to the channel as an Admin?</i>`);
      }

      const channelMsgId = copyData.result.message_id;

      await kv.put(`admin_file_${chatId}_${msg.message_id}`, JSON.stringify({ id: channelMsgId, type: "channel_msg", size: fileSize }));

      return sendMsg(`✅ <b>File Saved to Database!</b> <i>(Msg ID: ${channelMsgId})</i>\n\n<i>Forward more files to group them together, or type </i>/done<i> when you have sent all files for this set.</i>\n\n<i>Type /cancel to abort.</i>`);
    }
  }

  if (state.step === "accumulate" && text === "/done") {
    const list = await kv.list({ prefix: `admin_file_${chatId}_` });
    if (list.keys.length === 0) {
      return sendMsg("⚠️ No files received yet. Forward files first.");
    }

    const files = [];
    for (const keyObj of list.keys) {
      const fileStr = await kv.get(keyObj.name);
      if (fileStr) files.push(JSON.parse(fileStr));
      await kv.delete(keyObj.name);
    }

    state.step = "ask_type";
    state.files = files;
    await kv.put(`admin_state_${chatId}`, JSON.stringify(state));

    const kb = { inline_keyboard: [[{ text: "🎬 Movie", callback_data: "type_movie" }, { text: "📺 Series", callback_data: "type_series" }]] };
    return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `📦 <b>${files.length} Files Grouped Successfully!</b>\n\nWhat type of content is this?`, parse_mode: "HTML", reply_markup: kb })
    });
  }

  if (state.step === "ask_details" && text) {
    const parts = text.split(",").map(s => s.trim());
    state.title = parts[0] || "Unknown";
    state.year = parts[1] || "Unknown";
    state.rating = parts[2] || "N/A";
    state.step = "ask_quality";
    await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
    return sendMsg("2️⃣ Enter <b>Format/Type</b>\n<i>(e.g: WEB-DL, Bluray, HDRip)</i>");
  }

  if (state.step === "ask_quality" && text) {
    state.quality = state.quality_btn || "Unknown";
    state.format = text.trim();

    state.step = "ask_thumbnail";
    await kv.put(`admin_state_${chatId}`, JSON.stringify(state));

    const keyboard = {
      inline_keyboard: [[
        { text: "✅ Yes", callback_data: "thumb_yes" },
        { text: "❌ No", callback_data: "thumb_no" }
      ]]
    };

    return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "🖼 <b>Do you want to add a Thumbnail for the Group Message?</b>", parse_mode: "HTML", reply_markup: keyboard })
    });
  }

  if (state.step === "wait_for_thumbnail" && msg.photo) {
    const thumbId = msg.photo[msg.photo.length - 1].file_id;
    return finalizeSave(chatId, state, env, thumbId);
  }

  if (text && !text.startsWith("/")) {
    if (Object.keys(state).length > 0) {
      return sendMsg("⚠️ <b>You are currently in the middle of an upload.</b>\nType /cancel to abort if you want to search movies.");
    }

    const results = await searchMovieInKV(text, env.BLACK_BULL_CINEMA);
    if (results && results.length > 0) {
      const userFirstName = msg.chat.first_name || "Admin";
      return sendSearchResults([env.BOT_TOKEN_1], chatId, msg.from?.id || chatId, msg.message_id, text, results, "all", env, null, userFirstName);
    } else {
      return sendMsg(`❌ <b>'${text}' Not found in KV database.</b>\n\n👋 <b>Admin Uploader Panel:</b>\nForward any file to start uploading.`);
    }
  }
}

// Helper to safely answer callbacks for multiple bots
async function answerCallbackSafe(bots, callbackId, text = null, showAlert = false) {
  const body = { callback_query_id: callbackId };
  if (text) { body.text = text; body.show_alert = showAlert; }
  await Promise.all(bots.map(token =>
    fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(() => { })
  ));
}

// ══════════════════════════════════════════════
// THUMBNAIL & FINALIZATION LOGIC
// ══════════════════════════════════════════════

async function handleCallback(cb, env, ctx) {
  try {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    const msgId = cb.message.message_id;

    // Check if the user who clicked is the same as the one who requested (for group chats)
    if (cb.message.chat.type !== "private") {
      const parts = data.split("|");
      if (parts.length >= 3) {
        const requesterId = parts[parts.length - 1];
        if (requesterId !== String(cb.from.id)) {
          const langCode = await getUserLang(cb.from.id, env);
          const T = LANGS[langCode] || LANGS.si;
          await answerCallbackSafe(bots, cb.id, T.wrong_user, true);
        }
      }
    }

    const kv = env.BLACK_BULL_CINEMA;
    let state = {};
    const stateStr = await kv.get(`admin_state_${chatId}`);
    if (stateStr) state = JSON.parse(stateStr);

    const bots = [];
    for (let i = 1; i <= 7; i++) {
      if (env[`BOT_TOKEN_${i}`]) bots.push(env[`BOT_TOKEN_${i}`]);
    }

    const editMsg = async (msgText, keyboard = null) => {
      const body = { chat_id: chatId, message_id: msgId, text: msgText, parse_mode: "HTML" };
      if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
      return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/editMessageText`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    };

    if (state.step === "ask_type") {
      if (data === "type_movie" || data === "type_series") {
        state.is_series = data === "type_series";
        state.step = "ask_quality_btn";
        await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
        
        const qList = ["144p", "240p", "360p", "480p", "720p", "1k", "2k", "4k", "8k"];
        const keyboard = [];
        for (let i = 0; i < qList.length; i += 3) {
          keyboard.push(qList.slice(i, i + 3).map(q => ({ text: q, callback_data: `qbtn_${q}` })));
        }

        await editMsg(`✅ <b>Type selected:</b> ${state.is_series ? '📺 Series' : '🎬 Movie'}\n\n3️⃣ Select the <b>Quality Category</b> for this upload:`, keyboard);
      }
      return;
    }

    if (data.startsWith("qbtn_")) {
      const qSelected = data.split("_")[1];
      state.quality_btn = qSelected;
      state.step = "ask_details";
      await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
      await editMsg(`✅ <b>Quality Category:</b> ${qSelected}\n\n1️⃣ Enter <b>Name, Year, Rating</b>\n<i>(Comma separated. e.g: Avatar, 2009, 7.9)</i>`);
      return;
    }

    if (state.step === "ask_thumbnail") {
      if (data === "thumb_yes") {
        state.step = "wait_for_thumbnail";
        await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
        await editMsg("🖼 <b>Please send the Thumbnail Photo now.</b>\n<i>(Type /cancel to abort)</i>");
      } else if (data === "thumb_no") {
        await editMsg("🚫 <b>No thumbnail selected. Saving...</b>");
        await finalizeSave(chatId, state, env, null);
      }
      return;
    }

    if (data.startsWith("setlang_")) {
      const langCode = data.split("_")[1];
      if (env.BLACK_BULL_CINEMA_LANG) {
        if (langCode === "si") await env.BLACK_BULL_CINEMA_LANG.delete(`lang_${cb.from.id}`);
        else await env.BLACK_BULL_CINEMA_LANG.put(`lang_${cb.from.id}`, langCode);
      }

      let alertMsg = "✅ Language Updated!";
      if (langCode === "si") alertMsg = "✅ ඔබේ භාශාව සිංහල ලෙස වෙනස් විය!";
      else if (langCode === "en") alertMsg = "✅ Your language was changed to English!";
      else if (langCode === "hi") alertMsg = "✅ आपकी भाषा बदल दी गई है!";
      else if (langCode === "es") alertMsg = "✅ ¡Tu idioma ha sido cambiado!";
      else if (langCode === "ta") alertMsg = "✅ உங்கள் மொழி மாற்றப்பட்டுள்ளது!";

      await answerCallbackSafe(bots, cb.id, alertMsg, true);

      for (const token of bots) {
        const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: msgId })
        });
        if ((await res.json()).ok) break;
      }
      return;
    }

    if (data === "lang_menu") {
      const kb = {
        inline_keyboard: [
          [{ text: "🇱🇰 Sinhala (Default)", callback_data: "setlang_si" }],
          [{ text: "🇬🇧 English", callback_data: "setlang_en" }, { text: "🇮🇳 Hindi", callback_data: "setlang_hi" }],
          [{ text: "🇪🇸 Spanish", callback_data: "setlang_es" }, { text: "🇮🇳 Tamil", callback_data: "setlang_ta" }]
        ]
      };

      for (const token of bots) {
        const res = await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: msgId, caption: "🌐 <b>Select your preferred language:</b>", parse_mode: "HTML", reply_markup: kb })
        });
        if ((await res.json()).ok) break;
      }

      const autoDelete = async () => {
        await new Promise(r => setTimeout(r, 25000)); // Increased to 25s as requested
        for (const token of bots) {
          const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId })
          });
          if ((await res.json()).ok) break;
        }
      };
      if (typeof ctx !== "undefined" && ctx.waitUntil) ctx.waitUntil(autoDelete());
      return;
    }

    if (data.startsWith("view_")) {
      await answerCallbackSafe(bots, cb.id);

      const payloadStr = data.substring(5);
      const splitIndex = payloadStr.indexOf("|");
      let movieId = payloadStr;
      let originalQuery = "";
      if (splitIndex !== -1) {
        movieId = payloadStr.substring(0, splitIndex);
        originalQuery = payloadStr.substring(splitIndex + 1);
      }

      let searchKey = null;
      if (env.BLACK_BULL_CINEMA_FILEID) searchKey = await env.BLACK_BULL_CINEMA_FILEID.get(`idx_${movieId}`);
      if (!searchKey) searchKey = await kv.get(`idx_${movieId}`);

      if (searchKey) {
        const existingStr = await kv.get(searchKey);
        if (existingStr) {
          const movie = JSON.parse(existingStr);
          const langCode = await getUserLang(cb.from.id, env);
          const T = LANGS[langCode] || LANGS.si;

          const availableCats = [...new Set(movie.qualities.map(q => q.cat || "Other"))].sort();
          const keyboard = [];
          for (const cat of availableCats) {
            keyboard.push([{ text: `${cat} ⚡`, callback_data: `qview_${movieId}|${cat}|${originalQuery}|${cb.from.id}` }]);
          }
          keyboard.push([{ text: "❤️ Add to Watchlist", callback_data: `watch_add_${movieId}|${cb.from.id}` }]);
          keyboard.push([{ text: "🔙 Back to List", callback_data: `search_${originalQuery}|${cb.from.id}` }]);

          const detailText = `🎬 <b>${movie.title} (${movie.year})</b>\n\n⭐️ <b>Rating:</b> ${movie.rating}/10\n🎭 <b>Type:</b> ${movie.is_series ? 'Series' : 'Movie'}\n\nහරි, දැන් ඔයා කැමතිම කොලිටි එක තෝරගන්නෝ... 😉👇`;
          const randomImg = "https://i.ibb.co/1J98HrbR/ipl2026schedule-1773243338.webp";
          const thumb = movie.thumb || randomImg;

          for (const token of bots) {
            const payload = {
              chat_id: chatId,
              message_id: msgId,
              media: { type: "photo", media: thumb, caption: detailText, parse_mode: "HTML" },
              reply_markup: { inline_keyboard: keyboard }
            };
            const res = await fetch(`https://api.telegram.org/bot${token}/editMessageMedia`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            if ((await res.json()).ok) break;
          }
        }
      }
      return;
    }

    if (data.startsWith("qview_")) {
      await answerCallbackSafe(bots, cb.id);
      const [movieId, cat, originalQuery] = data.substring(6).split("|");

      let searchKey = null;
      if (env.BLACK_BULL_CINEMA_FILEID) searchKey = await env.BLACK_BULL_CINEMA_FILEID.get(`idx_${movieId}`);
      if (!searchKey) searchKey = await kv.get(`idx_${movieId}`);

      if (searchKey) {
        const dataStr = await kv.get(searchKey);
        const movie = JSON.parse(dataStr);
        const filteredQualities = movie.qualities.filter(q => (q.cat || "Other") === cat);
        
        const detailText = `🎬 <b>${movie.title} (${movie.year})</b>\nQuality: <b>${cat}</b>\n\nමෙන්න ඔයා ඉල්ලපු ලින්ක් එක. පහළ බටන් එක ඔබලා ඩවුන්ලෝඩ් කරගන්න. 📥👇`;

        for (const token of bots) {
          const botUser = await getBotUsername(token);
          const keyboard = [];
          for (const q of filteredQualities) {
            let sizeText = "";
            if (!movie.is_series && q.size) {
              sizeText = ` - ${formatSize(q.size)}`;
            }
            keyboard.push([{ text: `📥 Download (${q.name})${sizeText}`, url: `https://idsmovieplanet.ishangadineth.online/?id=${q.q}&bot=${botUser}` }]);
          }
          keyboard.push([{ text: "🔙 Back to Qualities", callback_data: `view_${movieId}|${originalQuery}|${cb.from.id}` }]);

          const res = await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, caption: detailText, parse_mode: "HTML", reply_markup: { inline_keyboard: keyboard } })
          });
          if ((await res.json()).ok) break;
        }
      }
      return;
    }

    if (data.startsWith("search_")) {
      await answerCallbackSafe(bots, cb.id);
      const parts = data.substring(7).split("|");
      const query = parts[0];
      
      if (query === "watch") {
        await fetch(`https://api.telegram.org/bot${bots[0]}/deleteMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: msgId })
        }).catch(() => {});
        return;
      }

      const results = await searchMovieInKV(query, kv);
      if (results && results.length > 0) {
        const userFirstName = cb.message.chat.first_name || "User";
        await sendSearchResults(bots, chatId, cb.from.id, cb.message.reply_to_message?.message_id || msgId, query, results, "all", env, msgId, userFirstName);
      }
      return;
    }

    if (data.startsWith("filter_")) {
      await answerCallbackSafe(bots, cb.id);
      const parts = data.split("_");
      const fType = parts[1];
      const queryPart = parts.slice(2).join("_").split("|")[0];
      const results = await searchMovieInKV(queryPart, kv);
      if (results && results.length > 0) {
        const userFirstName = cb.message.chat.first_name || "User";
        await sendSearchResults(bots, chatId, cb.from.id, cb.message.reply_to_message?.message_id || msgId, queryPart, results, fType, env, msgId, userFirstName);
      }
      return;
    }

    if (data.startsWith("watch_add_")) {
      const parts = data.substring(10).split("|");
      const movieId = parts[0];
      const requesterId = parts[1];
      
      if (cb.from.id.toString() !== requesterId) {
        const langCode = await getUserLang(cb.from.id, env);
        const T = LANGS[langCode] || LANGS.si;
        await answerCallbackSafe(bots, cb.id, T.wrong_user, true);
        return;
      }
      
      let watchlistStr = await kv.get(`watch_${cb.from.id}`);
      let watchlist = watchlistStr ? JSON.parse(watchlistStr) : [];
      if (!watchlist.includes(movieId)) {
          watchlist.push(movieId);
          await kv.put(`watch_${cb.from.id}`, JSON.stringify(watchlist));
          await answerCallbackSafe(bots, cb.id, "✅ Added to your Watchlist!", true);
      } else {
          await answerCallbackSafe(bots, cb.id, "⚠️ Already in your Watchlist!", true);
      }
      return;
    }

    if (data.startsWith("check_sub_")) {
      const payload = data.substring(10);
      const isSubbed = await checkForceSub(env.BOT_TOKEN_1, cb.from.id);

      if (isSubbed) {
        for (const token of bots) {
          const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: cb.message.message_id })
          });
          if ((await res.json()).ok) break;
        }
        await handleStartCommand(chatId, payload, env, bots);
      } else {
        await answerCallbackSafe(bots, cb.id, "❌ You must join both channels first!", true);
      }
      return;
    }

    if (data.startsWith("search_")) {
      await answerCallbackSafe(bots, cb.id);
      const query = data.substring(7);
      const results = await searchMovieInKV(query, kv);
      if (results && results.length > 0) {
        const userFirstName = cb.message.chat.first_name || "User";
        await sendSearchResults(bots, chatId, cb.from.id, cb.message.reply_to_message?.message_id || msgId, query, results, "all", env, msgId, userFirstName);
      }
      return;
    }

    if (data.startsWith("req_")) {
      const query = data.substring(4);
      const reqText = `සොරි අනේ, 🥺 මේක නම් මගේ ඩේටාබේස් එකේ හොයාගන්න නෑ.\nසමහරවිට නමේ පොඩි අකුරක් එහෙ මෙහෙ වෙලාද දන්නෑ. 🤔\nපුළුවන්නම් ආයෙත් සැරයක් නම හරිද කියලා බලන්නකෝ 🙏\n\nනම හරියටම මතක නැත්නම්, මතක විදිහට Google එකේ සර්ච් කරලා බලන්න. 🕵️ ගොඩක් දුරට හරි නම එතනින් හොයාගන්න පුළුවන් ✨\n\nඇඩ්මින්ලට request එකක් යවන්න ඕනෙද? 😉 හරිම ලේසියි.! මෙන්න මෙහෙම කරන්න 👇\n\n👉 මුලින්ම පහළ තියෙන බටන් එක ඔබලා, ඔයාට ඕනේ Movie එකක්ද Series එකක්ද කියලා තෝරන්න. 🎬\n👉 ඊට පස්සේ එන bot ගේ 'Start' බටන් එකත් ඔබන්න. එච්චරයි.! 😉`;
      const kb = { 
        inline_keyboard: [
          [{ text: "💝 Send Request 💝", callback_data: `reqask_${query}` }],
          [{ text: "🔙 Back", callback_data: `search_${query}` }]
        ] 
      };

      await answerCallbackSafe(bots, cb.id);

      const isPhoto = !!(cb.message.photo || cb.message.video || cb.message.document);

      for (const token of bots) {
        let apiUrl = `https://api.telegram.org/bot${token}/editMessageText`;
        let payload = { chat_id: chatId, message_id: msgId, text: reqText, parse_mode: "HTML", reply_markup: kb };
        
        if (isPhoto) {
          apiUrl = `https://api.telegram.org/bot${token}/editMessageCaption`;
          payload = { chat_id: chatId, message_id: msgId, caption: reqText, parse_mode: "HTML", reply_markup: kb };
        }

        const res = await fetch(apiUrl, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const resData = await res.json();
        if (resData.ok) {
          if (ctx) {
            ctx.waitUntil((async () => {
              await new Promise(r => setTimeout(r, 20000)); // 20 seconds
              await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, message_id: msgId })
              }).catch(() => {});
            })());
          }
          break;
        }
      }
      return;
    }

    if (data.startsWith("reqask_")) {
      const query = data.substring(7);
      const askText = `හරි දැන් ඔයා ඕනි ෆිල්ම් එකක්ද ටීවී සිරීස් එකක්ද කියලා තෝරන්නකෝ.. 🤔`;
      const reqBotUser = env.REQ_BOT_USERNAME || "BLACKBULL_MODERATOR_BOT";

      const safeParam = query.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);

      const kb = {
        inline_keyboard: [[
          { text: "🎬 ෆිල්ම් එකක්", url: `https://t.me/${reqBotUser}?start=m_${safeParam}` },
          { text: "📺 සිරීස් එකක්", url: `https://t.me/${reqBotUser}?start=s_${safeParam}` }
        ]]
      };

      await answerCallbackSafe(bots, cb.id);
      const isPhoto = !!(cb.message.photo || cb.message.video || cb.message.document);

      for (const token of bots) {
        let apiUrl = `https://api.telegram.org/bot${token}/editMessageText`;
        let payload = { chat_id: chatId, message_id: msgId, text: askText, parse_mode: "HTML", reply_markup: kb };
        
        if (isPhoto) {
          apiUrl = `https://api.telegram.org/bot${token}/editMessageCaption`;
          payload = { chat_id: chatId, message_id: msgId, caption: askText, parse_mode: "HTML", reply_markup: kb };
        }

        const res = await fetch(apiUrl, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const resData = await res.json();
        if (resData.ok) {
          if (ctx) {
            ctx.waitUntil((async () => {
              await new Promise(r => setTimeout(r, 20000));
              await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, message_id: msgId })
              }).catch(() => {});
            })());
          }
          break;
        }
      }
      return;
    }
  } catch (err) {
    console.error("Callback Error:", err.message, err.stack);
  }
}

async function finalizeSave(chatId, state, env, thumbId) {
  const kv = env.BLACK_BULL_CINEMA;
  const searchKey = state.title.toLowerCase().trim();
  const safeTitle = searchKey.replace(/\s+/g, '_');

  const newQ = `${state.quality.toLowerCase()}_${state.format.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const gatewayId = `${safeTitle}_${newQ}`;

  const movieId = Date.now().toString(36);

  let movieData = {
    id: movieId,
    title: state.title,
    year: state.year,
    rating: state.rating,
    is_series: state.is_series || false,
    qualities: []
  };
  const existingStr = await kv.get(searchKey);
  if (existingStr) {
    try {
      const parsed = JSON.parse(existingStr);
      movieData = parsed;
      if (!movieData.id) movieData.id = movieId;
      if (movieData.is_series === undefined) movieData.is_series = state.is_series || false;
    } catch (e) { }
  }

  if (thumbId) {
    movieData.thumb = thumbId;
  }

  let exists = movieData.qualities.some(q => q.q === gatewayId);
  if (!exists) {
    const firstFileType = (state.files && state.files.length > 0) ? state.files[0].type : "video";
    const firstFileId = (state.files && state.files.length > 0) ? state.files[0].id : "grouped_files";
    const firstFileSize = (state.files && state.files.length > 0) ? state.files[0].size : 0;

    movieData.qualities.push({
      id: firstFileId,
      type: firstFileType,
      name: `${state.quality} ${state.format}`.trim(),
      caption: `🎬 ${state.quality} (${state.format})`.trim(),
      q: gatewayId,
      cat: state.quality_btn || "Other",
      size: firstFileSize
    });
  }

  await kv.put(searchKey, JSON.stringify(movieData));
  await kv.delete(`admin_state_${chatId}`);

  if (env.BLACK_BULL_CINEMA_FILEID) {
    await env.BLACK_BULL_CINEMA_FILEID.put(`idx_${movieData.id}`, searchKey);
    const filesToSave = state.files.map(f => ({
      id: f.id,
      type: f.type,
      caption: ""
    }));
    await env.BLACK_BULL_CINEMA_FILEID.put(gatewayId, JSON.stringify(filesToSave));
  } else {
    await kv.put(`idx_${movieData.id}`, searchKey);
  }

  const sendMsg = async (msgText) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: "HTML" })
  });

  return sendMsg(`✅ <b>Successfully Saved to KV!</b>\n\n📌 <b>Key:</b> <code>${searchKey}</code>\n🎬 <b>Type:</b> ${movieData.is_series ? 'Series' : 'Movie'}\n🎬 <b>Total Qualities:</b> ${movieData.qualities.length}\n📦 <b>Grouped Files:</b> ${state.files.length}\n🖼 <b>Thumbnail:</b> ${thumbId ? "Yes" : "No"}\n🔗 <b>Gateway ID:</b> <code>${gatewayId}</code>\n\n<i>Forward another video to add more qualities or a new movie.</i>`);
}

// ══════════════════════════════════════════════
// DEEP LINKING LOGIC (SENDING FILE TO USER)
// ══════════════════════════════════════════════

async function handleStartCommand(chatId, payload, env, bots) {
  const isSubbed = await checkForceSub(bots[0], chatId);
  if (!isSubbed) {
    return sendForceSubMessage(bots[0], chatId, chatId, payload, env);
  }

  if (!env.BLACK_BULL_CINEMA_FILEID) {
    const tgApiUrl = `https://api.telegram.org/bot${bots[0]}/sendMessage`;
    await fetch(tgApiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "❌ <b>Database Error:</b> File database not connected.", parse_mode: "HTML" }) });
    return;
  }

  const fileKey = payload;
  const fileDataStr = await env.BLACK_BULL_CINEMA_FILEID.get(fileKey);

  if (!fileDataStr) {
    const tgApiUrl = `https://api.telegram.org/bot${bots[0]}/sendMessage`;
    await fetch(tgApiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "❌ <b>File not found or expired.</b>", parse_mode: "HTML" }) });
    return;
  }

  const fileArray = JSON.parse(fileDataStr);
  const filesToProcess = Array.isArray(fileArray) ? fileArray : [fileArray];

  for (const file of filesToProcess) {
    let method = "sendDocument";
    let requestPayload = { chat_id: chatId, caption: file.caption || "", parse_mode: "HTML" };

    if (file.type === "channel_msg" || !isNaN(file.id)) {
      method = "copyMessage";
      requestPayload = {
        chat_id: chatId,
        from_chat_id: "-1003759058179",
        message_id: parseInt(file.id),
        caption: file.caption || "",
        parse_mode: "HTML"
      };
    } else {
      const typeToMethod = {
        "video": "sendVideo",
        "document": "sendDocument",
        "audio": "sendAudio",
        "photo": "sendPhoto",
        "file": "sendDocument"
      };
      method = typeToMethod[file.type] || "sendDocument";
      requestPayload[file.type === "file" ? "document" : file.type] = file.id || file.file_id;
    }

    const tgApiUrl = `https://api.telegram.org/bot${bots[0]}/${method}`;
    await fetch(tgApiUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload)
    });
  }
}

// ══════════════════════════════════════════════
// SEARCH & UI LOGIC
// ══════════════════════════════════════════════

const LANGS = {
  si: {
    hello: "👋 හෙලෝ {name},\n\nබලන්න ඔයා හොයන '<b>{query}</b>' මෙතන තියනවද කියලා.. 👇\n\n📌 <i>ඔයා හොයන්නේ සීරීස් එකක් නම් 'Series' කියන බට්න් එක ඔබලා ඔයාට ඕනි සීරීස් එක තෝරන්න.</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ ඔයා හොයන '<b>{query}</b>' අපේ පද්ධතියේ නෑ.\n\nපහළ බට්න් එක ඔබලා Admin ට Request එකක් දාන්න. 👇",
    not_found_cat: "🚫 No results found for this category.",
    not_here: "මේ list එකේ නෑනේ🥲",
    change_lang: "🌐 Change Language",
    req_sent: "✅ ඔයාගේ Request එක Admin ට යැව්වා. ඉක්මනින්ම එකතු කරන්නම්!",
    req_btn: "මේ list එකේ නෑනේ🥲 (Request Movie)",
    force_sub: "❌ <b>ඔයා අපේ Main Channels දෙකටම Join වෙලා නෑ!</b>\n\nපහළ තියෙන Channels දෙකටම Join වෙලා ඇවිත් ආපහු '✅ I have Joined' කියන එක ඔබන්න.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ආයුබෝවන්! සාදරයෙන් පිළිගන්න.\nඔයාට අවශ්‍ය මූවීස් සහ සීරීස් පහසුවෙන් ලබා ගැනීමට අපගේ චැනල් එකේ ඇති ලින්ක් එකක් ක්ලික් කර මෙතැනට පැමිණෙන්න.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group",
    wrong_user: "මේ ඔයා ඉල්ලපු එක නෙවේ🧐"
  },
  en: {
    hello: "👋 Hello {name},\n\nCheck if the movie '<b>{query}</b>' you are looking for is here.. 👇\n\n📌 <i>If you are looking for a series, tap the 'Series' button to filter.</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ The movie '<b>{query}</b>' is not in our system.\n\nTap the button below to request it from the Admin. 👇",
    not_found_cat: "🚫 No results found for this category.",
    not_here: "😮 Not Here",
    change_lang: "🌐 Change Language",
    req_sent: "✅ Your request has been sent to the Admin! We will add it soon.",
    req_btn: "😮 Request Movie",
    force_sub: "❌ <b>You haven't joined our Main Channels!</b>\n\nPlease join the 2 channels below and click '✅ I have Joined'.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 Hello! Welcome.\nTo easily get your desired movies and series, click a link in our channel to come here.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group",
    wrong_user: "That wasn't requested by you! 🧐"
  },
  hi: {
    hello: "👋 नमस्ते {name},\n\nजांचें कि आप जिस फिल्म '<b>{query}</b>' की तलाश कर रहे हैं वह यहां है या नहीं.. 👇\n\n📌 <i>यदि आप कोई श्रृंखला ढूंढ रहे हैं, तो 'Series' बटन पर टैप करें।</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ फिल्म '<b>{query}</b>' हमारे सिस्टम में नहीं है।\n\nएडमिन से अनुरोध करने के लिए नीचे दिए गए बटन पर टैप करें। 👇",
    not_found_cat: "🚫 इस श्रेणी के लिए कोई परिणाम नहीं मिला।",
    not_here: "😮 यहाँ नहीं है",
    change_lang: "🌐 Change Language",
    req_sent: "✅ आपका अनुरोध एडमिन को भेज दिया गया है! हम इसे जल्द ही जोड़ देंगे।",
    req_btn: "😮 Request Movie",
    force_sub: "❌ <b>आप हमारे मुख्य चैनल में शामिल नहीं हुए हैं!</b>\n\nकृपया नीचे दिए गए 2 चैनलों से जुड़ें और '✅ I have Joined' पर क्लिक करें।",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 नमस्ते! स्वागत है।\nअपनी मनपसंद फिल्में और सीरीज आसानी से पाने के लिए हमारे चैनल में दिए गए लिंक पर क्लिक करके यहां आएं।\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group",
    wrong_user: "यह आपके द्वारा अनुरोधित नहीं किया गया था! 🧐"
  },
  es: {
    hello: "👋 Hola {name},\n\nComprueba si la película '<b>{query}</b>' que buscas está aquí.. 👇\n\n📌 <i>Si buscas una serie, toca el botón 'Series'.</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ La película '<b>{query}</b>' no está en nuestro sistema.\n\nToca el botón de abajo para pedirla al administrador. 👇",
    not_found_cat: "🚫 No se encontraron resultados para esta categoría.",
    not_here: "😮 No está aquí",
    change_lang: "🌐 Change Language",
    req_sent: "✅ ¡Tu solicitud ha sido enviada al Administrador! La agregaremos pronto.",
    req_btn: "😮 Request Movie",
    force_sub: "❌ <b>¡No te has unido a nuestros canales principales!</b>\n\nÚnete a los 2 canales a continuación y haz clic en '✅ I have Joined'.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ¡Hola! Bienvenido.\nPara obtener fácilmente tus películas y series, haz clic en un enlace de nuestro canal para venir aquí.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group",
    wrong_user: "¡Eso no fue solicitado por ti! 🧐"
  },
  ta: {
    hello: "👋 வணக்கம் {name},\n\nநீங்கள் தேடும் '<b>{query}</b>' திரைப்படம் இங்கே உள்ளதா என்று பார்க்கவும்.. 👇\n\n📌 <i>நீங்கள் ஒரு தொடரை தேடுகிறீர்கள் என்றால், 'Series' பொத்தானை அழுத்தவும்.</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ '<b>{query}</b>' திரைப்படம் எங்கள் கணினியில் இல்லை.\n\nநிவாகியிடம் கோர கீழேயுள்ள பொத்தானை அழுத்தவும். 👇",
    not_found_cat: "🚫 இந்த வகைக்கு முடிவுகள் எதுவும் கிடைக்கவில்லை.",
    not_here: "😮 இங்கே இல்லை",
    change_lang: "🌐 Change Language",
    req_sent: "✅ உங்கள் கோரிக்கை நிர்வாகிக்கு அனுப்பப்பட்டது! விரைவில் சேர்ப்போம்.",
    req_btn: "😮 Request Movie",
    force_sub: "❌ <b>எங்கள் முக்கிய சேனல்களில் நீங்கள் சேரவில்லை!</b>\n\nகீழே உள்ள 2 சேனல்களில் சேர்ந்து '✅ I have Joined' என்பதைக் கிளிக் செய்யவும்.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 வணக்கம்! வரவேற்கிறோம்.\nஉங்களுக்குத் தேவையான திரைப்படங்கள் மற்றும் தொடர்களை எளிதாகப் பெற, எங்கள் சேனலில் உள்ள இணைப்பைக் கிளிக் செய்து இங்கே வரவும்.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group",
    wrong_user: "இது உங்களால் கோரப்படவில்லை! 🧐"
  }
};

async function getUserLang(userId, env) {
  if (env.BLACK_BULL_CINEMA_LANG) {
    const lang = await env.BLACK_BULL_CINEMA_LANG.get(`lang_${userId}`);
    if (lang && LANGS[lang]) return lang;
  }
  return "si";
}

async function getChannelLink(botToken, channelId, kv) {
  let link = null;
  if (kv) link = await kv.get(`invite_${channelId}`);
  if (link) return link;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/exportChatInviteLink?chat_id=${channelId}`);
    const data = await res.json();
    if (data.ok && data.result) {
      if (kv) await kv.put(`invite_${channelId}`, data.result);
      return data.result;
    }
  } catch (e) { }
  return "https://t.me/";
}

async function checkForceSub(botToken, userId) {
  const channels = ["-1003947907936", "-1003999803362"];
  for (const channelId of channels) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${channelId}&user_id=${userId}`);
      const data = await res.json();
      if (!data.ok || ["left", "kicked"].includes(data.result.status)) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }
  return true;
}

async function sendForceSubMessage(botToken, chatId, userId, payloadStr, env) {
  const langCode = await getUserLang(userId, env);
  const T = LANGS[langCode] || LANGS.si;

  const link1 = "https://t.me/BLACKBULLCINEMAUPDATES";
  const link2 = "https://t.me/BLACKBULLCINEMA";

  const kb = {
    inline_keyboard: [
      [{ text: "📢 Channel 01", url: link1 }, { text: "📢 Channel 02", url: link2 }],
      [{ text: T.joined_btn, callback_data: `check_sub_${payloadStr}` }]
    ]
  };

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: T.force_sub, parse_mode: "HTML", reply_markup: kb })
  });
}

async function sendWelcomeMessage(botToken, chatId, userId, env) {
  const langCode = await getUserLang(userId, env);
  const T = LANGS[langCode] || LANGS.si;

  const chLink = await getChannelLink(botToken, "-1003999803362", env.BLACK_BULL_CINEMA_LANG);
  const gpLink = await getChannelLink(botToken, "-1003838706115", env.BLACK_BULL_CINEMA_LANG);

  const kb = {
    inline_keyboard: [
      [{ text: T.ch_btn, url: chLink }],
      [{ text: T.gp_btn, url: gpLink }]
    ]
  };

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: T.welcome_msg, parse_mode: "HTML", reply_markup: kb })
  });
}

// Memory Cache implemented for Bot Username fetching
function formatSize(bytes) {
  if (!bytes || bytes === 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)}${units[unitIndex]}`;
}

async function getBotUsername(token) {
  if (botUsernamesCache[token]) return botUsernamesCache[token];
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      botUsernamesCache[token] = data.result.username;
      return data.result.username;
    }
  } catch (e) {
    console.error("Error fetching bot username:", e);
  }
  return "UnknownBot";
}

async function searchMovieInKV(query, kv) {
  if (query.length < 2) return [];
  if (!kv) return [];

  const searchKey = query.toLowerCase();
  const list = await kv.list({ prefix: searchKey });
  const results = [];

  for (const keyObj of list.keys) {
    if (keyObj.name.startsWith("admin_") || keyObj.name.startsWith("config_") || keyObj.name.startsWith("idx_")) continue;
    const dataString = await kv.get(keyObj.name);
    if (dataString) {
      try {
        const parsed = JSON.parse(dataString);
        parsed._key = keyObj.name;
        results.push(parsed);
      } catch (e) { }
    }
  }
  return results;
}

// Updated to use the Multi-Bot Retry Loop for Editing Media!
async function sendSearchResults(bots, chatId, userId, replyToMsgId, query, results, filterType, env, editMsgId = null, firstName = "User") {
  const langCode = await getUserLang(userId, env);
  const T = LANGS[langCode] || LANGS.si;
  const botList = Array.isArray(bots) ? bots : [bots];

  let filtered = results;
  if (filterType === "movies") filtered = results.filter(r => !r.is_series);
  if (filterType === "series") filtered = results.filter(r => r.is_series);

  const defaultImages = [
    "https://i.ibb.co/1J98HrbR/ipl2026schedule-1773243338.webp",
    "https://i.ibb.co/1J98HrbR/ipl2026schedule-1773243338.webp",
    "https://i.ibb.co/1J98HrbR/ipl2026schedule-1773243338.webp"
  ];
  const randomImg = defaultImages[Math.floor(Math.random() * defaultImages.length)];
  let text = T.hello.replace("{name}", firstName).replace("{query}", query);

  const keyboard = [];
  keyboard.push([
    { text: filterType === "movies" ? `✅ ${T.movies}` : T.movies, callback_data: `filter_movies_${query}|${userId}` },
    { text: filterType === "series" ? `✅ ${T.series}` : T.series, callback_data: `filter_series_${query}|${userId}` }
  ]);

  for (const r of filtered) {
    const safeQuery = query.substring(0, 20);
    const mId = r.id ? r.id : r._key.substring(0, 20);
    const icon = r.is_series ? "📺" : "🎬";
    keyboard.push([{ text: `${icon} ${r.title} (${r.year})`, callback_data: `view_${mId}|${safeQuery}|${userId}` }]);
  }

  if (filtered.length === 0) {
    keyboard.push([{ text: T.not_found_cat, callback_data: "none" }]);
  }

  keyboard.push([{ text: T.not_here, callback_data: `req_${query.substring(0, 40)}|${userId}` }]);
  keyboard.push([{ text: T.change_lang, callback_data: `lang_menu|${userId}` }]);

  const payload = {
    chat_id: chatId,
    reply_markup: { inline_keyboard: keyboard }
  };

  for (const botToken of botList) {
    let tgApiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    if (editMsgId) {
      tgApiUrl = `https://api.telegram.org/bot${botToken}/editMessageMedia`;
      payload.message_id = editMsgId;
      payload.media = { type: "photo", media: randomImg, caption: text, parse_mode: "HTML" };
    } else {
      payload.photo = randomImg;
      payload.caption = text;
      payload.parse_mode = "HTML";
      if (replyToMsgId) payload.reply_to_message_id = replyToMsgId;
    }

    try {
      const res = await fetch(tgApiUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      // If success or "message is not modified" (preventing 400 error on duplicate clicks)
      if (data.ok || (data.description && data.description.includes("modified"))) {
        return;
      }
    } catch (e) {
      console.error("sendSearchResults API Error:", e);
    }
  }
}

async function sendMovieReplyWithRetry(bots, startIndex, chatId, replyToMsgId, movieData, env, editMsgId = null, originalQuery = null) {
  const text = `🎬 <b>${movieData.is_series ? 'Series' : 'Movie'} Found!</b>\n\n` +
    `📌 <b>Title:</b> ${movieData.title}\n` +
    `📅 <b>Year:</b> ${movieData.year}\n` +
    `⭐ <b>Rating:</b> ${movieData.rating}\n\n` +
    `<i>Select quality to download below:</i>`;

  let baseUrl = "https://idsmovieplanet.ishangadineth.online";
  if (env && env.BLACK_BULL_CINEMA) {
    const customUrl = await env.BLACK_BULL_CINEMA.get("config_gateway_url");
    if (customUrl) baseUrl = customUrl;
  }
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

  for (let offset = 0; offset < bots.length; offset++) {
    const currentIndex = (startIndex + offset) % bots.length;
    const botToken = bots[currentIndex];

    const botUser = await getBotUsername(botToken);
    if (botUser === "UnknownBot") continue;

    const keyboard = [];
    if (movieData.qualities && Array.isArray(movieData.qualities)) {
      for (let i = 0; i < movieData.qualities.length; i += 2) {
        const row = [];
        const q1 = movieData.qualities[i];
        row.push({ text: `📥 ${q1.name}`, url: `${baseUrl}/?id=${q1.q}&bot=${botUser}` });
        if (i + 1 < movieData.qualities.length) {
          const q2 = movieData.qualities[i + 1];
          row.push({ text: `📥 ${q2.name}`, url: `${baseUrl}/?id=${q2.q}&bot=${botUser}` });
        }
        keyboard.push(row);
      }
    } else {
      keyboard.push([{ text: "📥 Click Here to Download", url: `${baseUrl}/?bot=${botUser}` }]);
    }

    if (originalQuery) {
      keyboard.push([{ text: "⬅️ Back to Search", callback_data: `search_${originalQuery}` }]);
    }

    const defaultImages = [
      "https://i.ibb.co/1J98HrbR/ipl2026schedule-1773243338.webp",
      "https://i.ibb.co/1J98HrbR/ipl2026schedule-1773243338.webp",
      "https://i.ibb.co/1J98HrbR/ipl2026schedule-1773243338.webp"
    ];
    const randomImg = defaultImages[Math.floor(Math.random() * defaultImages.length)];
    const movieThumb = movieData.thumb || randomImg;

    const payload = {
      chat_id: chatId,
      reply_markup: { inline_keyboard: keyboard }
    };

    let tgApiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    if (editMsgId) {
      tgApiUrl = `https://api.telegram.org/bot${botToken}/editMessageMedia`;
      payload.message_id = editMsgId;
      payload.media = { type: "photo", media: movieThumb, caption: text, parse_mode: "HTML" };
    } else {
      payload.photo = movieThumb;
      payload.caption = text;
      payload.parse_mode = "HTML";
      if (replyToMsgId) payload.reply_to_message_id = replyToMsgId;
    }

    try {
      const res = await fetch(tgApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.ok || (data.description && data.description.includes("modified"))) {
        break;
      }
    } catch (e) {
      console.error(`Fetch error for Bot ${currentIndex + 1}:`, e);
    }
  }
}

// ══════════════════════════════════════════════
// ANALYTICS & STATS LOGGING
// ══════════════════════════════════════════════
async function logSearchStats(kv, query, found) {
  if (!kv) return;
  try {
    // 1. Total Searches
    let total = await kv.get("stats_total_searches");
    total = total ? parseInt(total) + 1 : 1;
    await kv.put("stats_total_searches", total.toString());

    // 2. Daily Chart Data
    const dateStr = new Date().toISOString().split('T')[0];
    const chartKey = `stats_chart_${dateStr}`;
    let daily = await kv.get(chartKey);
    daily = daily ? parseInt(daily) + 1 : 1;
    await kv.put(chartKey, daily.toString());

    // 3. Missing Searches
    if (!found && query) {
      const qLower = query.toLowerCase().trim().substring(0, 30);
      let missingStr = await kv.get("stats_missing_searches");
      let missing = missingStr ? JSON.parse(missingStr) : {};
      
      missing[qLower] = (missing[qLower] || 0) + 1;
      
      // Keep only top 50 to avoid KV size limit
      const entries = Object.entries(missing).sort((a,b) => b[1] - a[1]);
      if (entries.length > 50) {
        missing = Object.fromEntries(entries.slice(0, 50));
      }
      
      await kv.put("stats_missing_searches", JSON.stringify(missing));
    }
  } catch (e) {
    console.error("Stats log error:", e);
  }
}