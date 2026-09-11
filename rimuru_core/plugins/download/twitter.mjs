export const FEATURE_CREDIT = "الميزة بواسطة: ShowyWharf27322\nسورس بوت Rimuru MD 👑\nالقناة الرسمية: https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P";


/**
 ╔══════════════════════
      ⧉  [Twitter] — [downloader]
╚══════════════════════

  ✺ Type     : Plugin ESM
  ✺ Source   : https://whatsapp.com/channel/0029VbAXhS26WaKugBLx4E05
  ✺ Creator  : SXZnightmare
  ✺ Scrape      : 
  [ https://gist.github.com/ZenzzXD/d6223d6e9ead8f013be12c75754c00e9 ]
  [ https://whatsapp.com/channel/0029Vap84RE8KMqfYnd0V41A/3420 ]
  ✺ Scrape Maker : [ Zenz ]
  ✺ Note    : Only Video download
*/

let handler = async (m, { conn, text, usedPrefix, command }) => {
    try {
        if (!text) {
            return m.reply(`*Contoh: ${usedPrefix + command} https://x.com/...*`);
        }

        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

        const body = new URLSearchParams({
            q: text,
            lang: 'id',
            cftoken: ''
        });

        const res = await fetch('https://savetwitter.net/api/ajaxSearch', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://savetwitter.net',
                'Referer': 'https://savetwitter.net/id3'
            },
            body
        });

        const json = await res.json();
        const html = json?.data;

        if (!html) {
            return m.reply('*Gagal mengambil data video 🍂*');
        }

        const title = html.match(/<h3>(.*?)<\/h3>/)?.[1]?.trim() || 'Twitter Video';
        const duration = html.match(/<p>(\d+:\d+)<\/p>/)?.[1] || '-';
        const thumbnail = html.match(/<img src="([^"]+)"/)?.[1];

        const mp4 = [...html.matchAll(/href="(https:\/\/dl\.snapcdn\.app\/get\?token=[^"]+)".*?MP4\s*\(([^)]+)\)/g)]
            .map(v => ({
                quality: v[2],
                url: v[1]
            }));

        if (!mp4.length) {
            return m.reply('*Video tidak ditemukan 🍂*');
        }

        const best = mp4[0];

        let caption = `*🐦 Twitter Downloader*\n\n`;
        caption += `*📌 Judul:* ${title}\n`;
        caption += `*⏱️ Durasi:* ${duration}\n`;
        caption += `*🎞️ Kualitas:* ${best.quality}\n`;

        await conn.sendMessage(
            m.chat,
            {
                video: { url: best.url },
                caption,
                jpegThumbnail: thumbnail ? await (await fetch(thumbnail)).arrayBuffer() : null
            },
            { quoted: m }
        );

    } catch (e) {
        await m.reply(`*Terjadi kesalahan saat memproses video 🍂*\n\n${e.message}`);
    } finally {
        await conn.sendMessage(m.chat, { react: { text: '', key: m.key } });
    }
};

handler.help = ['twitter'];
handler.tags = ['downloader'];
handler.command = /^(twitter|tw|xdl)$/i;
handler.limit = true;
handler.register = false; // true kan jika ada fitur register atau daftar di bot mu.

export default handler;
