/**
 * Cloudflare Worker - SENDER BOT + UPLOADER COMBINED
 * v 0.0.1 - Hybrid Black Bull Sender & Queue Worker
 */

export default {
  async fetch(request, env) {
    const BOT_TOKEN = env.BOT_TOKEN;
    const GITHUB_REPO = env.GITHUB_REPO;
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const DB_CHANNEL = env.DATABASE_CHANNEL_ID || "-1003759058179"; // Default fallback
    const ADMIN_ID = 8512163462;

    if (!BOT_TOKEN) {
      return new Response("⚠️ Missing BOT_TOKEN in CF Dashboard.", { status: 500 });
    }

    const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
    const DB = env.THUMB_KV || { get: async () => null, put: async () => { }, delete: async () => { } };
    
    // Create a unique prefix for this bot based on its Token
    const botId = BOT_TOKEN.split(":")[0];
    const Q_RUNNING = `queue_running_${botId}`;
    const Q_TASKS = `queue_tasks_${botId}`;
    const STATE_KEY = (id) => `state_${botId}_${id}`;
    const THUMB_KEY = `global_thumb_${botId}`;

    if (request.method !== "POST") return new Response("Worker2 Combined Sender/Uploader Active ✅");

    try {
      const payload = await request.json();

      // ── Queue Trigger from GitHub Actions ──
      if (payload.action === "task_complete") {
        await DB.put(Q_RUNNING, "");
        await processQueue(DB, TG_API, GITHUB_REPO, GITHUB_TOKEN, Q_RUNNING, Q_TASKS);
        return new Response("Queue Advanced");
      }

      // ══════════════ CALLBACK QUERIES ══════════════
      if (payload.callback_query) {
        const cb = payload.callback_query;
        const data = cb.data;
        const chatId = cb.message.chat.id;
        const userId = cb.from.id;
        const msgId = cb.message.message_id;
        const isPrivate = cb.message.chat.type === "private";

        // CHECK SUB CALLBACK ADDED HERE
        if (data.startsWith("check_sub_")) {
          const payloadStr = data.substring(10);
          const isSubbed = await checkForceSub(BOT_TOKEN, userId);
          
          if (isSubbed) {
            // Delete the force join message
            await deleteMessage(TG_API, chatId, msgId);
            
            // Re-trigger the start command logic
            const kvFiles = env.BLACK_BULL_CINEMA_FILEID;
            if (kvFiles) {
              const filesStr = await kvFiles.get(payloadStr);
              if (filesStr) {
                try {
                  const files = JSON.parse(filesStr);
                  const fileArray = Array.isArray(files) ? files : [files];
                  for (let i = 0; i < fileArray.length; i++) {
                    const file = fileArray[i];
                    await sendMovieFile(TG_API, chatId, file.id, file.type, file.caption || "", DB_CHANNEL);
                  }
                } catch (e) {
                  await tgSend(TG_API, chatId, "❌ <b>System Error while parsing files.</b>", []);
                }
              } else {
                await tgSend(TG_API, chatId, "❌ <b>Movie files not found!</b>\nThe files may have been removed or the ID is incorrect.", []);
              }
            }
          } else {
            await answerCallback(TG_API, cb.id, "❌ You must join both channels first!");
          }
          return new Response("OK");
        }

        if (userId !== ADMIN_ID || !isPrivate) {
          await answerCallback(TG_API, cb.id, "⚠️ Access Denied! Admin Only (Private).");
          return new Response("OK");
        }

        const state = JSON.parse(await DB.get(STATE_KEY(chatId)) || "{}");

        await answerCallback(TG_API, cb.id);

        if (data === "home") {
          await editMessage(TG_API, chatId, msgId, getHomeText(), getHomeButtons());
        }

        else if (data === "rename_start") {
          await editMessage(TG_API, chatId, msgId,
            "<b>📝 Enter New Filename:</b>\n(Without extension)",
            [[{ text: "⬅️ Back", callback_data: "home" }]]
          );
          await DB.put(STATE_KEY(chatId), JSON.stringify({ ...state, waiting: "name", lastBotMsg: msgId }));
        }

        else if (data === "thumb_start") {
          await editMessage(TG_API, chatId, msgId,
            "<b>🖼 Select Output Format:</b>\n(Using saved Custom Thumbnail)",
            [[
              { text: "🎥 Video + Thumb", callback_data: "type_c2v_thumb" },
              { text: "📁 Document + Thumb", callback_data: "type_c2d_thumb" }
            ]]
          );
        }

        else if (data === "convert_start") {
          const isLink = !!(state.url && !state.fileId);
          if (isLink) {
            await editMessage(TG_API, chatId, msgId,
              "<b>📥 Download Format:</b>",
              [[{ text: "🎥 Video MP4", callback_data: "dl_video" }]]
            );
          } else {
            await editMessage(TG_API, chatId, msgId,
              "<b>⚡ Convert Format:</b>",
              [[
                { text: "🎥 Video", callback_data: "type_c2v" },
                { text: "📁 Document", callback_data: "type_c2d" }
              ]]
            );
          }
        }

        // Link download
        else if (data === "dl_video") {
          if (!GITHUB_REPO || !GITHUB_TOKEN) return new Response("Missing Github Env");
          await enqueueTask(DB, {
            mode: "download",
            url: state.url,
            chat_id: chatId.toString(),
            target_file_id: null,
            new_name: state.newName || null,
            thumb_file_id: null,
            bot_token: BOT_TOKEN
          }, chatId, request.url.split("?")[0], TG_API, GITHUB_REPO, GITHUB_TOKEN, Q_RUNNING, Q_TASKS);
        }

        // Convert Modes (c2v / c2d)
        else if (data.startsWith("type_")) {
          if (!GITHUB_REPO || !GITHUB_TOKEN) return new Response("Missing Github Env");
          const isDoc = data.includes("c2d");
          const useThumb = data.includes("thumb");
          const mode = isDoc ? "c2d" : "c2v";

          let thumbId = null;
          if (useThumb) {
            thumbId = await DB.get(THUMB_KEY);
          }

          await editMessage(TG_API, chatId, msgId,
            `🚀 <b>Task Dispatched to GitHub!</b>\nMode: <code>${mode.toUpperCase()}</code> | Thumb: <code>${useThumb ? "Custom ✅" : "Original"}</code>`,
            []
          );

          await enqueueTask(DB, {
            mode,
            url: state.url || null,
            chat_id: chatId.toString(),
            target_file_id: state.fileId,
            source_msg_id: state.sourceMsgId || null,
            new_name: state.newName || null,
            thumb_file_id: thumbId, // Real Telegram File ID
            bot_token: BOT_TOKEN
          }, chatId, request.url.split("?")[0], TG_API, GITHUB_REPO, GITHUB_TOKEN, Q_RUNNING, Q_TASKS);
        }

        // Delete Thumb
        else if (data === "del_thumb") {
          await DB.delete(THUMB_KEY);
          await editMessage(TG_API, chatId, msgId,
            "🗑 <b>Thumbnail Deleted successfully!</b>",
            [[{ text: "🏠 Home", callback_data: "home" }]]
          );
        }

        // View Thumb
        else if (data === "view_thumb") {
          const savedThumbId = await DB.get(THUMB_KEY);
          if (savedThumbId) {
            await fetch(`${TG_API}/sendPhoto`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId, photo: savedThumbId,
                caption: "🖼 <b>Current Custom Thumbnail</b>", parse_mode: "HTML",
                reply_markup: { inline_keyboard: [[{ text: "🗑 Delete", callback_data: "del_thumb" }]] }
              })
            });
            await deleteMessage(TG_API, chatId, msgId);
          } else {
            await editMessage(TG_API, chatId, msgId, "❌ <b>No custom thumbnail is set.</b>\nUse /setthumb to add one.", [[{ text: "🏠 Home", callback_data: "home" }]]);
          }
        }

        return new Response("OK");
      }

      // ══════════════ TEXT & MEDIA MESSAGES ══════════════
      if (payload.message) {
        const msg = payload.message;
        const chatId = msg.chat.id;
        const userId = msg.from?.id;
        const chatType = msg.chat.type;
        const isPrivate = chatType === "private";
        const isAdmin = userId === ADMIN_ID;

        const text = msg.text || "";
        const caption = msg.caption || "";
        const combined = `${text} ${caption}`.trim();

        const state = JSON.parse(await DB.get(STATE_KEY(chatId)) || "{}");

        // ── Waiting: thumbnail photo ──
        if (state.waiting === "thumb_set" && msg.photo) {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          await deleteMessage(TG_API, chatId, msg.message_id);
          if (state.lastBotMsg) await deleteMessage(TG_API, chatId, state.lastBotMsg);

          // Save Telegram File ID directly to KV for instant access!
          await DB.put(THUMB_KEY, fileId);

          // Upload to GitHub as backup
          if (GITHUB_REPO && GITHUB_TOKEN) {
            try {
              const fInfo = await (await fetch(`${TG_API}/getFile?file_id=${fileId}`)).json();
              const imgResp = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fInfo.result.file_path}`);
              const bytes = new Uint8Array(await imgResp.arrayBuffer());
              let binary = ""; for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
              const b64 = btoa(binary);

              const getRef = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/thumb.jpg`, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "User-Agent": "CF" } });
              let sha = null; if (getRef.ok) sha = (await getRef.json()).sha;

              await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/thumb.jpg`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json", "User-Agent": "CF" },
                body: JSON.stringify({ message: "Update thumb", content: b64, sha })
              });
            } catch (e) { console.error("GH Backup Error:", e) }
          }

          await tgSend(TG_API, chatId, "✅ <b>Thumbnail saved successfully!</b>", [[{ text: "🏠 Home", callback_data: "home" }]]);
          await DB.put(STATE_KEY(chatId), JSON.stringify({ ...state, waiting: null }));
          return new Response("OK");
        }

        // ── Waiting: new name ──
        if (state.waiting === "name" && text && !text.startsWith("/")) {
          await deleteMessage(TG_API, chatId, msg.message_id);
          if (state.lastBotMsg) await deleteMessage(TG_API, chatId, state.lastBotMsg);

          const res = await fetch(`${TG_API}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId, parse_mode: "HTML",
              text: `✅ <b>New Name Set:</b> <code>${text}</code>\n\nSelect a format to proceed:`,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🎥 Video", callback_data: "type_c2v" }, { text: "📁 Document", callback_data: "type_c2d" }],
                  [{ text: "🎥 Video + Thumb", callback_data: "type_c2v_thumb" }, { text: "📁 Doc + Thumb", callback_data: "type_c2d_thumb" }]
                ]
              }
            })
          });
          const newMsgId = (await res.json()).result?.message_id;
          await DB.put(STATE_KEY(chatId), JSON.stringify({ ...state, newName: text, waiting: null, lastBotMsg: newMsgId }));
          return new Response("OK");
        }

        // ── Commands ──
        if (text.startsWith("/start")) {
          const payloadCmd = text.split(" ")[1];
          if (payloadCmd) {
            // === BLACK BULL CINEMA SENDER KV LOGIC ===
            
            // FORCE SUB CHECK
            const isSubbed = await checkForceSub(BOT_TOKEN, userId);
            if (!isSubbed) {
               await sendForceSubMessage(TG_API, BOT_TOKEN, chatId, userId, payloadCmd, env);
               return new Response("OK");
            }

            const kvFiles = env.BLACK_BULL_CINEMA_FILEID;
            if (!kvFiles) {
              await tgSend(TG_API, chatId, "❌ KV Namespace (BLACK_BULL_CINEMA_FILEID) not bound!", []);
              return new Response("OK");
            }

            const filesStr = await kvFiles.get(payloadCmd);

            if (filesStr) {
              try {
                const files = JSON.parse(filesStr);
                const fileArray = Array.isArray(files) ? files : [files];
                for (let i = 0; i < fileArray.length; i++) {
                  const file = fileArray[i];
                  await sendMovieFile(TG_API, chatId, file.id, file.type, file.caption || "", DB_CHANNEL);
                }
              } catch (e) {
                console.error("Parse error:", e);
                await tgSend(TG_API, chatId, "❌ <b>System Error while parsing files.</b>", []);
              }
            } else {
              await tgSend(TG_API, chatId, "❌ <b>Movie files not found!</b>\nThe files may have been removed or the ID is incorrect.", []);
            }
          } else {
            // Normal start without parameters
            if (isAdmin && isPrivate) {
              await tgSend(TG_API, chatId, getHomeText(), getHomeButtons());
            } else if (isPrivate) {
              await sendWelcomeMessage(TG_API, BOT_TOKEN, chatId, userId, env);
            }
          }
        }
        else if (text === "/qq" && isAdmin && isPrivate) {
          let queue = JSON.parse(await DB.get(Q_TASKS) || "[]");
          let running = await DB.get(Q_RUNNING);
          let msgStr = `📊 <b>Queue Status:</b>\n\n`;
          if (running) {
             msgStr += `▶️ <b>1 task currently processing</b>\n`;
          } else {
             msgStr += `⏸ <b>Idle</b>\n`;
          }
          msgStr += `⏳ <b>${queue.length} tasks waiting</b>`;
          await tgSend(TG_API, chatId, msgStr, []);
        }
        else if (text === "/setthumb" && isAdmin && isPrivate) {
          const res = await fetch(`${TG_API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, parse_mode: "HTML", text: "📸 <b>Please send me the Thumbnail image.</b>" }) });
          await DB.put(STATE_KEY(chatId), JSON.stringify({ ...state, waiting: "thumb_set", lastBotMsg: (await res.json()).result?.message_id }));
        }
        else if (text === "/viewthumb" && isAdmin && isPrivate) {
          const savedThumbId = await DB.get(THUMB_KEY);
          if (savedThumbId) {
            const r = await fetch(`${TG_API}/sendPhoto`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, photo: savedThumbId, caption: "🖼 <b>Current Custom Thumbnail</b>", parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🗑 Delete", callback_data: "del_thumb" }]] } }) });
            if (!r.ok) await tgSend(TG_API, chatId, "❌ <b>Thumbnail error!</b>", []);
          } else {
            await tgSend(TG_API, chatId, "❌ <b>No custom thumbnail is set!</b>\nUse /setthumb to add one.", []);
          }
        }
        // ── File / Link handler ──
        else if (isAdmin && isPrivate) {
          let fileId = null;
          if (msg.video) fileId = msg.video.file_id;
          else if (msg.document) fileId = msg.document.file_id;
          else if (msg.photo && !combined.includes("/setthumb")) fileId = msg.photo[msg.photo.length - 1].file_id;

          const urlMatch = combined.match(/https?:\/\/[^\s]+/);
          const dlUrl = urlMatch ? urlMatch[0] : null;

          if (fileId || dlUrl) {
            const isLink = !!(dlUrl && !fileId);
            const res = await fetch(`${TG_API}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId, parse_mode: "HTML", text: "<b>⚙️ Advanced File Options:</b>", reply_to_message_id: msg.message_id,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "✏️ Rename", callback_data: "rename_start" }, { text: "🖼 Custom Thumb", callback_data: "thumb_start" }],
                    [{ text: isLink ? "📥 Download Only" : "⚡ Convert Only", callback_data: "convert_start" }],
                    [{ text: "❌ Cancel", callback_data: "home" }]
                  ]
                }
              })
            });
            await DB.put(STATE_KEY(chatId), JSON.stringify({ fileId, sourceMsgId: msg.message_id, url: dlUrl, lastBotMsg: (await res.json()).result?.message_id, newName: null, waiting: null }));
          }
        } else if (isPrivate && !isAdmin) {
          // If a non-admin sends anything else (e.g. sticker, text) in private chat
          await sendWelcomeMessage(TG_API, BOT_TOKEN, chatId, userId, env);
        }
      }
    } catch (err) { console.error("Worker error:", err.message, err.stack); }
    return new Response("OK");
  }
};

