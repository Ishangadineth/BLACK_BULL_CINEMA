/**
 * BLACK BULL Cinema - Group Manager & Request Bot
 * v 2.0.0
 * Features:
 * - Welcome Message (Auto-delete 30s)
 * - URL/Emoji Detection (Auto-delete & 30m Restrict)
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Group Manager Active ✅");

    const BOT_TOKEN = env.REQ_BOT_TOKEN;
    const KV = env.REQ_KV;

    if (!BOT_TOKEN) return new Response("Missing REQ_BOT_TOKEN", { status: 500 });

    const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

    try {
      const payload = await request.json();

      if (payload.message) {
        const msg = payload.message;
        const chatId = msg.chat.id;
        const msgId = msg.message_id;
        const userId = msg.from?.id;
        const firstName = msg.from?.first_name || "User";

        // ── 1. Welcome Message for New Members ──
        if (msg.new_chat_members) {
          const welcomeText = `👋 <b>සාදරයෙන් පිළිගන්න ${firstName}!</b>\n\n🌟 <b>BLACK BULL CINEMA</b> Group එකට ඔබව සාදරයෙන් පිළිගන්නවා.\n\n⚠️ කරුණාකර ගෲප් එකේ නීති රීති පිළිපදින්න. (ලින්ක් හෝ ඉමෝජි දැමීම තහනම්)`;
          
          const res = await fetch(`${TG_API}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: welcomeText, parse_mode: "HTML" })
          });
          const data = await res.json();
          
          if (data.ok) {
            const welcomeMsgId = data.result.message_id;
            ctx.waitUntil((async () => {
              try {
                await new Promise(r => setTimeout(r, 25000)); // 25 seconds (safer for CF Workers)
                await fetch(`${TG_API}/deleteMessage`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, message_id: welcomeMsgId })
                });
              } catch (e) {
                console.error("Delete Welcome Msg Error:", e);
              }
            })());
          }
          return new Response("OK");
        }

        // ── 2. URL & Emoji Detection (Groups Only) ──
        if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
          const text = msg.text || msg.caption || "";
          
          const hasUrl = /https?:\/\/[^\s]+|t\.me\/[^\s]+/.test(text);
          // Simple Emoji detection: Check for common emoji ranges
          const hasEmoji = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/.test(text);

          if (hasUrl || hasEmoji) {
            const violation = hasUrl ? "Sending URL" : "Sending Emoji";
            
            // Delete the message
            await fetch(`${TG_API}/deleteMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: msgId })
            }).catch(() => {});

            // Restrict user for 30 minutes
            const untilDate = Math.floor(Date.now() / 1000) + (30 * 60);
            await fetch(`${TG_API}/restrictChatMember`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                chat_id: chatId, 
                user_id: userId, 
                until_date: untilDate,
                permissions: { can_send_messages: false }
              })
            });

            // Send restriction notice and auto-delete it after 20s
            const restrictMsg = `🚫 <b><a href="tg://user?id=${userId}">${firstName}</a> has been restricted for 30 minutes due to violation of group rules.</b>\n\nViolation/s committed: <b>${violation}</b>`;
            const noticeRes = await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: restrictMsg, parse_mode: "HTML" })
            });
            const noticeData = await noticeRes.json();
            
            if (noticeData.ok) {
              const noticeMsgId = noticeData.result.message_id;
              ctx.waitUntil((async () => {
                try {
                  await new Promise(r => setTimeout(r, 20000)); // 20 seconds
                  await fetch(`${TG_API}/deleteMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, message_id: noticeMsgId })
                  });
                } catch (e) {}
              })());
            }

            return new Response("OK");
          }
        }
      }
    } catch (e) {
      console.error("Error:", e);
    }

    return new Response("OK");
  }
};