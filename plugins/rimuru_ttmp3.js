'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/ttmp3.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["ttmp3", "ttmusic", "tiktokmusic"],
    description: "Download audio TikTok",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/ttmp3.mjs", sock, chatId, message, args, query, '');
});
