'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/kuis.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["kuis"],
    description: "kuis",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/kuis.mjs", sock, chatId, message, args, query, '');
});
