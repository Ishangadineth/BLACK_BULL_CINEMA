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

      if (payload.callback_query) {
        ctx.waitUntil(handleCallback(payload.callback_query, env));
      }
      if (payload.message) {
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

  // Array of bots
  const bots = [
    env.BOT_TOKEN_1, env.BOT_TOKEN_2, env.BOT_TOKEN_3, env.BOT_TOKEN_4,
    env.BOT_TOKEN_5, env.BOT_TOKEN_6, env.BOT_TOKEN_7
  ].filter(Boolean);

  if (bots.length === 0) {
    console.error("No valid bots available!");
    return;
  }

  // 1. PRIVATE CHAT LOGIC
  if (msg.chat.type === "private") {
    // A) DEEP LINKING: User requests a specific file
    if (text.startsWith("/start ")) {
      const payload = text.replace("/start ", "").trim();
      if (payload) return handleStartCommand(chatId, payload, env, bots);
    }

    // B) ADMIN UPLOADER LOGIC
    if (!env.ADMIN_ID || chatId.toString() !== env.ADMIN_ID) {
      if (text.startsWith("/start")) return; // Silently ignore generic /start for non-admins
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
  
  if (text === "/list") {
    const list = await env.BLACK_BULL_CINEMA.list();
    const movieKeys = list.keys.filter(k => !k.name.startsWith("admin_") && !k.name.startsWith("site_") && !k.name.startsWith("verified_"));
    
    if (movieKeys.length === 0) {
       await fetch(`https://api.telegram.org/bot${bots[0]}/sendMessage`, { 
         method: "POST", headers: {"Content-Type": "application/json"}, 
         body: JSON.stringify({ chat_id: chatId, text: "📂 <b>No movies available yet.</b>", parse_mode: "HTML" }) 
       });
       return;
    }

    const listText = `📂 <b>Available Movies List:</b>\n\n` + 
      movieKeys.map((k, i) => `${i+1}. <code>${k.name}</code>`).join("\n") +
      `\n\n<i>Tap a movie name to copy it, then paste it to search!</i>`;

    await fetch(`https://api.telegram.org/bot${bots[0]}/sendMessage`, { 
         method: "POST", headers: {"Content-Type": "application/json"}, 
         body: JSON.stringify({ chat_id: chatId, text: listText, parse_mode: "HTML" }) 
    });
    return;
  }

  // Ignore other commands starting with "/"
  if (text.startsWith("/")) return;

  // Round-Robin Logic using modulo operator
  const botIndex = msgId % bots.length;
  const selectedToken = bots[botIndex];

  // Search for the movie in BLACK_BULL_CINEMA KV Storage
  const movieData = await searchMovieInKV(text, env.BLACK_BULL_CINEMA);

  // If a movie is found, process the UI logic and reply
  if (movieData) {
    await sendMovieReplyWithRetry(bots, botIndex, chatId, msgId, movieData, env);
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
    if (!currentUrl) currentUrl = "https://idsmovieplanet.ishangadineth.online/"; // Default
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

  // Step 1: Receive File(s)
  let fileId = null;
  let fileType = "file";
  
  if (msg.video) { fileId = msg.video.file_id; fileType = "video"; }
  else if (msg.document) { fileId = msg.document.file_id; fileType = "document"; }
  else if (msg.audio) { fileId = msg.audio.file_id; fileType = "audio"; }
  else if (msg.photo) { fileId = msg.photo[msg.photo.length - 1].file_id; fileType = "photo"; }

  if (fileId) {
    if (!state.step || state.step === "accumulate") {
      state.step = "accumulate";
      await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
      
      // COPY TO DATABASE CHANNEL
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

      // Save each file independently to prevent KV race conditions during rapid multi-file forwarding
      await kv.put(`admin_file_${chatId}_${msg.message_id}`, JSON.stringify({ id: channelMsgId, type: "channel_msg" }));
      
      return sendMsg(`✅ <b>File Saved to Database!</b> <i>(Msg ID: ${channelMsgId})</i>\n\n<i>Forward more files to group them together, or type </i>/done<i> when you have sent all files for this set.</i>\n\n<i>Type /cancel to abort.</i>`);
    }
  }

  // Step 2: Finish accumulation
  if (state.step === "accumulate" && text === "/done") {
    const list = await kv.list({ prefix: `admin_file_${chatId}_` });
    if (list.keys.length === 0) {
      return sendMsg("⚠️ No files received yet. Forward files first.");
    }
    
    const files = [];
    for (const keyObj of list.keys) {
      const fileStr = await kv.get(keyObj.name);
      if (fileStr) files.push(JSON.parse(fileStr));
      await kv.delete(keyObj.name); // cleanup
    }
    
    state.step = "ask_type";
    state.files = files;
    await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
    
    const kb = { inline_keyboard: [[ { text: "🎬 Movie", callback_data: "type_movie" }, { text: "📺 Series", callback_data: "type_series" } ]] };
    return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/sendMessage`, { 
      method: "POST", headers: {"Content-Type": "application/json"}, 
      body: JSON.stringify({ chat_id: chatId, text: `📦 <b>${files.length} Files Grouped Successfully!</b>\n\nWhat type of content is this?`, parse_mode: "HTML", reply_markup: kb }) 
    });
  }

  // Step 3: Ask Title, Year, Rating
  if (state.step === "ask_details" && text) {
    const parts = text.split(",").map(s => s.trim());
    state.title = parts[0] || "Unknown";
    state.year = parts[1] || "Unknown";
    state.rating = parts[2] || "N/A";
    state.step = "ask_quality";
    await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
    return sendMsg("2️⃣ Enter <b>Quality, Format</b>\n<i>(Comma separated. e.g: 1080p, WEB)</i>");
  }

  // Step 4: Ask for Thumbnail
  if (state.step === "ask_quality" && text) {
    const parts = text.split(",").map(s => s.trim());
    state.quality = parts[0] || "Unknown";
    state.format = parts[1] || "";
    
    state.step = "ask_thumbnail";
    await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
    
    const keyboard = {
      inline_keyboard: [[
        { text: "✅ Yes", callback_data: "thumb_yes" },
        { text: "❌ No", callback_data: "thumb_no" }
      ]]
    };
    
    return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/sendMessage`, { 
      method: "POST", headers: {"Content-Type": "application/json"}, 
      body: JSON.stringify({ chat_id: chatId, text: "🖼 <b>Do you want to add a Thumbnail for the Group Message?</b>", parse_mode: "HTML", reply_markup: keyboard }) 
    });
  }

  // Step 5: Receive Thumbnail Photo
  if (state.step === "wait_for_thumbnail" && msg.photo) {
    const thumbId = msg.photo[msg.photo.length - 1].file_id;
    return finalizeSave(chatId, state, env, thumbId);
  }

  // Fallback for private chat
  if (!text.startsWith("/") && Object.keys(state).length === 0) {
    return sendMsg("👋 <b>Admin Uploader Panel</b>\nForward any file (Video, Document, Audio, Photo) to me to start uploading to KV. You can forward multiple files to group them into a single quality.");
  }
}

// ══════════════════════════════════════════════
// THUMBNAIL & FINALIZATION LOGIC
// ══════════════════════════════════════════════

async function handleCallback(cb, env) {
  const chatId = cb.message.chat.id;
  const data = cb.data;
  const msgId = cb.message.message_id;

  const kv = env.BLACK_BULL_CINEMA;
  let state = {};
  const stateStr = await kv.get(`admin_state_${chatId}`);
  if (stateStr) state = JSON.parse(stateStr);

  const editMsg = async (msgText) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/editMessageText`, { 
    method: "POST", headers: {"Content-Type": "application/json"}, 
    body: JSON.stringify({ chat_id: chatId, message_id: msgId, text: msgText, parse_mode: "HTML" }) 
  });

  if (state.step === "ask_type") {
    if (data === "type_movie" || data === "type_series") {
      state.is_series = data === "type_series";
      state.step = "ask_details";
      await kv.put(`admin_state_${chatId}`, JSON.stringify(state));
      await editMsg(`✅ <b>Type selected:</b> ${state.is_series ? '📺 Series' : '🎬 Movie'}\n\n1️⃣ Enter <b>Name, Year, Rating</b>\n<i>(Comma separated. e.g: Avatar, 2009, 7.9)</i>`);
    }
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
  }
}

async function finalizeSave(chatId, state, env, thumbId) {
  const kv = env.BLACK_BULL_CINEMA;
  const searchKey = state.title.toLowerCase().trim();
  const safeTitle = searchKey.replace(/\s+/g, '_'); 
  
  const newQ = `${state.quality.toLowerCase()}_${state.format.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const gatewayId = `${safeTitle}_${newQ}`; 
  
  const movieId = Date.now().toString(36); // Short Unique ID

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
      // Ensure existing movies get an ID if missing
      if (!movieData.id) movieData.id = movieId;
      // Ensure is_series is updated if not present
      if (movieData.is_series === undefined) movieData.is_series = state.is_series || false;
    } catch(e) {}
  }

  if (thumbId) {
    movieData.thumb = thumbId;
  }

  let exists = movieData.qualities.some(q => q.q === gatewayId);
  if (!exists) {
    const firstFileType = (state.files && state.files.length > 0) ? state.files[0].type : "video";
    const firstFileId = (state.files && state.files.length > 0) ? state.files[0].id : "grouped_files";
    
    movieData.qualities.push({
      id: firstFileId,
      type: firstFileType,
      name: `${state.quality} ${state.format}`.trim(),
      caption: `🎬 ${state.quality} (${state.format})`.trim(),
      q: gatewayId 
    });
  }

  await kv.put(searchKey, JSON.stringify(movieData));
  await kv.put(`idx_${movieData.id}`, searchKey); // Secondary index for callback
  await kv.delete(`admin_state_${chatId}`);

  if (env.BLACK_BULL_CINEMA_FILEID) {
    const filesToSave = state.files.map(f => ({
      id: f.id,
      type: f.type,
      caption: ""
    }));
    await env.BLACK_BULL_CINEMA_FILEID.put(gatewayId, JSON.stringify(filesToSave));
  }

  const sendMsg = async (msgText) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/sendMessage`, { 
    method: "POST", headers: {"Content-Type": "application/json"}, 
    body: JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: "HTML" }) 
  });

  return sendMsg(`✅ <b>Successfully Saved to KV!</b>\n\n📌 <b>Key:</b> <code>${searchKey}</code>\n🎬 <b>Type:</b> ${movieData.is_series ? 'Series' : 'Movie'}\n🎬 <b>Total Qualities:</b> ${movieData.qualities.length}\n📦 <b>Grouped Files:</b> ${state.files.length}\n🖼 <b>Thumbnail:</b> ${thumbId ? "Yes" : "No"}\n🔗 <b>Gateway ID:</b> <code>${gatewayId}</code>\n\n<i>Forward another video to add more qualities or a new movie.</i>`);
}

// ══════════════════════════════════════════════
// DEEP LINKING LOGIC (SENDING FILE TO USER)
// ══════════════════════════════════════════════

async function handleStartCommand(chatId, payload, env, bots) {
  if (!env.BLACK_BULL_CINEMA_FILEID) {
    const tgApiUrl = `https://api.telegram.org/bot${bots[0]}/sendMessage`;
    await fetch(tgApiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "❌ <b>Database Error:</b> File database not connected.", parse_mode: "HTML" }) });
    return;
  }

  const fileKey = payload; // Payload is exactly the key now, e.g. Movie_01_1080p_webdl
  const fileDataStr = await env.BLACK_BULL_CINEMA_FILEID.get(fileKey);
  
  if (!fileDataStr) {
    const tgApiUrl = `https://api.telegram.org/bot${bots[0]}/sendMessage`;
    await fetch(tgApiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "❌ <b>File not found or expired.</b>", parse_mode: "HTML" }) });
    return;
  }

  const fileArray = JSON.parse(fileDataStr);
  const filesToProcess = Array.isArray(fileArray) ? fileArray : [fileArray];

  // Send all files using Manager Bot token directly (bots[0])
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
      // Fallback for old file_ids
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

