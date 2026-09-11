'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/tebakjkt48.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tebakjkt48", "jkt48", "jkt"],
    description: "خمّن عضوة فرقة JKT48",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/tebakjkt48.mjs", sock, chatId, message, args, query, '');
});
