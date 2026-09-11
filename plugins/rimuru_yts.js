'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/yts.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["yts", "youtubesearch"],
    description: "yts",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/yts.mjs", sock, chatId, message, args, query, '');
});
