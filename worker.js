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
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const msgId = msg.message_id;

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
