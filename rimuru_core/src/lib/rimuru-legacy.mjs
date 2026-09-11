import { RIMURU_CORE_ROOT } from "../../rimuru_paths.mjs";
import { RIMURU_CORE_CONFIG, RIMURU_DEVELOPER } from "../../rimuru.mjs";
import fs from "fs";
import path from "path";
import { getDatabase } from "./rimuru-database.mjs";

const cache = new WeakMap();

const stateNames = new Set([
  "game","misi","bomb","xnxx","war","war2","tebakmakanan","ncsResults",
  "tebakanime","jbRooms","jbVotes","todRooms","players","blackjack",
  "lengkapikalimat","cerdasCermat","siapakahaku","koboy","kuis","caklontong",
  "casino","dungeon","slots","level","fightnaga","soccer","storyData",
  "story","duel","family100","math","tebakhewan","ulartangga"
]);

const cleanKey = (key) => {
  if (typeof key !== "string") return key;
  return key.includes("@") ? key.split("@")[0] : key;
};

function ensureUser(db, key) {
  const jid = typeof key === "string" && key.includes("@") ? key : `${key}@s.whatsapp.net`;
  let user = db.getUser(jid);
  if (!user) user = db.setUser(jid, {});
  if (!user) return {};

  if (user.money !== undefined && user.koin === undefined) user.koin = Number(user.money) || 0;
  if (user.balance !== undefined && user.saldo === undefined) user.saldo = Number(user.balance) || 0;
  if (user.limit !== undefined && user.energi === undefined) user.energi = Number(user.limit) || 0;
  if (user.premium !== undefined && user.isPremium === undefined) user.isPremium = !!user.premium;
  if (user.registered !== undefined && user.isRegistered === undefined) user.isRegistered = !!user.registered;

  for (const legacyProp of ["limit","money","balance","premium","registered"]) {
    try {
      if (Object.prototype.hasOwnProperty.call(user, legacyProp)) {
        delete user[legacyProp];
      }
    } catch {}
  }

  const aliases = {
    limit: {
      get() { return this.energi ?? 0; },
      set(v) { this.energi = Number.isFinite(Number(v)) ? Number(v) : 0; }
    },
    money: {
      get() { return this.koin ?? 0; },
      set(v) { this.koin = Number.isFinite(Number(v)) ? Number(v) : 0; }
    },
    balance: {
      get() { return this.saldo ?? this.koin ?? 0; },
      set(v) { this.saldo = Number.isFinite(Number(v)) ? Number(v) : 0; }
    },
    premium: {
      get() { return !!this.isPremium; },
      set(v) { this.isPremium = !!v; }
    },
    registered: {
      get() { return !!this.isRegistered; },
      set(v) { this.isRegistered = !!v; }
    }
  };

  for (const [prop, desc] of Object.entries(aliases)) {
    try {
      Object.defineProperty(user, prop, {
        configurable: true,
        enumerable: false,
        get: desc.get,
        set: desc.set
      });
    } catch {}
  }

  user.exp ??= 0;
  user.level ??= 1;
  user.health ??= 100;
  user.maxHealth ??= 100;
  user.warn ??= 0;
  user.bank ??= 0;
  user.premiumTime ??= 0;
  user.isRegistered ??= false;
  user.name ??= "Unknown";
  db.markDirty?.("users");
  return user;
}


function usersProxy(db) {
  const target = db.data.users;
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop !== "string") return t[prop];
      const key = cleanKey(prop);
      if (!t[key]) t[key] = ensureUser(db, key);
      return ensureUser(db, key);
    },
    set(t, prop, value) {
      if (typeof prop !== "string") { t[prop] = value; return true; }
      const key = cleanKey(prop);
      t[key] = value || {};
      db.markDirty?.("users");
      return true;
    },
    deleteProperty(t, prop) {
      const key = cleanKey(prop);
      delete t[key];
      db.markDirty?.("users");
      return true;
    },
    has(t, prop) {
      return prop in t || cleanKey(prop) in t;
    },
    ownKeys(t) { return Reflect.ownKeys(t); },
    getOwnPropertyDescriptor(t, prop) {
      return Object.getOwnPropertyDescriptor(t, prop) || {
        enumerable: true, configurable: true, writable: true, value: t[prop]
      };
    }
  });
}

