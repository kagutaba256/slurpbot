const TikTokScraper = require('tiktok-scraper')
const axios = require('axios')
const slugify = require('slugify')
const ffmpeg = require('fluent-ffmpeg')
const stream = require('stream')
const { promisify } = require('util')
const { createWriteStream } = require('fs')
const { v4 } = require('uuid')
const ydl = require('youtube-dl-exec')

exports.isTiktokLink = (link) => {
  return (
    link.includes('http') &&
    link.includes('://') &&
    ((link.includes('twitch') && link.includes('/clip/')) ||
      link.includes('tiktok') ||
      link.includes('reddit'))
  )
}

exports.downloadTiktokVideo = async (link) => {
  const id = v4()
  const filename = id + '.mp4'
  const path = process.env.VIDEO_PATH
  const filepath = path + '/' + filename
  console.log(`downloading ${link} to ${filepath}...`)
  await ydl(link, { q: true, o: filepath })
  return { id, filename, filepath }
}

exports.downloadWithYdl = async (link, filepath) => {
  await ydl(link, { q: true }, { cwd: filepath })
}

exports.downloadFile = async (fileUrl, outputLocationPath) => {
  const finished = promisify(stream.finished)
  const writer = createWriteStream(outputLocationPath)
  return axios({
    method: 'get',
    url: fileUrl,
    timeout: 30 * 1000,
    responseType: 'stream',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.80 Safari/537.36',
      referer: 'https://www.tiktok.com/',
      cookie: `tt_webid_v2=689854141086886123`,
      //cookie: `tt_webid_v2=${cookieID}`,
    },
  }).then(async (response) => {
    response.data.pipe(writer)
    return finished(writer) //this is a Promise
  })
}

exports.makeVideoSmaller = async (input, output, sizeTarget) => {
  function ffConvert() {
    return new Promise((resolve, reject) => {
      console.log('doing things')
      try {
        ffmpeg()
          .input(input)
          .inputFormat('mp4')
          .outputOptions('-vcodec', 'libx264')
          //.outputOptions('-preset', 'slower')
          .outputOptions('-crf', '32')
          .on('progress', (progress) =>
            console.log('converting: ' + progress.timemark)
          )
          .save(output)
          .on('end', async (stdout, stderr) => {
            //console.log(stdout)
            //console.error(stderr)
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
      } catch (err) {
        throw new Error(err)
      }
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
