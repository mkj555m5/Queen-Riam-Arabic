'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/family100.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["family100", "f100", "survei"],
    description: "استطلاع الرأي! خمّن الإجابات الأكثر شعبية",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/family100.mjs", sock, chatId, message, args, query, '');
});
