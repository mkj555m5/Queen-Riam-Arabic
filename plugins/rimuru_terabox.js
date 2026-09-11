'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/terabox.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["terabox", "tb", "tera", "teraboxdl", "tbdl"],
    description: "Download video/file dari TeraBox",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/terabox.mjs", sock, chatId, message, args, query, '');
});
