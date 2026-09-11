'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/cocofundl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["cocofundl", "cfdl", "cocofun", "cf"],
    description: "Download video CocoFun",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/cocofundl.mjs", sock, chatId, message, args, query, '');
});
