export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { games } from '../../src/lib/rimuru-games.mjs'

games.register('tebakkata', {
    alias: ['tk', 'guessword'],
    emoji: '📝',
    title: 'خمّن الكلمة',
    description: 'خمّن الكلمة من التلميح'
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('tebakkata')
export { pluginConfig as config, handler, answerHandler }
