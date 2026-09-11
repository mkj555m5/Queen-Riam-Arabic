'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/pindl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["pindl", "pinterestdl", "pindownload", "pintdl"],
    description: "Download gambar/video dari Pinterest",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/pindl.mjs", sock, chatId, message, args, query, '');
});