function chatsProxy(db) {
  const target = db.data.groups;
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop !== "string") return t[prop];
      if (!t[prop]) t[prop] = db.setGroup(prop, {});
      return t[prop];
    },
    set(t, prop, value) {
      t[prop] = value || {};
      db.markDirty?.("groups");
      return true;
    },
    deleteProperty(t, prop) {
      delete t[prop];
      db.markDirty?.("groups");
      return true;
    },
    ownKeys(t) { return Reflect.ownKeys(t); },
    getOwnPropertyDescriptor(t, prop) {
      return Object.getOwnPropertyDescriptor(t, prop) || {
        enumerable: true, configurable: true, writable: true, value: t[prop]
      };
    }
  });
}

function legacyDb(db) {
  if (cache.has(db)) return cache.get(db);
  const users = usersProxy(db);
  const chats = chatsProxy(db);
  const dataTarget = {
    users,
    chats,
    stats: db.data.stats,
    msgs: {},
    sticker: {},
    settings: db.data.settings,
    sewa: db.data.sewa,
    premium: db.data.premium || [],
    owner: db.data.owner || [],
  };
  const data = new Proxy(dataTarget, {
    set(t, prop, value) {
      if (prop === "users" || prop === "chats") return true;
      t[prop] = value;
      return true;
    }
  });
  const out = {
    data,
    READ: false,
    async read() { db.readAll?.(); return data; },
    async write() { await db.save?.(); return data; },
    save: () => db.save?.(),
    chain: null,
    getUser: (jid) => ensureUser(db, jid),
    setUser: (jid, value) => ensureUser(db, jid) && db.setUser(jid, value),
    getGroup: (jid) => db.getGroup(jid),
    setGroup: (jid, value) => db.setGroup(jid, value),
  };
  cache.set(db, out);
  return out;
}

function mentions(text) {
  return [...String(text || "").matchAll(/@(\d{5,20})/g)].map(x => `${x[1]}@s.whatsapp.net`);
}

