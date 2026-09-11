import { generateWAMessageFromContent, proto } from "../../ourin_shim.mjs";
import fs from "fs";
import path from "path";
import { saluranCtx } from "./rimuru-context.mjs";
import { fetchBuffer, getMimeType } from "./rimuru-utils.mjs";
/**
 * @typedef {Object} MessageOptions
 * @property {Object} [quoted] - الرسالة المراد اقتباسها
 * @property {boolean} [ephemeral] - رسالة مؤقتة
 * @property {string[]} [mentions] - مصفوفة JID للمنشن
 */

/**
 * @typedef {Object} ButtonData
 * @property {string} text - نص الزر
 * @property {string} id - معرّف الزر
 */

/**
 * @typedef {Object} ListSection
 * @property {string} title - عنوان القسم
 * @property {Array<{title: string, rowId: string, description?: string}>} rows - مصفوفة الصفوف
 */

/**
 * إرسال رسالة نصية
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {string} text - النص المراد إرساله
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 * @example
 * await sendText(sock, jid, 'Hello World!', { quoted: m });
 */
async function sendText(sock, jid, text, options = {}) {
  return sock.sendMessage(
    jid,
    {
      text,
      mentions: options.mentions || [],
    },
    {
      quoted: options.quoted,
      ephemeralExpiration: options.ephemeral ? 86400 : undefined,
    },
  );
}

/**
 * إرسال رسالة مع اقتباس
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {string} text - النص المراد إرساله
 * @param {Object} quoted - الرسالة المراد الرد عليها
 * @returns {Promise<Object>} الرسالة المرسلة
 */
async function sendReply(sock, jid, text, quoted) {
  return sendText(sock, jid, text, { quoted });
}

/**
 * إرسال صورة
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {Buffer|string} image - Buffer الصورة أو رابط
 * @param {string} [caption=''] - كابشن الصورة
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 * @example
 * await sendImage(sock, jid, imageBuffer, 'Caption here', { quoted: m });
 * await sendImage(sock, jid, 'https://example.com/image.png');
 */
async function sendImage(sock, jid, image, caption = "", options = {}) {
  let buffer;

  if (typeof image === "string") {
    if (image.startsWith("http")) {
      buffer = await fetchBuffer(image);
    } else if (fs.existsSync(image)) {
      buffer = fs.readFileSync(image);
    } else {
      throw new Error("Invalid image source");
    }
  } else {
    buffer = image;
  }

  return sock.sendMessage(
    jid,
    {
      image: buffer,
      caption,
      mentions: options.mentions || [],
    },
    {
      quoted: options.quoted,
      ephemeralExpiration: options.ephemeral ? 86400 : undefined,
    },
  );
}

/**
 * إرسال فيديو
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {Buffer|string} video - Buffer الفيديو أو رابط
 * @param {string} [caption=''] - كابشن الفيديو
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 */
async function sendVideo(sock, jid, video, caption = "", options = {}) {
  let buffer;

  if (typeof video === "string") {
    if (video.startsWith("http")) {
      buffer = await fetchBuffer(video);
    } else if (fs.existsSync(video)) {
      buffer = fs.readFileSync(video);
    } else {
      throw new Error("Invalid video source");
    }
  } else {
    buffer = video;
  }

  return sock.sendMessage(
    jid,
    {
      video: buffer,
      caption,
      mentions: options.mentions || [],
    },
    {
      quoted: options.quoted,
      ephemeralExpiration: options.ephemeral ? 86400 : undefined,
    },
  );
}

/**
 * إرسال صوت
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {Buffer|string} audio - Buffer الصوت أو رابط
 * @param {boolean} [ptt=false] - هل يرسل كرسالة صوتية
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 */
async function sendAudio(sock, jid, audio, ptt = false, options = {}) {
  let buffer;

  if (typeof audio === "string") {
    if (audio.startsWith("http")) {
      buffer = await fetchBuffer(audio);
    } else if (fs.existsSync(audio)) {
      buffer = fs.readFileSync(audio);
    } else {
      throw new Error("Invalid audio source");
    }
  } else {
    buffer = audio;
  }

  return sock.sendMessage(
    jid,
    {
      audio: buffer,
      ptt,
      mimetype: "audio/mpeg",
    },
    {
      quoted: options.quoted,
    },
  );
}

/**
 * إرسال ملصق
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {Buffer|string} sticker - Buffer الملصق أو رابط
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 */
async function sendSticker(sock, jid, sticker, options = {}) {
  let buffer;

  if (typeof sticker === "string") {
    if (sticker.startsWith("http")) {
      buffer = await fetchBuffer(sticker);
    } else if (fs.existsSync(sticker)) {
      buffer = fs.readFileSync(sticker);
    } else {
      throw new Error("Invalid sticker source");
    }
  } else {
    buffer = sticker;
  }

  return sock.sendMessage(
    jid,
    {
      sticker: buffer,
    },
    {
      quoted: options.quoted,
    },
  );
}

/**
 * إرسال مستند/ملف
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {Buffer|string} file - Buffer الملف أو المسار
 * @param {string} fileName - اسم الملف
 * @param {string} [mimetype] - نوع MIME للملف
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 */
async function sendDocument(sock, jid, file, fileName, mimetype, options = {}) {
  let buffer;

  if (typeof file === "string") {
    if (file.startsWith("http")) {
      buffer = await fetchBuffer(file);
    } else if (fs.existsSync(file)) {
      buffer = fs.readFileSync(file);
    } else {
      throw new Error("Invalid file source");
    }
  } else {
    buffer = file;
  }

  const mime = mimetype || getMimeType(buffer);

  return sock.sendMessage(
    jid,
    {
      document: buffer,
      fileName,
      mimetype: mime,
      caption: options.caption || "",
    },
    {
      quoted: options.quoted,
    },
  );
}

