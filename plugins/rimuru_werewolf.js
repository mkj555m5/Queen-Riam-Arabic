'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/werewolf.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["werewolf", "ww", "wwgc"],
    description: "العب لعبة المستذئب مع لاعبين آخرين",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/werewolf.mjs", sock, chatId, message, args, query, '');
});
