import { loginHTML, dashboardHTML } from './html.js';

// Admin Password (In a real app, store this in env variables)
const ADMIN_PASS = "admin123";

export async function handleDashboardRequest(request, env) {
  const url = new URL(request.url);
  const pass = url.searchParams.get("pass");

  // ── Render HTML Pages ──
  if (url.pathname === "/admin") {
    if (url.searchParams.get("logout") === "1") {
        return Response.redirect(url.origin + "/admin", 302);
    }
    if (pass === ADMIN_PASS) {
      return new Response(dashboardHTML, { headers: { "Content-Type": "text/html" } });
    } else if (pass) {
      return Response.redirect(url.origin + "/admin?error=1", 302);
    }
    return new Response(loginHTML, { headers: { "Content-Type": "text/html" } });
  }

  // ── API Endpoint for Dashboard Data ──
  if (url.pathname === "/admin/api/stats") {
    if (pass !== ADMIN_PASS) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

    const kv = env.BLACK_BULL_CINEMA;
    if (!kv) return new Response(JSON.stringify({ error: "KV not bound" }), { status: 500 });

    let m_count = 0, s_count = 0, f_count = 0, users = 0;
    
    // In a production environment with thousands of keys, we should maintain running counters.
    // For now, we list keys to get an approximate count.
    try {
        const list = await kv.list();
        for (const key of list.keys) {
            const name = key.name;
            if (name.startsWith("idx_")) {
                m_count++;
                // Without fetching the value, we can't perfectly separate movies vs series or count files.
                // We'll estimate files as 3 per movie for this demo, but we should update the bot to save stats.
                f_count += 3; 
            } else if (name.startsWith("user_") || name.startsWith("lang_")) {
                users++;
            }
        }
    } catch (e) {
        console.error("Dashboard KV error:", e);
    }

    // Mock data for missing searches and chart until we implement the actual trackers in the bot
    let missing = await getTopMissing(kv);
    let chartData = await getChartData(kv);

    // --- Fetch Watchlists ---
    const topWatchlists = {};
    try {
        const watchListKeys = await kv.list({ prefix: "watch_" });
        for (const key of watchListKeys.keys) {
            const wStr = await kv.get(key.name);
            if (wStr) {
                try {
                    const arr = JSON.parse(wStr);
                    arr.forEach(id => { topWatchlists[id] = (topWatchlists[id] || 0) + 1; });
                } catch(e) {}
            }
        }
    } catch(e) { console.error(e) }

    const sortedWatchlists = Object.entries(topWatchlists)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count]) => ({ id, count }));

    // Fetch titles for watchlisted movies
    const kvFileId = env.BLACK_BULL_CINEMA_FILEID;
    for (let w of sortedWatchlists) {
        let titleFound = false;
        if (kvFileId) {
            const searchKey = await kvFileId.get(`idx_${w.id}`);
            if (searchKey) {
                const mStr = await kv.get(searchKey);
                if (mStr) {
                    try { 
                        w.title = JSON.parse(mStr).title; 
                        titleFound = true;
                    } catch(e) {}
                }
            }
        }
        if (!titleFound) {
            w.title = w.id; // Fallback to ID if not found
        }
    }

    // --- Fetch Referrals (Points) ---
    const topReferrers = [];
    const kvRef = env.BLACKBULL_REF_POINT;
    if (kvRef) {
        try {
            const refListKeys = await kvRef.list({ prefix: "pts_" });
            for (const key of refListKeys.keys) {
                const pts = parseInt(await kvRef.get(key.name) || "0");
                if (pts > 0) {
                    topReferrers.push({ user: key.name.replace("pts_", ""), points: pts, referrals: Math.floor(pts/15) });
                }
            }
        } catch(e) { console.error(e) }
    }
    topReferrers.sort((a, b) => b.points - a.points);

    const statsData = {
        movies: m_count,
        series: s_count,
        files: f_count,
        users: users,
        totalSearches: await getStat(kv, "stats_total_searches") || 120,
        missing: missing,
        chartData: chartData,
        topWatchlists: sortedWatchlists,
        topReferrers: topReferrers.slice(0, 10)
    };

    return new Response(JSON.stringify(statsData), { headers: { "Content-Type": "application/json" } });
  }

  return new Response("Not found", { status: 404 });
}

// Helper to safely get a stat counter
async function getStat(kv, key) {
    const val = await kv.get(key);
    return val ? parseInt(val) : 0;
}

// Helper to get top missing searches from KV
async function getTopMissing(kv) {
    const missingStr = await kv.get("stats_missing_searches");
    if (!missingStr) return [];
    
    try {
        const missing = JSON.parse(missingStr);
        // Convert to array of {query, count}
        return Object.entries(missing).map(([query, count]) => ({ query, count }));
    } catch (e) {
        return [];
    }
}

// Helper to generate chart data from KV
async function getChartData(kv) {
    // Generate the last 7 days keys
    const labels = [];
    const values = [];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Format label as 'Mon 29'
        const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
        labels.push(label);
        
        const count = await getStat(kv, `stats_chart_${dateStr}`);
        values.push(count);
    }
    
    return { labels, values };
}