/**
 * إرسال جهة اتصال
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {string} number - رقم جهة الاتصال
 * @param {string} name - اسم جهة الاتصال
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 */
async function sendContact(sock, jid, number, name, options = {}) {
  const cleanNumber = number.replace(/[^0-9]/g, "");

  const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL;type=CELL;type=VOICE;waid=${cleanNumber}:+${cleanNumber}
END:VCARD`;

  return sock.sendMessage(
    jid,
    {
      contacts: {
        displayName: name,
        contacts: [{ vcard }],
      },
    },
    {
      quoted: options.quoted,
    },
  );
}

/**
 * إرسال موقع جغرافي
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {number} latitude - خط العرض
 * @param {number} longitude - خط الطول
 * @param {string} [name=''] - اسم الموقع
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 */
async function sendLocation(
  sock,
  jid,
  latitude,
  longitude,
  name = "",
  options = {},
) {
  return sock.sendMessage(
    jid,
    {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name,
      },
    },
    {
      quoted: options.quoted,
    },
  );
}

/**
 * إرسال تفاعل إيموجي
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID المحادثة
 * @param {string} emoji - إيموجي التفاعل
 * @param {Object} key - مفتاح الرسالة للتفاعل
 * @returns {Promise<Object>} النتيجة
 */
async function sendReact(sock, jid, emoji, key) {
  return sock.sendMessage(jid, {
    react: {
      text: emoji,
      key,
    },
  });
}

/**
 * إرسال رسالة مع مؤشر الكتابة
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {string} text - النص المراد إرساله
 * @param {number} [delay=1000] - مدة الكتابة بالمللي ثانية
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 */
async function sendWithTyping(sock, jid, text, delay = 1000, options = {}) {
  await sock.sendPresenceUpdate("composing", jid);
  await new Promise((r) => setTimeout(r, delay));
  await sock.sendPresenceUpdate("paused", jid);
  return sendText(sock, jid, text, options);
}

/**
 * إرسال رسالة إلى عدة JID
 * @param {Object} sock - اتصال السوكِت
 * @param {string[]} jids - مصفوفة JID الوجهات
 * @param {Object} content - محتوى الرسالة
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object[]>} مصفوفة الرسائل المرسلة
 */
async function sendToMultiple(sock, jids, content, options = {}) {
  const results = [];

  for (const jid of jids) {
    try {
      const result = await sock.sendMessage(jid, content, options);
      results.push({ jid, success: true, result });
    } catch (error) {
      results.push({ jid, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * إعادة توجيه رسالة إلى JID آخر
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {Object} message - الرسالة المراد إعادة توجيهها
 * @param {boolean} [forceForward=false] - فرض علامة إعادة التوجيه
 * @returns {Promise<Object>} الرسالة المعاد توجيهها
 */
async function forwardMessage(sock, jid, message, forceForward = false) {
  return sock.sendMessage(jid, {
    forward: message,
    force: forceForward,
  });
}

/**
 * حذف رسالة
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID المحادثة
 * @param {Object} key - مفتاح الرسالة
 * @returns {Promise<Object>} النتيجة
 */
async function deleteMessage(sock, jid, key) {
  return sock.sendMessage(jid, {
    delete: key,
  });
}

/**
 * إنشاء رسالة مقتبسة وهمية للرد الوهمي
 * @param {string} jid - JID المرسل
 * @param {string} text - نص الرسالة
 * @param {string} [pushName='Bot'] - اسم المرسل
 * @returns {Object} رسالة مقتبسة وهمية
 */
function createQuotedDummy(jid, text, pushName = "Bot") {
  return {
    key: {
      fromMe: false,
      participant: jid,
      remoteJid: jid,
    },
    message: {
      conversation: text,
    },
    pushName,
  };
}

/**
 * إرسال رسالة مع معاينة رابط وصورة مصغرة
 * @param {Object} sock - اتصال السوكِت
 * @param {string} jid - JID الوجهة
 * @param {string} text - نص الرسالة
 * @param {Object} preview - بيانات المعاينة
 * @param {string} preview.title - عنوان المعاينة
 * @param {string} preview.body - محتوى المعاينة
 * @param {string} text - نص القائمة
 * @param {Buffer|string} [image] - صورة الترويسة (اختياري)
 * @param {MessageOptions} [options={}] - خيارات الرسالة
 * @returns {Promise<Object>} الرسالة المرسلة
 */
async function sendWithPreview(sock, jid, text, preview, options = {}) {
  const ctx = saluranCtx();
  ctx.mentionedJid = options.mentions || [];
  return sock.sendMessage(
    jid,
    {
      text,
      contextInfo: ctx,
    },
    {
      quoted: options.quoted,
    },
  );
}

async function sendMenu(sock, jid, text, image = null, options = {}) {
  if (image) {
    return sendImage(sock, jid, image, text, options);
  }
  return sendText(sock, jid, text, options);
}

export {
  sendText,
  sendReply,
  sendImage,
  sendVideo,
  sendAudio,
  sendSticker,
  sendDocument,
  sendContact,
  sendLocation,
  sendReact,
  sendWithTyping,
  sendToMultiple,
  forwardMessage,
  deleteMessage,
  createQuotedDummy,
  sendWithPreview,
  sendMenu,
};
