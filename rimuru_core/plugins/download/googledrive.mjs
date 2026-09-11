import axios from 'axios';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


/*
Fitur: Downloader Google Drive
Info: Mengunduh File dari link Drive
Type: Plugins
By: SkyWalker
[ `Sumber` ]
https://whatsapp.com/channel/0029Vb1NWzkCRs1ifTWBb13u

[ `Sumber Scrape` ]
https://whatsapp.com/channel/0029Vb2mOzL1Hsq0lIEHoR0N/346
*/


let handler = async (m, { args, usedPrefix, command, conn }) => {
  const url = args[0]
  if (!url) throw `Contoh: ${usedPrefix + command} https://drive.google.com/file/d/xxxxxxxxx/view`

  const fileId = await extractGDrive(url)
  if (!fileId) throw 'URL Google Drive tidak valid!'

  try {
    const apiKey = '' // ضع مفتاح Google API الخاص بك هنا لتفعيل التحميل من جوجل درايف
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size,mimeType&key=${apiKey}`
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`

    const metadata = await axios.get(metaUrl)
    const { name, size, mimeType } = metadata.data

    m.reply(`Mendownload file...\n\n• Nama: ${name}\n• Ukuran: ${await formatSize(size)}\n• Tipe: ${mimeType}`)

    const res = await axios.get(downloadUrl, { responseType: 'arraybuffer' })

    if (res.status !== 200) {
      throw `Gagal mengunduh file: ${res.status} ${res.statusText}`
    }

    const buffer = Buffer.from(res.data, 'binary')
    const tmpPath = path.join(tmpdir(), name)
    writeFileSync(tmpPath, buffer)

    await conn.sendMessage(m.chat, {
      document: { url: tmpPath },
      fileName: name,
      mimetype: mimeType || 'application/octet-stream',
      caption: `File berhasil diunduh!\n\n• Nama: ${name}\n• Ukuran: ${await formatSize(size)}`
    }, { quoted: m })

  } catch (err) {
    console.error(err)
    throw typeof err === 'string' ? err : `Terjadi kesalahan: ${err.response?.status} ${err.response?.statusText}`
  }
}

handler.help = ['gdrive <url>']
handler.tags = ['downloader']
handler.command = /^gdrive$/i

export default handler
//module export= handler
async function extractGDrive(url) {
  const match = url.match(/\/d\/([^/]+)|open\?id=([^&]+)/)
  return match ? (match[1] || match[2]) : null
}

async function formatSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
}
