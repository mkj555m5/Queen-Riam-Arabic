import chalk from "chalk";
import * as timeHelper from "./rimuru-time.mjs";
import { getCachedJid, isLidConverted } from "./rimuru-lid.mjs";

// Mock gradient-string if any other file imports it from here
const gradientMock = (text) => text;
const gradient = () => gradientMock;

// 3 Main Colors
const cGreen = chalk.greenBright;
const cWhite = chalk.whiteBright;
const cGray = chalk.gray;

function makeTag(label, isSuccess = false, isError = false) {
  const l = label.toUpperCase().trim();
  let icon = "•";
  let colorFn = chalk.white;

  if (isSuccess || l === "OK" || l === "DONE") {
    icon = "✔";
    colorFn = chalk.green;
  } else if (isError || l === "FAIL" || l === "ERR" || l === "NO") {
    icon = "✖";
    colorFn = chalk.red;
  } else if (l === "WARN" || l === "WN") {
    icon = "⚠";
    colorFn = chalk.yellow;
  } else if (l === "INFO") {
    icon = "ℹ";
    colorFn = chalk.blue;
  } else if (l === "BOOT") {
    icon = "❖";
    colorFn = chalk.magenta;
  } else if (l === "SYS") {
    icon = "⚙";
    colorFn = chalk.cyan;
  } else if (l === "WAIT") {
    icon = "⟳";
    colorFn = chalk.yellow;
  } else if (l === "DBG") {
    icon = "🐛";
    colorFn = chalk.white;
  }

  const text = l.substring(0, 4).padEnd(4, " ");
  return `  ${colorFn(icon)}  ${colorFn(text)}`;
}

const SYM = {
  ok: makeTag("OK", true),
  no: makeTag("FAIL", false, true),
  wn: makeTag("WARN"),
  info: makeTag("INFO"),
  sys: makeTag("SYS"),
  dbg: makeTag("DBG"),
};

function writeLog(kind, label, detail = "") {
  const tags = {
    info: SYM.info,
    success: SYM.ok,
    warn: SYM.wn,
    error: SYM.no,
    system: SYM.sys,
    debug: SYM.dbg,
  };
  const tag = tags[kind] || SYM.info;

  // Format: [  OK  ] Started rimuru AI
  const msg = `${tag} ${chalk.cyanBright(label)}${detail ? " " + cWhite(detail) : ""}`;
  console.log(msg);
}

const logger = {
  info: (label, detail = "") => writeLog("info", label, detail),
  success: (label, detail = "") => writeLog("success", label, detail),
  warn: (label, detail = "") => writeLog("warn", label, detail),
  error: (label, detail = "") => writeLog("error", label, detail),
  system: (label, detail = "") => writeLog("system", label, detail),
  debug: (label, detail = "") => writeLog("debug", label, detail),
  tag: (label, msg, detail = "") => {
    console.log(`${makeTag(label.substring(0, 4))} ${cWhite(msg)}${detail ? " " + cGray(detail) : ""}`);
  },
};

function createSpinner(label = "SYS", text = "جارِ التحميل", options = {}) {
  // Simplified spinner for linux style (just log the start)
  let active = false;
  return {
    start() {
      active = true;
      console.log(`${makeTag(label)} ${cWhite(text)}...`);
    },
    update(nextText) {
      if (active) console.log(`${makeTag(label)} ${cWhite(nextText)}...`);
    },
    stop() {
      active = false;
    },
    succeed(detail = text) {
      this.stop();
      logger.success(label, detail);
    },
    warn(detail = text) {
      this.stop();
      logger.warn(label, detail);
    },
    fail(detail = text) {
      this.stop();
      logger.error(label, detail);
    },
    isActive() {
      return active;
    }
  };
}

async function spinText(label, text, options = {}) {
  // Directly print success since we want a fast, simple boot
  console.log(`${makeTag("OK", true)} ${cWhite(text)}`);
}

