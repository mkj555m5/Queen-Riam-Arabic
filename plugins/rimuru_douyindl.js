'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/douyindl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["douyindl", "douyin", "dydl"],
    description: "Download video/audio dari Douyin (TikTok China)",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/douyindl.mjs", sock, chatId, message, args, query, '');
});
