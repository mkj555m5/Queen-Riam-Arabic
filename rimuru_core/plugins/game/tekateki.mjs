export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { games } from '../../src/lib/rimuru-games.mjs'

games.register('tekateki', {
    alias: ['teka'],
    emoji: '🧩',
    title: 'ألغاز',
    description: 'لعبة ألغاز تقليدية'
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('tekateki')
export { pluginConfig as config, handler, answerHandler }
