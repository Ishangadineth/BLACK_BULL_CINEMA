/**
 * v 0.0.1 - BLACK BULL Cinema SENDER BOT
 * Code for the 6 Sender Bots
 */

export default {
  async fetch(request, env, ctx) {
    // Only accept POST requests from Telegram Webhooks
    if (request.method !== "POST") return new Response("Worker Bot Bull (Sender) Active ✅");

    try {
      const payload = await request.json();

      // Ensure it's a message
      if (payload.message) {
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

async function handleMessage(msg, env) {
  const text = msg.text ? msg.text.trim() : "";
  const chatId = msg.chat.id;

  // Get Bot Token from variables
  const botToken = env.BOT_TOKEN;

  if (!botToken) {
    console.error("No BOT_TOKEN variable found!");
    return;
  }

  const tgApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const sendMsg = async (msgText) => fetch(tgApiUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: "HTML" })
  });

  // Handle /start command from Gateway Site Redirects
  if (text.startsWith("/start")) {
    const payload = text.split(" ")[1]; // e.g. "group_540p_web"

    if (payload) {
      const kvFiles = env.BLACK_BULL_CINEMA_FILEID;
      if (!kvFiles) return sendMsg("❌ KV Namespace (BLACK_BULL_CINEMA_FILEID) not bound to this worker!");

      const filesStr = await kvFiles.get(payload);

      if (filesStr) {
        try {
          const files = JSON.parse(filesStr);
          
          // Send all files in the array
          if (Array.isArray(files)) {
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              // Optional: You can send a caption on the first or last file if needed
              await sendFile(botToken, chatId, file.id, file.type, file.caption || "");
            }
          } else {
            // Fallback just in case it's not an array
            await sendFile(botToken, chatId, files.id, files.type, files.caption || "");
          }

        } catch (e) {
          console.error("Parse error:", e);
          await sendMsg("❌ <b>System Error while parsing files.</b>");
        }
      } else {
        await sendMsg("❌ <b>Movie files not found!</b>\nThe files may have been removed or the ID is incorrect.");
      }
      
    } else {
      // Normal start without parameters
      await sendMsg("🎬 <b>Welcome to BLACK BULL Cinema!</b>\n\nPlease use the main group to search for movies.");
    }
    return;
  }
}

// Function to send the actual file (Video/Document/Audio/Photo)
async function sendFile(botToken, chatId, fileId, type = "video", caption = "") {
  // Map our internal types to Telegram API methods
  const typeToMethod = {
    "video": "sendVideo",
    "document": "sendDocument",
    "audio": "sendAudio",
    "photo": "sendPhoto",
    "file": "sendDocument" // Fallback
  };

  const method = typeToMethod[type] || "sendDocument";
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  
  const requestPayload = { chat_id: chatId, caption: caption, parse_mode: "HTML" };
  requestPayload[type === "file" ? "document" : type] = fileId; // Dynamic key assignment

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload)
  });
}
