'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/tekateki.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tekateki", "teka"],
    description: "لعبة ألغاز تقليدية",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/tekateki.mjs", sock, chatId, message, args, query, '');
});
