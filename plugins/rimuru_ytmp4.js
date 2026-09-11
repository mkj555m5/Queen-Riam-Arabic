'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/ytmp4.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["ytmp4", "youtubemp4", "ytvideo"],
    description: "Download video YouTube",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/ytmp4.mjs", sock, chatId, message, args, query, '');
});
