'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/cerdascermat.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["cerdascermat", "cc"],
    description: "cerdascermat",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/cerdascermat.mjs", sock, chatId, message, args, query, '');
});
