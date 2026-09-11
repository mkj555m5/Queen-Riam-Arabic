'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/wwsorcerer.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["wwsorcerer", "sorcerer", "wws"],
    description: "حركة الساحر ليلاً - تحقق إن كان الهدف عرافاً",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/wwsorcerer.mjs", sock, chatId, message, args, query, '');
});
