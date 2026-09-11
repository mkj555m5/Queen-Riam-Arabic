'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/igaudio.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["igaudio", "igmp3"],
    description: "igaudio <url>",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/igaudio.mjs", sock, chatId, message, args, query, '');
});
