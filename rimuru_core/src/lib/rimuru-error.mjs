import config from '../../config.mjs'
function te(prefix, command, pushName) {
    const tpl = config.errorTemplate || `☢ *ᴇʀʀᴏʀ*\n\n> حدث خطأ في الأمر \`{prefix}{command}\`\n> الرجاء المحاولة مرة أخرى لاحقًا يا {pushName}\n\n_إذا استمرت المشكلة، تواصل مع المالك_`
    return tpl
        .replace(/\{prefix\}/g, prefix || '.')
        .replace(/\{command\}/g, command || '?')
        .replace(/\{pushName\}/g, pushName || 'User')
}

export default te
