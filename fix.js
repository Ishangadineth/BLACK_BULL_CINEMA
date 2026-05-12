const fs = require('fs');

function processFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');

    // Replace lucy.jpg with sofia.jpg
    code = code.replace(/https:\/\/i\.ibb\.co\/pvntBK3s\/lucy\.jpg/g, 'https://i.ibb.co/t0y016p/sofia.jpg');

    // Fix buttons to English
    const keysToReplace = {
        'req_btn': '"😮 Request Movie"',
        'gp_btn': '"💬 Main Group"',
        'req_film_btn': '"🎬 A Movie"',
        'req_series_btn': '"📺 A Series"',
        'req_send_btn': '"💝 Send Request 💝"',
        'back_btn': '"🔙 Back"',
        'dl_btn': '"📥 Download"',
        'back_qual': '"🔙 Back to Qualities"'
    };

    for (const [key, value] of Object.entries(keysToReplace)) {
        const regex = new RegExp(`${key}:\\s*".*?"`, 'g');
        code = code.replace(regex, `${key}: ${value}`);
    }

    fs.writeFileSync(filePath, code);
}

processFile('worker.js');
processFile('SenderBot/worker.js');
