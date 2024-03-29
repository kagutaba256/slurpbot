import axios from 'axios'
import ffmpeg from 'fluent-ffmpeg'
import stream from 'stream'
import { promisify } from 'util'
import { createWriteStream } from 'fs'
import { v4 } from 'uuid'
import ydl from 'youtube-dl-exec'
import { getVideoDurationInSeconds } from 'get-video-duration'

export const isSlurpable = (link) => {
  const li = (str) => link.includes(str)
  return (
    (li('http') &&
      li('://') &&
      ((li('twitch') && li('clip')) ||
        li('tiktok') ||
        li('twitter') ||
        li('facebook') ||
        li('reddit') ||
        li('fb.watch') ||
        li('bilibili'))) ||
    ((li('youtube.com/watch') || li('youtu.be')) && !li('list'))
  )
}

export const isNonPostable = (link) => {
  const li = (str) => link.includes(str)
  return (
    li('youtube.com/watch') || li('youtu.be') || li('twitch') || li('bilibili')
  )
}

export const downloadVideoWithYdl = async (link) => {
  const id = v4()
  const filename = id + '.mp4'
  const path = process.env.VIDEO_PATH
  //const cookies = process.env.COOKIES_PATH
  const filepath = path + '/' + filename
  console.log(`downloading ${link} to ${filepath}...`)
  await ydl(link, {
    q: true,
    o: filepath,
    //cookies,
    userAgent: 'facebookexternalhit/1.1',
  })
  return { id, filename, filepath }
}

export const downloadFile = async (fileUrl, outputLocationPath) => {
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
    },
  }).then(async (response) => {
    response.data.pipe(writer)
    return finished(writer) //this is a Promise
  })
}

export const makeVideoSmaller = async (input, output, shrink) => {
  const duration = await getVideoDurationInSeconds(input)
  function ffConvert() {
    return new Promise((resolve, reject) => {
      try {
        let outputOptions = []
        let slownessOptions = []
        if (shrink) {
          const targetSize = 8 * 1024 * 1024 * 5.5
          const bitrate = Math.floor(targetSize / duration)
          console.log(`using bitrate ${bitrate}, size ${duration}, targetSize ${targetSize}`)
          // two-pass encoding
          outputOptions = ['-b', `${bitrate}`, '-pass', '1']
          slownessOptions = ['-preset', 'slow']
        } else {
          outputOptions = ['-crf', '32']
          //slownessOptions = ['-preset', 'slow']
        }
        ffmpeg()
          .input(input)
          .inputFormat('mp4')
          .outputOptions('-vcodec', 'libx264')
          //.outputOptions('-preset', 'slower')
          .outputOptions(outputOptions)
          .outputOptions(slownessOptions)
          .on('progress', (progress) =>
            console.log('converting: ' + progress.timemark)
          )
          .save(output)
          .on('end', async () => {
            console.log(`done converting ${output}`)
            resolve()
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
