export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { nightActionHandler } from './werewolf.mjs'
import te from '../../src/lib/rimuru-error.mjs'
const pluginConfig = {
    name: 'wwkill',
    alias: ['wolfkill', 'wk'],
    category: 'game',
    description: 'حركة المستذئب ليلاً - اقتل الهدف',
    usage: '.wwkill <nomor>',
    example: '.wwkill 2',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: true,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        return await nightActionHandler(m, { sock })
    } catch (error) {
        console.error('[WWKILL ERROR]', error)
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
