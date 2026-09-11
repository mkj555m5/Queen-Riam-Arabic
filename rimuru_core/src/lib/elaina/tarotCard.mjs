import { RIMURU_CORE_ROOT } from "../../../rimuru_paths.mjs";
import { Canvas, loadImage } from '@napi-rs/canvas';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';

const PP_FALLBACK = path.join(RIMURU_CORE_ROOT, 'assets', 'profile.jpg');

const W = 700;
const H = 1960;

const CARD_IMG_BASE = 'https://ishtarcollective.blob.core.windows.net/rider-waite-tarot/major-';

// Fallback URL map per card (slug → trustedtarot.com + sacred-texts)
const CARD_SLUGS = {
    0:  'the-fool',        1:  'the-magician',    2:  'the-high-priestess',
    3:  'the-empress',     4:  'the-emperor',     5:  'the-heirophant',
    6:  'the-lovers',      7:  'the-chariot',     8:  'strength',
    9:  'the-hermit',      10: 'wheel-of-fortune',11: 'justice',
    12: 'the-hanged-man',  13: 'death',           14: 'temperance',
    15: 'the-devil',       16: 'the-tower',       17: 'the-star',
    18: 'the-moon',        19: 'the-sun',         20: 'judgement',
    21: 'the-world',
};

async function _loadCardImg(imgId) {
    
    const slug = CARD_SLUGS[imgId] || '';
    const nn   = String(imgId).padStart(2, '0');

    const urls = [
        // Primary: ishtarcollective Azure blob (format confirmed: major-0.jpg)
        `https://ishtarcollective.blob.core.windows.net/rider-waite-tarot/major-${imgId}.jpg`,
        // Fallback 1: trustedtarot.com PNG
        slug ? `https://www.trustedtarot.com/img/cards/${slug}.png` : null,
        // Fallback 2: sacred-texts.com scans (format: rwcs01.jpg → rwcs22.jpg, 0=fool=01)
        `https://www.sacred-texts.com/tarot/rwcs/img/rwcs${String(imgId + 1).padStart(2,'0')}.jpg`,
        // Fallback 3: raw githubusercontent metabismuth tarot-json cards
        `https://raw.githubusercontent.com/metabismuth/tarot-json/master/cards/${nn}.jpg`,
        // Fallback 4: jsdelivr from same repo
        `https://cdn.jsdelivr.net/gh/metabismuth/tarot-json@master/cards/${nn}.jpg`,
    ].filter(Boolean);

    for (const url of urls) {
        try {
            const buf = await _fetch(url);
            if (buf && buf.length > 2000) {
                const img = await loadImage(buf);
                if (img && img.width > 0) return img;
            }
        } catch {}
    }
    return null;
}

