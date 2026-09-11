export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { games } from '../../src/lib/rimuru-games.mjs'

games.register('tebakepep', {
    alias: ['tebakff', 'tebakfreefire'],
    emoji: '🔫',
    title: 'خمّن فري فاير',
    description: 'خمّن شخصية من لعبة فري فاير',
    hasImage: true
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('tebakepep')
export { pluginConfig as config, handler, answerHandler }
