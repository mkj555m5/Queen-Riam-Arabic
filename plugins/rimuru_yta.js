'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/yta.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["ytmp3", "mp4", "a", "v"],
    description: "ytmp3",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/yta.mjs", sock, chatId, message, args, query, '');
});
