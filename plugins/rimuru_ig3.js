'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/ig3.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["ig3", "igdl3", "instagram3"],
    description: "instagram3",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/ig3.mjs", sock, chatId, message, args, query, '');
});
