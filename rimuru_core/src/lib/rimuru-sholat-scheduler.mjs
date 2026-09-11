import { RIMURU_CORE_CONFIG } from "../../rimuru.mjs";
import { getDatabase } from "./rimuru-database.mjs";
import { logger } from "./rimuru-logger.mjs";
import { CronJob } from "cron";
import config from "../../config.mjs";
import * as timeHelper from "./rimuru-time.mjs";
import { saluranCtx } from "./rimuru-context.mjs";
import { getTodaySchedule, extractPrayerTimes } from "./rimuru-sholat-api.mjs";

const TZ = "Asia/Jakarta";

const SHOLAT_MESSAGES = {
  imsak:
    "🌙 *وقت الإمساك*\n\n> مرحباً يا صديقي، حان وقت الإمساك.\n> أسرع بتناول السحور قبل انتهاء الوقت.",
  subuh:
    "🌅 *وقت الفجر*\n\n> مرحباً يا صديقي، حان وقت صلاة الفجر.\n> تحلّل بالوضوء وأسرع إلى الصلاة.",
  terbit:
    "☀️ *وقت الشروق*\n\n> طلعت الشمس.\n> نتمنى لك يوماً موفقاً!",
  dhuha:
    "🌤️ *وقت الضحى*\n\n> مرحباً يا صديقي، حان وقت صلاة الضحى.\n> لا تنسَ صلاة الضحى من ركعتين إلى ثماني ركعات.",
  dzuhur:
    "🌞 *وقت الظهر*\n\n> مرحباً يا صديقي، حان وقت صلاة الظهر.\n> تحلّل بالوضوء وأسرع إلى الصلاة.",
  ashar:
    "🌇 *وقت العصر*\n\n> مرحباً يا صديقي، حان وقت صلاة العصر.\n> تحلّل بالوضوء وأسرع إلى الصلاة.",
  maghrib:
    "🌆 *وقت المغرب*\n\n> مرحباً يا صديقي، حان وقت صلاة المغرب.\n> تحلّل بالوضوء وأسرع إلى الصلاة.",
  isya: "🌙 *وقت العشاء*\n\n> مرحباً يا صديقي، حان وقت صلاة العشاء.\n> تحلّل بالوضوء وأسرع إلى الصلاة.",
};

const PRAYER_NAMES_AR = {
  imsak: "الإمساك",
  subuh: "الفجر",
  terbit: "الشروق",
  dhuha: "الضحى",
  dzuhur: "الظهر",
  ashar: "العصر",
  maghrib: "المغرب",
  isya: "العشاء",
};

const GAMBAR_SUASANA = {
  imsak: "https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif",
  subuh: "https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif",
  terbit: "https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif",
  dhuha: "https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif",
  dzuhur:
    "https://cdn.gimita.id/download/qf2d6868_sheikh-zayed-grand-mosque_625x300_04_March_25_1769502237718_92212561.webp",
  ashar:
    "https://cdn.gimita.id/download/18537d69-a2e0-4dc2-a144-57dde0f359b5_1769502389063_5c004902.jpg",
  maghrib:
    "https://cdn.gimita.id/download/mosque-5950407_1280_1769502206553_660ae15c.webp",
  isya: "https://cdn.gimita.id/download/pngtree-nighttime-mosque-illustration-with-realistic-details-celebrating-ramadan-kareem-mubarak-image_3814083_1769502091988_e4cf3326.jpg",
};

const AUDIO_ADZAN = "https://files.catbox.moe/z2bj5s.mp3";

let sock = null;
let cachedSchedule = null;
let cacheDate = "";
const sholatCronJobs = new Map();
let dailyRefreshJob = null;

function getTodayDateString() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

async function loadTodaySchedule() {
  const todayStr = getTodayDateString();
  if (cachedSchedule && cacheDate === todayStr) return cachedSchedule;

  const db = getDatabase();
  const kotaSetting = db.setting("autoSholatKota") || {
    id: "1301",
    nama: "KOTA JAKARTA",
  };

  try {
    const jadwalData = await getTodaySchedule(kotaSetting.id);
    const schedule = extractPrayerTimes(jadwalData);
    const daerah = jadwalData.daerah || "DKI JAKARTA";
    
    let cityTz = "Asia/Jakarta";
    const d = daerah.toUpperCase();
    if (d.includes("SULAWESI") || d.includes("BALI") || d.includes("NUSA TENGGARA") || d.includes("KALIMANTAN SELATAN") || d.includes("KALIMANTAN TIMUR") || d.includes("KALIMANTAN UTARA")) {
      cityTz = "Asia/Makassar";
    } else if (d.includes("MALUKU") || d.includes("PAPUA")) {
      cityTz = "Asia/Jayapura";
    }

    cachedSchedule = { schedule, cityTz };
    cacheDate = todayStr;
    return cachedSchedule;
  } catch (e) {
    logger.error("SholatScheduler", `فشل جلب الجدول: ${e.message}`);
    return null;
  }
}

function clearSholatCronJobs() {
  for (const [, job] of sholatCronJobs) job.stop();
  sholatCronJobs.clear();
}

async function schedulePrayerTimes() {
  clearSholatCronJobs();

  const db = getDatabase();
  const globalEnabled = db.setting("autoSholat");
  if (!globalEnabled) return;

  const data = await loadTodaySchedule();
  if (!data) return;

  const { schedule, cityTz } = data;

  for (const [sholat, waktu] of Object.entries(schedule)) {
    if (waktu === "-") continue;

    const [hour, minute] = waktu.split(":").map(Number);
    const cronExpr = `${minute} ${hour} * * *`;

    const job = new CronJob(
      cronExpr,
      async () => {
        await sendSholatNotifications(sholat, waktu);
      },
      null,
      true,
      cityTz,
    );

    sholatCronJobs.set(sholat, job);
  }

  logger.info(
    "SholatScheduler",
    `جُدولت ${sholatCronJobs.size} أوقات صلاة (المنطقة الزمنية: ${cityTz})`,
  );
}

