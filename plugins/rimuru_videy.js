'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/videy.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["videy", "vdl", "videydownload", "videydl"],
    description: "Download video dari videy.co",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/videy.mjs", sock, chatId, message, args, query, '');
});
