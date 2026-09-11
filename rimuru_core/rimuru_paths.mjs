// جذر نسخة Rimuru المدمجة (يُستخدم بدلاً من process.cwd() في ملفات النواة)
import { dirname } from "path";
import { fileURLToPath } from "url";

export const RIMURU_CORE_ROOT = dirname(fileURLToPath(import.meta.url));
