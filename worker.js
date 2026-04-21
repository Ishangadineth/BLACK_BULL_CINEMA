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
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const msgId = msg.message_id;

  // Ignore commands starting with "/"
  if (text.startsWith("/")) return;

  // Array of 7 Bot Tokens from Environment Variables
  const botTokens = [
    env.BOT_TOKEN_1,
    env.BOT_TOKEN_2,
    env.BOT_TOKEN_3,
    env.BOT_TOKEN_4,
    env.BOT_TOKEN_5,
    env.BOT_TOKEN_6,
    env.BOT_TOKEN_7
  ].filter(Boolean); // Filters out any undefined tokens

  if (botTokens.length === 0) {
    console.error("No bot tokens available!");
    return;
  }

  // Round-Robin Logic using modulo operator
  const botIndex = msgId % botTokens.length;
  const selectedToken = botTokens[botIndex];

  // Search for the movie in BLACK_BULL_CINEMA KV Storage
  const movieData = await searchMovieInKV(text, env.BLACK_BULL_CINEMA);

  // If a movie is found, process the UI logic and reply
  if (movieData) {
    await sendMovieReply(selectedToken, chatId, msgId, movieData);
  }
}

// ══════════════════════════════════════════════
// SEARCH & UI LOGIC
// ══════════════════════════════════════════════

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

async function sendMovieReply(botToken, chatId, replyToMsgId, movieData) {
  const tgApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  // Format the UI Message Details
  const text = `🎬 <b>Movie Found!</b>\n\n` +
               `📌 <b>Title:</b> ${movieData.title}\n` +
               `📅 <b>Year:</b> ${movieData.year}\n` +
               `⭐ <b>Rating:</b> ${movieData.rating}\n\n` +
               `<i>Select quality to download below:</i>`;

  const baseUrl = `https://idsmovieplanet.ishangadineth.online/?id=${movieData.id}`;

  const buttons = {
    inline_keyboard: [
      [
        { text: "🎬 480p", url: `${baseUrl}&q=480p` },
        { text: "🎥 720p", url: `${baseUrl}&q=720p` },
        { text: "📺 1080p", url: `${baseUrl}&q=1080p` }
      ]
    ]
  };

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    reply_to_message_id: replyToMsgId,
    reply_markup: buttons
  };

  await fetch(tgApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
