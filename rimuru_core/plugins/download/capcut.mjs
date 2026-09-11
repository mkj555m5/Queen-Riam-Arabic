export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


/**
 * Fitur   : CapCut Downloader
 * Base    : capdownloader.com
 * Type    : Plugin ESM
 * Channel : https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K
 * Creator : Hilman
 */

async function getCapcutVideo(url) {
  const res = await fetch(
    "https://capdownloader.com/wp-json/aio-dl/video-data/",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": "https://capdownloader.com",
        "referer": "https://capdownloader.com/",
        "user-agent": "Mozilla/5.0"
      },
      body: JSON.stringify({ url })
    }
  )

  if (!res.ok) throw "Server tidak merespon"

  const data = await res.json().catch(() => ({}))
  const video = data?.medias?.[0]?.url

  if (!video) throw "Media tidak tersedia"

  return video
}

let handler = async (m, { text, conn }) => {
  if (!text) throw "Masukkan link CapCut"
  if (!/capcut\.com/.test(text)) throw "Link tidak valid"

  await m.react("✨")

  try {
    const videoUrl = await getCapcutVideo(text)

    await conn.sendMessage(
      m.chat,
      { video: { url: videoUrl } },
      { quoted: m }
    )

    await m.react("✅")

  } catch (e) {
    console.log(e)
    await m.react("❌")
    m.reply("Gagal mengambil video")
  }
}

handler.help = ["capcut <link>"]
handler.tags = ["downloader"]
handler.command = /^(capcut|ccdl)$/i
handler.limit = true
handler.register = true

export default handler
