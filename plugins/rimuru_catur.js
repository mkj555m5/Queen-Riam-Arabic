'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/catur.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["catur", "chess"],
    description: "Inline Chess game",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/catur.mjs", sock, chatId, message, args, query, '');
});
