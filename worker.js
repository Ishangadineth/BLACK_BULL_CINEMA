/**
 * v 0.0.1 - BLACK BULL Cinema Manager Bot
 * High-Performance Telegram Group Manager & Movie Search Bot
 * using Cloudflare Workers
 */

export default {
  async fetch(request, env, ctx) {
    // Only accept POST requests from Telegram Webhooks
    if (request.method !== "POST") return new Response("Black Bull Cinema Manager Active ✅");

    try {
      const payload = await request.json();

      // Ensure it's a message and contains text
      if (payload.message && payload.message.text) {
        // Process message in the background
        ctx.waitUntil(handleMessage(payload.message, env));
      }

      // Immediately return 200 OK to Telegram
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

async function handleMessage(msg, env) {
  const text = msg.text ? msg.text.trim() : "";
  const chatId = msg.chat.id;
  const msgId = msg.message_id;

  // 1. ADMIN UPLOADER LOGIC (Private Chat)
  if (msg.chat.type === "private") {
    // Admin Lock: Only respond if ADMIN_ID variable is set and matches
    if (!env.ADMIN_ID || chatId.toString() !== env.ADMIN_ID) {
      const tgApiUrl = `https://api.telegram.org/bot${env.BOT_TOKEN_1}/sendMessage`;
      await fetch(tgApiUrl, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: `❌ <b>You can't access this!</b>\nYour Telegram ID is: <code>${chatId}</code>\n\n<i>Please add this ID to the ADMIN_ID variable in Cloudflare.</i>`, 
          parse_mode: "HTML" 
        })
      });
      return;
    }
    return handleAdminLogic(msg, env);
  }

  // 2. GROUP MANAGER LOGIC
  // Ignore commands starting with "/"
  if (text.startsWith("/")) return;

  // Array of 7 Bots (Tokens only) from Environment Variables
  const bots = [
    env.BOT_TOKEN_1,
    env.BOT_TOKEN_2,
    env.BOT_TOKEN_3,
    env.BOT_TOKEN_4,
    env.BOT_TOKEN_5,
    env.BOT_TOKEN_6,
    env.BOT_TOKEN_7
  ].filter(Boolean); // Only filter out missing tokens

  if (bots.length === 0) {
    console.error("No valid bots available! Please check variables.");
    return;
  }

  // Round-Robin Logic using modulo operator
  const botIndex = msgId % bots.length;
  const selectedToken = bots[botIndex];

  // Search for the movie in BLACK_BULL_CINEMA KV Storage
  const movieData = await searchMovieInKV(text, env.BLACK_BULL_CINEMA);

  // If a movie is found, process the UI logic and reply
  if (movieData) {
    // Dynamically fetch the bot username using the Telegram API
    const botUsername = await getBotUsername(selectedToken);
    await sendMovieReply(selectedToken, botUsername, chatId, msgId, movieData);
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
    method: "POST", headers: {"Content-Type": "application/json"}, 
    body: JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: "HTML" }) 
  });

  // Read current conversational state
  let state = {};
  const stateStr = await kv.get(`admin_state_${chatId}`);
  if (stateStr) state = JSON.parse(stateStr);

  if (text === "/cancel") {
    await kv.delete(`admin_state_${chatId}`);
    return sendMsg("❌ <b>Upload Cancelled.</b> Send a new video to start again.");
  }

  // Step 1: Receive File
  let fileId = null;
  let fileType = "file";
  
  if (msg.video) { fileId = msg.video.file_id; fileType = "video"; }
  else if (msg.document) { fileId = msg.document.file_id; fileType = "document"; }
  else if (msg.audio) { fileId = msg.audio.file_id; fileType = "audio"; }
  else if (msg.photo) { fileId = msg.photo[msg.photo.length - 1].file_id; fileType = "photo"; }

  if (fileId && !state.step) {
    state = { step: "ask_id", fileId: fileId, fileType: fileType };
    await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
    return sendMsg("🎬 <b>File Received!</b>\n\n1️⃣ What is the <b>Movie ID</b> for Gateway? (e.g. <code>Movie_1</code>)\n\n<i>Type /cancel to abort.</i>");
  }

  // Step 2: Ask Title, Year, Rating
  if (state.step === "ask_id" && text) {
    state.movieId = text;
    state.step = "ask_details";
    await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
    return sendMsg("2️⃣ Enter <b>Movie Name, Year, Rating</b>\n<i>(Comma separated. e.g: Avatar, 2009, 7.9)</i>");
  }

  // Step 3: Ask Quality and Format
  if (state.step === "ask_details" && text) {
    const parts = text.split(",").map(s => s.trim());
    state.title = parts[0] || "Unknown";
    state.year = parts[1] || "Unknown";
    state.rating = parts[2] || "N/A";
    state.step = "ask_quality";
    await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
    return sendMsg("3️⃣ Enter <b>Quality, Format</b>\n<i>(Comma separated. e.g: 1080p, WEB-DL)</i>");
  }

  // Step 4: Save to KV
  if (state.step === "ask_quality" && text) {
    const parts = text.split(",").map(s => s.trim());
    const quality = parts[0] || "Unknown";
    const format = parts[1] || "";
    
    const searchKey = state.title.toLowerCase();
    
    // Load existing Movie Data to append quality if it already exists
    let movieData = { id: state.movieId, title: state.title, year: state.year, rating: state.rating, qualities: [] };
    const existingStr = await kv.get(searchKey);
    if (existingStr) {
      try { movieData = JSON.parse(existingStr); } catch(e) {}
    }

    const newQ = `${quality.toLowerCase()}_${format.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    // Add new quality entry
    movieData.qualities.push({
      id: state.fileId, // Saved for Gateway extraction
      type: state.fileType || "video",
      name: `${quality} ${format}`.trim(),
      caption: `🎬 ${quality} (${format})`.trim(),
      q: newQ
    });

    await kv.put(searchKey, JSON.stringify(movieData));
    await kv.delete(`admin_state_${chatId}`);

    return sendMsg(`✅ <b>Successfully Saved to KV!</b>\n\n📌 <b>Key:</b> <code>${searchKey}</code>\n🎬 <b>Total Qualities:</b> ${movieData.qualities.length}\n\n<i>Forward another video to add more qualities or a new movie.</i>`);
  }

  // Fallback for private chat
  if (!text.startsWith("/") && Object.keys(state).length === 0) {
    return sendMsg("👋 <b>Admin Uploader Panel</b>\nForward any file (Video, Document, Audio, Photo) to me to start uploading to KV.");
  }
}

// ══════════════════════════════════════════════
// SEARCH & UI LOGIC
// ══════════════════════════════════════════════

async function getBotUsername(token) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      return data.result.username;
    }
  } catch (e) {
    console.error("Error fetching bot username:", e);
  }
  return "UnknownBot";
}

async function searchMovieInKV(query, kv) {
  if (query.length < 2) return null;
  if (!kv) return null; // In case KV is not bound correctly

  const searchKey = query.toLowerCase();
  const dataString = await kv.get(searchKey);

  if (dataString) {
    try {
      // Expected JSON format: {"id": "12345", "title": "Avatar", "year": "2009", "rating": "7.9"}
      return JSON.parse(dataString);
    } catch (e) {
      console.error("JSON parse error from KV data:", e);
      return null;
    }
  }
  return null;
}

async function sendMovieReply(botToken, botUser, chatId, replyToMsgId, movieData) {
  const tgApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  // Format the UI Message Details
  const text = `🎬 <b>Movie Found!</b>\n\n` +
    `📌 <b>Title:</b> ${movieData.title}\n` +
    `📅 <b>Year:</b> ${movieData.year}\n` +
    `⭐ <b>Rating:</b> ${movieData.rating}\n\n` +
    `<i>Select quality to download below:</i>`;

  const baseUrl = `https://idsmovieplanet.ishangadineth.online/?id=${movieData.id}&bot=${botUser}`;

  // Dynamically generate buttons based on 'qualities' array in KV
  // e.g. qualities: [{ name: "480p WEBRip", q: "480p_web" }, { name: "1080p HW", q: "1080p_hw" }]
  const keyboard = [];

  if (movieData.qualities && Array.isArray(movieData.qualities)) {
    // Add buttons in pairs (2 per row) for a clean UI
    for (let i = 0; i < movieData.qualities.length; i += 2) {
      const row = [];
      const q1 = movieData.qualities[i];
      row.push({ text: `🎬 ${q1.name}`, url: `${baseUrl}&q=${q1.q}` });

      if (i + 1 < movieData.qualities.length) {
        const q2 = movieData.qualities[i + 1];
        row.push({ text: `🎬 ${q2.name}`, url: `${baseUrl}&q=${q2.q}` });
      }
      keyboard.push(row);
    }
  } else {
    // Fallback if no specific qualities are provided
    keyboard.push([{ text: "🎬 Click Here to Download", url: baseUrl }]);
  }

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    reply_to_message_id: replyToMsgId,
    reply_markup: { inline_keyboard: keyboard }
  };

  await fetch(tgApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
