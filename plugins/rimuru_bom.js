'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/bom.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["bomb"],
    description: "bomb",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/bom.mjs", sock, chatId, message, args, query, '');
});
