'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/download/spotifydl.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["spotifydl", "spdl", "spotify-dl", "spotdl"],
    description: "Unduh lagu favoritmu langsung dari Spotify tanpa ribet!",
    category: 'download',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/download/spotifydl.mjs", sock, chatId, message, args, query, '');
});