const CARDS = [
    {
        id: 0, name: 'الأحمق', number: 'O', imgId: 0,
        accent: '#E8C97A', accentDark: '#8B6914', textLight: '#FFF8E7',
        keywords: ['بداية جديدة','مغامرة','حرية','عفوية'],
        upright:  'اليوم بداية فصل جديد. خُذ خطوة جسورة دون خوف. الكون يدعمك لتجرّب شيئاً لم تفعله من قبل. روحك الفتية هي قوتك.',
        reversed: 'قد تتصرف اليوم بتهور زائد. خذ نفساً عميقاً وأعد التفكير في قرارك الكبير قبل الخطوة. الحذر حكمة.',
    },
    {
        id: 1, name: 'الساحر', number: 'I', imgId: 1,
        accent: '#E8C97A', accentDark: '#8B6914', textLight: '#FFF8E7',
        keywords: ['قوة','إبداع','تجسيد','تركيز'],
        upright:  'كل ما تحتاجه موجود بين يديك. حان وقت الفعل وتحقيق الحلم. طاقة الكون تتدفق عبرك — استخدم إبداعك وقدراتك الآن.',
        reversed: 'احذر من التلاعب أو الأفكار غير الصادقة. تأكد من نقاء نيّتك قبل التصرف. قوتك قد تُستخدم في غير محلها إن لم تُوجّه جيداً.',
    },
    {
        id: 2, name: 'الكاهنة العليا', number: 'II', imgId: 2,
        accent: '#C8A8E8', accentDark: '#5A3080', textLight: '#F8F0FF',
        keywords: ['حدس','غموض','حكمة','باطن'],
        upright:  'أنصت لصوتك الداخلي اليوم. الجواب الذي تبحث عنه ليس في الخارج — بل مخبّأ في داخلك. التأمل والسكينة سيفتحان باب الفهم.',
        reversed: 'قد تتجاهل حدسك المهم. لا تدع ضجيج العالم الخارجي يغطي صوت قلبك العميق. ثق بغرائزك.',
    },
    {
        id: 3, name: 'الإمبراطورة', number: 'III', imgId: 3,
        accent: '#8FD98F', accentDark: '#2D6E2D', textLight: '#F0FFF0',
        keywords: ['وفرة','خصوبة','حنان','طبيعة'],
        upright:  'الوفرة تتدفق إليك. هذا هو الوقت الأمثل لرعاية علاقة أو مشروع أو حلم ينمو. الحب والإبداع سيثمران جمالاً إذا منحتهما اهتمامك.',
        reversed: 'ربما تعتمد كثيراً على الآخرين أو تُهمل نفسك. عد إلى ذاتك — اعتنِ باحتياجاتك أولاً قبل الاعتناء بغيرك.',
    },
    {
        id: 4, name: 'الإمبراطور', number: 'IV', imgId: 4,
        accent: '#E88A8A', accentDark: '#8B1A1A', textLight: '#FFF0F0',
        keywords: ['سلطة','نظام','استقرار','قيادة'],
        upright:  'تولّ القيادة اليوم. كن قائداً حازماً لكن عادلاً — في العمل والأسرة ونفسك. النظام والانضباط هما مفتاح نجاحك الآن.',
        reversed: 'قد تكون متصلباً أو مستبداً أكثر من اللازم. المرونة ليست ضعفاً. أنصت لمن حولك وراعِ وجهات النظر الأخرى.',
    },
    {
        id: 5, name: 'الكاهن الأكبر', number: 'V', imgId: 5,
        accent: '#E8C97A', accentDark: '#8B6914', textLight: '#FFF8E7',
        keywords: ['تقاليد','إرشاد','إيمان','عادات'],
        upright:  'اطلب الإرشاد من أكثر منك خبرة. التقاليد والقيم التي صمدت أمام الزمن ستكون سندك اليوم. انضم إلى مجتمع يوافق قيمك.',
        reversed: 'تساءل عن القواعد التي لم تعد منطقية بالنسبة لك. حان وقت التفكير المستقل والخروج بجرأة عن الأنماط القديمة المقيدة.',
    },
    {
        id: 6, name: 'العاشقان', number: 'VI', imgId: 6,
        accent: '#F0A0C0', accentDark: '#8B2050', textLight: '#FFF0F8',
        keywords: ['حب','اختيار','انسجام','التزام'],
        upright:  'يوم جيد للعلاقات وقرارات القلب المهمة. طاقة الحب تتدفق إليك — عبّر عن مشاعرك بصدق. اختياراتك اليوم ستبقى أثرها طويلاً.',
        reversed: 'ثمة انسجام منقطع في علاقتك أو في الخيار الذي تواجهه. راجع قيمك — ما الأهم بالنسبة لك حقاً؟',
    },
    {
        id: 7, name: 'العربة الحربية', number: 'VII', imgId: 7,
        accent: '#8AD8E8', accentDark: '#1A6080', textLight: '#F0FBFF',
        keywords: ['انتصار','عزيمة','سيطرة','طموح'],
        upright:  'أنت على درب النصر. حافظ على تركيزك ودافعيتك — ستوجد عقبات، لكنك أقوى من أن تعبرها. تحكم بمشاعرك وابقَ على هدفك.',
        reversed: 'قد تضيع عنك الرؤية أو تتفرق قواك. ركّز طاقتك على هدف رئيسي واحد ولا تدع الأنا تسيطر.',
    },
    {
        id: 8, name: 'القوة', number: 'VIII', imgId: 8,
        accent: '#F0C080', accentDark: '#8B5010', textLight: '#FFF8F0',
        keywords: ['شجاعة','صبر','ثبات','رفق'],
        upright:  'قوتك الحقيقية ليست من العضلات بل من القلب. واجه التحديات بالحنان والصبر. لطفك هو سلاحك الأعظم اليوم.',
        reversed: 'قد تشكك في قدراتك. تذكّر: الشجاعة ليست غياب الخوف، بل السير رغم الخوف. ثق بنفسك أكثر مما تفعل.',
    },
    {
        id: 9, name: 'الناسك', number: 'IX', imgId: 9,
        accent: '#C8D8E8', accentDark: '#304050', textLight: '#F0F8FF',
        keywords: ['عزلة','تأمل','نور داخلي','إرشاد'],
        upright:  'خصّص وقتاً للوحدة والتأمل. ابتعد عن الضجيج قليلاً — في الصمت ستجد الجواب. حكمتك هي نورك.',
        reversed: 'قد تنعزل عن العالم أكثر من اللازم. العزلة المديدة قد تضرّك. حان وقت الخروج ومشاركة نورك مع الآخرين.',
    },
    {
        id: 10, name: 'عجلة الحظ', number: 'X', imgId: 10,
        accent: '#E8C97A', accentDark: '#8B6914', textLight: '#FFF8E7',
        keywords: ['قدر','دورات','حظ','تغيير'],
        upright:  'عجلة الحظ تدور لصالحك! ستأتيك اليوم فرص غير متوقعة — استعد ولا تفوّت اللحظة. الكون يعمل لمصلحتك.',
        reversed: 'أنت تمر بدورة عصيبة. تذكّر أن العجلة تدور دائماً — هذا لن يدوم للأبد. اصبر وثق بالمسار.',
    },
    {
        id: 11, name: 'العدالة', number: 'XI', imgId: 11,
        accent: '#8FD98F', accentDark: '#2D6E2D', textLight: '#F0FFF0',
        keywords: ['عدالة','توازن','حقيقة','سبب ونتيجة'],
        upright:  'الحقيقة ستُكشف اليوم. لكل تصرفك نتيجة — تصرّف بنزاهة وصدق. الكارما في حركة، والعدالة ستُقام.',
        reversed: 'ربما تعاني أو ترتكب ظلماً. أعد النظر في الموقف من زاوية أكثر موضوعية. الخطأ قابل للإصلاح إذا اعتُرف به.',
    },
    {
        id: 12, name: 'المشنوق', number: 'XII', imgId: 12,
        accent: '#A8C8E8', accentDark: '#204060', textLight: '#F0F8FF',
        keywords: ['توقف','منظور جديد','تضحية','تخلي'],
        upright:  'توقف لحظة وانظر من زاوية مختلفة. تضحية صغيرة اليوم ستفتح فهماً كبيراً. التخلي عن السيطرة قد يكون الحرية الحقيقية.',
        reversed: 'قد تكون عالقاً وترفض التغيير. التضحية التي تتجنبها هي بالضبط ما تحتاجه. حان وقت ترك ما لم يعد يخدمك.',
    },
    {
        id: 13, name: 'الموت', number: 'XIII', imgId: 13,
        accent: '#C8B8D8', accentDark: '#402858', textLight: '#F8F0FF',
        keywords: ['تحول','نهاية وبداية','تغيير','انتقال'],
        upright:  'لا تخف — لا علاقة له بالموت الجسدي. مرحلة من حياتك ستنتهي اليوم لفتح المجال لما هو جديد وأفضل. اترك الماضي واستقبل التحول.',
        reversed: 'قد تقاوم تغييراً محتوماً. الخوف من النهاية يجعلك عالقاً. التغيير هو اليقين الوحيد في الحياة.',
    },
    {
        id: 14, name: 'الاعتدال', number: 'XIV', imgId: 14,
        accent: '#8FD9C8', accentDark: '#1A6050', textLight: '#F0FFFC',
        keywords: ['توازن','اعتدال','صبر','تكيف'],
        upright:  'ابحث عن التوازن في كل شيء اليوم. لا إفراط ولا تفريط — المنتصف هو قوتك. الصبر والاعتدال سيوصلانك إلى الانسجام.',
        reversed: 'ثمة اختلال في حياتك يحتاج انتباهك. ربما تعمل بجهد زائد أو تتكاسل أكثر من اللازم. اعثر على نقطة التوازن.',
    },
    {
        id: 15, name: 'الشيطان', number: 'XV', imgId: 15,
        accent: '#E87070', accentDark: '#8B1010', textLight: '#FFF0F0',
        keywords: ['تعلق','ظلال','إغراء','تحرر'],
        upright:  'احذر من العادة أو العلاقة التي تقيدك سلباً. أنت أكثر حرية مما تظن — تلك السلاسل ربما موجودة في ذهنك فقط. حان وقت مواجهة ظلالك.',
        reversed: 'بدأت تتحرر من القيود التي تحاصرك. الخطوة الأولى نحو الحرية اتُّخذت. واصل التقدم ولا تنظر خلفك.',
    },
    {
        id: 16, name: 'البرج', number: 'XVI', imgId: 16,
        accent: '#E8A040', accentDark: '#8B4010', textLight: '#FFF8F0',
        keywords: ['صدمة','بصيرة مفاجئة','انهيار','كشف'],
        upright:  'قد يحدث اليوم شيء مرعب — لكن خلف هذه الصدمة بصيرة عظيمة. ما انهار كان يجب أن يذهب. ابنِ على أساس أقوى.',
        reversed: 'نجوت من أزمة كبرى، أو ربما أجّلت تغييراً ضرورياً. تذكّر: تأخير الانهيار الضروري يطيل المعاناة فقط.',
    },
    {
        id: 17, name: 'النجمة', number: 'XVII', imgId: 17,
        accent: '#A0C8F0', accentDark: '#1A4880', textLight: '#F0F8FF',
        keywords: ['أمل','إلهام','سكينة','ثقة'],
        upright:  'النجوم تشع عليك اليوم. بعد الظلام يأتي النور. ثق بمسارك — حلمك في طريقه ليصبح واقعاً. الأمل هو أفضل دواء.',
        reversed: 'قد تشعر بيأس أو فقدان أمل. تذكّر: النجمة تظل تضيء حتى خلف الغيوم. اترك أمرك للوقت.',
    },
    {
        id: 18, name: 'القمر', number: 'XVIII', imgId: 18,
        accent: '#C0B0E0', accentDark: '#403060', textLight: '#F8F0FF',
        keywords: ['وهم','حدس','لاوعي','أحلام'],
        upright:  'ليس كل ما يظهر هو الواقع اليوم. ثق بحدسك وسط الحيرة. أخرج ما هو مخفي إلى السطح — لا تخف من مواجهة جانبك المظلم.',
        reversed: 'الحيرة تبدأ في التلاشي والوضوح قادم. الوهم الذي عمّاك يكشف حقيقته. واصل البحث عن النور.',
    },
    {
        id: 19, name: 'الشمس', number: 'XIX', imgId: 19,
        accent: '#F0D060', accentDark: '#907010', textLight: '#FFFFF0',
        keywords: ['سعادة','نجاح','حيوية','مجد'],
        upright:  'يوم استثنائي بانتظارك! الطاقة الإيجابية تفور — فالسعادة والنجاح والمجد بين يديك. استمتع بكل لحظة من هذا اليوم بقلبك كله.',
        reversed: 'ربما تبدو السعادة بعيدة اليوم. ابحث عن مصدر نور صغير حولك — الامتنان للأشياء البسيطة قد يغيّر نظرتك تغييراً جذرياً.',
    },
    {
        id: 20, name: 'الدينونة', number: 'XX', imgId: 20,
        accent: '#D0B890', accentDark: '#806040', textLight: '#FFF8F0',
        keywords: ['بعث','تأمل','مغفرة','نداء'],
        upright:  'حان وقت مساءلة اختياراتك والنهوض كأفضل نسخة منك. أنصت لنداءك الحقيقي. علّمك الماضي ما يكفي — حان وقت التطور.',
        reversed: 'قد تحاكم نفسك أو غيرك بقسوة زائدة. المغفرة تحرر. اترك عبء الذنب وافتح صفحة جديدة.',
    },
    {
        id: 21, name: 'العالم', number: 'XXI', imgId: 21,
        accent: '#98D898', accentDark: '#2A6E2A', textLight: '#F0FFF0',
        keywords: ['إتمام','تكامل','إنجاز','اكتمال'],
        upright:  'أنت في قمة الدورة! احتفل اليوم بإنجازك — لقد أتممت شيئاً مذهلاً. الكون يحتضنك بكل فخر.',
        reversed: 'اقتربت من هدفك لكن شيئاً لم يكتمل بعد. لا تتوقف عند خط النهاية — خطوة قليلة ويصير كل شيء تاماً.',
    },
];

