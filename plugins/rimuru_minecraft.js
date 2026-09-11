'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/minecraft.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["mct", "minecraft"],
    description: "Minecraft - Mining & Crafting Game",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/minecraft.mjs", sock, chatId, message, args, query, '');
});
