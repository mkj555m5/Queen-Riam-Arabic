// جسر توافق: يوجّه استيرادات "ourin" (فرع Baileys الخاص بـ Rimuru MD)
// إلى @whiskeysockets/baileys المتوفر في Queen Riam.
import * as baileys from "@whiskeysockets/baileys";

export const {
  proto,
  generateWAMessageFromContent,
  generateWAMessageContent,
  generateWAMessage,
  prepareWAMessageMedia,
  downloadContentFromMessage,
  downloadMediaMessage,
  getContentType,
  jidDecode,
  areJidsSameUser,
  normalizeMessageContent,
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = baileys;

export default baileys;
export * from "@whiskeysockets/baileys";