const FORTUNES = {
    love:    ['افتح قلبك — هناك من ينظر إليك أكثر مما تتصور.','التواصل الصادق سيقوّي رابطتك العاطفية.','الحب الحقيقي يبدأ من محبة نفسك.','لقاء غير متوقع قد يجلب مفاجأة حلوة.','خذ مسافة قصيرة لتصفية مشاعرك.'],
    career:  ['فكرتك الإبداعية اليوم تستحق النضال.','اجتهادك اليوم سيثمر نتائج مُرضية.','لا تخف من القيادة — الفريق يحتاج توجيهك.','التعاون أقوى من العمل الفردي اليوم.','فرصة جديدة تطرق بابك — افتح!'],
    health:  ['الراحة الكافية هي أفضل استثمار في يومك.','أنصت لجسدك — إنه يعرف ما يحتاج.','الحركة الخفيفة ترفع طاقتك وتركيزك.','توازن العقل والجسد هو مفتاح حيويتك.','كُل بوعي واستمتع بكل لقمة.'],
    lucky:   ['7','3','21','14','9','38','42','1','17','28'],
    element: ['النار 🔥','الماء 💧','التراب 🌿','الهواء 🌬️','الأثير ✨'],
    planet:  ['عطارد ☿','الزهرة ♀','المريخ ♂','المشتري ♃','زحل ♄','القمر 🌙','الشمس ☀️'],
};

