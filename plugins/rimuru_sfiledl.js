'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/sfiledl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["sfiledl", "sfile", "sfiledownload"],
    description: "Download file dari Sfile.mobi",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/sfiledl.mjs", sock, chatId, message, args, query, '');
});