function guessMime(filename = "") {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mp3" || ext === ".m4a") return "audio/mpeg";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function legacyConn(sock) {
  const state = Object.create(null);
  const methods = {
    reply: async (chat, text, quoted, options = {}) =>
      sock.sendMessage(chat, { text: String(text ?? "") }, { quoted: quoted || undefined, ...options }),
    sendFile: async (chat, file, filename = "file", caption = "", quoted, ptt = false, options = {}) => {
      let data = file;
      if (typeof file === "string" && /^https?:\/\//i.test(file)) data = { url: file };
      else if (typeof file === "string" && fs.existsSync(file)) data = fs.readFileSync(file);

      const mime = options.mimetype || guessMime(filename);
      let content;
      if (mime.startsWith("image/")) content = { image: data, caption, mimetype: mime, ...options };
      else if (mime.startsWith("video/")) content = { video: data, caption, mimetype: mime, ...options };
      else if (mime.startsWith("audio/")) content = { audio: data, mimetype: mime, ptt, ...options };
      else if (mime === "image/webp" && options.asSticker) content = { sticker: data };
      else content = { document: data, fileName: filename, mimetype: mime, caption, ...options };
      return sock.sendMessage(chat, content, { quoted: quoted || undefined });
    },
    getName: async (jid) => {
      const id = String(jid || "");
      if (sock.contacts?.[id]?.name) return sock.contacts[id].name;
      if (sock.contacts?.[id]?.notify) return sock.contacts[id].notify;
      return id.split("@")[0] || "Unknown";
    },
    parseMention: mentions,
    decodeJid: (jid) => String(jid || "").replace(/:\d+(?=@)/, ""),
    delay: (ms) => new Promise(r => setTimeout(r, ms)),
    sendThumb: async (chat, text, thumb, options = {}) =>
      sock.sendMessage(chat, { text, contextInfo: options.contextInfo || {} }, { quoted: options.quoted }),
    adReply: async (chat, text, options = {}) =>
      sock.sendMessage(chat, { text, contextInfo: options.contextInfo || {} }, { quoted: options.quoted }),
    waUploadToServer: async (x) => x,
    cMod: (chat, msg, text) => {
      try {
        const cloned = JSON.parse(JSON.stringify(msg));
        if (cloned?.message?.conversation) cloned.message.conversation = text;
        if (cloned?.message?.extendedTextMessage) cloned.message.extendedTextMessage.text = text;
        cloned.key = { ...(cloned.key || {}), remoteJid: chat };
        return cloned;
      } catch { return msg; }
    },
    sendGroupV4Invite: async (chat, jid, code, expiration, groupName, caption, jpegThumbnail) =>
      sock.sendMessage(chat, {
        groupInviteMessage: { groupJid: jid, inviteCode: code, inviteExpiration: expiration, groupName, caption, jpegThumbnail }
      }),
  };

  const out = new Proxy(state, {
    get(t, prop) {
      if (prop in methods) return methods[prop];
      if (prop === "user") return sock.user;
      if (prop in t) return t[prop];
      if (typeof sock[prop] === "function") return sock[prop].bind(sock);
      if (stateNames.has(prop)) return (t[prop] ||= {});
      return sock[prop];
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    }
  });
  return out;
}

function legacyMessage(m) {
  return new Proxy(m, {
    get(target, prop, receiver) {
      if (prop === "reply") {
        return async (text, quoted, options = {}) => {
          if (quoted && typeof quoted === "object" && !quoted.key && !quoted.message && !quoted.remoteJid) {
            return target.reply(text, quoted);
          }
          return target.reply(text, { ...(options || {}), ...(quoted ? { quoted } : {}) });
        };
      }
      if (prop === "copy") return () => target;
      if (prop === "copyNForward") return (...args) => target.forward?.(...args);
      return Reflect.get(target, prop, receiver);
    }
  });
}

function makeGlobals(sock, db, config) {
  const lc = legacyConn(sock);
  const ldb = legacyDb(db);
  const ownerNums = (config.owner?.number || []).map(x => String(x).replace(/\D/g, "")).filter(Boolean);
  const api = {
    faa: "https://api-faa.my.id",
    lol: "https://api.lolhuman.xyz",
    deline: "https://api.deline.web.id",
  };
  global.conn = lc;
  global.db = ldb;
  global.DATABASE = ldb;
  global.plugins = global.__legacyPlugins || {};
  global.config = config;
  global.owner = ownerNums.map(n => [n, config.owner?.name || "Owner", true]);
  global.prems = [];
  global.mods = [];
  global.nomorown = ownerNums[0] || "";
  global.nomorbot = String(sock.user?.id || "").split(":")[0].split("@")[0];
  global.nameown = config.owner?.name || "Owner";
  global.namebot = RIMURU_CORE_CONFIG.bot?.name || "rimuru";
  global.wm = RIMURU_CORE_CONFIG.bot?.name || "rimuru";
  global.author = RIMURU_DEVELOPER || config.owner?.name || "Rimuru";
  global.wait = config.messages?.wait || "🕕 رمورو تعمل الآن… انتظر لحظة. 💙";
  global.eror = config.messages?.error || "☢ همف… واجهت رمورو مشكلة ما. حاول مرة أخرى لاحقًا. 💙";
  global.success = config.messages?.success || "💙 تم بنجاح… أنجزت رمورو الأمر من أجلك.";
  global.sukses = global.success;
  global.linkch = RIMURU_CORE_CONFIG.saluran?.link || "";
  global.chId = RIMURU_CORE_CONFIG.saluran?.id || "";
  global.newsletterName = RIMURU_CORE_CONFIG.saluran?.name || global.namebot;
  global.domain = config.pterodactyl?.server1?.domain || "";
  global.apikey = config.pterodactyl?.server1?.apikey || "";
  global.capikey = config.pterodactyl?.server1?.capikey || "";
  global.APIs = api;
  global.APIKeys = { [api.lol]: config.APIkey?.lolhuman || "" };
  global.API = (name, p = "/", query = {}, keyName) => {
    const base = api[name] || name;
    const q = query || keyName ? `?${new URLSearchParams({ ...(query || {}), ...(keyName ? { [keyName]: global.APIKeys[base] } : {}) })}` : "";
    return base + p + q;
  };
  global.multiplier = 1;
  global.autotyping = false;
  global.opts = global.opts || {};
  global.prefix = new RegExp("^[.!#/]");
  global.autocorrect = global.autocorrect || {};
  global.aiSessions = global.aiSessions || {};
  global.akinatorSessions = global.akinatorSessions || {};
  global.games = global.games || {};
  global.listedPlugins = global.listedPlugins || {};
  global.pmenus = global.pmenus || "◈";
  global.dmenub = global.dmenub || "✦ ";
  global.dmenub2 = global.dmenub2 || "┊ ";
  global.dmenuf = global.dmenuf || "┕━━━━━━━━━━━━━ ⬦ •";
  global.fla = global.fla || [
    "https://flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=water-logo&text=",
    "https://flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=crafts-logo&text="
  ];
  global.rpg = global.rpg || {
    emoticon(name = "") {
      const map = {
        level:"🧬", limit:"🌌", health:"❤️", exp:"✉️", money:"💵",
        potion:"🥤", diamond:"💎", common:"📦", uncommon:"🎁",
        mythic:"🗳️", legendary:"🗃️", pet:"🎁", trash:"🗑️",
        armor:"🥼", sword:"⚔️", pickaxe:"⛏️", fishingrod:"🎣",
        wood:"🪵", rock:"🪨", iron:"⛓️", gold:"👑", emerald:"💚",
        chicken:"🐔", ayam:"🐔", sapi:"🐄", babi:"🐖", cat:"🐈",
        dog:"🐕", fox:"🦊", wolf:"🐺", dragon:"🐉", fish:"🐟",
        ikan:"🐟", lobster:"🦞", udang:"🦐", kepiting:"🦀",
        steak:"🍝", trash:"🗑️", pelabuhan:"🛳️"
      };
      const key = String(name).toLowerCase();
      return map[key] || "";
    }
  };
  return { lc, ldb };
}

export function createLegacyPlugin(raw, filePath) {
  const names = [];
  if (Array.isArray(raw.help)) {
    for (const h of raw.help) {
      const n = String(h || "").trim().split(/\s+/)[0];
      if (n) names.push(n.toLowerCase());
    }
  } else if (raw.help) {
    const n = String(raw.help).trim().split(/\s+/)[0];
    if (n) names.push(n.toLowerCase());
  }

  if (Array.isArray(raw.command)) {
    names.push(...raw.command.map(x => String(x).replace(/^\/|\/$/g, "").toLowerCase()));
  } else if (raw.command instanceof RegExp) {
    const src = raw.command.source.replace(/^\^|\$$/g, "");
    if (!names.length && /^[A-Za-z0-9_+.-]+$/.test(src)) names.push(src.toLowerCase());
    if (src.includes("|")) {
      for (const x of src.split("|")) {
        const clean = x.replace(/\\/g, "");
        if (/^[A-Za-z0-9_+.-]+$/.test(clean)) names.push(clean.toLowerCase());
      }
    }
  }
  const uniq = [...new Set(names.filter(Boolean))];
  const primary = uniq[0] || path.basename(filePath, ".js");
  const aliases = uniq.slice(1);

  const tags = Array.isArray(raw.tags) ? raw.tags : (raw.tags ? [raw.tags] : []);
  const limit = raw.limit === false ? 0 : (Number.isFinite(raw.energy) ? raw.energy : 1);

  const plugin = {
    config: {
      name: primary,
      alias: aliases,
      category: String(tags[0] || "megami").toLowerCase(),
      description: raw.description || `ميزة Megami القديمة: ${primary}`,
      usage: Array.isArray(raw.help) ? String(raw.help[0] || primary) : String(raw.help || primary),
      example: raw.example || "",
      isOwner: !!(raw.owner || raw.rowner || raw.mods),
      isPremium: !!raw.premium,
      isGroup: !!raw.group,
      isPrivate: !!raw.private,
      isAdmin: !!raw.admin,
      isBotAdmin: !!raw.botAdmin,
      cooldown: Number.isFinite(raw.cooldown) ? raw.cooldown : 2,
      energi: limit,
      isEnabled: !raw.disabled && raw.disable !== true,
      skipRegistration: !raw.register,
    },
    legacy: { raw, filePath },
  };

  plugin.handler = async (m, ctx) => {
    const { sock, db, config } = ctx;
    const { lc, ldb } = makeGlobals(sock, db, config);
    const lm = legacyMessage(m);
    const legacyCtx = {
      conn: lc,
      m: lm,
      text: m.text || "",
      args: m.args || [],
      usedPrefix: m.prefix || ".",
      command: m.command || primary,
      participants: m.groupMetadata?.participants || [],
      isOwner: !!m.isOwner,
      isPrems: !!m.isPremium,
      isPremium: !!m.isPremium,
      db: ldb,
      __dirname: RIMURU_CORE_ROOT,
    };
    try {
      return await raw.call(lc, lm, legacyCtx);
    } finally {
      db.markDirty?.("users");
      db.markDirty?.("groups");
      db.markDirty?.("settings");
    }
  };

  return plugin;
}

export function runLegacyHook(hook, m, ctx) {
  try {
    const { sock, db, config } = ctx;
    const { lc, ldb } = makeGlobals(sock, db, config);
    const lm = legacyMessage(m);
    const hookCtx = {
      conn: lc,
      m: lm,
      text: m.text || "",
      args: m.args || [],
      usedPrefix: m.prefix || ".",
      command: m.command || "",
      participants: m.groupMetadata?.participants || [],
      isOwner: !!m.isOwner,
      isPrems: !!m.isPremium,
      isPremium: !!m.isPremium,
      db: ldb,
      __dirname: RIMURU_CORE_ROOT,
    };
    return Promise.resolve(hook.call(lc, lm, hookCtx)).finally(() => {
      db.markDirty?.("users");
      db.markDirty?.("groups");
      db.markDirty?.("settings");
    });
  } catch {
    return Promise.resolve(false);
  }
}