function _rng(seed) {
    let v = Math.abs(seed) || 42;
    return () => { v = (v * 16807) % 2147483647; return (v - 1) / 2147483646; };
}

async function _fetch(url) {
    return new Promise((res, rej) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { timeout: 14000 }, (r) => {
            if (r.statusCode === 301 || r.statusCode === 302) { req.destroy(); return _fetch(r.headers.location).then(res).catch(rej); }
            if (r.statusCode !== 200) { req.destroy(); return rej(new Error('HTTP '+r.statusCode)); }
            const ch = []; r.on('data', c => ch.push(c)); r.on('end', () => res(Buffer.concat(ch))); r.on('error', rej);
        });
        req.on('error', rej); req.on('timeout', () => { req.destroy(); rej(new Error('Timeout')); });
    });
}

async function _loadImg(src) {
    
    if (!src) return null;
    try {
        if (Buffer.isBuffer(src) && src.length > 800) return await loadImage(src);
        if (typeof src === 'string' && /^https?:\/\//.test(src)) {
            const buf = await _fetch(src);
            if (buf && buf.length > 1500) return await loadImage(buf);
            return null;
        }
        if (typeof src === 'string' && fs.existsSync(src)) return await loadImage(fs.readFileSync(src));
    } catch {}
    return null;
}

