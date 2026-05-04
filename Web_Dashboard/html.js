export const loginHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - BLACK BULL CINEMA</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; }
    </style>
</head>
<body>
    <div class="glass p-8 w-96 text-center">
        <h1 class="text-2xl font-bold mb-6 text-blue-400">BLACK BULL Admin</h1>
        <form id="loginForm">
            <input type="password" id="pass" placeholder="Enter Password" class="w-full p-3 rounded bg-slate-800 border border-slate-600 focus:outline-none focus:border-blue-500 mb-4 text-white">
            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded transition-colors">Login</button>
        </form>
        <p id="error" class="text-red-400 mt-4 hidden">Incorrect Password!</p>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const pass = document.getElementById('pass').value;
            window.location.href = '?pass=' + encodeURIComponent(pass);
        });
        if (window.location.search.includes('error=1')) {
            document.getElementById('error').classList.remove('hidden');
        }
    </script>
</body>
</html>
`;

export const dashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Insights & Analytics - BLACK BULL CINEMA</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { background-color: #0f172a; color: #f8fafc; font-family: 'Inter', sans-serif; }
        .glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .stat-value { font-size: 2rem; font-weight: 700; margin-top: 0.5rem; }
        .nav-header { border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    </style>
</head>
<body class="min-h-screen">

    <nav class="nav-header bg-slate-900 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">BB</div>
            <h1 class="text-xl font-bold">Insights & Analytics <span class="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full ml-2 border border-red-500/30">🔴 LIVE DATA</span></h1>
        </div>
        <button onclick="window.location.href='?logout=1'" class="text-slate-400 hover:text-white transition">Logout</button>
    </nav>

    <main class="p-6 max-w-7xl mx-auto space-y-6">
        
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div class="glass-card p-5 border-t-4 border-blue-500">
                <div class="flex items-center gap-2 text-slate-400 text-sm font-semibold uppercase tracking-wider">
                    <span>🎬 Total Movies</span>
                </div>
                <div class="stat-value text-blue-400" id="m_count">-</div>
            </div>
            
            <div class="glass-card p-5 border-t-4 border-purple-500">
                <div class="flex items-center gap-2 text-slate-400 text-sm font-semibold uppercase tracking-wider">
                    <span>📺 Total Series</span>
                </div>
                <div class="stat-value text-purple-400" id="s_count">-</div>
            </div>

            <div class="glass-card p-5 border-t-4 border-emerald-500">
                <div class="flex items-center gap-2 text-slate-400 text-sm font-semibold uppercase tracking-wider">
                    <span>🗂️ Total Files</span>
                </div>
                <div class="stat-value text-emerald-400" id="f_count">-</div>
            </div>

            <div class="glass-card p-5 border-t-4 border-amber-500">
                <div class="flex items-center gap-2 text-slate-400 text-sm font-semibold uppercase tracking-wider">
                    <span>🔍 Total Searches</span>
                </div>
                <div class="stat-value text-amber-400" id="search_count">-</div>
            </div>

            <div class="glass-card p-5 border-t-4 border-rose-500">
                <div class="flex items-center gap-2 text-slate-400 text-sm font-semibold uppercase tracking-wider">
                    <span>👤 Active Users</span>
                </div>
                <div class="stat-value text-rose-400" id="u_count">-</div>
            </div>
        </div>

        <!-- Main Content Area -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Chart Section -->
            <div class="glass-card p-6 lg:col-span-2">
                <h2 class="text-lg font-semibold mb-4">Traffic Overview (Searches)</h2>
                <div class="relative h-72 w-full">
                    <canvas id="trafficChart"></canvas>
                </div>
            </div>

            <!-- Top Missing Searches -->
            <div class="glass-card p-6">
                <h2 class="text-lg font-semibold mb-4 text-rose-400 flex items-center gap-2">
                    <span>⚠️ Top Missing Searches</span>
                </h2>
                <div class="space-y-3 max-h-72 overflow-y-auto pr-2" id="missingList">
                    <div class="text-slate-400 text-sm text-center py-4">Loading data...</div>
                </div>
            </div>
            
        </div>

        <!-- Referrals and Watchlists -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <!-- Top Referrers -->
            <div class="glass-card p-6">
                <h2 class="text-lg font-semibold mb-4 text-emerald-400 flex items-center gap-2">
                    <span>👑 Top Referrers (Points)</span>
                </h2>
                <div class="space-y-3 max-h-72 overflow-y-auto pr-2" id="referrersList">
                    <div class="text-slate-400 text-sm text-center py-4">Loading data...</div>
                </div>
            </div>

            <!-- Top Watchlisted Movies -->
            <div class="glass-card p-6">
                <h2 class="text-lg font-semibold mb-4 text-purple-400 flex items-center gap-2">
                    <span>❤️ Most Watchlisted</span>
                </h2>
                <div class="space-y-3 max-h-72 overflow-y-auto pr-2" id="watchlistsList">
                    <div class="text-slate-400 text-sm text-center py-4">Loading data...</div>
                </div>
            </div>
            
        </div>
        
    </main>

    <script>
        const pass = new URLSearchParams(window.location.search).get('pass');
        
        async function loadData() {
            try {
                const res = await fetch('/admin/api/stats?pass=' + pass);
                if (!res.ok) throw new Error("Unauthorized");
                const data = await res.json();
                
                document.getElementById('m_count').innerText = data.movies;
                document.getElementById('s_count').innerText = data.series;
                document.getElementById('f_count').innerText = data.files;
                document.getElementById('search_count').innerText = data.totalSearches;
                document.getElementById('u_count').innerText = data.users;

                // Render Missing Searches
                const missingHtml = data.missing.length > 0 
                    ? data.missing.map(m => \`
                        <div class="flex justify-between items-center bg-slate-800/50 p-3 rounded">
                            <span class="font-medium">\${m.query}</span>
                            <span class="text-xs bg-slate-700 px-2 py-1 rounded-full">\${m.count} reqs</span>
                        </div>
                    \`).join('')
                    : '<div class="text-slate-400 text-sm">No missing searches yet!</div>';
                document.getElementById('missingList').innerHTML = missingHtml;

                // Render Top Referrers
                const referrersHtml = data.topReferrers && data.topReferrers.length > 0
                    ? data.topReferrers.map((r, index) => \`
                        <div class="flex justify-between items-center bg-slate-800/50 p-3 rounded border-l-4 \${index === 0 ? 'border-yellow-500' : index === 1 ? 'border-gray-300' : index === 2 ? 'border-amber-600' : 'border-slate-600'}">
                            <div>
                                <span class="font-bold text-white">\${index + 1}. User ID: \${r.user}</span>
                                <div class="text-xs text-slate-400">\${r.referrals} Referrals</div>
                            </div>
                            <span class="text-sm bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">\${r.points} pts</span>
                        </div>
                    \`).join('')
                    : '<div class="text-slate-400 text-sm text-center">No referrers found yet.</div>';
                document.getElementById('referrersList').innerHTML = referrersHtml;

                // Render Top Watchlisted
                const watchlistsHtml = data.topWatchlists && data.topWatchlists.length > 0
                    ? data.topWatchlists.map((w, index) => \`
                        <div class="flex justify-between items-center bg-slate-800/50 p-3 rounded">
                            <div class="truncate max-w-[70%]">
                                <span class="font-medium text-white">\${index + 1}. \${w.title}</span>
                            </div>
                            <span class="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">❤️ \${w.count} users</span>
                        </div>
                    \`).join('')
                    : '<div class="text-slate-400 text-sm text-center">No watchlists found yet.</div>';
                document.getElementById('watchlistsList').innerHTML = watchlistsHtml;

                // Render Chart
                const ctx = document.getElementById('trafficChart').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.chartData.labels,
                        datasets: [{
                            label: 'Searches per day',
                            data: data.chartData.values,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                        }
                    }
                });

            } catch (e) {
                console.error(e);
                alert("Failed to load data.");
            }
        }

        loadData();
    </script>
</body>
</html>
`;
