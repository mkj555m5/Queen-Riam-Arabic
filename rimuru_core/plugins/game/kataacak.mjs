export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { games } from '../../src/lib/rimuru-games.mjs'

games.register('kataacak', {
    alias: ['ka', 'acakkata'],
    emoji: '🔤',
    title: 'كلمة عشوائية',
    description: 'رتّب الحروف العشوائية'
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('kataacak')
export { pluginConfig as config, handler, answerHandler }
