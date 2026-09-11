export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { games } from '../../src/lib/rimuru-games.mjs'

games.register('tebakjkt48', {
    alias: ['jkt48', 'jkt'],
    emoji: '🎀',
    title: 'خمّن عضوة JKT48',
    description: 'خمّن عضوة فرقة JKT48',
    hasImage: true
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('tebakjkt48')
export { pluginConfig as config, handler, answerHandler }
