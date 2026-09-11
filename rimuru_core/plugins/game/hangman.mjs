export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import config from '../../config.mjs';
const pluginConfig = {
    name: 'hangman',
    alias: ['tebakkata2', 'hangman'],
    category: 'game',
    description: 'خمّن الكلمة (حرفاً بحرف)',
    usage: '.hangman',
    example: '.hangman',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 30,
    energi: 1,
    isEnabled: true
}

const words = [
    'zero two', 'darling', 'franxx', 'strelizia', 'hiro',
    'ichigo', 'goro', 'miku', 'kokoro', 'mitsuru',
    'zorome', 'futoshi', 'nana', 'hachi', 'klaxosaur'
]

let activeGames = {}

function getRandomWord() {
    return words[Math.floor(Math.random() * words.length)]
}

function displayWord(word, guessed) {
    return word.split('').map(letter => {
        if (letter === ' ') return ' '
        return guessed.has(letter) ? letter : '_'
    }).join(' ')
}

async function handler(m, { sock, db }) {
    const chatId = m.chat
    
    if (activeGames[chatId]) {
        return m.reply(`⏳ *لا تزال هناك لعبة جارية!*`)
    }
    
    m.react('🔤')
    
    const word = getRandomWord()
    const guessed = new Set()
    
    activeGames[chatId] = {
        word: word,
        guessed: guessed,
        attempts: 6,
        time: setTimeout(() => {
            if (activeGames[chatId]) {
                m.reply(`⏰ *انتهى الوقت!*\n\n> الجواب: *${word}*`)
                delete activeGames[chatId]
            }
        }, 60000)
    }
    
    await m.reply(
        `🔤 *ʜᴀɴɢᴍᴀɴ* 🔤\n\n` +
        `╭━━━━━━━━━━━━━━━━━━━━━⬣\n` +
        `┃ 📝 *ᴋᴀᴛᴀ*: ${displayWord(word, guessed)}\n` +
        `┃ ❌ *ᴘᴇʀᴄᴏʙᴀᴀɴ*: ${activeGames[chatId].attempts}/6\n` +
        `┃\n` +
        `┃ ⏱️ *الوقت*: 60 ثانية\n` +
        `┃ 💰 *الجائزة*: 50 limit\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
        `> أرسل *حرفاً واحداً* للتخمين، أو *أجب بالكلمة كاملة*`
    )
}

async function answerHandler(m, { sock, db }) {
    const chatId = m.chat
    const game = activeGames[chatId]
    
    if (!game) return false
    
    const input = m.text?.toLowerCase().trim()
    if (!input) return false
    
    // Tebak kata lengkap
    if (input === game.word) {
        clearTimeout(game.time)
        delete activeGames[chatId]
        
        const user = db.getUser(m.sender)
        user.limit = (user.limit || 0) + 50
        db.setUser(m.sender, user)
        
        await m.reply(`🎉 *صحيح!*\n\n> الكلمة: *${game.word}*\n> حصلت على +50 حد يومي! 🎁`)
        await m.react('🎉')
        return true
    }
    
    // Tebak huruf
    if (input.length === 1 && /[a-z]/.test(input)) {
        if (game.guessed.has(input)) {
            await m.reply(`⚠️ *ʜᴜʀᴜꜰ '${input}' ꜱᴜᴅᴀʜ ᴘᴇʀɴᴀʜ ᴅɪᴛᴇʙᴀᴋ!*`)
            return true
        }
        
        game.guessed.add(input)
        
        if (game.word.includes(input)) {
            const display = displayWord(game.word, game.guessed)
            
            if (!display.includes('_')) {
                clearTimeout(game.time)
                delete activeGames[chatId]
                
                const user = db.getUser(m.sender)
                user.limit = (user.limit || 0) + 50
                db.setUser(m.sender, user)
                
                await m.reply(`🎉 *صحيح!*\n\n> الكلمة: *${game.word}*\n> حصلت على +50 حد يومي! 🎁`)
                await m.react('🎉')
                return true
            }
            
            await m.reply(
                `✅ *صحيح!* الحرف '${input}' موجود في الكلمة!\n\n` +
                `📝 *ᴋᴀᴛᴀ*: ${display}\n` +
                `❌ *ᴘᴇʀᴄᴏʙᴀᴀɴ*: ${game.attempts}/6`
            )
        } else {
            game.attempts--
            
            if (game.attempts === 0) {
                clearTimeout(game.time)
                delete activeGames[chatId]
                await m.reply(`💀 *ɢᴀᴍᴇ ᴏᴠᴇʀ!*\n\n> الجواب: *${game.word}*`)
                return true
            }
            
            await m.reply(
                `❌ *خطأ!* الحرف '${input}' غير موجود!\n\n` +
                `📝 *ᴋᴀᴛᴀ*: ${displayWord(game.word, game.guessed)}\n` +
                `❌ *ᴘᴇʀᴄᴏʙᴀᴀɴ*: ${game.attempts}/6`
            )
        }
        return true
    }
    
    return false
}

export { pluginConfig as config, handler, answerHandler };
