'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/blibili.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["bili", "blibli", "bilibili"],
    description: "bilibili <url>",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/blibili.mjs", sock, chatId, message, args, query, '');
});
