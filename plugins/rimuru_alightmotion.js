'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/alightmotion.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["alightmotiondl", "alightmotion", "amdl"],
    description: "Download project/preset Alight Motion",
    category: 'downloader',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/alightmotion.mjs", sock, chatId, message, args, query, '');
});
