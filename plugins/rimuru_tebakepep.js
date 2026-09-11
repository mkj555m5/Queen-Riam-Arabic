'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/tebakepep.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tebakepep", "tebakff", "tebakfreefire"],
    description: "خمّن شخصية من لعبة فري فاير",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/tebakepep.mjs", sock, chatId, message, args, query, '');
});
