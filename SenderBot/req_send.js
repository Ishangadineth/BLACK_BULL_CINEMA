/**
 * BLACK BULL Cinema - Request System Bot
 * v 1.0.0
 * Forwards user movie/series requests to the admin group and allows admins to mark them as completed,
 * which automatically notifies the user.
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Request Bot Active ✅");

    const BOT_TOKEN = env.REQ_BOT_TOKEN;
    const ADMIN_GROUP = "-1003788726228";

    if (!BOT_TOKEN) {
      return new Response("Missing REQ_BOT_TOKEN", { status: 500 });
    }

    const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

    try {
      const payload = await request.json();

      // Handle Callbacks (Admin clicking COMPLETE in group)
      if (payload.callback_query) {
        const cb = payload.callback_query;
        const data = cb.data;
        const chatId = cb.message.chat.id;
        const msgId = cb.message.message_id;

        if (data.startsWith("status_notcomplete_")) {
          // data format: status_notcomplete_USERID_QUERY
          const parts = data.replace("status_notcomplete_", "").split("_");
          const userId = parts[0];
          const query = parts.slice(1).join("_");

          // 1. Notify the user
          const userMsg = `✅ <b>ඔන්න ඔයා ඉල්ලපු එක දැම්මා!</b>\n\n🎬 <code>${query}</code> එක Group එකට දාලා තියෙන්නේ. දැන් ගිහින් Download කරගන්න. 😉`;
          await fetch(`${TG_API}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: userId, text: userMsg, parse_mode: "HTML" })
          });

          // 2. Edit the admin group message button to COMPLETE
          const newKb = { inline_keyboard: [[{ text: "✅ COMPLETE", callback_data: `status_complete_${userId}_${query}` }]] };
          
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: newKb })
          });

          // 3. Answer Callback
          await fetch(`${TG_API}/answerCallbackQuery`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id, text: "✅ Marked as Complete and User Notified!" })
          });
        }
        
        else if (data.startsWith("status_complete_")) {
          await fetch(`${TG_API}/answerCallbackQuery`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id, text: "⚠️ This request is already completed." })
          });
        }

        return new Response("OK");
      }

      // Handle Text Messages
      if (payload.message) {
        const msg = payload.message;
        const text = msg.text || "";
        const userId = msg.from.id;
        const firstName = msg.from.first_name || "User";

        if (text.startsWith("/start ")) {
          const params = text.split(" ")[1]; 

          // Save User ID in KV to ensure we know they've started the bot
          if (env.REQ_KV) {
            await env.REQ_KV.put(`user_${userId}`, "true");
          }

          let type = "Unknown";
          let query = "";

          if (params.startsWith("m_")) {
            type = "🎬 Movie";
            query = decodeURIComponent(params.substring(2));
          } else if (params.startsWith("s_")) {
            type = "📺 Series";
            query = decodeURIComponent(params.substring(2));
          } else {
            query = decodeURIComponent(params);
          }

          // Replace underscores back to spaces if needed (though start param doesn't allow spaces, we might pass them as encoded or underscores)
          query = query.replace(/_/g, " ");

          // 1. Send the Request to Admin Group
          const adminMsg = `📢 <b>New Request!</b>\n\n👤 <b>User:</b> <a href="tg://user?id=${userId}">${firstName}</a> (<code>${userId}</code>)\n🔎 <b>Requested:</b> <code>${query}</code>\n📂 <b>Type:</b> ${type}`;
          
          // Add safe query string for callback data (max 64 bytes total, limit query to 20 chars for safety)
          const safeQuery = query.substring(0, 20);
          const kb = { inline_keyboard: [[{ text: "🚫 NOT COMPLETE", callback_data: `status_notcomplete_${userId}_${safeQuery}` }]] };

          const res = await fetch(`${TG_API}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: ADMIN_GROUP, text: adminMsg, parse_mode: "HTML", reply_markup: kb })
          });

          // 2. Send confirmation to User
          if (res.ok) {
            await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: userId, text: `✅ <b>ඔයාගේ Request එක යැව්වා!</b>\n\nඅපි <code>${query}</code> ඉක්මනින්ම ගෲප් එකට දාන්නම්. දැම්මට පස්සේ ඔයාට මෙතනින් මැසේජ් එකක් එයි. 😉`, parse_mode: "HTML" })
            });
          } else {
             await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: userId, text: `❌ <b>Request එක යැවීමේදී දෝෂයක්.</b>\nකරුණාකර පසුව නැවත උත්සාහ කරන්න.`, parse_mode: "HTML" })
            });
          }
        } else {
           // Default welcome message for everything else (including plain /start)
           const welcomeText = `🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ආයුබෝවන්! සාදරයෙන් පිළිගන්න.\nඔයාට අවශ්‍ය මූවීස් සහ සීරීස් පහසුවෙන් ලබා ගැනීමට අපගේ චැනල් එකේ ඇති ලින්ක් එකක් ක්ලික් කර මෙතැනට පැමිණෙන්න.\n\n🛡️ <b>Safe & Fast Delivery</b>`;
           await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: userId, text: welcomeText, parse_mode: "HTML" })
            });
        }
      }
    } catch (e) {
      console.error("Error:", e);
    }

    return new Response("OK");
  }
};
