'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/akinator.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["akinator", "aki", "akistop"],
    description: "akinator",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/akinator.mjs", sock, chatId, message, args, query, '');
});
