const axios = require('axios')
const ffmpeg = require('fluent-ffmpeg')
const stream = require('stream')
const { promisify } = require('util')
const { createWriteStream } = require('fs')
const { v4 } = require('uuid')
const ydl = require('youtube-dl-exec')

exports.isSlurpable = (link) => {
  const li = (str) => link.includes(str)
  return (
    (li('http') &&
      li('://') &&
      ((li('twitch') && li('clip')) ||
        li('tiktok') ||
        li('twitter') ||
        li('facebook') ||
        li('reddit') ||
        li('bilibili'))) ||
    ((li('youtube.com/watch') || li('youtu.be')) && !li('list'))
  )
}

exports.isNonPostable = (link) => {
  const li = (str) => link.includes(str)
  return (
    li('youtube.com/watch') || li('youtu.be') || li('twitch') || li('bilibili')
  )
}

exports.downloadVideoWithYdl = async (link) => {
  const id = v4()
  const filename = id + '.mp4'
  const path = process.env.VIDEO_PATH
  const cookies = process.env.COOKIES_PATH
  const filepath = path + '/' + filename
  console.log(`downloading ${link} to ${filepath}...`)
  await ydl(link, {
    q: true,
    o: filepath,
    cookies,
    userAgent: 'facebookexternalhit/1.1',
  })
  return { id, filename, filepath }
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
    },
  }).then(async (response) => {
    response.data.pipe(writer)
    return finished(writer) //this is a Promise
  })
}

exports.makeVideoSmaller = async (input, output, shrink) => {
  function ffConvert() {
    return new Promise((resolve, reject) => {
      try {
        let outputOptions = []
        let slownessOptions = []
        if (shrink) {
          outputOptions = ['-crf', '40']
          slownessOptions = ['-preset', 'medium']
        } else {
          outputOptions = ['-crf', '28']
          slownessOptions = ['-preset', 'faster']
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
