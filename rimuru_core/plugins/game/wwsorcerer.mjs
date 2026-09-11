export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { nightActionHandler } from './werewolf.mjs'
const pluginConfig = {
    name: 'wwsorcerer',
    alias: ['sorcerer', 'wws'],
    category: 'game',
    description: 'حركة الساحر ليلاً - تحقق إن كان الهدف عرافاً',
    usage: '.wwsorcerer <nomor>',
    example: '.wwsorcerer 3',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: true,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    return await nightActionHandler(m, { sock })
}

export { pluginConfig as config, handler }
