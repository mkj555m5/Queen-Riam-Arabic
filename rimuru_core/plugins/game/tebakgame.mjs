export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import fs from 'fs'
let timeout = 120000
let poin = 4999
let handler = async (m, { conn, command, usedPrefix }) => {
    conn.game = conn.game ? conn.game : {}
    let id = 'tebakgame-' + m.chat
    if (id in conn.game) return conn.reply(m.chat, 'لا يزال هناك سؤال لم يُجب عنه في هذه المحادثة', conn.game[id][0])
    let src = JSON.parse(fs.readFileSync('../../json/tebakgame.json', 'utf-8'))
    let json = src[Math.floor(Math.random() * src.length)]
    let caption = `
Logo apakah ini?

الوقت *${(timeout / 1000).toFixed(2)} ثانية*
اكتب ${usedPrefix}hgame للمساعدة
مكافأة: ${poin} خبرة
`.trim()
    conn.game[id] = [
        await conn.sendFile(m.chat, json.img, 'tebakgame.jpg', caption, m),
        json, poin,
        setTimeout(() => {
            if (conn.game[id]) conn.reply(m.chat, `انتهى الوقت!\nالجواب هو *${json.jawaban}*`, conn.game[id][0])
            delete conn.game[id]
        }, timeout)
    ]
}
handler.help = ['tebakgame']
handler.tags = ['game']
handler.command = /^tebakgame$/i

export default handler
