import axios from 'axios';
export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import config from '../../config.mjs';
const pluginConfig = {
    name: 'tebakanime',
    alias: ['tebaknime', 'guessanime'],
    category: 'game',
    description: 'خمّن الأنمي من الوصف (يستهلك الحد اليومي)',
    usage: '.tebakanime',
    example: '.tebakanime',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 30,
    energi: 1,
    isEnabled: true
}

const API_URL = 'https://api.jikan.moe/v4/anime'

let activeGames = {}

async function getRandomAnime() {
    const randomId = Math.floor(Math.random() * 50000) + 1
    try {
        const res = await axios.get(`${API_URL}/${randomId}`)
        return res.data.data
    } catch {
        return null
    }
}

async function handler(m, { sock, db }) {
    const chatId = m.chat
    
    if (activeGames[chatId]) {
        return m.reply(`⏳ *لا تزال هناك لعبة جارية!*\n\n> أجب أولاً يا عزيزي~`)
    }
    
    m.react('🎮')
    await m.reply(`⏳ *جاري البحث عن أنمي...*\n\n💗 *رمورو:* أبحث عن أنمي للتخمين يا عزيزي~`)
    
    try {
        let anime = null
        let attempts = 0
        while (!anime && attempts < 5) {
            anime = await getRandomAnime()
            attempts++
        }
        
        if (!anime) {
            return m.reply(`💔 *فشل*\n\n> فشل في جلب بيانات الأنمي. حاول مجدداً~`)
        }
        
        const soal = anime.synopsis?.substring(0, 200) || anime.title
        const jawaban = anime.title.toLowerCase()
        
        activeGames[chatId] = {
            jawaban: jawaban,
            soal: soal,
            time: setTimeout(() => {
                if (activeGames[chatId]) {
                    m.reply(`⏰ *انتهى الوقت!*\n\n> الجواب: *${anime.title}*`)
                    delete activeGames[chatId]
                }
            }, 30000)
        }
        
        await sock.sendMessage(m.chat, {
            image: { url: anime.images?.jpg?.image_url },
            caption: `🎮 *ᴛᴇʙᴀᴋ ᴀɴɪᴍᴇ* 🎮\n\n` +
                    `╭━━━━━━━━━━━━━━━━━━━━━⬣\n` +
                    `┃ 📝 *ᴅᴇꜱᴋʀɪᴘꜱɪ*:\n` +
                    `┃ ${soal}\n` +
                    `┃\n` +
                    `┃ ⏱️ *الوقت*: 30 ثانية\n` +
                    `┃ 💰 *الجائزة*: 50 limit\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━⬣`
        }, { quoted: m })
        
    } catch (err) {
        console.error('[TebakAnime] Error:', err)
        m.react('💔')
        m.reply(`💔 *ᴇʀʀᴏʀ*\n\n> ${err.message}`)
    }
}

// مستمع للإجابات
async function answerHandler(m, { sock, db }) {
    const chatId = m.chat
    const game = activeGames[chatId]
    
    if (!game) return false
    
    const userAnswer = m.text?.toLowerCase().trim()
    if (userAnswer === game.jawaban) {
        clearTimeout(game.time)
        delete activeGames[chatId]
        
        const user = db.getUser(m.sender)
        user.limit = (user.limit || 0) + 50
        db.setUser(m.sender, user)
        
        await m.reply(`🎉 *صحيح!*\n\n> الجواب: *${game.jawaban}*\n> حصلت على +50 حد يومي! 🎁`)
        await m.react('🎉')
        return true
    }
    return false
}

export { pluginConfig as config, handler, answerHandler };
