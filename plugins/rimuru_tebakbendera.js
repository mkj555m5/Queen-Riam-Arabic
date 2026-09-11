'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/tebakbendera.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tebakbendera", "tbendera", "flag"],
    description: "خمّن الدولة من العلم",
    category: 'games',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/tebakbendera.mjs", sock, chatId, message, args, query, '');
});
