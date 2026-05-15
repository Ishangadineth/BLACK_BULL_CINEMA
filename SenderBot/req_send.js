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
    btn_no: "📅 NO",
    fb_welcome: "🎁 <b>ඔයාට points 75 ලබාගන්න chance එකක්!</b>\n\nඔයා අපේ facebook page එක follow කරලා පහල තියෙන <b>'I Follow on FB'</b> කියන button එක click කරන්න.\n\nඑතකොට අපේ page එකේ screen shot එක ඉල්ලයි. ඔයා ඒක bot ට send කරන්න. ඊට පස්සේ ඔයාගේ profile name එක bot ඉල්ලනවා. ඒකත් send කරන්න. එච්චරයි ඔයාට කරන්ට තියෙන්නෙ!\n\nඅපේ admin check කරලා 2-3 h අතර කාලෙකින් ඔයාට point ලැබුනා කියලා msg එකක් එයි. 🔥",
    fb_btn: "✅ I have followed",
    fb_ask_ss: "📸 <b>නියමයි!</b>\nදැන් ඔයා අපේ Facebook Page එක Follow කරපු බව පෙනෙන Screenshot එකක් මෙතැනට එවන්න.",
    fb_ask_name: "✍️ <b>දැන් ඔයාගේ Facebook Profile Name එක මෙතැනට එවන්න.</b>",
    fb_final: "✅ <b>ඔයාගේ විස්තර ලැබුණා!</b>\n\nඅපේ admin check කරලා 2-3 h අතර කාලෙකින් ඔයාට point ලැබුනා කියලා msg එකක් එයි. ස්තූතියි! ❤️",
    fb_earned_already: "ඔයා දැනටම point 75 අරගෙන ඉන්නේ පැටියෝ.. 😉",
    fb_not_verified: "❌ <b>ඔයා අපේ page එක follow කරලා නෑනේ!</b>\n\nfollow කරලා නම් තියෙන්නේ ඔයාගේ profile එකේ තියෙන name එක හරියට දාන්න. ආයේ check කරලා පහළ තියෙන <b>TRY AGAIN</b> button එක click කරන්න. 👇",
    fb_try_again: "🔄 TRY AGAIN",
    fb_success: "🎉 <b>Congratulations!</b>\nඔයාට point 75ක් add උනා! දැන් points system එක හරහා gateway නොයා කෙලින්ම films/series download කරගන්න.\n\nතව point ඕනි නම් පහල තියෙන share button එක click කරන්න. 👇"
  },
  en: {
    welcome: "Please provide the full name of the <b>{query}</b> {type} you're requesting. Search on Google if needed. 🔍",
    ask_year: "Do you know the release year of <b>{name}</b>? If yes, type it; otherwise, tap the 'NO' button. 📅",
    req_sent: "✅ <b>Your Request has been sent to the admin!</b>\n\nWe will add <code>{query}</code> to the group soon. You will receive a message here once it's done. 😉",
    done_msg: "✅ <b>The item you requested has been uploaded!</b>\n\n🎬 <code>{query}</code> is now available in the group. Go and download it now. 😉",
    home_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 Welcome! Glad to have you here.\nTo get your favorite movies and series, click a link from our channel to come here.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    grp_welcome: "👋 <b>Welcome {name}!</b>\n\n🌟 Welcome to the <b>BLACK BULL CINEMA</b> Group.\n\n⚠️ Please follow the group rules. (No links or emojis)",
    btn_no: "📅 NO",
    fb_welcome: "🎁 <b>Get 75 Free Points!</b>\n\nFollow our Facebook page and click the <b>'I Follow on FB'</b> button below.\n\nYou will be asked to send a screenshot and your profile name. Once approved, you get 75 points! 🔥",
    fb_btn: "✅ I have followed",
    fb_ask_ss: "📸 <b>Great!</b>\nPlease send a screenshot showing that you followed our Facebook page.",
    fb_ask_name: "✍️ <b>Now, please send your Facebook Profile Name.</b>",
    fb_final: "✅ <b>Details Received!</b>\n\nOur admin will verify it within 2-3 hours and you'll receive your points. Thank you! ❤️",
    fb_earned_already: "You have already earned these 75 points! 😉",
    fb_not_verified: "❌ <b>Verification Failed!</b>\n\nYou haven't followed our page or the profile name is incorrect. Please check again and click <b>TRY AGAIN</b>. 👇",
    fb_try_again: "🔄 TRY AGAIN",
    fb_success: "🎉 <b>Congratulations!</b>\n75 points have been added to your account! You can now download directly without the gateway.\n\nNeed more points? Click share below. 👇"
  },
  hi: {
    welcome: "कृपया उस <b>{query}</b> {type} का पूरा नाम प्रदान करें जिसे आप अनुरोध कर रहे हैं। 🔍",
    ask_year: "क्या आप <b>{name}</b> की रिलीज का वर्ष जानते हैं? यदि हाँ, तो इसे टाइप करें; अन्यथा, 'NO' बटन दबाएं। 📅",
    req_sent: "✅ <b>आपका अनुरोध एडमिन को भेज दिया गया है!</b>\n\nहम जल्द ही ग्रुप में <code>{query}</code> जोड़ देंगे। 😉",
    done_msg: "✅ <b>वह फिल्म जिसे आपने अनुरोध किया था, अपलोड कर दी गई है!</b>\n\n🎬 <code>{query}</code> अब ग्रुप में उपलब्ध है। 😉",
    home_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 स्वागत है!",
    grp_welcome: "👋 <b>स्वागत है {name}!</b>\n\n🌟 <b>BLACK BULL CINEMA</b> ग्रुप में आपका स्वागत है।\n\n⚠️ कृपया समूह के नियमों का पालन करें। (कोई लिंक या इमोजी नहीं)",
    btn_no: "📅 NO",
    fb_welcome: "🎁 <b>75 फ्री पॉइंट्स पाएं!</b>\n\nहमारे फेसबुक पेज को फॉलो करें और नीचे दिए गए <b>'I Follow on FB'</b> बटन पर क्लिक करें।",
    fb_btn: "✅ I have followed",
    fb_ask_ss: "📸 <b>बहुत बढ़िया!</b>\nकृपया वह स्क्रीनशॉट भेजें जिसमें दिखाया गया है कि आपने हमारे फेसबुक पेज को फॉलो किया है।",
    fb_ask_name: "✍️ <b>अब, कृपया अपना फेसबुक प्रोफाइल नाम भेजें।</b>",
    fb_final: "✅ <b>विवरण प्राप्त हुआ!</b>\n\nहमारे एडमिन 2-3 घंटों के भीतर इसकी पुष्टि करेंगे। ❤️",
    fb_earned_already: "आपने पहले ही ये 75 अंक अर्जित कर लिए हैं! 😉",
    fb_not_verified: "❌ <b>सत्यापन विफल!</b>\n\nआपने हमारे पेज को फॉलो नहीं किया है या नाम गलत है। कृपया पुनः प्रयास करें। 👇",
    fb_try_again: "🔄 TRY AGAIN",
    fb_success: "🎉 <b>बधाई हो!</b>\n75 अंक आपके खाते में जोड़ दिए गए हैं! 👇"
  },
  es: {
    welcome: "Proporcione el nombre completo de <b>{query}</b> {type} que está solicitando. 🔍",
    ask_year: "¿Conoces el año de estreno de <b>{name}</b>? Si es así, escríbelo; de lo contrario, pulsa 'NO'. 📅",
    req_sent: "✅ <b>¡Tu solicitud ha sido enviada al administrador!</b>\n\nPronto agregaremos <code>{query}</code> al grupo. 😉",
    done_msg: "✅ <b>¡El elemento que solicitaste ha sido subido!</b>\n\n🎬 <code>{query}</code> ya está disponible. 😉",
    home_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ¡Bienvenido!",
    grp_welcome: "👋 <b>¡Bienvenido {name}!</b>\n\n🌟 Bienvenido al grupo <b>BLACK BULL CINEMA</b>.\n\n⚠️ Por favor sigue las reglas. (Sin enlaces ni emojis)",
    btn_no: "📅 NO",
    fb_welcome: "🎁 <b>¡Gana 75 puntos gratis!</b>\n\nSigue nuestra página de Facebook y haz clic en el botón <b>'I Follow on FB'</b>.",
    fb_btn: "✅ I have followed",
    fb_ask_ss: "📸 <b>¡Genial!</b>\nEnvía una captura de pantalla que demuestre que seguiste nuestra página.",
    fb_ask_name: "✍️ <b>Ahora, envía tu nombre de perfil de Facebook.</b>",
    fb_final: "✅ <b>¡Detalles recibidos!</b>\n\nNuestro administrador verificará esto pronto. ❤️",
    fb_earned_already: "¡Ya has ganado estos 75 puntos! 😉",
    fb_not_verified: "❌ <b>¡Verificación fallida!</b>\n\nNo has seguido nuestra página o el nombre es incorrecto. Inténtalo de nuevo. 👇",
    fb_try_again: "🔄 TRY AGAIN",
    fb_success: "🎉 <b>¡Felicidades!</b>\n¡Se han añadido 75 puntos a tu cuenta! 👇"
  },
  ta: {
    welcome: "நீங்கள் கோரும் <b>{query}</b> {type} இன் முழுப் பெயரை வழங்கவும். 🔍",
    ask_year: "<b>{name}</b> இன் வெளியீட்டு ஆண்டு உங்களுக்குத் தெரியுமா? ஆம் எனில், தட்டச்சு செய்யவும்; இல்லையெனில் 'NO' பொத்தானைத் தட்டவும். 📅",
    req_sent: "✅ <b>உங்கள் கோரிக்கை நிர்வாகிக்கு அனுப்பப்பட்டது!</b>\n\nவிரைவில் <code>{query}</code> ஐ குழுவில் சேர்ப்போம். 😉",
    done_msg: "✅ <b>நீங்கள் கோரியது பதிவேற்றப்பட்டது!</b>\n\n🎬 <code>{query}</code> இப்போது குழுவில் கிடைக்கிறது. 😉",
    home_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 வரவேற்கிறோம்!",
    grp_welcome: "👋 <b>வரவேற்கிறோம் {name}!</b>\n\n🌟 <b>BLACK BULL CINEMA</b> குழுவிற்கு உங்களை வரவேற்கிறோம்.\n\n⚠️ குழு விதிகளைப் பின்பற்றவும். (இணைப்புகள் அல்லது ஈமோஜிகள் இல்லை)",
    btn_no: "📅 NO",
    fb_welcome: "🎁 <b>75 இலவச புள்ளிகளைப் பெறுங்கள்!</b>\n\nஎங்கள் பேஸ்புக் பக்கத்தைப் பின்தொடர்ந்து <b>'I Follow on FB'</b> பொத்தானைக் கிளிக் செய்யவும்.",
    fb_btn: "✅ I have followed",
    fb_ask_ss: "📸 <b>சிறந்தது!</b>\nஎங்கள் பேஸ்புக் பக்கத்தைப் பின்தொடர்ந்ததைக் காட்டும் ஸ்கிரீன்ஷாட்டை அனுப்பவும்.",
    fb_ask_name: "✍️ <b>இப்போது, உங்கள் பேஸ்புக் சுயவிவரப் பெயரை அனுப்பவும்.</b>",
    fb_final: "✅ <b>விவரங்கள் பெறப்பட்டன!</b>\n\nஎங்கள் நிர்வாகி விரைவில் சரிபார்ப்பார். ❤️",
    fb_earned_already: "நீங்கள் ஏற்கனவே இந்த 75 புள்ளிகளைப் பெற்றுள்ளீர்கள்! 😉",
    fb_not_verified: "❌ <b>சரிபார்ப்பு தோல்வி!</b>\n\nநீங்கள் எங்கள் பக்கத்தைப் பின்தொடரவில்லை அல்லது பெயர் தவறானது. மீண்டும் முயற்சிக்கவும். 👇",
    fb_try_again: "🔄 TRY AGAIN",
    fb_success: "🎉 <b>வாழ்த்துகள்!</b>\nஉங்கள் கணக்கில் 75 புள்ளிகள் சேர்க்கப்பட்டுள்ளன! 👇"
  }
};

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Bot Active ✅");

    const BOT_TOKEN = env.REQ_BOT_TOKEN;
    const ADMIN_GROUP = "-1003788726228";
    const KV = env.REQ_KV;
    const LANG_KV = env.BLACK_BULL_CINEMA_LANG;
    const POINT_KV = env.BLACKBULL_REF_POINT;
    const VERIFY_CHANNEL = "-1003926419218";

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
          // This is the initial "NOT COMPLETE" button
          const parts = data.replace("req_complete_", "").split("_");
          const targetUserId = parts[0];
          const query = parts.slice(1).join("_");
          
          const newKb = {
             inline_keyboard: [
                [{ text: "📸 Do you have a post for this film?", callback_data: "ignore" }],
                [
                  { text: "✅ Yes", callback_data: `req_haspost_yes_${targetUserId}_${query}` },
                  { text: "❌ No", callback_data: `req_haspost_no_${targetUserId}_${query}` }
                ]
             ]
          };
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: newKb })
          });
          await answerCallback(TG_API, cb.id);
          return new Response("OK");
        }
        
        else if (data.startsWith("req_haspost_yes_")) {
          const parts = data.replace("req_haspost_yes_", "").split("_");
          const targetUserId = parts[0];
          const query = parts.slice(1).join("_");
          
          const newKb = {
             inline_keyboard: [
                [{ text: "⏳ Please send the image.", callback_data: "ignore" }],
                [{ text: "🚫 Cancel", callback_data: `req_cancel_${targetUserId}_${query}` }]
             ]
          };
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: newKb })
          });
          
          await KV.put("waiting_for_req_img", JSON.stringify({
            msgId: msgId,
            targetUserId: targetUserId,
            query: query
          }));
          
          await answerCallback(TG_API, cb.id);
          return new Response("OK");
        }
        
        else if (data.startsWith("req_cancel_")) {
          const parts = data.replace("req_cancel_", "").split("_");
          const targetUserId = parts[0];
          const query = parts.slice(1).join("_");
          
          const newKb = { inline_keyboard: [[{ text: "🚫 NOT COMPLETE", callback_data: `req_complete_${targetUserId}_${query}` }]] };
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: newKb })
          });
          await KV.delete(`req_img_${msgId}`); 
          
          const waitingDataStr = await KV.get("waiting_for_req_img");
          if (waitingDataStr) {
            const wData = JSON.parse(waitingDataStr);
            if (wData.msgId === msgId) await KV.delete("waiting_for_req_img");
          }
          
          await answerCallback(TG_API, cb.id);
          return new Response("OK");
        }
        
        else if (data.startsWith("req_haspost_no_") || data.startsWith("req_confirm_")) {
          const isConfirm = data.startsWith("req_confirm_");
          const prefix = isConfirm ? "req_confirm_" : "req_haspost_no_";
          const parts = data.replace(prefix, "").split("_");
          const targetUserId = parts[0];
          const query = parts.slice(1).join(" ").replace(/_/g, " ");
          
          const langCode = await getUserLang(LANG_KV, targetUserId);
          const T = LOCALES[langCode] || LOCALES.si;

          const userMsg = T.done_msg.replace("{query}", query);

          if (isConfirm) {
            const savedImg = await KV.get(`req_img_${msgId}`);
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
          } else {
            await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: targetUserId, text: userMsg, parse_mode: "HTML" })
            });
          }

          const adminName = cb.from.first_name;
          const newKb = { inline_keyboard: [[{ text: `✅ Completed by: ${adminName}`, callback_data: `req_alert_${msgId}` }]] };
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: newKb })
          });

          const alertData = {
            adminName: adminName,
            date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }),
            query: query
          };
          await KV.put(`req_alert_${msgId}`, JSON.stringify(alertData), { expirationTtl: 2592000 });

          await answerCallback(TG_API, cb.id, "✅ User Notified & Request Marked as Complete!");
        }

        else if (data.startsWith("req_alert_")) {
          const alertId = data.replace("req_alert_", "");
          const alertStr = await KV.get(`req_alert_${alertId}`);
          if (alertStr) {
             const ad = JSON.parse(alertStr);
             const alertText = `✅ Request Completed!\n\n👤 Completed by: ${ad.adminName}\n🕒 Date: ${ad.date}\n🎬 Movie: ${ad.query}`;
             await answerCallback(TG_API, cb.id, alertText, true);
          } else {
             await answerCallback(TG_API, cb.id, "✅ This request is already completed.", true);
          }
        }

        // ── Handle FB Verification Callbacks ──
        else if (data === "fb_start_verify") {
          const langCode = await getUserLang(LANG_KV, userId);
          const T = LOCALES[langCode] || LOCALES.si;
          
          await KV.put(`fb_state_${userId}`, JSON.stringify({ step: "waiting_ss", bot_msg_id: msgId }));
          await fetch(`${TG_API}/editMessageText`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, text: T.fb_ask_ss, parse_mode: "HTML" })
          });
          await answerCallback(TG_API, cb.id);
        }

        else if (data.startsWith("fb_verify_") || data.startsWith("fb_reject_")) {
          const isApprove = data.startsWith("fb_verify_");
          const targetId = data.split("_")[3];
          
          const kb = {
            inline_keyboard: [
              [{ text: `Are you sure to ${isApprove ? "VERIFY" : "REJECT"}?`, callback_data: "ignore" }],
              [
                { text: "✅ Yes", callback_data: `${isApprove ? "fb_confirm_v" : "fb_confirm_r"}_${targetId}` },
                { text: "❌ No", callback_data: `fb_cancel_v_${targetId}` }
              ]
            ]
          };
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: kb })
          });
          await answerCallback(TG_API, cb.id);
        }

        else if (data.startsWith("fb_confirm_v_")) {
          const targetId = data.split("_")[3];
          const langCode = await getUserLang(LANG_KV, targetId);
          const T = LOCALES[langCode] || LOCALES.si;

          if (POINT_KV) {
             const currentPts = parseInt(await POINT_KV.get("pts_" + targetId) || "0");
             await POINT_KV.put("pts_" + targetId, (currentPts + 75).toString());
             await POINT_KV.put(`fb_earned_${targetId}`, "true");
          }

          const successKb = {
            inline_keyboard: [
              [{ text: "🔗 Share Link", url: `https://t.me/share/url?url=https://t.me/Lucy_BLACKBULL_bot?start=ref&text=Join this movie bot!` }]
            ]
          };

          await fetch(`${TG_API}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetId, text: T.fb_success, parse_mode: "HTML", reply_markup: successKb })
          });

          const adminName = cb.from.first_name;
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [[{ text: `✅ Verified by: ${adminName}`, callback_data: `fb_alert_v_${msgId}` }]] } })
          });
          
          const alertData = { adminName: adminName, date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }), action: 'Verified' };
          await KV.put(`fb_alert_${msgId}`, JSON.stringify(alertData), { expirationTtl: 2592000 });
          await answerCallback(TG_API, cb.id, "✅ User Verified!");
        }

        else if (data.startsWith("fb_confirm_r_")) {
          const targetId = data.split("_")[3];
          const langCode = await getUserLang(LANG_KV, targetId);
          const T = LOCALES[langCode] || LOCALES.si;

          const rejectKb = { inline_keyboard: [[{ text: T.fb_try_again, callback_data: "fb_retry" }]] };
          await fetch(`${TG_API}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetId, text: T.fb_not_verified, parse_mode: "HTML", reply_markup: rejectKb })
          });

          const adminName = cb.from.first_name;
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [[{ text: `❌ Rejected by: ${adminName}`, callback_data: `fb_alert_r_${msgId}` }]] } })
          });
          
          const alertData = { adminName: adminName, date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }), action: 'Rejected' };
          await KV.put(`fb_alert_${msgId}`, JSON.stringify(alertData), { expirationTtl: 2592000 });
          await answerCallback(TG_API, cb.id, "❌ User Rejected!");
        }

        else if (data.startsWith("fb_alert_")) {
          const alertId = data.replace("fb_alert_v_", "").replace("fb_alert_r_", "");
          const alertStr = await KV.get(`fb_alert_${alertId}`);
          if (alertStr) {
             const ad = JSON.parse(alertStr);
             const alertText = `FB Verification ${ad.action}\n\n👤 Action by: ${ad.adminName}\n🕒 Date: ${ad.date}`;
             await answerCallback(TG_API, cb.id, alertText, true);
          } else {
             await answerCallback(TG_API, cb.id, "✅ Action already processed.", true);
          }
        }

        else if (data.startsWith("fb_cancel_v_")) {
          const targetId = data.split("_")[3];
          const newKb = {
            inline_keyboard: [
              [{ text: "✅ Verified", callback_data: `fb_verify_v_${targetId}` }, { text: "❌ Not Verified", callback_data: `fb_reject_r_${targetId}` }]
            ]
          };
          await fetch(`${TG_API}/editMessageReplyMarkup`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: newKb })
          });
          await answerCallback(TG_API, cb.id);
        }

        else if (data === "fb_retry") {
           const langCode = await getUserLang(LANG_KV, userId);
           const T = LOCALES[langCode] || LOCALES.si;
           const welcomeKb = { inline_keyboard: [[{ text: "🔗 Facebook Page", url: "https://www.facebook.com/share/1F4ZK23Dmp/" }], [{ text: T.fb_btn, callback_data: "fb_start_verify" }]] };
           await fetch(`${TG_API}/editMessageText`, {
             method: "POST", headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ chat_id: chatId, message_id: msgId, text: T.fb_welcome, parse_mode: "HTML", reply_markup: welcomeKb })
           });
           await answerCallback(TG_API, cb.id);
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

        if (KV && userId) {
          await KV.put(`user_${userId}`, JSON.stringify({ name: firstName, date: new Date().toISOString() }));
        }

        if (chatId.toString() === ADMIN_GROUP && msg.photo) {
          const waitingDataStr = await KV.get("waiting_for_req_img");
          if (waitingDataStr) {
            const wData = JSON.parse(waitingDataStr);
            await KV.delete("waiting_for_req_img");
            
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            await KV.put(`req_img_${wData.msgId}`, photoId);
            
            const newKb = {
               inline_keyboard: [
                  [{ text: "🖼 Image received. Confirm & Send?", callback_data: "ignore" }],
                  [
                    { text: "✅ Confirm & Send", callback_data: `req_confirm_${wData.targetUserId}_${wData.query}` },
                    { text: "🚫 Cancel", callback_data: `req_cancel_${wData.targetUserId}_${wData.query}` }
                  ]
               ]
            };
            await fetch(`${TG_API}/editMessageReplyMarkup`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: wData.msgId, reply_markup: newKb })
            });
            
            await fetch(`${TG_API}/deleteMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: msgId })
            }).catch(() => {});
            
            return new Response("OK");
          }
        }

        if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
          if (text.startsWith("/") && ctx) {
            ctx.waitUntil((async () => {
              await new Promise(r => setTimeout(r, 10000));
              await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) }).catch(() => {});
            })());
          }

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
            
            if (params === "fb_pts") {
               const hasEarned = POINT_KV ? await POINT_KV.get(`fb_earned_${userId}`) : null;
               if (hasEarned) {
                 await fetch(`${TG_API}/sendMessage`, {
                   method: "POST", headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({ chat_id: userId, text: T.fb_earned_already, parse_mode: "HTML" })
                 });
                 return new Response("OK");
               }
               const welcomeKb = { inline_keyboard: [[{ text: "🔗 Facebook Page", url: "https://www.facebook.com/share/1F4ZK23Dmp/" }], [{ text: T.fb_btn, callback_data: "fb_start_verify" }]] };
               await fetch(`${TG_API}/sendMessage`, {
                 method: "POST", headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ chat_id: userId, text: T.fb_welcome, parse_mode: "HTML", reply_markup: welcomeKb })
               });
               return new Response("OK");
            }

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

          // ── FB Step Handling ──
          let fbState = await getKV(KV, `fb_state_${userId}`);
          if (fbState) {
            if (fbState.step === "waiting_ss" && msg.photo) {
              await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, message_id: msgId }) }).catch(() => {});
              const photoId = msg.photo[msg.photo.length - 1].file_id;
              fbState.photo1 = photoId;
              fbState.step = "waiting_profile";
              
              const langCode = await getUserLang(LANG_KV, userId);
              const T = LOCALES[langCode] || LOCALES.si;
              
              await fetch(`${TG_API}/editMessageText`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: userId, message_id: fbState.bot_msg_id, text: T.fb_ask_name, parse_mode: "HTML" })
              });
              await KV.put(`fb_state_${userId}`, JSON.stringify(fbState));
              return new Response("OK");
            }

            if (fbState.step === "waiting_profile" && (text || msg.photo) && !(text || "").startsWith("/")) {
              await fetch(`${TG_API}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: userId, message_id: msgId }) }).catch(() => {});
              
              const providedName = msg.caption || text || firstName;
              const photo2 = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;

              const adminText = `🆕 <b>FB Follow Verification!</b>\n\n👤 <b>User:</b> <a href="tg://user?id=${userId}">${firstName}</a> (<code>${userId}</code>)\n✍️ <b>FB Name:</b> <code>${providedName}</code>\n<i>(Follow SS attached to this message)</i>`;
              const adminKb = {
                inline_keyboard: [
                  [{ text: "✅ Verified", callback_data: `fb_verify_v_${userId}` }, { text: "❌ Not Verified", callback_data: `fb_reject_r_${userId}` }]
                ]
              };
              
              await fetch(`${TG_API}/sendPhoto`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: VERIFY_CHANNEL, photo: fbState.photo1, caption: adminText, parse_mode: "HTML", reply_markup: adminKb })
              });

              if (photo2) {
                await fetch(`${TG_API}/sendPhoto`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: VERIFY_CHANNEL, photo: photo2, caption: `📸 <b>Profile Screenshot</b>\n👤 <b>From:</b> <code>${userId}</code>`, parse_mode: "HTML" })
                });
              }

              const langCode = await getUserLang(LANG_KV, userId);
              const T = LOCALES[langCode] || LOCALES.si;
              await fetch(`${TG_API}/editMessageText`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: userId, message_id: fbState.bot_msg_id, text: T.fb_final, parse_mode: "HTML" })
              });

              await KV.delete(`fb_state_${userId}`);
              return new Response("OK");
            }
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