const LANGS = {
  si: {
    force_sub: "❌ <b>ඔයා අපේ Main Channels දෙකටම Join වෙලා නෑ!</b>\n\nපහළ තියෙන Channels දෙකටම Join වෙලා ඇවිත් ආපහු '✅ I have Joined' කියන එක ඔබන්න.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ආයුබෝවන්! සාදරයෙන් පිළිගන්න.\nඔයාට අවශ්‍ය මූවීස් සහ සීරීස් පහසුවෙන් ලබා ගැනීමට අපගේ චැනල් එකේ ඇති ලින්ක් එකක් ක්ලික් කර මෙතැනට පැමිණෙන්න.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group"
  },
  en: {
    force_sub: "❌ <b>You haven't joined our Main Channels!</b>\n\nPlease join the 2 channels below and click '✅ I have Joined'.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 Hello! Welcome.\nTo easily get your desired movies and series, click a link in our channel to come here.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group"
  },
  hi: {
    force_sub: "❌ <b>आप हमारे मुख्य चैनल में शामिल नहीं हुए हैं!</b>\n\nकृपया नीचे दिए गए 2 चैनलों से जुड़ें और '✅ I have Joined' पर क्लिक करें।",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 नमस्ते! स्वागत है।\nअपनी मनपसंद फिल्में और सीरीज आसानी से पाने के लिए हमारे चैनल में दिए गए लिंक पर क्लिक करके यहां आएं。\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group"
  },
  es: {
    force_sub: "❌ <b>¡No te has unido a nuestros canales principales!</b>\n\nÚnete a los 2 canales a continuación y haz clic en '✅ I have Joined'.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ¡Hola! Bienvenido.\nPara obtener fácilmente tus películas y series, haz clic en un enlace de nuestro canal para venir aquí.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group"
  },
  ta: {
    force_sub: "❌ <b>எங்கள் முக்கிய சேனல்களில் நீங்கள் சேரவில்லை!</b>\n\nகீழே உள்ள 2 சேனல்களில் சேர்ந்து '✅ I have Joined' என்பதைக் கிளிக் செய்யவும்.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 வணக்கம்! வரவேற்கிறோம்.\nஉங்களுக்குத் தேவையான திரைப்படங்கள் மற்றும் தொடர்களை எளிதாகப் பெற, எங்கள் சேனலில் உள்ள இணைப்பைக் கிளிக் செய்து இங்கே வரவும்.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group"
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

async function sendForceSubMessage(api, botToken, chatId, userId, payloadStr, env) {
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

  await fetch(`${api}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: T.force_sub, parse_mode: "HTML", reply_markup: kb })
  });
}

async function sendWelcomeMessage(api, botToken, chatId, userId, env) {
  const langCode = await getUserLang(userId, env);
  const T = LANGS[langCode] || LANGS.si;

  const chLink = await getChannelLink(botToken, "-1003999803362", env.BLACK_BULL_CINEMA_LANG);
  const gpLink = await getChannelLink(botToken, "-1003838706115", env.BLACK_BULL_CINEMA_LANG);

  const kb = {
    inline_keyboard: [
      [{ text: T.ch_btn, url: chLink }],
      [{ text: T.gp_btn, url: gpLink }]
    ]
  };

  await fetch(`${api}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: T.welcome_msg, parse_mode: "HTML", reply_markup: kb })
  });
}


