'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/downloader/mcpedldl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["mcpedldl", "dlmcpedl", "mcpedldownload", "mcdl"],
    description: "Mengunduh file atau mengambil detail dari MCPEDL",
    category: 'downloader',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/downloader/mcpedldl.mjs", sock, chatId, message, args, query, '');
});
