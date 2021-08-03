const TikTokScraper = require('tiktok-scraper')
const axios = require('axios')
const slugify = require('slugify')
const ffmpeg = require('fluent-ffmpeg')
const stream = require('stream')
const { promisify } = require('util')
const { createWriteStream } = require('fs')
const { v4 } = require('uuid')

exports.isTiktokLink = (link) => {
  return link.includes('https://' && 'tiktok.com')
}

exports.downloadTiktokVideo = async (link) => {
  const getCookieRes = await axios.get(process.env.TEST_LINK, {
    withCredentials: true,
  })
  const cookieID = getCookieRes.headers['set-cookie'][0]
    .split(';')[0]
    .split('=')[1]
  const headers = {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.80 Safari/537.36',
    referer: 'https://www.tiktok.com/',
    //cookie: `tt_webid_v2=689854141086886123`,
    cookie: `tt_webid_v2=${cookieID}`,
  }
  let meta = false
  let data, author, title, slug, id
  try {
    const response = await TikTokScraper.getVideoMeta(link, headers)
    if (!response || !response.collector || !response.collector[0])
      throw new Error('ERROR: Could not download')
    data = response.collector[0]
    author = data.authorMeta.name
    title = data.text
    slug = slugify(title, {
      strict: true,
      lower: true,
      trim: true,
    }).substring(0, 50)
    id = data.id
    meta = true
  } catch (err) {
    console.error(err)
    try {
      id = link.split('/video/')[1].split('?')[0]
    } catch (err) {
      id = v4()
    }
  }
  const filename = id + '.mp4'
  const filepath = process.env.VIDEO_PATH + '/' + filename
  const videoOptions = {
    _: ['video'],
    d: true,
    download: true,
    asyncDownload: 5,
    a: 5,
    'async-download': 5,
    filepath: process.env.VIDEO_PATH,
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.80 Safari/537.36',
      referer: 'https://www.tiktok.com/',
      //cookie: `tt_webid_v2=689854141086886123`,
      cookie: `tt_webid_v2=${cookieID}`,
    },
  }
  const videoStuff = await TikTokScraper.video(link, videoOptions)
  if (!videoStuff || !videoStuff.message)
    throw new Error('ERROR: Could not download the video')
  return { meta, data, id, author, title, slug, filename, filepath }
}

exports.downloadFile = async (fileUrl, outputLocationPath) => {
  const finished = promisify(stream.finished)
  const writer = createWriteStream(outputLocationPath)
  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then(async (response) => {
    response.data.pipe(writer)
    return finished(writer) //this is a Promise
  })
}

exports.makeVideoSmaller = async (input, output, sizeTarget) => {
  function ffConvert() {
    return new Promise((resolve, reject) => {
      console.log('doing things')
      ffmpeg()
        .input(input)
        .inputFormat('mp4')
        .outputOptions('-fs', sizeTarget - 2000000)
        .on('progress', (progress) =>
          console.log('converting: ' + progress.timemark)
        )
        .save(output)
        .on('end', async (stdout, stderr) => {
          console.log(stdout)
          console.error(stderr)
          console.log(`done converting ${output}`)
          // await ffmpeg.ffprobe(output, (err, metadata) => {
          //   if (metadata.format.size >= sizeTarget) {
          //     console.log(`failed to make ${output} smaller than ${sizeTarget}`)
          //   }
          resolve()
          // })
        })
        .on('err', (err) => {
          reject(err)
        })
    })
  }
  await ffConvert()
}
//   await ffmpeg.ffprobe(input, async (err, metadata) => {
//     console.log('doing things 1234')
//     console.log('doing things 132')
//     if (metadata.format.size < sizeTarget) {
//       console.log('already smaller.')
//       retval = input
//       return input
//     } else {
//       console.log('doing things 1')
//       await ffmpeg.ffprobe(input, async (err, metadata) => {
//         function ffConvert() {
//           return new Promise((resolve, reject) => {
//             console.log('doing things')
//             ffmpeg()
//               .input(input)
//               .inputFormat('mp4')
//               .outputOptions('-fs', sizeTarget - 2000000)
//               .on('progress', (progress) =>
//                 console.log('converting: ' + progress.timemark)
//               )
//               .save(output)
//               .on('end', async (stdout, stderr) => {
//                 console.log(stdout)
//                 console.error(stderr)
//                 console.log(`done converting ${output}`)
//                 await ffmpeg.ffprobe(output, (err, metadata) => {
//                   if (metadata.format.size >= sizeTarget) {
//                     console.log(
//                       `failed to make ${output} smaller than ${sizeTarget}`
//                     )
//                   }
//                   return output
//                 })
//                 callback()
//               })
//               .on('err', (err) => {
//                 reject(err)
//               })
//               .run()
//           })
//         }
//         Promise.resolve(ffConvert())
//       })
//     }
//   })
// }
