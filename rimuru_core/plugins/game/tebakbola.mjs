export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import axios from "axios"

let timeout = 60000
let poin = 4999

let handler = async (m, { conn, usedPrefix, command }) => {
  conn.game = conn.game || {}
  const id = "tebakbola-" + m.chat

  if (command === "tebakbola") {
    if (id in conn.game)
      return m.reply("لا يزال هناك سؤال لم يُجب عنه بعد!")

    let data
    try {
      const res = await axios.get("https://api.deline.web.id/game/tebakpemainbola")
      if (!res.data?.result) throw new Error()
      data = res.data.result
    } catch {
      return m.reply("فشل في جلب بيانات لاعب كرة القدم، حاول مجدداً.")
    }

    const answer = data.jawaban.trim().toLowerCase()
    const clue = data.deskripsi || "لا يوجد وصف."

    const caption = `
⚽ *خمّن لاعب كرة القدم*

السؤال:
❓ *${data.soal}*

الوقت: *${timeout / 1000} ثانية*
اكتب *${usedPrefix}whobola* للمساعدة
مكافأة: ${poin} خبرة
`.trim()

    let msg = await m.reply(caption)

    conn.game[id] = [
      msg,
      { answer },
      poin,
      setTimeout(() => {
        if (conn.game[id]) {
          conn.reply(
            m.chat,
            `⏳ *انتهى الوقت!*\nالجواب هو: *${data.jawaban}*`,
            conn.game[id][0]
          )
          delete conn.game[id]
        }
      }, timeout)
    ]
  }

  if (command === "whobola") {
    if (!(id in conn.game)) return m.reply("لا توجد لعبة نشطة.")

    let ans = conn.game[id][1].answer
    let hint = ans[0] + "_".repeat(Math.max(ans.length - 2, 1)) + ans.slice(-1)

    return m.reply(`🧩 *تلميح:* ${hint}`)
  }
}

handler.all = async function (m) {
  const id = "tebakbola-" + m.chat
  if (!(id in this.game)) return

  let text = (m.text || "").trim().toLowerCase()
  if (!text) return

  let ans = this.game[id][1].answer

  if (text === ans || text.includes(ans)) {
    clearTimeout(this.game[id][3])
    this.reply(
      m.chat,
      `🎉 *صحيح!* اللاعب هو: *${ans.toUpperCase()}*`,
      this.game[id][0]
    )
    delete this.game[id]
  }
}

handler.help = ["tebakbola"]
handler.tags = ["game"]
handler.command = /^(tebakbola|whobola)$/i
handler.limit = false

export default handler
