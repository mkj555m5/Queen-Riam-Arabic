'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/checkerszerotwo.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["checkers", "dam", "caturdam", "zerocheckers"],
    description: "لعبة الضامة مع ريمورو! التهم كل قطع الخصم للفوز.",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/checkerszerotwo.mjs", sock, chatId, message, args, query, '');
});
