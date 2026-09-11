export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import safeJson from "../../src/lib/rimuru-safe-json.mjs";
import yts from 'yt-search'

let handler = async (m, { conn, text }) => {

   if (!text) throw `Contoh:\n.playvid dj remix|360\n.ytmp4 dj remix|720`

   await m.reply(global.wait)

   let [query, resolusi] = text.split('|')
   resolusi = resolusi || '360'

   let url = query

   if (!/^https?:\/\//.test(query)) {
      let search = await yts(query)
      let vid = search.videos[0]
      if (!vid) throw 'Video tidak ditemukan'
      url = vid.url
   }

   let api = `https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(url)}&resolusi=${resolusi}`

   let res = await fetch(api)
   let json = await safeJson(res, { status: false })

   if (!json.status) throw 'Gagal mengambil video'

   let data = json.result

   let caption = `🍉 *${data.title}*
🍓 Durasi: ${data.duration}s
🍊 Resolusi: ${data.resolusi}p
🍹 Nih videonya wok~`

   await conn.sendMessage(m.chat, {
      video: { url: data.url },
      caption
   }, { quoted: m })
}

handler.help = ['playvid', 'ytmp4']
handler.tags = ['downloader']
handler.command = /^(playvid|ytmp4)$/i
handler.limit = true

export default handler
