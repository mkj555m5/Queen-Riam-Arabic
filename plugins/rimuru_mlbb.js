'use strict';
// ★ بلوجن منقول تلقائياً من Rimuru MD v4.6 (النسخة العربية) — المالك: ShowyWharf27322
// المصدر: rimuru_core/"plugins/game/mlbb.mjs"
const { runPlugin } = require('../lib/rimuru-bridge');
const { bot } = require('../lib/pluginLoader');

bot({
    command: ["mlbb", "mlbbcounter", "mlsynergy", "mltier", "mlmatchup"],
    description: "معلومات MLBB: توصيات الكاونتر، تآزر الأبطال، توقعات المباريات وقائمة التصنيفات",
    category: 'game',
}, async (sock, chatId, message, args, query) => {
    await runPlugin("plugins/game/mlbb.mjs", sock, chatId, message, args, query, '');
});
