'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/tebakgambar.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tebakgambar", "guessimage"],
    description: "خمّن الكلمة من الصورة",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/tebakgambar.mjs", sock, chatId, message, args, query, '');
});
