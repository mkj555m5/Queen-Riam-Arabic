export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { nightActionHandler } from './werewolf.mjs'
import te from '../../src/lib/rimuru-error.mjs'
const pluginConfig = {
    name: 'wwsee',
    alias: ['seer', 'vision', 'wse'],
    category: 'game',
    description: 'حركة العرّاف ليلاً - اطّلع على دور الهدف',
    usage: '.wwsee <nomor>',
    example: '.wwsee 1',
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
        console.error('[WWSEE ERROR]', error)
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