async function _getAvatar(src) {
    let img = await _loadImg(src);
    if (img) return img;
    if (fs.existsSync(PP_FALLBACK)) { img = await _loadImg(PP_FALLBACK); if (img) return img; }
    return null;
}

function _rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
}

function _wrapText(ctx, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) {
        const test = cur ? cur+' '+w : w;
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
        else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
}

function _star(ctx, cx, cy, rO, rI, n, color, alpha) {
    ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let i = 0; i < n*2; i++) {
        const r = i%2===0 ? rO : rI;
        const a = (i*Math.PI)/n - Math.PI/2;
        i===0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
               : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
}

function _drawOrnamentBorder(ctx, w, h, accent, accentDark) {
    const m = 12;
    ctx.save();
    ctx.strokeStyle = accentDark; ctx.lineWidth = 6;
    _rrect(ctx, m, m, w-m*2, h-m*2, 6); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    _rrect(ctx, m+6, m+6, w-m*2-12, h-m*2-12, 4); ctx.stroke();
    ctx.strokeStyle = accentDark; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6;
    _rrect(ctx, m+10, m+10, w-m*2-20, h-m*2-20, 3); ctx.stroke();
    ctx.globalAlpha = 1;

    const corners = [[m+18,m+18],[w-m-18,m+18],[m+18,h-m-18],[w-m-18,h-m-18]];
    corners.forEach(([cx,cy]) => _star(ctx,cx,cy,10,5,4,accent,0.85));

    const mid = [[w/2,m+9],[w/2,h-m-9],[m+9,h/2],[w-m-9,h/2]];
    mid.forEach(([cx,cy]) => {
        ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2);
        ctx.fillStyle=accent; ctx.globalAlpha=0.75; ctx.fill(); ctx.globalAlpha=1;
    });

    [['top',m+18,m+8],[' bottom',m+18,h-m-8]].forEach(([,x,y]) => {
        ctx.save(); ctx.strokeStyle=accent; ctx.lineWidth=1; ctx.globalAlpha=0.45;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(w-x,y); ctx.stroke(); ctx.restore();
    });
    ctx.restore();
}

