'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/twitter.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["twitter", "tw", "xdl"],
    description: "twitter",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/twitter.mjs", sock, chatId, message, args, query, '');
});
