import { RIMURU_CORE_ROOT } from "../../rimuru_paths.mjs";
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logger } from './rimuru-logger.mjs';
import config from '../../config.mjs';

// Memory cache for both local and remote assets.
const assetCache = Object.create(null);
const remoteCache = new Map();

function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

async function fetchRemoteBuffer(url, timeout = 30000) {
  if (!isRemoteUrl(url)) return null;
  if (remoteCache.has(url)) return remoteCache.get(url);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout,
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0 Rimuru-MD AssetLoader' },
  });

  const buffer = Buffer.from(response.data);
  remoteCache.set(url, buffer);
  return buffer;
}

/**
 * Preload all configured single-file assets into memory. Remote URLs are fetched
 * once at startup so existing synchronous consumers can keep receiving Buffers.
 */
export async function preloadAssets(configAssets) {
  if (!configAssets) return;

  const entries = Object.entries(configAssets);
  for (const [key, value] of entries) {
    try {
      if (typeof value === 'string' && isRemoteUrl(value)) {
        const buffer = await fetchRemoteBuffer(value);
        if (buffer) {
          assetCache[key] = buffer;
          logger.system('CACHE', `Loaded remote: ${key}`);
        }
        continue;
      }

      if (typeof value === 'string') {
        const fullPath = path.resolve(RIMURU_CORE_ROOT, value);
        if (fs.existsSync(fullPath)) {
          assetCache[key] = fs.readFileSync(fullPath);
          logger.system('CACHE', `Loaded: ${key}`);
        } else {
          logger.warn('CACHE', `File not found: ${fullPath}`);
        }
      }
    } catch (e) {
      logger.error('CACHE', `Failed to load ${key}: ${e.message}`);
    }
  }
}

/**
 * Get the cached asset buffer by key. Local assets are loaded synchronously;
 * remote assets are expected to have been preloaded by preloadAssets().
 */
export function getAssetBuffer(key, configAssets = null) {
  if (assetCache[key]) return assetCache[key];

  const assets = configAssets || config?.assets;
  const value = assets?.[key];
  if (isRemoteUrl(value)) {
    // A remote asset must be preloaded because this API is synchronous.
    return null;
  }

  if (typeof value === 'string') {
    try {
      const fullPath = path.resolve(RIMURU_CORE_ROOT, value);
      if (fs.existsSync(fullPath)) {
        const buf = fs.readFileSync(fullPath);
        assetCache[key] = buf;
        return buf;
      }
    } catch (e) {
      console.error(`  ✖  ERR   Failed to read ${key} from disk:`, e.message);
    }
  }

  return null;
}

/** Fetch an arbitrary asset URL with an in-memory cache. */
export async function getRemoteAssetBuffer(url) {
  return fetchRemoteBuffer(url);
}

/** Return a random shuffle image as a Buffer. */
export async function getRandomShuffleAssetBuffer(urls = config?.assets?.shuffleUrls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  const url = urls[Math.floor(Math.random() * urls.length)];
  try {
    return await fetchRemoteBuffer(url);
  } catch (e) {
    logger.warn('SHUFFLE', `Failed to fetch remote shuffle image: ${e.message}`);
    return null;
  }
}

/**
 * Update an asset buffer in memory and optionally save it to disk.
 */
export function updateAssetAndSave(key, buffer, filepath) {
  assetCache[key] = buffer;
  if (filepath && !isRemoteUrl(filepath)) {
    try {
      const fullPath = path.resolve(RIMURU_CORE_ROOT, filepath);
      fs.writeFileSync(fullPath, buffer);
    } catch (e) {
      console.error(`  ✖  ERR   Failed to write updated asset ${key} to disk:`, e.message);
    }
  }
}
