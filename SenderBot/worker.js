/**
 * v 0.0.2 - BLACK BULL Cinema SENDER BOT
 * Code for the 6 Sender Bots
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Worker Bot Bull (Sender) Active ✅");

    try {
      const payload = await request.json();

      if (payload.callback_query) {
        ctx.waitUntil(handleCallback(payload.callback_query, env));
      }
      if (payload.message) {
        ctx.waitUntil(handleMessage(payload.message, env));
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("Worker error:", err.message);
      return new Response("Error", { status: 500 });
    }
  }
};

const LANGS = {
  si: {
    force_sub: "❌ <b>ඔයා අපේ Main Channels දෙකටම Join වෙලා නෑ!</b>\n\nපහළ තියෙන Channels දෙකටම Join වෙලා ඇවිත් ආපහු '✅ I have Joined' කියන එක ඔබන්න.",
    joined_btn: "✅ I have Joined"
  },
  en: {
    force_sub: "❌ <b>You haven't joined our Main Channels!</b>\n\nPlease join the 2 channels below and click '✅ I have Joined'.",
    joined_btn: "✅ I have Joined"
  },
  hi: {
    force_sub: "❌ <b>आप हमारे मुख्य चैनल में शामिल नहीं हुए हैं!</b>\n\nकृपया नीचे दिए गए 2 चैनलों से जुड़ें और '✅ I have Joined' पर क्लिक करें।",
    joined_btn: "✅ I have Joined"
  },
  es: {
    force_sub: "❌ <b>¡No te has unido a nuestros canales principales!</b>\n\nÚnete a los 2 canales a continuación y haz clic en '✅ I have Joined'.",
    joined_btn: "✅ I have Joined"
  },
  ta: {
    force_sub: "❌ <b>எங்கள் முக்கிய சேனல்களில் நீங்கள் சேரவில்லை!</b>\n\nகீழே உள்ள 2 சேனல்களில் சேர்ந்து '✅ I have Joined' என்பதைக் கிளிக் செய்யவும்.",
    joined_btn: "✅ I have Joined"
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
  } catch(e) {}
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
      return false; // Force join if error
    }
  }
  return true;
}

async function sendForceSubMessage(botToken, chatId, userId, payloadStr, env) {
  const langCode = await getUserLang(userId, env);
  const T = LANGS[langCode] || LANGS.si;

  const link1 = await getChannelLink(botToken, "-1003947907936", env.BLACK_BULL_CINEMA_LANG);
  const link2 = await getChannelLink(botToken, "-1003999803362", env.BLACK_BULL_CINEMA_LANG);

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

async function handleCallback(cb, env) {
  const chatId = cb.message.chat.id;
  const data = cb.data;
  const botToken = env.BOT_TOKEN;

  if (data.startsWith("check_sub_")) {
    const payload = data.substring(10);
    const isSubbed = await checkForceSub(botToken, cb.from.id);
    
    if (isSubbed) {
      // Delete the force join message
      await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: cb.message.message_id })
      });
      // Send the files
      await processPayload(botToken, chatId, payload, env);
    } else {
      // Answer callback with alert
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id, text: "❌ You must join both channels first!", show_alert: true })
      });
    }
  }
}

async function handleMessage(msg, env) {
  const text = msg.text ? msg.text.trim() : "";
  const chatId = msg.chat.id;
  const botToken = env.BOT_TOKEN;

  if (!botToken) return;

  const sendMsg = async (msgText) => fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: "HTML" })
  });

  if (text.startsWith("/start")) {
    const payload = text.split(" ")[1]; 

    if (payload) {
      const isSubbed = await checkForceSub(botToken, msg.from.id);
      if (!isSubbed) {
        return sendForceSubMessage(botToken, chatId, msg.from.id, payload, env);
      }
      return processPayload(botToken, chatId, payload, env);
    } else {
      await sendMsg("🤖 <b>I'm Alive!</b> ✅\n\nI am a BLACK BULL Cinema Sender Bot. Please use the main group to search for movies.");
    }
  }
}

async function processPayload(botToken, chatId, payload, env) {
  const kvFiles = env.BLACK_BULL_CINEMA_FILEID;
  if (!kvFiles) return;

  const sendMsg = async (msgText) => fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: "HTML" })
  });

  const filesStr = await kvFiles.get(payload);

  if (filesStr) {
    try {
      const files = JSON.parse(filesStr);
      if (Array.isArray(files)) {
        for (let i = 0; i < files.length; i++) {
          await sendFile(botToken, chatId, files[i].id, files[i].type, files[i].caption || "");
        }
      } else {
        await sendFile(botToken, chatId, files.id, files.type, files.caption || "");
      }
    } catch (e) {
      await sendMsg("❌ <b>System Error while parsing files.</b>");
    }
  } else {
    await sendMsg("❌ <b>Movie files not found!</b>\nThe files may have been removed or the ID is incorrect.");
  }
}

async function sendFile(botToken, chatId, fileId, type = "video", caption = "") {
  let method = "sendDocument";
  let requestPayload = { chat_id: chatId, caption: caption, parse_mode: "HTML" };

  if (type === "channel_msg" || !isNaN(fileId)) {
    method = "copyMessage";
    requestPayload = {
      chat_id: chatId,
      from_chat_id: "-1003759058179",
      message_id: parseInt(fileId),
      caption: caption,
      parse_mode: "HTML"
    };
  } else {
    const typeToMethod = { "video": "sendVideo", "document": "sendDocument", "audio": "sendAudio", "photo": "sendPhoto", "file": "sendDocument" };
    method = typeToMethod[type] || "sendDocument";
    requestPayload[type === "file" ? "document" : type] = fileId;
  }

  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload)
  });

  const data = await response.json();
  if (!data.ok) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `❌ <b>Failed to send file.</b>\nError: <code>${data.description}</code>`, parse_mode: "HTML" })
    });
  }
}
