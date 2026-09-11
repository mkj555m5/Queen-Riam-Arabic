'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/kyubigame.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["kyubigame", "kyubi", "naruto", "shinobi"],
    description: "استكشف عالم الشينوبي وواجه أقوى أعداء النينجا",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/kyubigame.mjs", sock, chatId, message, args, query, '');
});