async function sendMovieReplyWithRetry(bots, startIndex, chatId, replyToMsgId, movieData, env) {
  // Format the UI Message Details
  const text = `🎬 <b>Movie Found!</b>\n\n` +
    `📌 <b>Title:</b> ${movieData.title}\n` +
    `📅 <b>Year:</b> ${movieData.year}\n` +
    `⭐ <b>Rating:</b> ${movieData.rating}\n\n` +
    `<i>Select quality to download below:</i>`;

  // Fetch Dynamic Gateway URL
  let baseUrl = "https://idsmovieplanet.ishangadineth.online";
  if (env && env.BLACK_BULL_CINEMA) {
    const customUrl = await env.BLACK_BULL_CINEMA.get("config_gateway_url");
    if (customUrl) baseUrl = customUrl;
  }
  // Ensure no trailing slash for clean building
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

  // Try each bot starting from the Round-Robin selected index
  for (let offset = 0; offset < bots.length; offset++) {
    const currentIndex = (startIndex + offset) % bots.length;
    const botToken = bots[currentIndex];

    // Fetch username dynamically. If token is invalid, it returns UnknownBot.
    const botUser = await getBotUsername(botToken);
    if (botUser === "UnknownBot") {
      console.warn(`Bot ${currentIndex + 1} seems invalid. Skipping to next...`);
      continue;
    }

    // Dynamically generate buttons based on 'qualities' array in KV
    const keyboard = [];
    if (movieData.qualities && Array.isArray(movieData.qualities)) {
      for (let i = 0; i < movieData.qualities.length; i += 2) {
        const row = [];
        const q1 = movieData.qualities[i];
        row.push({ text: `🎬 ${q1.name}`, url: `${baseUrl}/?id=${q1.q}&bot=${botUser}` });
        if (i + 1 < movieData.qualities.length) {
          const q2 = movieData.qualities[i + 1];
          row.push({ text: `🎬 ${q2.name}`, url: `${baseUrl}/?id=${q2.q}&bot=${botUser}` });
        }
        keyboard.push(row);
      }
    } else {
      // Fallback
      keyboard.push([{ text: "🎬 Click Here to Download", url: `${baseUrl}/?bot=${botUser}` }]);
    }

    const tgApiUrl = movieData.thumb 
      ? `https://api.telegram.org/bot${botToken}/sendPhoto`
      : `https://api.telegram.org/bot${botToken}/sendMessage`;
      
    const payload = movieData.thumb 
      ? {
          chat_id: chatId,
          photo: movieData.thumb,
          caption: text,
          parse_mode: "HTML",
          reply_to_message_id: replyToMsgId,
          reply_markup: { inline_keyboard: keyboard }
        }
      : {
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
          reply_to_message_id: replyToMsgId,
          reply_markup: { inline_keyboard: keyboard }
        };

    try {
      const res = await fetch(tgApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.ok) {
        // Successfully sent message! Exit the loop completely.
        return;
      } else {
        console.warn(`Bot ${currentIndex + 1} failed to send message: ${data.description}. Trying next bot...`);
      }
    } catch (e) {
      console.error(`Fetch error for Bot ${currentIndex + 1}:`, e);
    }
  }
}
