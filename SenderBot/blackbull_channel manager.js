export default {
  async fetch(request, env, ctx) {
    // Only accept POST requests from Telegram
    if (request.method !== "POST") {
      return new Response("OK");
    }

    try {
      const update = await request.json();

      // We are looking for channel_post updates
      if (update.channel_post) {
        const post = update.channel_post;
        const sourceChannelId = String(post.chat.id);

        // Check if the post is from the target channel: -1003947907936 (@BLACKBULLCINEMAUPDATES)
        if (sourceChannelId === "-1003947907936") {
          // List of groups to forward to. Can be set in Environment Variables as a comma-separated string.
          // Example: "-100123456789,-100987654321"
          const targetGroupsStr = env.TARGET_GROUPS || "-1003838706115"; 
          const targetGroups = targetGroupsStr.split(",");

          const botToken = env.BOT_TOKEN; // Use BOT_TOKEN from environment

          for (const groupId of targetGroups) {
            const cleanGroupId = groupId.trim();
            if (!cleanGroupId) continue;

            // Use copyMessage to forward the post without the "Forwarded from" header
            await fetch(`https://api.telegram.org/bot${botToken}/copyMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cleanGroupId,
                from_chat_id: sourceChannelId,
                message_id: post.message_id
              })
            }).catch(e => console.error(`Forward error to ${cleanGroupId}:`, e));
          }
        }
      }

      return new Response("OK");
    } catch (err) {
      console.error("Worker error:", err);
      // Always return 200 OK to Telegram to avoid retries on error
      return new Response("OK");
    }
  }
};
