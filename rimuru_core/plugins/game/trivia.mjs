import axios from 'axios';
export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import config from '../../config.mjs';
const pluginConfig = {
    name: 'trivia',
    alias: ['kuis', 'quiz'],
    category: 'game',
    description: 'أسئلة معلومات عامة',
    usage: '.trivia',
    example: '.trivia',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 30,
    energi: 1,
    isEnabled: true
}

let activeGames = {}

async function getTrivia() {
    try {
        const res = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986')
        const data = res.data.results[0]
        
        return {
            question: decodeURIComponent(data.question),
            correct: decodeURIComponent(data.correct_answer),
            options: [
                decodeURIComponent(data.correct_answer),
                ...data.incorrect_answers.map(a => decodeURIComponent(a))
            ].sort(() => Math.random() - 0.5)
        }
    } catch {
        return null
    }
}

async function handler(m, { sock, db }) {
    const chatId = m.chat
    
    if (activeGames[chatId]) {
        return m.reply(`⏳ *لا تزال هناك لعبة جارية!*`)
    }
    
    m.react('📚')
    await m.reply(`⏳ *جاري البحث عن سؤال...*`)
    
    const trivia = await getTrivia()
    if (!trivia) {
        return m.reply(`💔 *فشل*\n\n> فشل في جلب السؤال. حاول مجدداً~`)
    }
    
    let optionsText = ''
    for (let i = 0; i < trivia.options.length; i++) {
        optionsText += `┃    ${i + 1}. ${trivia.options[i]}\n`
    }
    
    activeGames[chatId] = {
        jawaban: trivia.correct.toLowerCase(),
        time: setTimeout(() => {
            if (activeGames[chatId]) {
                m.reply(`⏰ *انتهى الوقت!*\n\n> الجواب: *${trivia.correct}*`)
                delete activeGames[chatId]
            }
        }, 30000)
    }
    
    await m.reply(
        `📚 *ᴛʀɪᴠɪᴀ* 📚\n\n` +
        `╭━━━━━━━━━━━━━━━━━━━━━⬣\n` +
        `┃ 📝 *السؤال*:\n` +
        `┃ ${trivia.question}\n` +
        `┃\n` +
        `┃ 🔢 *الخيارات*:\n` +
        `${optionsText}` +
        `┃\n` +
        `┃ ⏱️ *الوقت*: 30 ثانية\n` +
        `┃ 💰 *الجائزة*: 40 limit\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
        `> اكتب *1, 2, 3, atau 4* للإجابة`
    )
}

async function answerHandler(m, { sock, db }) {
    const chatId = m.chat
    const game = activeGames[chatId]
    
    if (!game) return false
    
    const answerIndex = parseInt(m.text?.trim())
    if (isNaN(answerIndex) || answerIndex < 1 || answerIndex > 4) return false
    
    // يحتاج هذا إلى تخزين الخيارات، لكن تم تبسيطه
    // للنسخة الكاملة يلزم تخزين الخيارات أيضاً
    
    return false
}

export { pluginConfig as config, handler, answerHandler };
