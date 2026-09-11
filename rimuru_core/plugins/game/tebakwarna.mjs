export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import axios from "axios"

async function scrapeWarna() {
  try {
    const res = await axios.get(
      "https://raw.githubusercontent.com/siputzx/databasee/main/games/butawarna.json",
      { timeout: 30000 }
    )

    const list = res.data.filter(v =>
      v.correct && v.image && v.image.startsWith("http")
    )

    if (!list.length) throw new Error("قاعدة بيانات الألوان غير صالحة")

    const pick = list[Math.floor(Math.random() * list.length)]

    return {
      img: pick.image,
      answer: String(pick.correct).toLowerCase()
    }
  } catch {
    throw new Error("فشل في جلب بيانات الألوان!")
  }
}

let timeout = 60000 // 60 ثانية

let handler = async (m, { conn, command }) => {
  global.tebakwarna = global.tebakwarna || {}
  const chat = m.chat
  let room = global.tebakwarna[chat]

  switch (command) {
    case "tebakwarna": {
      if (room?.active)
        return m.reply("❌ لا يزال هناك سؤال لم يُجب عنه بعد!", m)

      let data
      try {
        data = await scrapeWarna()
      } catch {
        return m.reply("❌ فشل في جلب بيانات الألوان!", m)
      }

      await conn.sendFile(
        chat,
        data.img,
        "warna.jpg",
        `🎨 *TES BUTA WARNA (Ishihara)*\n\nما الرقم الذي تراه في هذه الصورة؟\n⏳ الوقت: *${timeout / 1000} ثانية*\nأجب مباشرة.`,
        m
      )

      global.tebakwarna[chat] = {
        active: true,
        answer: data.answer,
        player: m.sender,
        timer: setTimeout(() => {
          conn.reply(chat, `❌ انتهى الوقت!\nالجواب: *${data.answer}*`)
          delete global.tebakwarna[chat]
        }, timeout)
      }
      break
    }

    case "whowarna": {
      if (!room?.active) return m.reply("❌ لا توجد لعبة نشطة.", m)

      let ans = room.answer
      let hint =
        ans[0] +
        "_".repeat(Math.max(ans.length - 2, 1)) +
        ans[ans.length - 1]

      return m.reply(`🧩 *تلميح:* ${hint}`, m)
    }
  }
}

handler.all = async function (m) {
  global.tebakwarna = global.tebakwarna || {}
  const room = global.tebakwarna[m.chat]
  if (!room?.active) return

  let text = (m.text || "").trim().toLowerCase()
  if (!text) return

  if (text === room.answer) {
    clearTimeout(room.timer)

    this.reply(
      m.chat,
      `✅ صحيح! 🎉\nالجواب الصحيح هو *${room.answer}*`,
      m
    )

    delete global.tebakwarna[m.chat]
  }
}

handler.help = ["tebakwarna"] 
handler.tags = ["game"]
handler.command = /^(tebakwarna|whowarna)$/i
handler.limit = false

export default handler
