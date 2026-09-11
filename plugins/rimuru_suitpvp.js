'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/suitpvp.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["suitpvp", "suit", "rps", "janken"],
    description: "العب حجر-مقص-ورقة مع لاعب آخر",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/suitpvp.mjs", sock, chatId, message, args, query, '');
});
