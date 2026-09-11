export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import axios from "axios"

async function fetchAyah() {
  try {
    const rand = Math.floor(Math.random() * 6236) + 1
    const res = await axios.get(
      `https://api.alquran.cloud/v1/ayah/${rand}/ar.alafasy`,
      { timeout: 30000 }
    )

    if (!res.data?.data) throw new Error("Invalid")

    const ayah = res.data.data

    return {
      text: ayah.text,
      audio: ayah.audio,
      surah: ayah.surah?.englishName?.toLowerCase().replace(/[^a-z ]/g, "")
    }
  } catch {
    throw new Error("فشل في جلب بيانات الآية!")
  }
}

let timeout = 60000 // 60 ثانية

let handler = async (m, { conn, command }) => {
  global.tebaksurah = global.tebaksurah || {}
  const chat = m.chat
  let room = global.tebaksurah[chat]

  switch (command) {
    case "tebaksurah": {
      if (room?.active)
        return m.reply("❌ لا يزال هناك سؤال لم يُجب عنه بعد!")

      let data
      try {
        data = await fetchAyah()
      } catch {
        return m.reply("❌ فشل في جلب بيانات الآية.")
      }

      await conn.sendMessage(
        chat,
        {
          text: `📖 *TEBAK SURAH*\n\nAyat:\n"${data.text}"\n\n⏳ الوقت: *${
            timeout / 1000
          } ثانية*\nاكتب *.whosurah* للتلميح.`
        },
        { quoted: m }
      )

      if (data.audio) {
        await conn.sendMessage(
          chat,
          {
            audio: { url: data.audio },
            mimetype: "audio/mpeg",
            ptt: true
          },
          { quoted: m }
        )
      }

      global.tebaksurah[chat] = {
        active: true,
        answer: data.surah,
        timer: setTimeout(() => {
          conn.reply(chat, `❌ انتهى الوقت!\nالجواب: *${data.surah}*`)
          delete global.tebaksurah[chat]
        }, timeout)
      }

      break
    }

    case "whosurah": {
      if (!room?.active) return m.reply("❌ لا توجد لعبة نشطة.")

      let ans = room.answer
      let hint = ans[0] + "_".repeat(Math.max(ans.length - 2, 1)) + ans.slice(-1)

      return m.reply(`🧩 *تلميح:* ${hint}`)
    }
  }
}

handler.all = async function (m) {
  global.tebaksurah = global.tebaksurah || {}
  const room = global.tebaksurah[m.chat]
  if (!room?.active) return

  let text = m.text?.trim().toLowerCase().replace(/[^a-z ]/g, "")
  if (!text) return

  let ans = room.answer

  let accept = [
    ans,
    ans.replace(/^al /, ""),
    ans.replace(/ /g, "")
  ]

  if (accept.includes(text)) {
    clearTimeout(room.timer)

    this.reply(
      m.chat,
      `✅ *صحيح!* 🎉\nSurah: *${room.answer.toUpperCase()}*`,
      m
    )

    delete global.tebaksurah[m.chat]
  }
}

handler.help = ["tebaksurah"]
handler.tags = ["game"]
handler.command = /^(tebaksurah|whosurah)$/i
handler.limit = false

export default handler