async function sendSholatNotifications(sholat, waktu) {
  try {
    const db = getDatabase();

    const closeGroup = db.setting("autoSholatCloseGroup") || false;
    const duration = db.setting("autoSholatDuration") || 5;
    const sendAudio = db.setting("autoSholatAudio") !== false;
    const kotaSetting = db.setting("autoSholatKota") || {
      nama: "KOTA JAKARTA",
    };

    const saluranId = RIMURU_CORE_CONFIG.saluran?.id || "120363400911374213@newsletter";
    const saluranName = RIMURU_CORE_CONFIG.saluran?.name || RIMURU_CORE_CONFIG.bot?.name || "rimuru-AI";

    let groupList = [];
    try {
      const groupsObj = await sock.groupFetchAllParticipating();
      groupList = Object.keys(groupsObj);
    } catch (e) {
      logger.error("SholatScheduler", `Failed to fetch groups: ${e.message}`);
      return;
    }

    if (groupList.length === 0) return;

    let sentCount = 0;
    const closedGroups = [];
    const isSholatTime = [
      "subuh",
      "dzuhur",
      "ashar",
      "maghrib",
      "isya",
    ].includes(sholat);

    const prayerName = PRAYER_NAMES_AR[sholat] || sholat;
    let message = `${SHOLAT_MESSAGES[sholat] || `🕌 *وقت ${prayerName}*`}\n\n⏰ *${waktu} بتوقيت جاكرتا*\n📍 *${kotaSetting.nama}*`;

    if (closeGroup && isSholatTime) {
      message += `\n\n> 🔒 _تُغلق المجموعة ${duration} دقيقة للصلاة_`;
    }

    for (const groupId of groupList) {
      const groupData = db.data?.groups?.[groupId] || {};
      if (groupData.notifSholat === false) continue;

      try {
        if (sendAudio && isSholatTime) {
          try {
            await sock.sendMessage(groupId, {
              audio: { url: AUDIO_ADZAN },
              mimetype: "audio/mpeg",
              ptt: false,
              contextInfo: {
                ...saluranCtx(),
                forwardedNewsletterMessageInfo: {
                  newsletterJid: saluranId,
                  newsletterName: saluranName,
                  serverMessageId: 127,
                },
              },
            });
          } catch (audioErr) {
            logger.error("SholatScheduler", `Failed to send audio to ${groupId}: ${audioErr.message}`);
          }
        }

        await sock.sendMessage(groupId, {
          text: message,
          contextInfo: {
            ...saluranCtx(),
            forwardedNewsletterMessageInfo: {
              newsletterJid: saluranId,
              newsletterName: saluranName,
              serverMessageId: 127,
            },
          },
        });

        if (closeGroup && isSholatTime) {
          try {
            await sock.groupSettingUpdate(groupId, "announcement");
            closedGroups.push(groupId);
          } catch (e) {
            logger.error(
              "SholatScheduler",
              `Failed to close ${groupId}: ${e.message}`,
            );
          }
        }

        sentCount++;
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        logger.error(
          "SholatScheduler",
          `Failed to send to ${groupId}: ${err.message}`,
        );
      }
    }

    if (closeGroup && closedGroups.length > 0) {
      setTimeout(
        async () => {
          for (const groupId of closedGroups) {
            try {
              await sock.groupSettingUpdate(groupId, "not_announcement");
              await sock.sendMessage(groupId, {
                text: `✅ فُتحت المجموعة مجدداً بعد صلاة ${prayerName}.\n\n> تقبّل الله صلاتنا. آمين 🤲`,
                contextInfo: {
                  forwardingScore: 9999,
                  isForwarded: true,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
                },
              });
              await new Promise((r) => setTimeout(r, 600));
            } catch (e) {
              logger.error(
                "SholatScheduler",
                `Failed to open ${groupId}: ${e.message}`,
              );
            }
          }
          logger.info(
            "SholatScheduler",
            `Opened ${closedGroups.length} groups after ${sholat}`,
          );
        },
        duration * 60 * 1000,
      );
    }

    if (sentCount > 0) {
      logger.info(
        "SholatScheduler",
        `Sent ${sholat} notification to ${sentCount} groups` +
          (closedGroups.length > 0 ? ` (${closedGroups.length} closed)` : ""),
      );
    }
  } catch (error) {
    logger.error("SholatScheduler", `Error: ${error.message}`);
  }
}

function initSholatScheduler(socketInstance) {
  sock = socketInstance;

  if (dailyRefreshJob) dailyRefreshJob.stop();

  dailyRefreshJob = new CronJob(
    "1 0 * * *",
    async () => {
      cachedSchedule = null;
      await schedulePrayerTimes();
    },
    null,
    true,
    TZ,
  );

  schedulePrayerTimes();
  logger.info(
    "SholatScheduler",
    "جدول أوقات الصلاة التلقائي يعمل الآن (فوري)",
  );
}

function stopSholatScheduler() {
  clearSholatCronJobs();
  if (dailyRefreshJob) {
    dailyRefreshJob.stop();
    dailyRefreshJob = null;
  }
  logger.info("SholatScheduler", "تم إيقاف جدول أوقات الصلاة");
}

export {
  initSholatScheduler,
  stopSholatScheduler,
  SHOLAT_MESSAGES,
  GAMBAR_SUASANA,
  AUDIO_ADZAN,
};
