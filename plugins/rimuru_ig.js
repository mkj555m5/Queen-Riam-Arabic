'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/ig.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["igdl"],
    description: "igdl",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/ig.mjs", sock, chatId, message, args, query, '');
});
