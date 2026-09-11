export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


/*
fitur: youtube download
cr: alfiXD
*/

import axios from 'axios'

let handler = async (m, { conn, usedPrefix, command, args }) => {
    const url = args[0]
    if (!url) {
        return m.reply(`
• ${usedPrefix}ytmp3 <url>
• ${usedPrefix}ytmp4 <url>`)
    }

    const isAudio = command.includes('mp3') || command === 'yta'
    const type = isAudio ? 'audio' : 'merge'
    const apikey = 'nbteam'
    const apiBase = 'https://youtubedl.siputzx.my.id'

        const { data: initialResponse } = await axios.get(`${apiBase}/download`, {
            params: { url, type, apikey }
        })

        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

        let finalData = initialResponse
        let attempts = 0
        const maxAttempts = 20
        while (finalData.status !== 'completed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000))
            const { data: checkData } = await axios.get(`${apiBase}/download`, {
                params: { url, type, apikey }
            })
            finalData = checkData
            attempts++

            if (finalData.status === 'error') throw new Error(finalData.error || 'API Error')
        }

        if (finalData.status !== 'completed') {
            throw new Error('Waktu tunggu habis. Silahkan coba lagi nanti.')
        }

        const downloadUrl = `${apiBase}${finalData.fileUrl}`
        if (isAudio) {
            await conn.sendMessage(m.chat, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg'
            }, { quoted: m })
        } else {
            await conn.sendMessage(m.chat, {
                video: { url: downloadUrl },
                mimetype: 'video/mp4'
            }, { quoted: m })
        }

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
}

handler.help = ['ytmp3', 'ytmp4']
handler.tags = ['downloader']
handler.command = /^yt(mp3|mp4|a|v)$/i
handler.limit = true

export default handler
