export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import yts from 'yt-search'

let handler = async (m, { text, conn, usedPrefix, command }) => {
  if (!text) throw `Masukkan judul!

Contoh:
${usedPrefix + command} dj 30 detik`

  let search = await yts(text)
  let videos = search.videos.slice(0, 10)

  if (!videos.length) throw 'Video tidak ditemukan.'

  let caption = `✨ *YouTube Search*\n`
  caption += `Query: ${text}\n\n`

  for (let i = 0; i < videos.length; i++) {
    let v = videos[i]
    caption += `*${i + 1}. ${v.title}*\n`
    caption += `⏱ ${v.timestamp} | 🍓 ${v.views.toLocaleString()}\n`
    caption += `📎 ${v.url}\n\n`
  }

  await conn.sendMessage(m.chat, {
    text: caption,
    contextInfo: {
      externalAdReplyOffOffOff: {
        title: "YouTube Search",
        body: text,
        thumbnailUrl: videos[0].thumbnail,
        sourceUrl: videos[0].url,
        mediaType: 1,
        renderLargerThumbnail: true
      }
    }
  }, { quoted: m })
}

handler.help = ['yts', 'youtubesearch']
handler.tags = ['search']
handler.command = /^(yts|youtubesearch)$/i
handler.limit = true

export default handler
