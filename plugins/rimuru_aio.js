'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/aio.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["aio", "allinone", "download", "dl"],
    description: "All in one downloader (IG, TikTok, FB, Twitter, YouTube, Pinterest, CapCut, dll)",
    category: 'downloader',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/aio.mjs", sock, chatId, message, args, query, '');
});