function _drawTopLabel(ctx, number, W, accent, accentDark) {
    ctx.save();
    ctx.font = 'bold 22px serif'; ctx.fillStyle = accentDark;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.shadowColor = accent; ctx.shadowBlur = 8;
    ctx.fillText(number, 32, 42);
    ctx.textAlign = 'right';
    ctx.fillText(number, W-32, 42);
    ctx.restore();
}

function _drawCardNameBanner(ctx, name, y, w, accent, accentDark, textLight) {
    const banH = 52;
    ctx.save();
    const banG = ctx.createLinearGradient(0, y, 0, y+banH);
    banG.addColorStop(0,   'rgba(0,0,0,0.85)');
    banG.addColorStop(0.3, 'rgba(0,0,0,0.78)');
    banG.addColorStop(1,   'rgba(0,0,0,0.70)');
    ctx.fillStyle = banG; ctx.fillRect(0, y, w, banH);

    ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.60;
    ctx.beginPath(); ctx.moveTo(24, y+1); ctx.lineTo(w-24, y+1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, y+banH-1); ctx.lineTo(w-24, y+banH-1); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = 'bold 26px serif'; ctx.fillStyle = textLight;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = accent; ctx.shadowBlur = 14;
    ctx.fillText(name, w/2, y + banH/2);
    ctx.restore();
    return y + banH;
}

function _drawKeywords(ctx, keywords, y, w, accent, accentDark) {
    ctx.save();
    ctx.font = 'italic 14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';

    const text = keywords.join('  ·  ');
    ctx.fillStyle = accentDark; ctx.shadowColor = 'transparent';
    ctx.fillText(text, w/2, y+1);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent; ctx.shadowBlur = 6;
    ctx.fillText(text, w/2, y);
    ctx.restore();
}

function _drawFortune(ctx, text, x, y, maxW, textLight) {
    ctx.save();
    ctx.font = '14px serif'; ctx.fillStyle = textLight; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
    const lines = _wrapText(ctx, text, maxW);
    lines.forEach((l,i) => ctx.fillText(l, x, y + i*20));
    ctx.restore();
    return y + lines.length * 20;
}