async function sendMovieFile(api, chatId, fileId, type = "video", caption = "", dbChannel) {
  let method = "sendDocument";
  let requestPayload = { chat_id: chatId, caption: caption, parse_mode: "HTML" };

  if (type === "channel_msg" || !isNaN(fileId)) {
    // It's a Message ID from the Database Channel
    method = "copyMessage";
    requestPayload = {
      chat_id: chatId,
      from_chat_id: dbChannel,
      message_id: parseInt(fileId),
      caption: caption,
      parse_mode: "HTML"
    };
  } else {
    // Fallback for old file_ids
    const typeToMethod = { "video": "sendVideo", "document": "sendDocument", "audio": "sendAudio", "photo": "sendPhoto", "file": "sendDocument" };
    method = typeToMethod[type] || "sendDocument";
    requestPayload[type === "file" ? "document" : type] = fileId;
  }

  const response = await fetch(`${api}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload)
  });
  
  if (!response.ok) {
    const data = await response.json();
    await fetch(`${api}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `❌ <b>Failed to send file.</b>\nError: <code>${data.description}</code>`, parse_mode: "HTML" })
    });
  }
}

async function dispatchGitHub(repo, token, clientPayload) {
  return fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Cloudflare" },
    body: JSON.stringify({ event_type: "start_download", client_payload: clientPayload })
  });
}
async function editMessage(api, chatId, msgId, text, buttons) {
  return fetch(`${api}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: msgId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } }) });
}
async function deleteMessage(api, chatId, msgId) {
  if (!msgId) return;
  return fetch(`${api}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) });
}
async function tgSend(api, chatId, text, buttons) {
  return fetch(`${api}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } }) });
}
async function answerCallback(api, callbackId, text = null) {
  const body = { callback_query_id: callbackId };
  if (text) body.text = text;
  return fetch(`${api}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function getHomeText() { return "<b>💎 IDS Movie Planet Advanced Bot</b>\n\n📥 Link send කරන්න → Download\n🎬 File send කරන්න → Convert\n🖼 /setthumb → Set custom thumbnail\n👁 /viewthumb → View current thumbnail\n📊 /qq → View Queue Status"; }
function getHomeButtons() { return [[{ text: "🖼 View My Thumbnail", callback_data: "view_thumb" }]]; }

// ══════════════ QUEUE LOGIC ══════════════
async function enqueueTask(DB, taskPayload, chatId, requestUrl, TG_API, GITHUB_REPO, GITHUB_TOKEN, Q_RUNNING, Q_TASKS) {
  let queue = JSON.parse(await DB.get(Q_TASKS) || "[]");
  queue.push({ task: taskPayload, worker_url: requestUrl, chat_id: chatId, repo: GITHUB_REPO, token: GITHUB_TOKEN });
  await DB.put(Q_TASKS, JSON.stringify(queue));
  
  await processQueue(DB, TG_API, GITHUB_REPO, GITHUB_TOKEN, Q_RUNNING, Q_TASKS);
}

async function processQueue(DB, TG_API, defaultRepo, defaultToken, Q_RUNNING, Q_TASKS) {
  let running = await DB.get(Q_RUNNING);
  if (running) {
    if (Date.now() - parseInt(running) > 6 * 60 * 60 * 1000) { // 6 hours timeout (GitHub max)
      running = null;
    } else {
      return; // Still running
    }
  }

  let queue = JSON.parse(await DB.get(Q_TASKS) || "[]");
  if (queue.length === 0) {
    await DB.put(Q_RUNNING, "");
    return;
  }

  let nextItem = queue.shift();
  await DB.put(Q_TASKS, JSON.stringify(queue));
  await DB.put(Q_RUNNING, Date.now().toString());

  // Notify user
  await tgSend(TG_API, nextItem.chat_id, "🚀 <b>Your task is now processing!</b>", []);

  // Ensure worker_url is passed to payload
  nextItem.task.worker_url = nextItem.worker_url;
  
  const repo = nextItem.repo || defaultRepo;
  const token = nextItem.token || defaultToken;
  await dispatchGitHub(repo, token, nextItem.task);
}
