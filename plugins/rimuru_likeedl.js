'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/likeedl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["likeedl", "lkdl", "likee", "lk"],
    description: "Download video Likee",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/likeedl.mjs", sock, chatId, message, args, query, '');
});
