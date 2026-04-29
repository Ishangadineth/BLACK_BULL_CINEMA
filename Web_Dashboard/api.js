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
    const statsData = {
        movies: m_count,
        series: s_count, // We will update the main bot to track this specifically later
        files: f_count,
        users: users,
        totalSearches: await getStat(kv, "stats_total_searches") || 120, // Default to 120 if empty
        missing: await getTopMissing(kv),
        chartData: await getChartData(kv)
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

// Helper to get top missing searches (Mocked for now, will connect to real KV data next)
async function getTopMissing(kv) {
    // TODO: Read from actual missing searches KV
    return [
        { query: "Deadpool 3", count: 45 },
        { query: "Avatar 3", count: 21 },
        { query: "Spider-Man 4", count: 18 }
    ];
}

// Helper to generate chart data (Mocked for now, will connect to real KV data next)
async function getChartData(kv) {
    // TODO: Read from actual daily views KV
    return {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        values: [120, 190, 300, 250, 280, 400, 350]
    };
}
