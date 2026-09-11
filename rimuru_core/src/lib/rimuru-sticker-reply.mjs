// Optional sticker-reply hook. Kept deliberately safe: when no dedicated
// sticker-reply engine is configured, returning false lets normal command
// processing continue without throwing an import/runtime error.
export async function handleStickerReply() {
  return false;
}
