import fs from 'fs'
import FormData from 'form-data'
import path from 'path'
import axios from 'axios'

function genserial() {
  let s = ''
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

async function upimage(filename) {
  const form = new FormData()
  form.append('file_name', filename)

  const res = await axios.post(
    'https://api.imgupscaler.ai/api/common/upload/upload-image',
    form,
    {
      headers: {
        ...form.getHeaders(),
        origin: 'https://imgupscaler.ai',
        referer: 'https://imgupscaler.ai/'
      }
    }
  )

  return res.data.result
}

async function uploadtoOSS(put, filepath) {
  const type = path.extname(filepath).toLowerCase() === '.png'
    ? 'image/png'
    : 'image/jpeg'

  const stream = fs.createReadStream(filepath)

  const res = await axios.put(put, stream, {
    headers: { 'Content-Type': type },
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  })

  return res.status === 200
}

async function createJob(imgurl, original, replace) {
  const form = new FormData()
  form.append('original_image_url', imgurl)
  form.append('original_text', original)
  form.append('replace_text', replace)

  const res = await axios.post(
    'https://api.magiceraser.org/api/magiceraser/v2/text-replace/create-job',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'product-code': 'magiceraser',
        'product-serial': genserial(),
        origin: 'https://imgupscaler.ai',
        referer: 'https://imgupscaler.ai/'
      }
    }
  )

  return res.data.result.job_id
}

async function cekjob(jobId) {
  const res = await axios.get(
    `https://api.magiceraser.org/api/magiceraser/v1/ai-remove/get-job/${jobId}`
  )
  return res.data
}

export async function textReplace(imgPath, original, replace) {
  const filename = path.basename(imgPath)

  const uploadInfo = await upimage(filename)
  await uploadtoOSS(uploadInfo.url, imgPath)

  const cdn = 'https://cdn.imgupscaler.ai/' + uploadInfo.object_name
  const jobId = await createJob(cdn, original, replace)

  let result
  do {
    await new Promise(r => setTimeout(r, 3000))
    result = await cekjob(jobId)
  } while (!result.result || !result.result.output_url)

  return result.result.output_url[0]
}
