'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/tebakprovinsi.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["tebakprovinsi", "tprovinsi", "tebakprov", "provinsi"],
    description: "خمّن اسم المقاطعة من عاصمتها",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/tebakprovinsi.mjs", sock, chatId, message, args, query, '');
});
