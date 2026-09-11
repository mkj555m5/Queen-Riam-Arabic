import axios from 'axios'
import FormData from 'form-data'

export async function uguu(buffer) {
  const form = new FormData()
  form.append('files[]', buffer, 'image.jpg')

  const res = await axios.post('https://uguu.se/upload', form, {
    headers: form.getHeaders()
  })

  return {
    url: res.data.files[0].url
  }
}
