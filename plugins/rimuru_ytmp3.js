'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/ytmp3.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["ytmp3", "youtubemp3", "ytaudio"],
    description: "Download audio YouTube",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/ytmp3.mjs", sock, chatId, message, args, query, '');
});
