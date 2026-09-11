'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/shopeedl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["shopeedl", "shopeevideo", "shopeevid"],
    description: "Download video dari Shopee",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/shopeedl.mjs", sock, chatId, message, args, query, '');
});
