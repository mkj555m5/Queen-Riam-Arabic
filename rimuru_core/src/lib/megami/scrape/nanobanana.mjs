/*
Base : https://live3d.io
By : ZennzXD
Kamis 12 Maret 2026 04:21
Source : https://whatsapp.com/channel/0029Vb7t6q7A89MjyGEBG41y
*/

import crypto from 'crypto'
import CryptoJS from 'crypto-js'
import FormData from 'form-data'
import fetch from 'node-fetch'

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCwlO+boC6cwRo3UfXVBadaYwcX
0zKS2fuVNY2qZ0dgwb1NJ+/Q9FeAosL4ONiosD71on3PVYqRUlL5045mvH2K9i8b
AFVMEip7E6RMK6tKAAif7xzZrXnP1GZ5Rijtqdgwh+YmzTo39cuBCsZqK9oEoeQ3
r/myG9S+9cR5huTuFQIDAQAB
-----END PUBLIC KEY-----`

const APP_ID = "aifaceswap"
const U_ID = "1H5tRtzsBkqXcaJ"

function generateRandomString(len) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let res = ""
  for (let i = 0; i < len; i++) res += chars.charAt(Math.floor(Math.random() * chars.length))
  return res
}

function aesenc(data, key) {
  const k = CryptoJS.enc.Utf8.parse(key)
  return CryptoJS.AES.encrypt(data, k, {
    iv: k,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  }).toString()
}

function rsaenc(data) {
  const buffer = Buffer.from(data, 'utf8')
  return crypto.publicEncrypt(
    {
      key: PUBLIC_KEY,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    buffer
  ).toString('base64')
}

function gencryptoheaders(type, fp = null) {
  const e = new Date()
  const n = Math.floor(new Date(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), e.getUTCHours(), e.getUTCMinutes(), e.getUTCSeconds()).getTime() / 1000)
  const r = crypto.randomUUID()
  const i = generateRandomString(16)
  const fingerPrint = fp || crypto.randomBytes(16).toString('hex')
  const s = rsaenc(i)
  
  let signStr = (type === 'upload') ? `${APP_ID}:${r}:${s}` : `${APP_ID}:${U_ID}:${n}:${r}:${s}`

  return {
    fp: fingerPrint,
    fp1: aesenc(`${APP_ID}:${fingerPrint}`, i),
    'x-guide': s,
    'x-sign': aesenc(signStr, i),
    'x-code': Date.now().toString()
  }
}

async function upimage(buffer) {
  const cryptoHeaders = gencryptoheaders('upload')
  const form = new FormData()

  form.append('file', buffer, 'image.jpg')
  form.append('fn_name', 'demo-image-editor')
  form.append('request_from', '9')
  form.append('origin_from', '8f3f0c7387123ae0')

  const res = await fetch('https://app.live3d.io/aitools/upload-img', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'origin': 'https://live3d.io',
      'referer': 'https://live3d.io/',
      'theme-version': '83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q',
      ...cryptoHeaders
    },
    body: form
  })
  
  const data = await res.json()
  return { path: data.data.path, fp: cryptoHeaders.fp }
}

async function createJob(imgRemote, prompt, fp) {
  const cryptoHeaders = gencryptoheaders('create', fp)

  const res = await fetch('https://app.live3d.io/aitools/of/create', {
    method: 'POST',
    headers: { 
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/json',
      'origin': 'https://live3d.io',
      'referer': 'https://live3d.io/',
      'theme-version': '83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q',
      ...cryptoHeaders 
    },
    body: JSON.stringify({
      fn_name: 'demo-image-editor',
      call_type: 3,
      input: {
        model: 'nano_banana_pro',
        source_images: [imgRemote],
        prompt,
        aspect_radio: 'auto',
        request_from: 9
      },
      request_from: 9,
      origin_from: '8f3f0c7387123ae0'
    })
  })
  
  const data = await res.json()
  return data.data.task_id
}

async function cekjob(taskId, fp) {
  const cryptoHeaders = gencryptoheaders('check', fp)

  const res = await fetch('https://app.live3d.io/aitools/of/check-status', {
    method: 'POST',
    headers: { 
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/json',
      'origin': 'https://live3d.io',
      'referer': 'https://live3d.io/',
      'theme-version': '83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q',
      ...cryptoHeaders 
    },
    body: JSON.stringify({
      task_id: taskId,
      fn_name: 'demo-image-editor',
      call_type: 3,
      request_from: 9,
      origin_from: '8f3f0c7387123ae0'
    })
  })
  
  const data = await res.json()
  return data.data
}

export async function nanobanana(buffer, prompt) {
  const uploadInfo = await upimage(buffer)
  const taskId = await createJob(uploadInfo.path, prompt, uploadInfo.fp)

  let result
  do {
    await new Promise(r => setTimeout(r, 4000))
    result = await cekjob(taskId, uploadInfo.fp)
  } while (result.status !== 2)

  return 'https://temp.live3d.io/' + result.result_image
}
