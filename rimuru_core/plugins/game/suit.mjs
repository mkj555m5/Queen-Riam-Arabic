export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


let handler = async (m, { text, usedPrefix }) => {
    let salah = `الخيارات المتاحة\n\nمقص، ورقة، حجر\n\n${usedPrefix}suit gunting\n\nافصل بينها بمسافة!`
    if (!text) throw salah
    var astro = Math.random()

    if (astro < 0.34) {
        astro = 'batu' 
    } else if (astro > 0.34 && astro < 0.67) {
        astro = 'gunting' 
    } else {
        astro = 'kertas'
    }

    //menentukan rules
    if (text == astro) {
        m.reply(`تعادل!\nأنت: ${text}\nالبوت: ${astro}`)
    } else if (text == 'batu') {
        if (astro == 'gunting') {
            global.db.data.users[m.sender].money += 1000
            m.reply(`أنت الفائز!\n+1000 مال\nأنت: ${text}\nالبوت: ${astro}`)
        } else {
            m.reply(`أنت الخاسر!\nأنت: ${text}\nالبوت: ${astro}`)
        }
    } else if (text == 'gunting') {
        if (astro == 'kertas') {
            global.db.data.users[m.sender].money += 1000
            m.reply(`أنت الفائز!\n+1000 مال\nأنت: ${text}\nالبوت: ${astro}`)
        } else {
            m.reply(`أنت الخاسر!\nأنت: ${text}\nالبوت: ${astro}`)
        }
    } else if (text == 'kertas') {
        if (astro == 'batu') {
            global.db.data.users[m.sender].money += 1000
            m.reply(`أنت الفائز! \n+1000 مال\nأنت: ${text}\nالبوت: ${astro}`)
        } else {
            m.reply(`أنت الخاسر!\nأنت: ${text}\nالبوت: ${astro}`)
        }
    } else {
        throw salah
    }
}
handler.help = ['suit']
handler.tags = ['game']
handler.command = /^(suit)$/i
handler.group = false
handler.register = true
handler.private = false
handler.limit = true

export default handler
