/**
 * BLACK BULL Cinema - Group Manager & Request Bot
 * v 2.1.0
 * Features:
 * - Welcome Message (Auto-delete 25s)
 * - URL/Emoji/Location Detection (Auto-delete & 30m Restrict for non-admins)
 * - Interactive Movie Request System (Step-by-step logic)
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Bot Active ✅");

    const BOT_TOKEN = env.REQ_BOT_TOKEN;
    const ADMIN_GROUP = "-1003788726228";
    const KV = env.REQ_KV;

    if (!BOT_TOKEN) return new Response("Missing REQ_BOT_TOKEN", { status: 500 });

    const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

    try {
      const payload = await request.json();

      // ── Handle Callbacks ──
      if (payload.callback_query) {
        const cb = payload.callback_query;
        const data = cb.data;
        const chatId = cb.message.chat.id;
        const msgId = cb.message.message_id;
        const userId = cb.from.id;

        // Callback for Year = NO
        if (data === "year_no") {
          let state = await getKVState(KV, userId);
          if (state && state.step === "waiting_year") {
            state.year = "Unknown";
            await finalizeRequest(TG_API, ADMIN_GROUP, userId, cb.from.first_name, state, KV, msgId);
            await answerCallback(TG_API, cb.id, "✅ Done!");
          }
        }

        // Callback for Admin Completion
        else if (data.startsWith("req_complete_")) {
          // format: req_complete_USERID_QUERY
          const parts = data.replace("req_complete_", "").split("_");
          const targetUserId = parts[0];
          const query = parts.slice(1).join(" ");

          // 1. Notify the User
          const userMsg = `✅ <b>ඔන්න ඔයා ඉල්ලපු එක දැම්මා!</b>\n\n🎬 <code>${query}</code> එක Group එකට දාලා තියෙන්නේ. දැන් ගිහින් Download කරගන්න. 😉`;
          await fetch(`${TG_API}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetUserId, text: userMsg, parse_mode: "HTML" })
          });

          // 2. Update Admin Group Button
          const newKb = { inline_keyboard: [[{ text: "✅ COMPLETE", callback_data: "done" }]] };
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: newKb })
          });

          await answerCallback(TG_API, cb.id, "✅ User Notified & Marked Complete!");
        }

        return new Response("OK");
      }

      // ── Handle Messages ──
      if (payload.message) {
        const msg = payload.message;
        const chatId = msg.chat.id;
        const msgId = msg.message_id;
        const userId = msg.from?.id;
        const firstName = msg.from?.first_name || "User";
        const text = msg.text || "";

        // ── 1. Group Moderation ──
        if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
          // Welcome Message
          if (msg.new_chat_members) {
            const welcomeText = `👋 <b>සාදරයෙන් පිළිගන්න ${firstName}!</b>\n\n🌟 <b>BLACK BULL CINEMA</b> Group එකට ඔබව සාදරයෙන් පිළිගන්නවා.\n\n⚠️ කරුණාකර ගෲප් එකේ නීති රීති පිළිපදින්න. (ලින්ක් හෝ ඉමෝජි දැමීම තහනම්)`;
            const res = await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: welcomeText, parse_mode: "HTML" })
            });
            const data = await res.json();
            if (data.ok) {
              const wMsgId = data.result.message_id;
              ctx.waitUntil((async () => {
                await new Promise(r => setTimeout(r, 25000));
                await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: wMsgId }) }).catch(() => {});
              })());
            }
            return new Response("OK");
          }

          // URL/Emoji/Location Detection
          let isAdmin = false;
          if (env.ADMIN_ID && userId.toString() === env.ADMIN_ID.toString()) isAdmin = true;
          else {
            const memberRes = await fetch(`${TG_API}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
            const mData = await memberRes.json();
            if (mData.ok && (mData.result.status === "creator" || mData.result.status === "administrator")) isAdmin = true;
          }

          if (!isAdmin) {
            const hasUrl = /https?:\/\/[^\s]+|t\.me\/[^\s]+/.test(text || msg.caption || "");
            const hasEmoji = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/.test(text || msg.caption || "");
            const hasLocation = !!msg.location;

            if (hasUrl || hasEmoji || hasLocation) {
              let violation = "Sending URL";
              if (hasEmoji) violation = "Sending Emoji";
              if (hasLocation) violation = "Sending Location";

              await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) }).catch(() => {});
              const untilDate = Math.floor(Date.now() / 1000) + (30 * 60);
              await fetch(`${TG_API}/restrictChatMember`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, user_id: userId, until_date: untilDate, permissions: { can_send_messages: false } }) });
              
              const restrictMsg = `🚫 <b><a href="tg://user?id=${userId}">${firstName}</a> has been restricted for 30 minutes due to violation of group rules.</b>\n\nViolation/s committed: <b>${violation}</b>`;
              const nRes = await fetch(`${TG_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: restrictMsg, parse_mode: "HTML" }) });
              const nData = await nRes.json();
              if (nData.ok) {
                const nMsgId = nData.result.message_id;
                ctx.waitUntil((async () => {
                  await new Promise(r => setTimeout(r, 20000));
                  await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: nMsgId }) }).catch(() => {});
                })());
              }
              return new Response("OK");
            }
          }
        }

        // ── 2. Request System (Private Chat) ──
        if (msg.chat.type === "private") {
          let state = await getKVState(KV, userId);

          // Deep Link Start
          if (text.startsWith("/start ")) {
            const params = text.split(" ")[1];
            let type = "🎬 Movie";
            let query = decodeURIComponent(params);

            if (params.startsWith("m_")) { type = "🎬 Movie"; query = decodeURIComponent(params.substring(2)); }
            else if (params.startsWith("s_")) { type = "📺 Series"; query = decodeURIComponent(params.substring(2)); }
            
            query = query.replace(/_/g, " ");

            const welcomeMsg = `ඔයා මේ ඉල්ලන <b>${query}</b> ${type} එකේ සම්පූර්ණ නම Google කරලා දාන්න. 🔍`;
            const res = await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: userId, text: welcomeMsg, parse_mode: "HTML" })
            });
            const data = await res.json();
            
            if (data.ok) {
              await KV.put(`state_${userId}`, JSON.stringify({
                step: "waiting_full_name",
                original_query: query,
                type: type,
                bot_msg_id: data.result.message_id
              }));
            }
            return new Response("OK");
          }

          // Step 1: Receiving Full Name
          if (state && state.step === "waiting_full_name" && text && !text.startsWith("/")) {
            // Delete user msg
            await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, message_id: msgId }) }).catch(() => {});
            
            state.full_name = text;
            state.step = "waiting_year";
            
            const askYearText = `ඔයා මේ ඉල්ලන <b>${state.full_name}</b> හදපු අවුරුද්ද දන්නවද? දන්නව නම් දාන්න, දන්නෙ නැත්තම් 'NO' කියන බටන් එක ඔබන්න. 📅`;
            const kb = { inline_keyboard: [[{ text: "📅 NO", callback_data: "year_no" }]] };
            
            await fetch(`${TG_API}/editMessageText`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: userId, message_id: state.bot_msg_id, text: askYearText, parse_mode: "HTML", reply_markup: kb })
            });

            await KV.put(`state_${userId}`, JSON.stringify(state));
            return new Response("OK");
          }

          // Step 2: Receiving Year
          if (state && state.step === "waiting_year" && text && !text.startsWith("/")) {
             // Delete user msg
             await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, message_id: msgId }) }).catch(() => {});
            
             state.year = text;
             await finalizeRequest(TG_API, ADMIN_GROUP, userId, firstName, state, KV, state.bot_msg_id);
             return new Response("OK");
          }

          // Default Welcome
          if (!text.startsWith("/")) {
            const welcomeText = `🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ආයුබෝවන්! සාදරයෙන් පිළිගන්න.\nඔයාට අවශ්‍ය මූවීස් සහ සීරීස් පහසුවෙන් ලබා ගැනීමට අපගේ චැනල් එකේ ඇති ලින්ක් එකක් ක්ලික් කර මෙතැනට පැමිණෙන්න.\n\n🛡️ <b>Safe & Fast Delivery</b>`;
            await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: userId, text: welcomeText, parse_mode: "HTML" })
            });
          }
        }
      }
    } catch (e) {
      console.error("Error:", e);
    }

    return new Response("OK");
  }
};

// --- HELPER FUNCTIONS ---

async function getKVState(KV, userId) {
  if (!KV) return null;
  const data = await KV.get(`state_${userId}`);
  return data ? JSON.parse(data) : null;
}

async function answerCallback(api, id, text = "") {
  await fetch(`${api}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text: text })
  });
}

async function finalizeRequest(api, adminGroup, userId, firstName, state, KV, botMsgId) {
  const query = state.full_name || state.original_query;
  const year = state.year || "Unknown";
  const type = state.type;

  // 1. Send to Admin Group
  const adminMsg = `📢 <b>New Request!</b>\n\n👤 <b>User:</b> <a href="tg://user?id=${userId}">${firstName}</a> (<code>${userId}</code>)\n🔎 <b>Requested:</b> <code>${query}</code>\n📅 <b>Year:</b> ${year}\n📂 <b>Type:</b> ${type}`;
  
  // Safe query for callback (max 64 bytes total)
  const safeQuery = query.substring(0, 20).replace(/ /g, "_");
  const kb = { inline_keyboard: [[{ text: "🚫 NOT COMPLETE", callback_data: `req_complete_${userId}_${safeQuery}` }]] };

  await fetch(`${api}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: adminGroup, text: adminMsg, parse_mode: "HTML", reply_markup: kb })
  });

  // 2. Notify User (Update the existing message)
  const confirmText = `✅ <b>ඔයාගේ Request එක ඇඩ්මින්ට යැව්වා!</b>\n\nඅපි <code>${query}</code> ඉක්මනින්ම ගෲප් එකට දාන්නම්. දැම්මට පස්සේ ඔයාට මෙතනින් මැසේජ් එකක් එයි. 😉`;
  await fetch(`${api}/editMessageText`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: userId, message_id: botMsgId, text: confirmText, parse_mode: "HTML" })
  });

  // 3. Clear state but maybe keep userID if needed? 
  // The user suggested saving userid in KV, but since we have it in the callback button, we don't strictly need a separate permanent store unless we want logs.
  if (KV) await KV.delete(`state_${userId}`);
}