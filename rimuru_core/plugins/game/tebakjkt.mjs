export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import axios from "axios"

async function scrapeJKT() {
  try {
    const res = await axios.get(
      "https://raw.githubusercontent.com/siputzx/tebak-jkt/main/tebak.json",
      { timeout: 30000 }
    )

    const list = res.data
    const pick = list[Math.floor(Math.random() * list.length)]

    if (!pick.gambar || !pick.jawaban) throw new Error("بيانات JKT غير صالحة")

    return {
      img: pick.gambar,
      answer: pick.jawaban.toLowerCase()
    }

  } catch {
    throw new Error("فشل في جلب بيانات JKT!")
  }
}

let timeout = 60000

let handler = async (m, { conn, command }) => {
  global.tebakjkt = global.tebakjkt || {}
  const chat = m.chat

  if (!global.tebakjkt[chat]) global.tebakjkt[chat] = {}
  let room = global.tebakjkt[chat]

  switch (command) {
    
    // ===== بدء اللعبة =====
    case "tebakjkt": {
      const data = await scrapeJKT()

      await conn.sendMessage(
        chat,
        {
          image: { url: data.img },
          caption: `🎀 *خمّن عضوة JKT48*\n\nمن العضوة الظاهرة في هذه الصورة؟\n⏳ الوقت: ${timeout / 1000} ثانية\nاكتب *whojkt* للتلميح.\nأجب مباشرة.`
        },
        { quoted: m }
      )

      global.tebakjkt[chat] = {
        answer: data.answer,
        player: m.sender,
        timer: setTimeout(() => {
          conn.reply(chat, `❌ انتهى الوقت!\nالجواب: *${data.answer}*`)
          delete global.tebakjkt[chat]
        }, timeout)
      }

      break
    }

    // ===== التلميح =====
    case "whojkt": {
      if (!room.answer) return conn.reply(chat, "❌ لا توجد لعبة نشطة.", m)

      const ans = room.answer
      const hint =
        ans[0] +
        "_".repeat(Math.max(ans.length - 2, 1)) +
        ans[ans.length - 1]

      return conn.reply(chat, `🧩 *تلميح:* ${hint}`, m)
    }
  }
}

// ===== الرد التلقائي =====
handler.all = async function (m) {
  global.tebakjkt = global.tebakjkt || {}

  const room = global.tebakjkt[m.chat]
  if (!room?.answer) return

  const text = (m.text || "").trim().toLowerCase()
  if (!text) return

  if (text === room.answer || text.includes(room.answer)) {
    clearTimeout(room.timer)

    this.reply(
      m.chat,
      `✅ *صحيح!* 🎉\nالجواب: *${room.answer}*`,
      m
    )

    delete global.tebakjkt[m.chat]
  }
}

handler.help = ["tebakjkt"]
handler.tags = ["game"]
handler.command = /^(tebakjkt|whojkt)$/i
handler.limit = false

export default handler
