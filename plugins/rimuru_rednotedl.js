'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/rednotedl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["rednotedl", "rednote", "xhsdl", "xiaohongshu"],
    description: "Download video/foto dari RedNote (XiaoHongShu)",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/rednotedl.mjs", sock, chatId, message, args, query, '');
});
