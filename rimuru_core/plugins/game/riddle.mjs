export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { games } from '../../src/lib/rimuru-games.mjs'

games.register('riddle', {
    alias: ['rd', 'tebaktebak', 'riddles'],
    emoji: '❓',
    title: 'RIDDLE',
    description: 'ألغاز وأسئلة تخمين'
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('riddle')
export { pluginConfig as config, handler, answerHandler }