async function typeLine(text, options = {}) {
  // Strip formatting from caller if it used old colors
  const clean = text.replace(/\x1B\[\d+m/g, "");
  console.log(`${makeTag("OK", true)} ${cWhite(clean)}`);
}

async function runLoader(text = "جارِ التحميل", options = {}) {
  console.log(`${makeTag("OK", true)} ${cWhite(text)}`);
}

async function playBootSequence(info = {}) {
  const { name = "rimuru", version = "3.3", mode = "public" } = info;
  console.log("");
  console.log(chalk.cyan(`
          ██████╗ ██╗   ██╗██████╗ ██╗███╗   ██╗
         ██╔═══██╗██║   ██║██╔══██╗██║████╗  ██║
         ██║   ██║██║   ██║██████╔╝██║██╔██╗ ██║
         ██║   ██║██║   ██║██╔══██╗██║██║╚██╗██║
         ╚██████╔╝╚██████╔╝██║  ██║██║██║ ╚████║
          ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
`));
  console.log(`         ${chalk.magenta.bold("►")} ${chalk.white("rimuru MULTI-DEVICE BOT")} ${chalk.gray(`v${version}`)}`);
  console.log(`         ${chalk.magenta("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
  console.log("");
  console.log(`${makeTag("BOOT", true)} ${cWhite(`جارِ تشغيل النظام الرئيسي...`)}`);
  console.log(`${makeTag("INFO")} ${cWhite(`الوضع: ${chalk.cyan(mode)}`)}`);
}

function getTypeTag(msgType, isNewsletter) {
  if (isNewsletter) return "قناة";

  const map = {
    imageMessage: "صورة",
    videoMessage: "فيديو",
    audioMessage: "صوت",
    stickerMessage: "ملصق",
    documentMessage: "مستند",
    contactMessage: "جهة اتصال",
    locationMessage: "موقع",
    viewOnceMessageV2: "مشاهدة واحدة",
    extendedTextMessage: "نص",
    conversation: "نص",
    interactiveResponseMessage: "زر",
    pollCreationMessage: "تصويت",
    reactionMessage: "تفاعل",
  };
  return map[msgType] || "رسالة";
}

function logMessage(info) {
  if (typeof info === "string") {
    const [chatType, sender, message] = arguments;
    info = {
      chatType,
      sender,
      message,
      pushName: sender,
      groupName: chatType === "group" ? "غير معروف" : "خاص",
    };
  }

  const { chatType, groupName, pushName, sender, message, messageType, isNewsletter } = info;
  if (!message || message.trim() === "" || !sender) return;

  const num = sender.replace("@s.whatsapp.net", "");
  let msg = message;

  msg = msg.replace(/@(\d{10,})/g, (match, num) => {
    const lidJid = num + "@lid";
    const resolved = getCachedJid(lidJid);
    if (resolved && !isLidConverted(resolved)) return "@" + resolved.replace(/@.+/g, "");
    const swJid = num + "@s.whatsapp.net";
    const resolved2 = getCachedJid(swJid);
    if (resolved2 && !isLidConverted(resolved2)) return "@" + resolved2.replace(/@.+/g, "");
    return match;
  });

  const time = timeHelper.formatTime("HH:mm:ss");
  const date = timeHelper.formatTime("DD/MM/YYYY");
  const typeTag = getTypeTag(messageType, isNewsletter || chatType === "newsletter");

  const location = chatType === "group" || chatType === "newsletter" ? (groupName || "مجموعة") : "خاص";
  const senderName = pushName || num;

  console.log("");
  console.log(`  ${cWhite("╭─")} ${chalk.bgWhiteBright("هيه، وصلت رسالة جديدة :3")} ${cGray("•")} ${chatType === "private" ? chalk.yellow("خاص") : chalk.whiteBright("من مجموعة") + " " + chalk.bgCyanBright(location)}`);
  console.log(`  ${cWhite("│")}  👤 ${chalk.greenBright(senderName)} ${cGray(`(${num})`)}`);
  console.log(`  ${cWhite("│")}  📱 ${chalk.yellowBright(info.device || "غير معروف")} ${chalk.red(`• ${time} • ${typeTag}`)}`);
  const maxWidth = 55;
  const msgLines = [];

  msg.split('\n').forEach(line => {
    let currentLine = "";
    line.split(' ').forEach(word => {
      if ((currentLine + word).length > maxWidth) {
        if (currentLine) {
          msgLines.push(currentLine.trimEnd());
          currentLine = word + " ";
        } else {
          const chunks = word.match(new RegExp(`.{1,${maxWidth}}`, 'g')) || [];
          chunks.slice(0, -1).forEach(c => msgLines.push(c));
          currentLine = (chunks[chunks.length - 1] || "") + " ";
        }
      } else {
        currentLine += word + " ";
      }
    });
    if (currentLine) {
      msgLines.push(currentLine.trimEnd());
    }
  });

  msgLines.forEach((line, index) => {
    if (index === 0) {
      console.log(`  ${cWhite("│")}  💬 ${chalk.whiteBright(line)}`);
    } else {
      console.log(`  ${cWhite("│")}     ${chalk.whiteBright(line)}`);
    }
  });
  console.log(`  ${cWhite("╰─")}`);
}

function logPlugin(name, category) {
  // Simple tree view for plugin
  console.log(`  ${cGray("├─")} ${cWhite(name)} ${cGray(`[${category}]`)}`);
}

function logConnection(status, info = "") {
  if (status === "connected") {
    console.log(`${makeTag("OK", true)} ${cWhite("تم الاتصال")} ${cWhite(info ? `— ${info}` : "")}`);
  } else if (status === "connecting") {
    console.log(`${makeTag("WAIT")} ${cWhite("جارِ الاتصال")} ${cWhite(info ? `— ${info}` : "")}`);
  } else {
    console.log(`${makeTag("FAIL", false, true)} ${cWhite("انقطع الاتصال")} ${cWhite(info ? `— ${info}` : "")}`);
  }
}

function logErrorBox(title, message) {
  console.log(`${makeTag("ERR", false, true)} ${cWhite(title)}: ${cGray(message)}`);
}

function printBanner(mini = false) {
  // No banner for linux style
}

function printStartup(info = {}) {
  // Already handled by boot sequence
}

const CODES = {
  reset: "", bold: "", dim: "", italic: "", underline: "",
  green: "", purple: "", white: "", gray: "", phantom: "",
  lime: "", silver: "", red: "", yellow: "", blue: "",
  cyan: "", magenta: "", bgBlack: "", bgGray: "",
};

// Map all colors to our 3 colors
const c = {
  green: cGreen,
  purple: cWhite,
  white: cWhite,
  gray: cGray,
  bold: (v) => v,
  dim: cGray,
  greenBold: cGreen,
  purpleBold: cWhite,
  whiteBold: cWhite,
  grayDim: cGray,
  red: cWhite,
  yellow: cWhite,
  cyan: cWhite,
  blue: cWhite,
  magenta: cWhite,
};

function divider() {
  // No divider for minimalism, or just a new line
  console.log("");
}

function createBanner(lines, color = "green") {
  return lines.map(l => `${cGray("│")} ${cWhite(l)}`).join("\n");
}

function getTimestamp() {
  return cGray(timeHelper.formatTime("HH:mm:ss"));
}

const theme = {
  primary: cWhite,
  secondary: cWhite,
  accent: cGreen,
  text: cWhite,
  dim: cGray,
  muted: cGray,
  success: cGreen,
  error: cWhite,
  warning: cWhite,
  info: cWhite,
  debug: cGray,
  border: cGray,
  tag: cWhite,
  pill: (t) => t,
  rainbow: gradientMock,
  borderFx: (t) => cGray(t),
  mintFx: (t) => cGreen(t),
  warmFx: (t) => cWhite(t),
  colorizeCategory: (t) => cWhite(t),
};

export {
  c,
  CODES,
  logger,
  createSpinner,
  spinText,
  typeLine,
  runLoader,
  playBootSequence,
  logMessage,
  logPlugin,
  logConnection,
  logErrorBox,
  printBanner,
  printStartup,
  createBanner,
  getTimestamp,
  divider,
  theme,
  chalk,
  gradient
};
