import { RIMURU_CORE_CONFIG } from "../../rimuru.mjs";
import fs from "fs";
import path from "path";
import config from "../../config.mjs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import axios from "axios";
import { getAssetBuffer } from "./rimuru-asset-manager.mjs";

let gameThumbBuffer = null;
let rpgThumbBuffer = null;
let winnerThumbBuffer = null;

const keys = [
  ["rimuru-games", (buf) => { gameThumbBuffer = buf; }],
  ["rimuru-rpg", (buf) => { rpgThumbBuffer = buf; }],
  ["rimuru-winner", (buf) => { winnerThumbBuffer = buf; }],
];
for (const [key, setter] of keys) {
  const buf = getAssetBuffer(key);
  if (buf) setter(buf);
}

const FAST_ANSWER_PRAISES = [
  "⚡ كالبرق! أنت عبقري!",
  "🚀 سريع جدًا! عقلٌ حاد!",
  "🔥 يا للروعة! إجابة أسرع من البرق!",
  "💫 مذهل! أنت كالبرق الخاطف!",
  "🎯 دقة عالية! إصابة مباشرة!",
  "⭐ نجم! ردود فعل خارقة!",
  "🏆 أسطوري! سرعة قصوى!",
  "💎 لاعب بريميوم! لا منافس لك!",
  "🦅 حاد كالنسر!",
  "🧠 عقل ضخم! ذكاء مرتفع!",
];

const FAST_ANSWER_THRESHOLD = 4000;
const FAST_ANSWER_BONUS = {
  exp: 50,
  balance: 500,
  limit: 1,
};

function getRandomPraise() {
  return FAST_ANSWER_PRAISES[
    Math.floor(Math.random() * FAST_ANSWER_PRAISES.length)
  ];
}

function _saluranCtx() {
  const saluranId = RIMURU_CORE_CONFIG.saluran?.id || "120363400911374213@newsletter";
  const saluranName = RIMURU_CORE_CONFIG.saluran?.name || RIMURU_CORE_CONFIG.bot?.name || "rimuru-AI";
  return {
    forwardingScore: 9,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: saluranId,
      newsletterName: saluranName,
      serverMessageId: 127,
    },
  };
}

function getGameContextInfo() {
  return _saluranCtx();
}

function getWinnerContextInfo() {
  return _saluranCtx();
}

function getRpgContextInfo(title, body) {
  const base = _saluranCtx();
  if (title || body) {
    base.externalAdReply = {
      title: title || RIMURU_CORE_CONFIG.bot?.name || "rimuru RPG",
      body: body || "",
      sourceUrl: RIMURU_CORE_CONFIG.saluran?.link || "",
      mediaType: 1,
      renderLargerThumbnail: false,
      thumbnail: rpgThumbBuffer,
    };
  }
  return base;
}

async function sendGamePreview(sock, jid, text, title, body, options) {
  const msgId = await sock.sendPreview(
    jid,
    {
      caption: `${config.info.website} ${text}`,
      url: `${config.info.website}`,
      title: title || "🎮 rimuru GAMES",
      description: body || "استمتع باللعب!",
      jpegThumbnail: gameThumbBuffer,
      previewType: 0,
    },
    { contextInfo: _saluranCtx(), ...options },
  );
  return { key: { id: msgId, remoteJid: jid, fromMe: true } };
}

async function sendWinnerPreview(sock, jid, text, title, body, options) {
  const msgId = await sock.sendPreview(
    jid,
    {
      caption: `${config.info.website} ${text}`,
      url: `${config.info.website}`,
      title: title || "🏆 WINNER!",
      description: body || "مبروك، لقد فزت!",
      jpegThumbnail: winnerThumbBuffer || gameThumbBuffer,
      previewType: 0,
    },
    { contextInfo: _saluranCtx(), ...options },
  );
  return { key: { id: msgId, remoteJid: jid, fromMe: true } };
}

async function sendRpgPreview(sock, jid, text, title, body, options) {
  const msgId = await sock.sendPreview(
    jid,
    {
      caption: `${config.info.website} ${text}`,
      url: `${config.info.website}`,
      title: title || "⚔️ rimuru RPG",
      description: body || "المغامرة بانتظارك!",
      jpegThumbnail: rpgThumbBuffer,
      previewType: 0,
    },
    { contextInfo: _saluranCtx(), ...options },
  );
  return { key: { id: msgId, remoteJid: jid, fromMe: true } };
}

async function sendToolsPreview(sock, jid, text, title, body, options) {
  const msgId = await sock.sendPreview(
    jid,
    {
      caption: `${config.info.website} ${text}`,
      url: `${config.info.website}`,
      title: title || "🛠️ rimuru TOOLS",
      description: body || "أدوات وفائدة",
      jpegThumbnail: gameThumbBuffer,
      previewType: 0,
    },
    { contextInfo: _saluranCtx(), ...options },
  );
  return { key: { id: msgId, remoteJid: jid, fromMe: true } };
}

function saluranCtx() {
  return _saluranCtx();
}

function checkFastAnswer(session) {
  if (!session?.startTime) return { isFast: false };

  const elapsed = Date.now() - session.startTime;

  if (elapsed <= FAST_ANSWER_THRESHOLD) {
    return {
      isFast: true,
      elapsed: elapsed,
      praise: getRandomPraise(),
      bonus: FAST_ANSWER_BONUS,
    };
  }

  return { isFast: false, elapsed: elapsed };
}

function createFakeQuoted(botName = "rimuru-AI", verified = true) {
  return {
    key: {
      fromMe: false,
      participant: "0@s.whatsapp.net",
      remoteJid: "status@broadcast",
    },
    message: {
      contactMessage: {
        displayName: verified ? `✅ ${botName}` : botName,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:${verified ? "Verified Bot" : "Bot"}\nEND:VCARD`,
      },
    },
  };
}

export {
  getGameContextInfo,
  getWinnerContextInfo,
  getRpgContextInfo,
  sendGamePreview,
  sendWinnerPreview,
  sendRpgPreview,
  sendToolsPreview,
  saluranCtx,
  createFakeQuoted,
  checkFastAnswer,
  getRandomPraise,
  gameThumbBuffer,
  rpgThumbBuffer,
  winnerThumbBuffer,
  FAST_ANSWER_THRESHOLD,
  FAST_ANSWER_BONUS,
  FAST_ANSWER_PRAISES,
};