function _drawInfoRow(ctx, items, x, y, w, accent, accentDark, textLight) {
    const colW = w / items.length;
    ctx.save();
    items.forEach(({label,value}, i) => {
        const cx = x + i*colW + colW/2;
        ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = accent;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.globalAlpha = 0.85;
        ctx.fillText(label, cx, y);
        ctx.font = '12px sans-serif'; ctx.fillStyle = textLight; ctx.globalAlpha = 0.75;
        ctx.fillText(value, cx, y+14);
        if (i < items.length-1) {
            ctx.strokeStyle = accent; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.25;
            ctx.beginPath(); ctx.moveTo(x+((i+1)*colW), y); ctx.lineTo(x+((i+1)*colW), y+30); ctx.stroke();
        }
    });
    ctx.globalAlpha = 1; ctx.restore();
}

function _drawAvatarCircle(ctx, img, cx, cy, r, accent) {
    ctx.save();
    ctx.shadowColor = accent; ctx.shadowBlur = 20; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.arc(cx, cy, r+4, 0, Math.PI*2);
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.arc(cx, cy, r+1, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
    const sc = Math.max((r*2)/img.width, (r*2)/img.height);
    ctx.drawImage(img, cx-img.width*sc/2, cy-img.height*sc/2, img.width*sc, img.height*sc);
    ctx.restore();
}

async function createTarotCard(opts = {}) {
    
    const {
        username  = 'Unknown',
        avatar    = null,
        cardIndex = null,
        reversed  = null,
    } = opts;

    const seed   = username.split('').reduce((a,c) => a+c.charCodeAt(0), 0);
    const dayOfY = Math.floor((new Date() - new Date(new Date().getFullYear(),0,0)) / 86400000);
    const rng    = _rng(seed + dayOfY * 17);

    const idx  = cardIndex !== null ? cardIndex % CARDS.length : Math.floor(rng() * CARDS.length);
    const card = CARDS[idx];
    const isRev = reversed !== null ? reversed : rng() > 0.72;
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];

    const loveF   = pick(FORTUNES.love);
    const careerF = pick(FORTUNES.career);
    const healthF = pick(FORTUNES.health);
    const luckyN  = pick(FORTUNES.lucky);
    const element = pick(FORTUNES.element);
    const planet  = pick(FORTUNES.planet);

    const [cardImgRaw, avatarImg] = await Promise.all([
        _loadCardImg(card.imgId).catch(() => null),
        _getAvatar(avatar),
    ]);

    const canvas = new Canvas(W, H);
    const ctx    = canvas.getContext('2d');

    ctx.fillStyle = '#1A1208'; ctx.fillRect(0, 0, W, H);

    const CARD_Y = 60;
    const CARD_H = Math.round(W * 1.62);
    const CARD_W = W;

    if (cardImgRaw) {
        if (isRev) {
            ctx.save();
            ctx.translate(W/2, CARD_Y + CARD_H/2);
            ctx.rotate(Math.PI);
            ctx.drawImage(cardImgRaw, -CARD_W/2, -CARD_H/2, CARD_W, CARD_H);
            ctx.restore();
        } else {
            ctx.drawImage(cardImgRaw, 0, CARD_Y, CARD_W, CARD_H);
        }
        const fadeG = ctx.createLinearGradient(0, CARD_Y + CARD_H*0.55, 0, CARD_Y + CARD_H);
        fadeG.addColorStop(0, 'rgba(0,0,0,0)');
        fadeG.addColorStop(0.55, 'rgba(0,0,0,0.72)');
        fadeG.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = fadeG; ctx.fillRect(0, CARD_Y, W, CARD_H);

        const topFade = ctx.createLinearGradient(0, CARD_Y, 0, CARD_Y+80);
        topFade.addColorStop(0, 'rgba(0,0,0,0.72)');
        topFade.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topFade; ctx.fillRect(0, CARD_Y, W, 80);
    } else {
        const fbG = ctx.createLinearGradient(0, CARD_Y, W, CARD_Y+CARD_H);
        fbG.addColorStop(0, '#1A1208'); fbG.addColorStop(1, '#2C2010');
        ctx.fillStyle = fbG; ctx.fillRect(0, CARD_Y, W, CARD_H);
    }

    _drawOrnamentBorder(ctx, W, H, card.accent, card.accentDark);
    _drawTopLabel(ctx, card.number, W, card.accent, card.accentDark);

    const INFO_PANEL_Y = CARD_Y + CARD_H - 10;
    const PAD = 28;
    let curY = INFO_PANEL_Y;

    curY = _drawCardNameBanner(ctx, card.name + (isRev ? '  ↓' : ''), curY, W, card.accent, card.accentDark, card.textLight);
    curY += 12;

    _drawKeywords(ctx, card.keywords, curY, W, card.accent, card.accentDark);
    curY += 26;

    ctx.save(); ctx.strokeStyle = card.accent; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.30;
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(W-PAD, curY); ctx.stroke();
    ctx.restore(); curY += 12;

    curY = _drawFortune(ctx, isRev ? card.reversed : card.upright, W/2, curY, W - PAD*2 - 8, card.textLight);
    curY += 14;

    ctx.save(); ctx.strokeStyle = card.accent; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(W-PAD, curY); ctx.stroke();
    ctx.restore(); curY += 10;

    _drawInfoRow(ctx, [
        { label: 'الحب',   value: loveF.split(' ').slice(0,3).join(' ')+'…' },
        { label: 'العمل',  value: careerF.split(' ').slice(0,3).join(' ')+'…' },
        { label: 'الصحة',  value: healthF.split(' ').slice(0,3).join(' ')+'…' },
    ], PAD, curY, W-PAD*2, card.accent, card.accentDark, card.textLight);
    curY += 38;

    ctx.save(); ctx.strokeStyle = card.accent; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.20;
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(W-PAD, curY); ctx.stroke();
    ctx.restore(); curY += 10;

    _drawInfoRow(ctx, [
        { label: '🍀 الحظ', value: luckyN },
        { label: '⚡ العنصر', value: element },
        { label: '🪐 الكوكب', value: planet },
    ], PAD, curY, W-PAD*2, card.accent, card.accentDark, card.textLight);
    curY += 36;

    ctx.save(); ctx.strokeStyle = card.accent; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.20;
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(W-PAD, curY); ctx.stroke();
    ctx.restore(); curY += 12;

    if (avatarImg) {
        const AV_R = 32, AV_CX = W/2, AV_CY = curY + AV_R + 2;
        _drawAvatarCircle(ctx, avatarImg, AV_CX, AV_CY, AV_R, card.accent);
        curY = AV_CY + AV_R + 10;
    }

    ctx.save();
    ctx.font = 'bold 13px serif'; ctx.fillStyle = card.textLight;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.shadowColor = card.accent; ctx.shadowBlur = 10;
    ctx.globalAlpha = 0.85;
    ctx.fillText(`✦  ${username.toUpperCase()}  ✦`, W/2, curY);
    curY += 18;
    ctx.font = '11px sans-serif'; ctx.fillStyle = card.accent; ctx.globalAlpha = 0.60;
    ctx.shadowBlur = 0;
    const todayStr = new Date().toLocaleDateString('ar',{day:'numeric',month:'long',year:'numeric'});
    ctx.fillText(todayStr + (isRev ? '  ·  معكوسة' : ''), W/2, curY);
    ctx.restore();

    const FINAL_H = Math.min(curY + 40, H);
    if (FINAL_H < H - 10) {
        const fc = new Canvas(W, FINAL_H);
        const fx = fc.getContext('2d');
        fx.drawImage(canvas, 0, 0);
        return fc.toBuffer('image/jpeg', { quality: 0.96 });
    }

    return canvas.toBuffer('image/jpeg', { quality: 0.96 });
}

function getTarotCard(username) {
    const seed   = username.split('').reduce((a,c) => a+c.charCodeAt(0), 0);
    const dayOfY = Math.floor((new Date() - new Date(new Date().getFullYear(),0,0)) / 86400000);
    const rng    = _rng(seed + dayOfY * 17);
    const idx    = Math.floor(rng() * CARDS.length);
    return CARDS[idx];
}

export { createTarotCard, getTarotCard, CARDS  };