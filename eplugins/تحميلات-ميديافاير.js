import fetch from 'node-fetch'

let handler = async (m, { conn, text, usedPrefix, command }) => {
if (!text) throw m.reply(`*❀ حـط لـيـنـك مـيـديـا فـايـر ☘️*\n> *مــثــال:* ${usedPrefix}${command} https://www.mediafire.com/file/2v2x1p0x58qomva/WhatsApp_Messenger_2.24.21.8_beta_By_WhatsApp_LLC.apk/file`);
conn.sendMessage(m.chat, { react: { text: "🕒", key: m.key } });
	let ouh = await fetch(`https://api.agatz.xyz/api/mediafire?url=${text}`)
  let gyh = await ouh.json()
	await conn.sendFile(m.chat, gyh.data[0].link, `${gyh.data[0].nama}`, `*اެݪاســم:* ${gyh.data[0].nama}\n*الـحـجـم:* ${gyh.data[0].size}\n*وصـف:* ${gyh.data[0].mime}\n> ৎ୭࠭͢𝐇Ꭵ𝐗-𝐁𝐨𝐭-𝐌𝐃𓆪͟͞ `, m)
	await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key }})
}
handler.help = ['W e S K Y']
handler.tags = ['التنزيل']
handler.command = /^(ميديافاير|ميديا-فاير)$/i
handler.premium = false
handler.register = false
export default handler