'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/war.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["war"],
    description: "war",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/war.mjs", sock, chatId, message, args, query, '');
});
