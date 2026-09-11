'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/threaddl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["threaddl", "tdl", "threads", "threadsdl"],
    description: "Download foto dan video dari postingan Threads tanpa repot!",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/threaddl.mjs", sock, chatId, message, args, query, '');
});
