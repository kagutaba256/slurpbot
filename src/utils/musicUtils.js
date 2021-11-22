const { v4 } = require('uuid')
const ydl = require('youtube-dl-exec')

exports.isMusicLink = (link) => {
  const valid = ['youtube.com', 'youtu.be', 'soundcloud', 'bandcamp.com']
  return new RegExp(valid.join('|')).test(link)
}

exports.downloadMusicWithYdl = async (link) => {
  const id = v4()
  const audioFormat = 'mp3'
  const filename = `${id}.${audioFormat}`
  const path = process.env.MUSIC_PATH
  const filepath = path + '/' + filename
  console.log(`downloading ${link} to ${filepath}...`)
  await ydl(link, {
    extractAudio: true,
    audioFormat,
    q: true,
    o: filepath,
  })
  return { id, filename, filepath }
}
