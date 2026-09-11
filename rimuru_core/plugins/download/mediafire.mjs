export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


import axios from 'axios'
import * as cheerio from 'cheerio'

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.mediafire.com/',
  'Upgrade-Insecure-Requests': '1'
}

function sizeToMB(size) {
  if (!size) return 0
  let s = size.toUpperCase()
  if (s.includes('GB')) return parseFloat(s) * 1024
  if (s.includes('MB')) return parseFloat(s)
  if (s.includes('KB')) return parseFloat(s) / 1024
  return 0
}

async function mediafiredl(url) {
  const res = await axios.get(url, { headers, maxRedirects: 5 })
  const $ = cheerio.load(res.data)

  const download = $('#download_link > a.input.popsok').attr('href') || null
  const filename = $('.dl-btn-label').first().text().trim() || 'file'
  const filesize = $('#download_link > a.input.popsok')
    .text()
    .match(/\(([^)]+)\)/)?.[1] || '-'
  const filetype = $('.dl-info .filetype span').first().text().trim() || '-'
  const uploaded = $('.details li').eq(1).find('span').text().trim() || '-'

  return { filename, filetype, filesize, uploaded, download }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) throw `Contoh:\n${usedPrefix + command} https://www.mediafire.com/file/xxxxx`

  await m.react('🕒')

  try {
    let res = await mediafiredl(text)
    if (!res.download) throw 'Link download tidak ditemukan.'

    let sizeMB = sizeToMB(res.filesize)
    if (sizeMB > 100) {
      return m.reply(`❌ File terlalu besar (${res.filesize})\nBatas maksimal: 100 MB`)
    }

    let ext = res.download.split('.').pop().split('?')[0]
    let fileName = res.filename.includes('.') ? res.filename : `${res.filename}.${ext}`

    await conn.sendMessage(m.chat, {
      document: { url: res.download },
      mimetype: `application/${ext}`,
      fileName,
      caption:
`📦 MediaFire Downloader
📝 Nama: ${res.filename}
📁 Tipe: ${res.filetype}
📏 Ukuran: ${res.filesize}
📅 Upload: ${res.uploaded}`
    }, { quoted: global.fstatus })

  } catch (e) {
    m.reply(typeof e === 'string' ? e : '❌ Gagal mengambil file MediaFire.')
  }
}

handler.help = ['mediafire']
handler.tags = ['downloader']
handler.command = /^(mediafire|mf)$/i
handler.limit = true

export default handler
