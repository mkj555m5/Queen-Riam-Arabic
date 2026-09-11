export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


let handler = async (m, { conn, text }) => {
  if (!m.mentionedJid[0]) return conn.reply(m.chat, `أشر (منشن) إلى شخص واحد لتتحداه في لعبة حرب السارونغ!`, m)

  let target = m.mentionedJid[0]
  let player1 = { jid: m.sender, name: conn.getName(m.sender) }
  let player2 = { jid: target, name: conn.getName(target) }

  let players = [player1, player2]

  let intro = `⚔️ *بدأت حرب السارونغ!!*\n\n${player1.name} ضد ${player2.name}\n\nمن سيكون الفائز؟\n\n*جاري التحميل...*`
  await conn.reply(m.chat, intro, m, { mentions: [player1.jid, player2.jid] })

 
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  await conn.sendPresenceUpdate('composing', m.chat)
  await delay(3000)
  await conn.reply(m.chat, `💥 بدأ الاثنان يلفّان السارونغ بأسلوب النينجا!`, m)

  await conn.sendPresenceUpdate('composing', m.chat)
  await delay(3000)
  await conn.reply(m.chat, `⚡ سُمع صوت *"بلاخ!"* في الهواء...`, m)

  await conn.sendPresenceUpdate('composing', m.chat)
  await delay(2500)

  let winner = players[Math.floor(Math.random() * players.length)]
  let loser = players.find(p => p.jid !== winner.jid)

  await conn.reply(m.chat, `☠️ ${loser.name} سقط ضحية سارونغ سجاد المسجد`, m)
  await delay(2000)
  await conn.reply(m.chat, `🏆 *الفائز هو:* ${winner.name.toUpperCase()}!`, m)
}

handler.help = ['perangsarung @user']
handler.tags = ['game']
handler.command = /^(perangsarung)$/i
handler.group = true
handler.register = true

export default handler

/*
SCRIPT BY © VYNAA VALERIE 
Modifikasi: By ZenzXD
*/
