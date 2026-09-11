'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/pindl2.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["pindl2"],
    description: "pindl2",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/pindl2.mjs", sock, chatId, message, args, query, '');
});
