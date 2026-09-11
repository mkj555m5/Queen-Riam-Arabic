'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/tiktok.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tt", "tiktok"],
    description: "tt",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/tiktok.mjs", sock, chatId, message, args, query, '');
});
