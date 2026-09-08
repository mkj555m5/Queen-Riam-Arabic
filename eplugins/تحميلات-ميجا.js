import { File } from "megajs";
import path from "path";

let handler = async (m, { conn, args, usedPrefix, text, command }) => {
    try {
        if (!text) return m.reply(`*⎔ ⋅ ───━ •﹝💀﹞• ━─── ⋅ ⎔*\n*_المرجو توفير رابط من موقع ميجا لي تحميله 🤝✅💗_*\n*على سبيل المثال*\n.ميجا https://mega.nz/file/ovJTHaQZ#yAbkrvQgykcH_NDKQ8eIc0zvsN7jonBbHZ_HTQL6lZ8\n*⎔ ⋅ ───━ •﹝💀﹞• ━─── ⋅ ⎔*`);

        const file = File.fromURL(text);
        await file.loadAttributes();

        if (file.size >= 300000000) return m.reply('الملف فيه اكثر من 300 ميجا 😅🔄');

        const downloadingMessage = `*⎔ ⋅ ───━ •﹝💀﹞• ━─── ⋅ ⎔*\n*_جاري تحميل من موقع ميجا........⏱️⏳_*\n*⎔ ⋅ ───━ •﹝💀﹞• ━─── ⋅ ⎔*`;
        m.reply(downloadingMessage);

        const caption = `*⎔ ⋅ ───━ •﹝💀﹞• ━─── ⋅ ⎔*\n*_تم تحميل من موقع ميجا بنجاح بواسطة بــودي بوت 🙂📚🪄_*\n*⌝ اسم الملف ┋📚⌞ ⇊*\n${file.name}\n*⌝ حجم الملف ┋🪽⌞ ⇊*\n${formatBytes(file.size)}\n*⎔ ⋅ ───━ •﹝💀﹞• ━─── ⋅ ⎔*`;

        const data = await file.downloadBuffer();

        const fileExtension = path.extname(file.name).toLowerCase();
        const mimeTypes = {
            ".mp4": "video/mp4",
            ".pdf": "application/pdf",
            ".zip": "application/zip",
            ".rar": "application/x-rar-compressed",
            ".7z": "application/x-7z-compressed",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        };

        let mimetype = mimeTypes[fileExtension] || "application/octet-stream";

        await conn.sendFile(m.chat, data, file.name, caption, m, null, { mimetype, asDocument: true });

    } catch (error) {
        return m.reply(`Error: ${error.message}`);
    }
}

handler.help = ["mega"]
handler.tags = ["downloader"]
handler.command = /^(ميجا)$/i
export default handler;

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}