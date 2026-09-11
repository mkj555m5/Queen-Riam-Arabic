export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


/**
 * Spotify play 
 * -----------------------------
 * Type   : Plugins ESM
 * creator : Hilman
 * Channel : https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K
 * API : https://api.nexray.web.id
 */
 
import axios from 'axios'
import { prepareWAMessageMedia } from '../../ourin_shim.mjs'

function formatNumber(num) {
  return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

let handler = async (
  m,
  { conn, text, usedPrefix, command }
) => {

  if (!text) {
    throw `Contoh:\n${usedPrefix + command} Payung Teduh Mari Bercerita`
  }

  await m.react('🕒')

  try {

    let api = `https://api.nexray.web.id/downloader/spotifyplay?q=${encodeURIComponent(text)}`
    
    let { data } = await axios.get(api)

    if (!data.status) throw 'Lagu tidak ditemukan'

    let v = data.result

    let caption = `
— spotify play —

❀ title :
${v.title}

❀ artist :
${v.artist}

❀ album :
${v.album}

❀ duration :
${v.duration}

❀ popularity :
${formatNumber(v.popularity)}

❀ release :
${v.release_at}

❀ status :
otw kirim audio...
`.trim()

    const thumbBuffer = Buffer.from(
      await (await fetch(v.thumbnail)).arrayBuffer()
    )

    const { imageMessage: image } =
      await prepareWAMessageMedia({
        image: thumbBuffer
      }, {
        upload: conn.waUploadToServer,
        mediaTypeOverride: 'thumbnail-link'
      })

    image.width = 1280
    image.height = 720

    const invisible = '\u200B'.repeat(400)

    await conn.sendMessage(m.chat, {

      text: `${v.url || 'https://open.spotify.com'}${invisible}

${caption}`,

      linkPreview: {
        'matched-text': v.url || 'https://open.spotify.com',
        title: v.title,
        description: `${v.artist} • Spotify`,
        previewType: 0,
        jpegThumbnail: thumbBuffer,
        highQualityThumbnail: image,
        linkPreviewMetadata: {
          socialMediaPostType: 4,
          linkMediaDuration: 0
        }
      }

    }, { quoted: m })

    let head = await axios.head(v.download_url)

    let size = Number(
      head.headers['content-length'] || 0
    )

    let sizeMB = size / 1024 / 1024

    if (sizeMB > 50) {

      await conn.sendMessage(m.chat, {
        document: {
          url: v.download_url
        },
        mimetype: 'audio/mpeg',
        fileName: v.title + '.mp3'
      }, { quoted: m })

    } else {

      await conn.sendMessage(m.chat, {
        audio: {
          url: v.download_url
        },
        mimetype: 'audio/mpeg',
        fileName: v.title + '.mp3'
      }, { quoted: m })

    }

    await m.react('✅')

  } catch (e) {

    console.error(e)

    await m.react('❌')

    m.reply('❌ Gagal mengambil lagu')
  }
}

handler.help = ['spotifyplay', 'spplay']
handler.tags = ['downloader']
handler.command = /^(spotifyplay|spplay)$/i
handler.limit = true

export default handler
