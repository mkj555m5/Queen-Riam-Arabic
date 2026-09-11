'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/mediafire.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["mediafire", "mf"],
    description: "mediafire",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/mediafire.mjs", sock, chatId, message, args, query, '');
});
