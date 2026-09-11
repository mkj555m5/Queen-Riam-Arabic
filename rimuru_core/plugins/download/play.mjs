export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import axios from 'axios'
import yts from 'yt-search'
import ytdl, { fallbackToMp3Buffer } from '../../src/scraper/ytdl.mjs'

async function getAudio(url) {
  try {
    const { data } = await axios.get(
      `https://my.izuka-api.xyz/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
      { timeout: 60000 }
    )

    const download = data?.result?.download_url || data?.result?.download
    if (download) return { download, title: data?.result?.title }
  } catch (e) {
    console.error('[PLAY API]', e.message)
  }

  const fallback = await ytdl(url, 'mp3')
  if (fallback?.status && fallback?.dl) {
    return { download: fallback.dl, title: fallback.title, fallback: true }
  }

  throw new Error(fallback?.mess || 'Gagal mendapatkan audio')
}

async function downloadAudio(url, fallback = false) {
  if (fallback) return fallbackToMp3Buffer(url)

  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: 100 * 1024 * 1024,
    maxBodyLength: 100 * 1024 * 1024,
  })

  const type = String(res.headers['content-type'] || '').toLowerCase()
  if (type.includes('text/html') || type.includes('application/json')) {
    throw new Error('URL download tidak mengembalikan audio')
  }

  return Buffer.from(res.data)
}

let handler = async (m, { conn, usedPrefix, command, text }) => {
  const query = (text || '').trim()

  if (!query) {
    return m.reply(`🎵 *PLAY*\n\nContoh:\n${usedPrefix + command} komang`)
  }

  await m.react('🕐')

  try {
    const search = await yts(query)
    if (!search.videos?.length) throw new Error('Lagu/video tidak ditemukan')

    const video = search.videos[0]
    const result = await getAudio(video.url)
    const audio = await downloadAudio(result.download, result.fallback)

    const caption =
      `🎵 *NOW PLAYING*\n\n` +
      `📌 *Judul:* ${video.title}\n` +
      `👤 *Channel:* ${video.author?.name || '-'}\n` +
      `⏱️ *Durasi:* ${video.timestamp || '-'}\n` +
      `👀 *Views:* ${formatNumber(video.views)}\n` +
      `📅 *Upload:* ${video.ago || '-'}\n\n` +
      `🔗 *YouTube:* ${video.url}`

    // Kirim thumbnail + link YouTube.
    await conn.sendMessage(m.chat, {
      image: { url: video.thumbnail },
      caption
    }, { quoted: m })

    // Lalu kirim audio hasil pencarian.
    await conn.sendMessage(m.chat, {
      audio,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${video.title.replace(/[\\/:*?"<>|]/g, '_')}.mp3`
    }, { quoted: m })

    await m.react('✅')
  } catch (e) {
    console.error('[PLAY]', e)
    await m.react('❌')
    return m.reply(`❌ *PLAY GAGAL*\n\n${e?.message || 'Gagal mengambil audio.'}`)
  }
}

handler.help = ['play']
handler.tags = ['downloader']
handler.command = /^(play)$/i
handler.limit = true

export default handler

function formatNumber(num = 0) {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}
