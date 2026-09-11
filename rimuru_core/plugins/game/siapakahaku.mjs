export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { games } from '../../src/lib/rimuru-games.mjs'

games.register('siapakahaku', {
    alias: ['siapa', 'whoami'],
    emoji: '🎭',
    title: 'من أنا؟',
    description: 'خمّن من الوصف'
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('siapakahaku')
export { pluginConfig as config, handler, answerHandler }
