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
  const results = await searchMovieInKV(text, env.BLACK_BULL_CINEMA);

  // If a movie is found, process the UI logic and reply
  if (results && results.length > 0) {
    const userFirstName = msg.chat.first_name || "User";
    await sendSearchResults(bots[0], chatId, msgId, text, results, "all", env, null, userFirstName);
  } else {
    // Optional: send a "not found" message
    const kb = { inline_keyboard: [[{ text: "😮 මෙතන නෑනේ (Request Movie)", callback_data: `req_${text.substring(0, 40)}` }]] };
    await fetch(`https://api.telegram.org/bot${bots[0]}/sendMessage`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ chat_id: chatId, text: `❌ ඔයා හොයන '<b>${text}</b>' අපේ පද්ධතියේ නෑ.\n\nපහළ බට්න් එක ඔබලා Admin ට Request එකක් දාන්න. 👇`, parse_mode: "HTML", reply_markup: kb })
    });
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
  if (text && !text.startsWith("/")) {
    if (Object.keys(state).length > 0) {
      return sendMsg("⚠️ <b>You are currently in the middle of an upload.</b>\nType /cancel to abort if you want to search movies.");
    }
    
    // Search movies in private chat!
    const results = await searchMovieInKV(text, env.BLACK_BULL_CINEMA);
    if (results && results.length > 0) {
      const userFirstName = msg.chat.first_name || "Admin";
      return sendSearchResults(env.BOT_TOKEN_1, chatId, msg.message_id, text, results, "all", env, null, userFirstName);
    } else {
      return sendMsg(`❌ <b>'${text}' Not found in KV database.</b>\n\n👋 <b>Admin Uploader Panel:</b>\nForward any file to start uploading.`);
    }
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

  // ════ CALLBACKS FOR SEARCH UI ════
  const bots = [];
  for (let i = 1; i <= 7; i++) {
    if (env[`BOT_TOKEN_${i}`]) bots.push(env[`BOT_TOKEN_${i}`]);
  }

  if (data.startsWith("view_")) {
    const movieId = data.split("_")[1];
    const searchKey = await kv.get(`idx_${movieId}`);
    if (searchKey) {
      const existingStr = await kv.get(searchKey);
      if (existingStr) {
        const movieData = JSON.parse(existingStr);
        await sendMovieReplyWithRetry(bots, 0, chatId, cb.message.reply_to_message?.message_id || msgId, movieData, env, msgId);
      }
    }
  }

  if (data.startsWith("filter_")) {
    const parts = data.split("_");
    const fType = parts[1]; // movies or series
    const query = parts.slice(2).join("_");
    const results = await searchMovieInKV(query, kv);
    if (results && results.length > 0) {
      const userFirstName = cb.message.chat.first_name || "User";
      await sendSearchResults(bots[0], chatId, cb.message.reply_to_message?.message_id || msgId, query, results, fType, env, msgId, userFirstName);
    }
  }

  if (data.startsWith("req_")) {
    const query = data.substring(4);
    if (env.ADMIN_ID) {
      const adminMsg = `📢 <b>New Request from User!</b>\n👤 <b>User:</b> <a href="tg://user?id=${chatId}">${cb.message.chat.first_name || "User"}</a> (<code>${chatId}</code>)\n🔎 <b>Requested:</b> ${query}`;
      await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/sendMessage`, { 
        method: "POST", headers: {"Content-Type": "application/json"}, 
        body: JSON.stringify({ chat_id: env.ADMIN_ID, text: adminMsg, parse_mode: "HTML" }) 
      });
      // Answer Callback
      await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN_1}/answerCallbackQuery`, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ callback_query_id: cb.id, text: "✅ ඔයාගේ Request එක Admin ට යැව්වා. ඉක්මනින්ම එකතු කරන්නම්!", show_alert: true })
      });
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
        results.push(JSON.parse(dataString));
      } catch (e) {}
    }
  }
  return results;
}

async function sendSearchResults(botToken, chatId, replyToMsgId, query, results, filterType, env, editMsgId = null, firstName = "User") {
  // Filter Logic
  let filtered = results;
  if (filterType === "movies") filtered = results.filter(r => !r.is_series);
  if (filterType === "series") filtered = results.filter(r => r.is_series);

  // Default Random Images Array
  const defaultImages = [
    "https://telegra.ph/file/09641775e714bc21cbdae.jpg", // Change these links to your actual 10 images later
    "https://telegra.ph/file/9d77490fb1275ff0d1a47.jpg",
    "https://telegra.ph/file/48d5d4d385f0ef3db9c7a.jpg"
  ];
  const randomImg = defaultImages[Math.floor(Math.random() * defaultImages.length)];

  const text = `👋 හෙලෝ <b>${firstName}</b>,\n\nබලන්න ඔයා හොයන '<b>${query}</b>' මෙතන තියනවද කියලා.. 👇\n\n📌 <i>ඔයා හොයන්නේ සීරීස් එකක් නම් 'Series' කියන බට්න් එක ඔබලා ඔයාට ඕනි සීරීස් එක තෝරන්න.</i>`;

  const keyboard = [];
  
  // Top Filter Buttons
  keyboard.push([
    { text: filterType === "movies" ? "✅ 🎬 Movies" : "🎬 Movies", callback_data: `filter_movies_${query}` },
    { text: filterType === "series" ? "✅ 📺 Series" : "📺 Series", callback_data: `filter_series_${query}` }
  ]);

  // List Buttons
  for (const r of filtered) {
    keyboard.push([{ text: `🎬 ${r.title} (${r.year})`, callback_data: `view_${r.id}` }]);
  }

  if (filtered.length === 0) {
    keyboard.push([{ text: "🚫 No results found for this category.", callback_data: "none" }]);
  }

  // Not Here Button
  keyboard.push([{ text: "😮 මෙතන නෑනේ", callback_data: `req_${query.substring(0,40)}` }]);

  const payload = {
    chat_id: chatId,
    reply_markup: { inline_keyboard: keyboard }
  };

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

  await fetch(tgApiUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function sendMovieReplyWithRetry(bots, startIndex, chatId, replyToMsgId, movieData, env, editMsgId = null) {
  // Format the UI Message Details
  const text = `🎬 <b>${movieData.is_series ? 'Series' : 'Movie'} Found!</b>\n\n` +
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

    const botUser = await getBotUsername(botToken);
    if (botUser === "UnknownBot") continue;

    // Dynamically generate buttons based on 'qualities' array in KV
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

    const defaultImages = [
      "https://telegra.ph/file/09641775e714bc21cbdae.jpg", 
      "https://telegra.ph/file/9d77490fb1275ff0d1a47.jpg",
      "https://telegra.ph/file/48d5d4d385f0ef3db9c7a.jpg"
    ];
    const randomImg = defaultImages[Math.floor(Math.random() * defaultImages.length)];
    const movieThumb = movieData.thumb || randomImg; // Always use an image so editMessageMedia works

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

      if (data.ok) {
        // Successfully sent/edited message! Exit the loop completely.
        return;
      } else {
        console.warn(`Bot ${currentIndex + 1} failed to send message: ${data.description}. Trying next bot...`);
      }
    } catch (e) {
      console.error(`Fetch error for Bot ${currentIndex + 1}:`, e);
    }
  }
}
