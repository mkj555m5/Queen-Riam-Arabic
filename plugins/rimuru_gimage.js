'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/downloads/gimage.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["gimage", "googleimage", "image"],
    description: "Mencari dan mendownload gambar dari Google",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/downloads/gimage.mjs", sock, chatId, message, args, query, '');
});
