// Queen Riam — Arabic Edition | الإعدادات
// كل القيم تُقرأ من متغيرات البيئة (.env) أو تكون بالقيم الافتراضية.
// المالك الافتراضي: 201270221253

require('dotenv').config({ override: true });

const settings = {
  // ── هوية البوت ─────────────────────────────────────────────────────────────
  botName:     process.env.BOT_NAME     || 'Queen Riam',
  botOwner:    process.env.BOT_OWNER    || '@ShowyWharf27322',
  packname:    process.env.PACK_NAME    || 'Queen Riam',
  author:      process.env.PACK_AUTHOR  || '@ShowyWharf27322',
  description: 'بوت واتساب عربي لإدارة المجموعات والأوامر.',
  version:     '1.0.0-ar',

  // ── المالك والجلسة ───────────────────────────────────────────────────────────
  // رقم المالك بصيغة دولية بدون + أو مسافات
  // الافتراضي: 201270221253 — يتيح الربط التلقائي بدون إدخال
  ownerNumber: (process.env.OWNER_NUMBER || '201270221253').replace(/[^0-9]/g, ''),

  // ── السلوك ──────────────────────────────────────────────────────────────────
  prefix:      process.env.PREFIX       || '.',
  timezone:    process.env.TIMEZONE     || 'Africa/Cairo',
  commandMode: process.env.COMMAND_MODE || 'public',   // 'public' أو 'private'

  // ── ميزات تلقائية (كلها معطلة افتراضياً) ───────────────────────────────────────
  AUTO_STATUS_REACT:  process.env.AUTO_STATUS_REACT  || 'false',
  AUTO_STATUS_REPLY:  process.env.AUTO_STATUS_REPLY  || 'false',
  AUTO_STATUS_MSG:    process.env.AUTO_STATUS_MSG     || 'تمت المشاهدة بواسطة Queen Riam',
  AUTOREAD:           process.env.AUTOREAD            || 'false',
  AUTOTYPE:           process.env.AUTOTYPE            || 'false',
  AUTORECORD:         process.env.AUTORECORD          || 'false',
  AUTORECORDTYPE:     process.env.AUTORECORDTYPE      || 'false',

  // ── API Keys ──────────────────────────────────────────────────────────────────
  giphyApiKey: process.env.GIPHY_API_KEY || '',
};

module.exports = settings;
