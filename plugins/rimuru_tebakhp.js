'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/tebakhp.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tebakhp", "thp", "merekhp", "brandhp"],
    description: "خمّن ماركة الهاتف من وصف ملامحها المميزة أو طرازها",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/tebakhp.mjs", sock, chatId, message, args, query, '');
});
