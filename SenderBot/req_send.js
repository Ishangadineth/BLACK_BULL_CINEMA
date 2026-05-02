/**
 * BLACK BULL Cinema - Group Manager & Request Bot
 * v 2.2.0
 * Features:
 * - Multi-Language Support (connected to BLACK_BULL_CINEMA_LANG)
 * - Group Moderation (Welcome 25s, Auto-delete violations, Admin bypass)
 * - Interactive Movie Request System
 * - Admin Image Attachment for Requests
 * - User ID Persistence (Saves all /start users)
 */

const LOCALES = {
  si: {
    welcome: "ඔයා මේ ඉල්ලන <b>{query}</b> {type} එකේ සම්පූර්ණ නම Google කරලා දාන්න. 🔍",
    ask_year: "ඔයා මේ ඉල්ලන <b>{name}</b> හදපු අවුරුද්ද දන්නවද? දන්නව නම් දාන්න, දන්නෙ නැත්තම් 'NO' කියන බටන් එක ඔබන්න. 📅",
    req_sent: "✅ <b>ඔයාගේ Request එක ඇඩ්මින්ට යැව්වා!</b>\n\nඅපි <code>{query}</code> ඉක්මනින්ම ගෲප් එකට දාන්නම්. දැම්මට පස්සේ ඔයාට මෙතනින් මැසේජ් එකක් එයි. 😉",
    done_msg: "✅ <b>ඔන්න ඔයා ඉල්ලපු එක දැම්මා!</b>\n\n🎬 <code>{query}</code> එක Group එකට දාලා තියෙන්නේ. දැන් ගිහින් Download කරගන්න. 😉",
    home_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ආයුබෝවන්! සාදරයෙන් පිළිගන්න.\nඔයාට අවශ්‍ය මූවීස් සහ සීරීස් පහසුවෙන් ලබා ගැනීමට අපගේ චැනල් එකේ ඇති ලින්ක් එකක් ක්ලික් කර මෙතැනට පැමිණෙන්න.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    grp_welcome: "👋 <b>සාදරයෙන් පිළිගන්න {name}!</b>\n\n🌟 <b>BLACK BULL CINEMA</b> Group එකට ඔබව සාදරයෙන් පිළිගන්නවා.\n\n⚠️ කරුණාකර ගෲප් එකේ නීති රීති පිළිපදින්න. (ලින්ක් හෝ ඉමෝජි දැමීම තහනම්)",
    btn_no: "📅 NO"
  },
  en: {
    welcome: "Please provide the full name of the <b>{query}</b> {type} you're requesting. Search on Google if needed. 🔍",
    ask_year: "Do you know the release year of <b>{name}</b>? If yes, type it; otherwise, tap the 'NO' button. 📅",
    req_sent: "✅ <b>Your Request has been sent to the admin!</b>\n\nWe will add <code>{query}</code> to the group soon. You will receive a message here once it's done. 😉",
    done_msg: "✅ <b>The item you requested has been uploaded!</b>\n\n🎬 <code>{query}</code> is now available in the group. Go and download it now. 😉",
    home_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 Welcome! Glad to have you here.\nTo get your favorite movies and series, click a link from our channel to come here.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    grp_welcome: "👋 <b>Welcome {name}!</b>\n\n🌟 Welcome to the <b>BLACK BULL CINEMA</b> Group.\n\n⚠️ Please follow the group rules. (No links or emojis)",
    btn_no: "📅 NO"
  },
  hi: {
    welcome: "कृपया उस <b>{query}</b> {type} का पूरा नाम प्रदान करें जिसे आप अनुरोध कर रहे हैं। 🔍",
    ask_year: "क्या आप <b>{name}</b> की रिलीज का वर्ष जानते हैं? यदि हाँ, तो इसे टाइप करें; अन्यथा, 'NO' बटन दबाएं। 📅",
    req_sent: "✅ <b>आपका अनुरोध एडमिन को भेज दिया गया है!</b>\n\nहम जल्द ही ग्रुप में <code>{query}</code> जोड़ देंगे। 😉",
    done_msg: "✅ <b>वह फिल्म जिसे आपने अनुरोध किया था, अपलोड कर दी गई है!</b>\n\n🎬 <code>{query}</code> अब ग्रुप में उपलब्ध है। 😉",
    home_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 स्वागत है!",
    grp_welcome: "👋 <b>स्वागत है {name}!</b>\n\n🌟 <b>BLACK BULL CINEMA</b> ग्रुप में आपका स्वागत है।\n\n⚠️ कृपया समूह के नियमों का पालन करें। (कोई लिंक या इमोजी नहीं)",
    btn_no: "📅 NO"
  },
  es: {
    welcome: "Proporcione el nombre completo de <b>{query}</b> {type} que está solicitando. 🔍",
    ask_year: "¿Conoces el año de estreno de <b>{name}</b>? Si es así, escríbelo; de lo contrario, pulsa 'NO'. 📅",
    req_sent: "✅ <b>¡Tu solicitud ha sido enviada al administrador!</b>\n\nPronto agregaremos <code>{query}</code> al grupo. 😉",
    done_msg: "✅ <b>¡El elemento que solicitaste ha sido subido!</b>\n\n🎬 <code>{query}</code> ya está disponible. 😉",
    home_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ¡Bienvenido!",
    grp_welcome: "👋 <b>¡Bienvenido {name}!</b>\n\n🌟 Bienvenido al grupo <b>BLACK BULL CINEMA</b>.\n\n⚠️ Por favor sigue las reglas. (Sin enlaces ni emojis)",
    btn_no: "📅 NO"
  },
  ta: {
    welcome: "நீங்கள் கோரும் <b>{query}</b> {type} இன் முழுப் பெயரை வழங்கவும். 🔍",
    ask_year: "<b>{name}</b> இன் வெளியீட்டு ஆண்டு உங்களுக்குத் தெரியுமா? ஆம் எனில், தட்டச்சு செய்யவும்; இல்லையெனில் 'NO' பொத்தானைத் தட்டவும். 📅",
    req_sent: "✅ <b>உங்கள் கோரிக்கை நிர்வாகிக்கு அனுப்பப்பட்டது!</b>\n\nவிரைவில் <code>{query}</code> ஐ குழுவில் சேர்ப்போம். 😉",
    done_msg: "✅ <b>நீங்கள் கோரியது பதிவேற்றப்பட்டது!</b>\n\n🎬 <code>{query}</code> இப்போது குழுவில் கிடைக்கிறது. 😉",
    home_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 வரவேற்கிறோம்!",
    grp_welcome: "👋 <b>வரவேற்கிறோம் {name}!</b>\n\n🌟 <b>BLACK BULL CINEMA</b> குழுவிற்கு உங்களை வரவேற்கிறோம்.\n\n⚠️ குழு விதிகளைப் பின்பற்றவும். (இணைப்புகள் அல்லது ஈமோஜிகள் இல்லை)",
    btn_no: "📅 NO"
  }
};

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Bot Active ✅");

    const BOT_TOKEN = env.REQ_BOT_TOKEN;
    const ADMIN_GROUP = "-1003788726228";
    const KV = env.REQ_KV;
    const LANG_KV = env.BLACK_BULL_CINEMA_LANG;

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

        if (data === "year_no") {
          let state = await getKV(KV, `state_${userId}`);
          if (state && state.step === "waiting_year") {
            state.year = "Unknown";
            await finalizeRequest(TG_API, ADMIN_GROUP, userId, cb.from.first_name, state, KV, LANG_KV, msgId);
            await answerCallback(TG_API, cb.id, "✅ Done!");
          }
        }

        else if (data.startsWith("setlang_")) {
          const parts = data.replace("setlang_", "").split("_");
          const lang = parts[0];
          const targetUserId = parts[1];
          
          if (userId.toString() !== targetUserId) {
            await answerCallback(TG_API, cb.id, "මේ ඔයා ඉල්ලපු එක නෙවේ🧐", true);
            return new Response("OK");
          }

          if (LANG_KV) await LANG_KV.put(`lang_${userId}`, lang);
          
          const T = LOCALES[lang] || LOCALES.si;
          const newWelcome = T.grp_welcome.replace("{name}", cb.from.first_name);
          
          const langKb = {
            inline_keyboard: [
              [{ text: "🇱🇰 සිංහල", callback_data: `setlang_si_${targetUserId}` }, { text: "🇬🇧 Eng", callback_data: `setlang_en_${targetUserId}` }, { text: "🇮🇳 हिन्", callback_data: `setlang_hi_${targetUserId}` }],
              [{ text: "🇪🇸 Esp", callback_data: `setlang_es_${targetUserId}` }, { text: "🇮🇳 தமி", callback_data: `setlang_ta_${targetUserId}` }]
            ]
          };

          await fetch(`${TG_API}/editMessageText`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, text: newWelcome, parse_mode: "HTML", reply_markup: langKb })
          });
          
          await answerCallback(TG_API, cb.id, "✅ Language Updated!");
          return new Response("OK");
        }

        else if (data.startsWith("req_complete_")) {
          const parts = data.replace("req_complete_", "").split("_");
          const targetUserId = parts[0];
          const query = parts.slice(1).join(" ");
          
          const langCode = await getUserLang(LANG_KV, targetUserId);
          const T = LOCALES[langCode] || LOCALES.si;

          // Check if there is a saved image for this request
          const savedImg = await KV.get(`req_img_${msgId}`);
          
          const userMsg = T.done_msg.replace("{query}", query);

          if (savedImg) {
            await fetch(`${TG_API}/sendPhoto`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: targetUserId, photo: savedImg, caption: userMsg, parse_mode: "HTML" })
            });
            await KV.delete(`req_img_${msgId}`);
          } else {
            await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: targetUserId, text: userMsg, parse_mode: "HTML" })
            });
          }

          const newKb = { inline_keyboard: [[{ text: "✅ COMPLETE", callback_data: "done" }]] };
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: newKb })
          });

          await answerCallback(TG_API, cb.id, "✅ User Notified!");
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

        // ── 0. Save User ID ──
        if (KV && userId) {
          await KV.put(`user_${userId}`, JSON.stringify({ name: firstName, date: new Date().toISOString() }));
        }

        // ── 1. Admin Group Image Attachment ──
        if (chatId.toString() === ADMIN_GROUP && msg.reply_to_message && msg.photo) {
          const repliedMsg = msg.reply_to_message;
          const repliedMsgId = repliedMsg.message_id;
          
          // Check if the replied message is a request (has NOT COMPLETE button)
          const hasButton = repliedMsg.reply_markup?.inline_keyboard?.some(row => row.some(btn => btn.callback_data.startsWith("req_complete_")));
          
          if (hasButton) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            await KV.put(`req_img_${repliedMsgId}`, photoId);
            
            // Delete admin's photo message to keep group clean
            await fetch(`${TG_API}/deleteMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: msgId })
            }).catch(() => {});
            
            return new Response("OK");
          }
        }

        // ── 2. Group Moderation ──
        if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
          // ── 1.1 Auto-delete any command in group after 10s ──
          if (text.startsWith("/") && ctx) {
            ctx.waitUntil((async () => {
              await new Promise(r => setTimeout(r, 10000));
              await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) }).catch(() => {});
            })());
          }

          // Welcome Msg
          if (msg.new_chat_members) {
            const langCode = await getUserLang(LANG_KV, userId);
            const T = LOCALES[langCode] || LOCALES.si;
            const welcomeText = T.grp_welcome.replace("{name}", firstName);
            
            const langKb = {
              inline_keyboard: [
                [{ text: "🇱🇰 සිංහල", callback_data: `setlang_si_${userId}` }, { text: "🇬🇧 Eng", callback_data: `setlang_en_${userId}` }, { text: "🇮🇳 हिन्", callback_data: `setlang_hi_${userId}` }],
                [{ text: "🇪🇸 Esp", callback_data: `setlang_es_${userId}` }, { text: "🇮🇳 தமி", callback_data: `setlang_ta_${userId}` }]
              ]
            };

            const res = await fetch(`${TG_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: welcomeText, parse_mode: "HTML", reply_markup: langKb }) });
            const data = await res.json();
            if (data.ok) {
              ctx.waitUntil((async () => {
                await new Promise(r => setTimeout(r, 25000));
                await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: data.result.message_id }) }).catch(() => {});
              })());
            }
            return new Response("OK");
          }

          // Admin Bypass
          let isAdmin = false;
          if (env.ADMIN_ID && userId.toString() === env.ADMIN_ID.toString()) isAdmin = true;
          else {
            const mRes = await fetch(`${TG_API}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
            const mData = await mRes.json();
            if (mData.ok && (mData.result.status === "creator" || mData.result.status === "administrator")) isAdmin = true;
          }

          if (!isAdmin) {
            const hasUrl = /https?:\/\/[^\s]+|t\.me\/[^\s]+/.test(text || msg.caption || "");
            const hasEmoji = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/.test(text || msg.caption || "");
            const hasLocation = !!msg.location;

            if (hasUrl || hasEmoji || hasLocation) {
              await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) }).catch(() => {});
              const untilDate = Math.floor(Date.now() / 1000) + (30 * 60);
              await fetch(`${TG_API}/restrictChatMember`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, user_id: userId, until_date: untilDate, permissions: { can_send_messages: false } }) });
              
              const violation = hasUrl ? "URL" : (hasEmoji ? "Emoji" : "Location");
              const restrictMsg = `🚫 <b><a href="tg://user?id=${userId}">${firstName}</a> restricted for 30m. Violation: ${violation}</b>`;
              const nRes = await fetch(`${TG_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: restrictMsg, parse_mode: "HTML" }) });
              const nData = await nRes.json();
              if (nData.ok) {
                ctx.waitUntil((async () => {
                  await new Promise(r => setTimeout(r, 20000));
                  await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: nData.result.message_id }) }).catch(() => {});
                })());
              }
              return new Response("OK");
            }
          }
        }

        // ── 3. Request System (Private) ──
        if (msg.chat.type === "private") {
          const langCode = await getUserLang(LANG_KV, userId);
          const T = LOCALES[langCode] || LOCALES.si;
          let state = await getKV(KV, `state_${userId}`);

          if (text.startsWith("/start ")) {
            const params = text.split(" ")[1];
            let type = "🎬 Movie";
            let query = decodeURIComponent(params);
            if (params.startsWith("m_")) { type = "🎬 Movie"; query = decodeURIComponent(params.substring(2)); }
            else if (params.startsWith("s_")) { type = "📺 Series"; query = decodeURIComponent(params.substring(2)); }
            query = query.replace(/_/g, " ");

            const welcomeMsg = T.welcome.replace("{query}", query).replace("{type}", type);
            const res = await fetch(`${TG_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, text: welcomeMsg, parse_mode: "HTML" }) });
            const data = await res.json();
            if (data.ok) {
              await KV.put(`state_${userId}`, JSON.stringify({ step: "waiting_full_name", original_query: query, type: type, bot_msg_id: data.result.message_id }));
            }
            return new Response("OK");
          }

          if (state && state.step === "waiting_full_name" && text && !text.startsWith("/")) {
            await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, message_id: msgId }) }).catch(() => {});
            state.full_name = text;
            state.step = "waiting_year";
            const askYearText = T.ask_year.replace("{name}", state.full_name);
            const kb = { inline_keyboard: [[{ text: T.btn_no, callback_data: "year_no" }]] };
            await fetch(`${TG_API}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, message_id: state.bot_msg_id, text: askYearText, parse_mode: "HTML", reply_markup: kb }) });
            await KV.put(`state_${userId}`, JSON.stringify(state));
            return new Response("OK");
          }

          if (state && state.step === "waiting_year" && text && !text.startsWith("/")) {
             await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, message_id: msgId }) }).catch(() => {});
             state.year = text;
             await finalizeRequest(TG_API, ADMIN_GROUP, userId, firstName, state, KV, LANG_KV, state.bot_msg_id);
             return new Response("OK");
          }

          if (text.startsWith("/")) {
            await fetch(`${TG_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, text: T.home_msg, parse_mode: "HTML" }) });
          }
        }
      }
    } catch (e) { console.error("Error:", e); }
    return new Response("OK");
  }
};

// --- HELPERS ---

async function getKV(KV, key) {
  if (!KV) return null;
  const data = await KV.get(key);
  return data ? JSON.parse(data) : null;
}

async function getUserLang(LANG_KV, userId) {
  if (!LANG_KV) return "si";
  const lang = await LANG_KV.get(`lang_${userId}`);
  return lang || "si";
}

async function answerCallback(api, id, text = "", showAlert = false) {
  await fetch(`${api}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: id, text: text, show_alert: showAlert }) });
}

