export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import { Akinator } from '@aqul/akinator-api'

if (!global.akinatorSessions) global.akinatorSessions = {}

const buildQuestion = (aki) =>
  `*🧞 AKINATOR*\n\n❓ *السؤال ${aki.step + 1}:*\n${aki.question}\n\n📊 Progress: ${Math.round(aki.progress)}%\n\n*الجواب:*\n1️⃣ نعم\n2️⃣ لا\n3️⃣ لا أعرف\n4️⃣ ربما\n5️⃣ ربما لا\n0️⃣ رجوع\n\n> اكتب *.akistop* للتوقف`

let handler = async (m, { conn, command }) => {
  const id = m.chat

  if (/^akistop$/i.test(command)) {
    if (!global.akinatorSessions[id]) return m.reply('لا توجد لعبة أكيناتور نشطة.')
    delete global.akinatorSessions[id]
    return m.reply('تم إيقاف لعبة أكيناتور! 👋')
  }

  if (global.akinatorSessions[id]) return m.reply('لا تزال هناك لعبة أكيناتور نشطة!\nاكتب *.akistop* untuk berhenti.')

  try {
    await m.reply('```جاري بدء أكيناتور...```')
    const aki = new Akinator({ region: 'id', childMode: true })
    await aki.start()
    global.akinatorSessions[id] = { aki, sender: m.sender }
    await conn.sendMessage(m.chat, { text: buildQuestion(aki) }, { quoted: m })
  } catch (e) {
    delete global.akinatorSessions[id]
    m.reply('فشل في بدء أكيناتور: ' + e.message)
  }
}

handler.help = ['akinator', 'aki']
handler.tags = ['game']
handler.command = /^(akinator|aki|akistop)$/i

export default handler
