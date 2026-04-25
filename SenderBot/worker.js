/**
 * Cloudflare Worker - SENDER BOT + UPLOADER COMBINED
 * v 0.0.26 - Hybrid Black Bull Sender & Queue Worker
 * manual edit
 */

export default {
  async fetch(request, env, ctx) {
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

        // --- UI CALLBACKS IMPORTED FROM MANAGER ---
        if (data === "lang_menu") {
          const kb = {
            inline_keyboard: [
              [{ text: "🇱🇰 Sinhala (Default)", callback_data: "setlang_si" }],
              [{ text: "🇬🇧 English", callback_data: "setlang_en" }, { text: "🇮🇳 Hindi", callback_data: "setlang_hi" }],
              [{ text: "🇪🇸 Spanish", callback_data: "setlang_es" }, { text: "🇮🇳 Tamil", callback_data: "setlang_ta" }]
            ]
          };
          await fetch(`${TG_API}/editMessageCaption`, {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, caption: "🌐 <b>Select your preferred language:</b>", parse_mode: "HTML", reply_markup: kb })
          });

          const autoDelete = async () => {
            await new Promise(r => setTimeout(r, 10000));
            await deleteMessage(TG_API, chatId, msgId);
          };
          if (typeof ctx !== "undefined" && ctx.waitUntil) ctx.waitUntil(autoDelete());

          return new Response("OK");
        }

        if (data.startsWith("setlang_")) {
          const langCode = data.split("_")[1];
          if (env.BLACK_BULL_CINEMA_LANG) {
            if (langCode === "si") await env.BLACK_BULL_CINEMA_LANG.delete(`lang_${userId}`);
            else await env.BLACK_BULL_CINEMA_LANG.put(`lang_${userId}`, langCode);
          }
          
          let alertMsg = "✅ Language Updated!";
          if (langCode === "si") alertMsg = "✅ ඔබේ භාශාව සිංහල ලෙස වෙනස් විය!";
          else if (langCode === "en") alertMsg = "✅ Your language was changed to English!";
          else if (langCode === "hi") alertMsg = "✅ आपकी भाषा बदल दी गई है!";
          else if (langCode === "es") alertMsg = "✅ ¡Tu idioma ha sido cambiado!";
          else if (langCode === "ta") alertMsg = "✅ உங்கள் மொழி மாற்றப்பட்டுள்ளது!";

          await fetch(`${TG_API}/answerCallbackQuery`, {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ callback_query_id: cb.id, text: alertMsg, show_alert: true })
          });
          
          await deleteMessage(TG_API, chatId, msgId);
          return new Response("OK");
        }

        if (data.startsWith("view_")) {
          await answerCallback(TG_API, cb.id);
          
          const payloadStr = data.substring(5);
          const splitIndex = payloadStr.indexOf("|");
          let movieId = payloadStr;
          let originalQuery = "";
          if (splitIndex !== -1) {
            movieId = payloadStr.substring(0, splitIndex);
            originalQuery = payloadStr.substring(splitIndex + 1);
          }
          
          const kv = env.BLACK_BULL_CINEMA;
          if (!kv) throw new Error("Database KV not bound to Sender Bot!");
          let searchKey = null;
          if (env.BLACK_BULL_CINEMA_FILEID) searchKey = await env.BLACK_BULL_CINEMA_FILEID.get(`idx_${movieId}`);
          if (!searchKey) searchKey = await kv.get(`idx_${movieId}`);
          if (searchKey) {
            const existingStr = await kv.get(searchKey);
            if (existingStr) {
              const movieData = JSON.parse(existingStr);
              await sendMovieReplyForSender(TG_API, BOT_TOKEN, chatId, cb.message.reply_to_message?.message_id || msgId, movieData, env, msgId, originalQuery);
            }
          }
          return new Response("OK");
        }

        if (data.startsWith("search_")) {
          await answerCallback(TG_API, cb.id);
          const kv = env.BLACK_BULL_CINEMA;
          if (!kv) throw new Error("Database KV not bound to Sender Bot!");
          const query = data.substring(7);
          const results = await searchMovieInKV(query, kv);
          if (results && results.length > 0) {
            const userFirstName = cb.message.chat.first_name || "User";
            await sendSearchResults(TG_API, BOT_TOKEN, chatId, userId, cb.message.reply_to_message?.message_id || msgId, query, results, "all", env, msgId, userFirstName);
          }
          return new Response("OK");
        }

        if (data.startsWith("filter_")) {
          await answerCallback(TG_API, cb.id);
          const kv = env.BLACK_BULL_CINEMA;
          if (!kv) throw new Error("Database KV not bound to Sender Bot!");
          const parts = data.split("_");
          const fType = parts[1];
          const query = parts.slice(2).join("_");
          const results = await searchMovieInKV(query, kv);
          if (results && results.length > 0) {
            const userFirstName = cb.message.chat.first_name || "User";
            await sendSearchResults(TG_API, BOT_TOKEN, chatId, userId, cb.message.reply_to_message?.message_id || msgId, query, results, fType, env, msgId, userFirstName);
          }
          return new Response("OK");
        }

        if (data.startsWith("req_")) {
          const query = data.substring(4);
          const reqText = `සොරි අනේ, 🥺 මේක නම් මගේ ඩේටාබේස් එකේ හොයාගන්න නෑ.\nසමහරවිට නමේ පොඩි අකුරක් එහෙ මෙහෙ වෙලාද දන්නෑ. 🤔\nපුළුවන්නම් ආයෙත් සැරයක් නම හරිද කියලා බලන්නකෝ 🙏\n\nනම හරියටම මතක නැත්නම්, මතක විදිහට Google එකේ සර්ච් කරලා බලන්න. 🕵️ ගොඩක් දුරට හරි නම එතනින් හොයාගන්න පුළුවන් ✨\n\nඇඩ්මින්ලට request එකක් යවන්න ඕනෙද? 😉 හරිම ලේසියි.! මෙන්න මෙහෙම කරන්න 👇\n\n👉 මුලින්ම පහළ තියෙන බටන් එක ඔබලා, ඔයාට ඕනේ Movie එකක්ද Series එකක්ද කියලා තෝරන්න. 🎬\n👉 ඊට පස්සේ එන bot ගේ 'Start' බටන් එකත් ඔබන්න. එච්චරයි.! 😉`;
          const kb = { inline_keyboard: [[{ text: "💝 Send Request 💝", callback_data: `reqask_${query}` }]] };
          
          await fetch(`${TG_API}/editMessageCaption`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, caption: reqText, reply_markup: kb })
          });
          return new Response("OK");
        }

        if (data.startsWith("reqask_")) {
          const query = data.substring(7);
          const askText = `හරි දැන් ඔයා ඕනි ෆිල්ම් එකක්ද ටීවී සිරීස් එකක්ද කියලා තෝරන්නකෝ.. 🤔`;
          const reqBotUser = env.REQ_BOT_USERNAME || "YOUR_REQ_BOT_USERNAME"; 
          
          const safeParam = query.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
          
          const kb = { 
            inline_keyboard: [[
              { text: "ෆිල්ම් එකක්", url: `https://t.me/${reqBotUser}?start=m_${safeParam}` },
              { text: "සිරීස් එකක්", url: `https://t.me/${reqBotUser}?start=s_${safeParam}` }
            ]] 
          };
          
          await fetch(`${TG_API}/editMessageCaption`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId, caption: askText, reply_markup: kb })
          });
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
            new_name: state.newName || state.origName || null,
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
            new_name: state.newName || state.origName || null, // FIX APPLIED HERE
            thumb_file_id: thumbId, 
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

          await DB.put(THUMB_KEY, fileId);

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
          let origName = null; // FIX APPLIED HERE

          if (msg.video) {
            fileId = msg.video.file_id;
            origName = msg.video.file_name; // Extracting the original name
          }
          else if (msg.document) {
            fileId = msg.document.file_id;
            origName = msg.document.file_name; // Extracting the original name
          }
          else if (msg.photo && !combined.includes("/setthumb")) {
            fileId = msg.photo[msg.photo.length - 1].file_id;
          }

          const urlMatch = combined.match(/https?:\/\/[^\s]+/);
          const dlUrl = urlMatch ? urlMatch[0] : null;

          if (fileId || dlUrl) {
            if (origName) {
              origName = origName.replace(/\.[^/.]+$/, ""); // Remove extension logic
            }
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
            await DB.put(STATE_KEY(chatId), JSON.stringify({ fileId, origName, sourceMsgId: msg.message_id, url: dlUrl, lastBotMsg: (await res.json()).result?.message_id, newName: null, waiting: null }));
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
    hello: "👋 හෙලෝ {name},\n\nබලන්න ඔයා හොයන '<b>{query}</b>' මෙතන තියනවද කියලා.. 👇\n\n📌 <i>ඔයා හොයන්නේ සීරීස් එකක් නම් 'Series' කියන බට්න් එක ඔබලා ඔයාට ඕනි සීරීස් එක තෝරන්න.</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ ඔයා හොයන '<b>{query}</b>' අපේ පද්ධතියේ නෑ.\n\nපහළ බට්න් එක ඔබලා Admin ට Request එකක් දාන්න. 👇",
    not_found_cat: "🚫 No results found for this category.",
    not_here: "මේ list එකේ නෑනේ🥲",
    change_lang: "🌐 Change Language",
    req_sent: "✅ ඔයාගේ Request එක Admin ට යැව්වා. ඉක්මනින්ම එකතු කරන්නම්!",
    req_btn: "මේ list එකේ නෑනේ🥲 (Request Movie)",
    force_sub: "❌ <b>ඔයා අපේ Main Channels දෙකටම Join වෙලා නෑ!</b>\n\nපහළ තියෙන Channels දෙකටම Join වෙලා ඇවිත් ආපහු '✅ I have Joined' කියන එක ඔබන්න.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ආයුබෝවන්! සාදරයෙන් පිළිගන්න.\nඔයාට අවශ්‍ය මූවීස් සහ සීරීස් පහසුවෙන් ලබා ගැනීමට අපගේ චැනල් එකේ ඇති ලින්ක් එකක් ක්ලික් කර මෙතැනට පැමිණෙන්න.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group"
  },
  en: {
    hello: "👋 Hello {name},\n\nCheck if the movie '<b>{query}</b>' you are looking for is here.. 👇\n\n📌 <i>If you are looking for a series, tap the 'Series' button to filter.</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ The movie '<b>{query}</b>' is not in our system.\n\nTap the button below to request it from the Admin. 👇",
    not_found_cat: "🚫 No results found for this category.",
    not_here: "😮 Not Here",
    change_lang: "🌐 Change Language",
    req_sent: "✅ Your request has been sent to the Admin! We will add it soon.",
    req_btn: "😮 Request Movie",
    force_sub: "❌ <b>You haven't joined our Main Channels!</b>\n\nPlease join the 2 channels below and click '✅ I have Joined'.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 Hello! Welcome.\nTo easily get your desired movies and series, click a link in our channel to come here.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group"
  },
  hi: {
    hello: "👋 नमस्ते {name},\n\nजांचें कि आप जिस फिल्म '<b>{query}</b>' की तलाश कर रहे हैं वह यहां है या नहीं.. 👇\n\n📌 <i>यदि आप कोई श्रृंखला ढूंढ रहे हैं, तो 'Series' बटन पर टैप करें।</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ फिल्म '<b>{query}</b>' हमारे सिस्टम में नहीं है।\n\nएडमिन से अनुरोध करने के लिए नीचे दिए गए बटन पर टैप करें। 👇",
    not_found_cat: "🚫 इस श्रेणी के लिए कोई परिणाम नहीं मिला।",
    not_here: "😮 यहाँ नहीं है",
    change_lang: "🌐 Change Language",
    req_sent: "✅ आपका अनुरोध एडमिन को भेज दिया गया है! हम इसे जल्द ही जोड़ देंगे।",
    req_btn: "😮 Request Movie",
    force_sub: "❌ <b>आप हमारे मुख्य चैनल में शामिल नहीं हुए हैं!</b>\n\nकृपया नीचे दिए गए 2 चैनलों से जुड़ें और '✅ I have Joined' पर क्लिक करें।",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 नमस्ते! स्वागत है।\nअपनी मनपसंद फिल्में और सीरीज आसानी से पाने के लिए हमारे चैनल में दिए गए लिंक पर क्लिक करके यहां आएं।\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group"
  },
  es: {
    hello: "👋 Hola {name},\n\nComprueba si la película '<b>{query}</b>' que buscas está aquí.. 👇\n\n📌 <i>Si buscas una serie, toca el botón 'Series'.</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ La película '<b>{query}</b>' no está en nuestro sistema.\n\nToca el botón de abajo para pedirla al administrador. 👇",
    not_found_cat: "🚫 No se encontraron resultados para esta categoría.",
    not_here: "😮 No está aquí",
    change_lang: "🌐 Change Language",
    req_sent: "✅ ¡Tu solicitud ha sido enviada al Administrador! La agregaremos pronto.",
    req_btn: "😮 Request Movie",
    force_sub: "❌ <b>¡No te has unido a nuestros canales principales!</b>\n\nÚnete a los 2 canales a continuación y haz clic en '✅ I have Joined'.",
    joined_btn: "✅ I have Joined",
    welcome_msg: "🌟 <b>BLACK BULL CINEMA</b> 🌟\n\n👋 ¡Hola! Bienvenido.\nPara obtener fácilmente tus películas y series, haz clic en un enlace de nuestro canal para venir aquí.\n\n🛡️ <b>Safe & Fast Delivery</b>",
    ch_btn: "📢 Official Channel",
    gp_btn: "💬 Main Group"
  },
  ta: {
    hello: "👋 வணக்கம் {name},\n\nநீங்கள் தேடும் '<b>{query}</b>' திரைப்படம் இங்கே உள்ளதா என்று பார்க்கவும்.. 👇\n\n📌 <i>நீங்கள் ஒரு தொடரை தேடுகிறீர்கள் என்றால், 'Series' பொத்தானை அழுத்தவும்.</i>",
    movies: "🎬 Movies",
    series: "📺 Series",
    not_found: "❌ '<b>{query}</b>' திரைப்படம் எங்கள் கணினியில் இல்லை.\n\nநிர்வாகியிடம் கோர கீழேயுள்ள பொத்தானை அழுத்தவும். 👇",
    not_found_cat: "🚫 இந்த வகைக்கு முடிவுகள் எதுவும் கிடைக்கவில்லை.",
    not_here: "😮 இங்கே இல்லை",
    change_lang: "🌐 Change Language",
    req_sent: "✅ உங்கள் கோரிக்கை நிர்வாகிக்கு அனுப்பப்பட்டது! விரைவில் சேர்ப்போம்.",
    req_btn: "😮 Request Movie",
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

  const link1 = "https://t.me/BLACKBULLCINEMAUPDATES";
  const link2 = "https://t.me/BLACKBULLCINEMA";

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

async function searchMovieInKV(query, kv) {
  if (query.length < 2) return [];
  if (!kv) return [];
  const searchKey = query.toLowerCase();
  const list = await kv.list({ prefix: searchKey });
  const results = [];
  for (const keyObj of list.keys) {
    if (keyObj.name.startsWith("admin_") || keyObj.name.startsWith("config_") || keyObj.name.startsWith("idx_")) continue;
    const dataString = await kv.get(keyObj.name);
    if (dataString) {
      try { results.push(JSON.parse(dataString)); } catch (e) {}
    }
  }
  return results;
}

async function sendSearchResults(api, botToken, chatId, userId, replyToMsgId, query, results, filterType, env, editMsgId = null, firstName = "User") {
  const langCode = await getUserLang(userId, env);
  const T = LANGS[langCode] || LANGS.si;

  let filtered = results;
  if (filterType === "movies") filtered = results.filter(r => !r.is_series);
  if (filterType === "series") filtered = results.filter(r => r.is_series);

  const defaultImages = [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1000", 
    "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1000",
    "https://images.unsplash.com/photo-1585647347384-2593bc35786b?q=80&w=1000"
  ];
  const randomImg = defaultImages[Math.floor(Math.random() * defaultImages.length)];
  let text = T.hello ? T.hello.replace("{name}", firstName).replace("{query}", query) : `👋 Hello ${firstName},\n\nSee if '${query}' is available here.. 👇`;

  const keyboard = [];
  keyboard.push([
    { text: filterType === "movies" ? `✅ ${T.movies}` : T.movies, callback_data: `filter_movies_${query}` },
    { text: filterType === "series" ? `✅ ${T.series}` : T.series, callback_data: `filter_series_${query}` }
  ]);
  // List Buttons
  for (const r of filtered) {
    const safeQuery = query.substring(0, 30);
    keyboard.push([{ text: `🎬 ${r.title} (${r.year})`, callback_data: `view_${r.id}|${safeQuery}` }]);
  }
  if (filtered.length === 0) keyboard.push([{ text: T.not_found_cat, callback_data: "none" }]);
  keyboard.push([{ text: T.not_here, callback_data: `req_${query.substring(0,40)}` }]);
  keyboard.push([{ text: T.change_lang, callback_data: "lang_menu" }]);

  const payload = { chat_id: chatId, reply_markup: { inline_keyboard: keyboard } };
  let tgApiUrl = `${api}/sendPhoto`;
  if (editMsgId) {
    tgApiUrl = `${api}/editMessageMedia`;
    payload.message_id = editMsgId;
    payload.media = { type: "photo", media: randomImg, caption: text, parse_mode: "HTML" };
  } else {
    payload.photo = randomImg;
    payload.caption = text;
    payload.parse_mode = "HTML";
    if (replyToMsgId) payload.reply_to_message_id = replyToMsgId;
  }

  const res = await fetch(tgApiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description);
}

async function sendMovieReplyForSender(api, botToken, chatId, replyToMsgId, movieData, env, editMsgId = null, originalQuery = null) {
  const text = `🎬 <b>${movieData.is_series ? 'Series' : 'Movie'} Found!</b>\n\n📌 <b>Title:</b> ${movieData.title}\n📅 <b>Year:</b> ${movieData.year}\n⭐ <b>Rating:</b> ${movieData.rating}\n\n<i>Select quality to download below:</i>`;

  let baseUrl = "https://idsmovieplanet.ishangadineth.online";
  if (env && env.BLACK_BULL_CINEMA) {
    const customUrl = await env.BLACK_BULL_CINEMA.get("config_gateway_url");
    if (customUrl) baseUrl = customUrl;
  }
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

  const botUser = await (async () => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await res.json();
      if (data.ok && data.result) return data.result.username;
    } catch(e){}
    return "UnknownBot";
  })();

  const keyboard = [];
  if (movieData.qualities && Array.isArray(movieData.qualities)) {
    for (let i = 0; i < movieData.qualities.length; i += 2) {
      const row = [];
      const q1 = movieData.qualities[i];
      row.push({ text: `📥 ${q1.name}`, url: `${baseUrl}/?id=${q1.q}&bot=${botUser}` });
      if (i + 1 < movieData.qualities.length) {
        const q2 = movieData.qualities[i + 1];
        row.push({ text: `📥 ${q2.name}`, url: `${baseUrl}/?id=${q2.q}&bot=${botUser}` });
      }
      keyboard.push(row);
    }
  } else {
    keyboard.push([{ text: "📥 Click Here to Download", url: `${baseUrl}/?bot=${botUser}` }]);
  }

  if (originalQuery) {
    keyboard.push([{ text: "⬅️ Back to Search", callback_data: `search_${originalQuery}` }]);
  }

  const defaultImages = ["https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1000", "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1000", "https://images.unsplash.com/photo-1585647347384-2593bc35786b?q=80&w=1000"];
  const randomImg = defaultImages[Math.floor(Math.random() * defaultImages.length)];
  const movieThumb = movieData.thumb || randomImg;

  const payload = { chat_id: chatId, reply_markup: { inline_keyboard: keyboard } };
  let tgApiUrl = `${api}/sendPhoto`;
  if (editMsgId) {
    tgApiUrl = `${api}/editMessageMedia`;
    payload.message_id = editMsgId;
    payload.media = { type: "photo", media: movieThumb, caption: text, parse_mode: "HTML" };
  } else {
    payload.photo = movieThumb;
    payload.caption = text;
    payload.parse_mode = "HTML";
    if (replyToMsgId) payload.reply_to_message_id = replyToMsgId;
  }

  const res = await fetch(tgApiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description);
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