async function finalizeRequest(api, adminGroup, userId, firstName, state, KV, LANG_KV, botMsgId) {
  const query = state.full_name || state.original_query;
  const year = state.year || "Unknown";
  const type = state.type;
  
  const langCode = await getUserLang(LANG_KV, userId);
  const T = LOCALES[langCode] || LOCALES.si;

  const adminMsg = `📢 <b>New Request!</b>\n\n👤 <b>User:</b> <a href="tg://user?id=${userId}">${firstName}</a> (<code>${userId}</code>)\n🔎 <b>Requested:</b> <code>${query}</code>\n📅 <b>Year:</b> ${year}\n📂 <b>Type:</b> ${type}`;
  const safeQuery = query.substring(0, 20).replace(/ /g, "_");
  const kb = { inline_keyboard: [[{ text: "🚫 NOT COMPLETE", callback_data: `req_complete_${userId}_${safeQuery}` }]] };

  await fetch(`${api}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: adminGroup, text: adminMsg, parse_mode: "HTML", reply_markup: kb }) });
  
  const confirmText = T.req_sent.replace("{query}", query);
  await fetch(`${api}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, message_id: botMsgId, text: confirmText, parse_mode: "HTML" }) });
  
  if (KV) await KV.delete(`state_${userId}`);
}