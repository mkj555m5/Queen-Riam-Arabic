export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


/**
 * Apple Music Downloader
 * -----------------------------
 * Type    : Plugins ESM
 * creator : Hilman
 * Channel : https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K
 * API     : https://kaizenapi.my.id
 */

import axios from 'axios'

let handler = async (m, { conn, text }) => {
  if (!text) throw 'Masukkan judul lagu atau URL Apple Music!'

  await m.react('🕒')

  try {
    let url = text

    if (!/^https?:\/\/(music\.)?apple\.com/i.test(text)) {
      let { data: search } = await axios.get(
        `https://kaizenapi.my.id/api/search/applemusic?q=${encodeURIComponent(text)}`
      )

      if (!search.status || !search.data?.length)
        throw 'Lagu tidak ditemukan.'

      url = search.data[0].url
    }

    let { data: json } = await axios.get(
      `https://kaizenapi.my.id/api/downloader/applemusic?url=${encodeURIComponent(url)}`
    )

    if (!json.status) throw 'Yahh error.'

    let data = json.data

    let caption = `APPLE MUSIC DOWNLOADER

❀ Judul : ${data.title}
❀ Artis : ${data.artist}
❀ Album : ${data.album}`

    await conn.sendMessage(
      m.chat,
      {
        image: { url: data.thumbnail },
        caption
      },
      { quoted: m }
    )

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: data.download_url },
        mimetype: 'audio/mpeg',
        fileName: `${data.title}.mp3`
      },
      { quoted: m }
    )

  } catch (e) {
    throw 'Yahh error.'
  }
}

handler.help = ['applemusic <judul/url>']
handler.tags = ['downloader']
handler.command = /^(applemusic|aplmusic)$/i
handler.limit = true

export default handler
