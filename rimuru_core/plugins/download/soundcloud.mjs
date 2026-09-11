export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


/**
 * SoundCloud Downloader
 * -----------------------------
 * Type    : Plugins ESM
 * creator : Hilman
 * Channel : https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K
 * API     : https://kaizenapi.my.id
 */

import fetch from 'node-fetch'

let handler = async (m, { conn, text }) => {
  if (!text) throw 'Masukkan judul lagu atau link SoundCloud!'

  await m.react('🕒')

  try {
    let res = await fetch(
      'https://kaizenapi.my.id/api/downloader/soundcloud?limit=1&query=' +
        encodeURIComponent(text)
    )

    let json = await res.json()

    if (!json.status || json.result.length === 0)
      throw 'Lagu tidak ditemukan.'

    let data = json.result[0]

    let caption = `SOUNDCLOUD DOWNLOADER

Judul: ${data.title}
Artis: ${data.artist}
Plays: ${data.plays}
Durasi: ${data.duration_seconds}s
URL: ${data.url}`

    await conn.sendMessage(
      m.chat,
      {
        image: { url: data.artwork },
        caption
      },
      { quoted: m }
    )

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: data.stream_url },
        mimetype: 'audio/mpeg',
        fileName: `${data.title}.mp3`
      },
      { quoted: m }
    )

  } catch (e) {
    throw 'Yahh error.'
  }
}

handler.help = ['soundcloudplay']
handler.tags = ['downloader']
handler.command = /^(soundcloudplay|soundcloud|scdl)$/i
handler.limit = true

export default handler
