'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/aio2.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["aio2"],
    description: "aio2 <url>",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/aio2.mjs", sock, chatId, message, args, query, '');
});
