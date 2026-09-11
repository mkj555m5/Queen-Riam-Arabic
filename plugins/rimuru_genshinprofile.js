'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/genshinprofile.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["genshinprofile"],
    description: "genshinprofile",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/genshinprofile.mjs", sock, chatId, message, args, query, '');
});
