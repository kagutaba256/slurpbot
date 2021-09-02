require('dotenv').config({ path: './config/config.env' })
require('colors')
const mongoose = require('mongoose')
const ydl = require('youtube-dl-exec')
const slugify = require('slugify')
const mkdirp = require('mkdirp')
const fs = require('fs')

const downloadAllSongs = async () => {
  await connectDB()
  let count = 0
  const music = Music()
  const files = await music.find()
  const root = process.env.MUSIC_PATH
  for (let i = 0; i < files.length; i++) {
    const song = files[i]
    console.log(`downloading ${song.link}...`.yellow)
    const requester = slugify(song.requester)
    const folder = `${root}/${requester}`
    await mkdirp(folder)
    await ydl(
      song.link,
      {
        extractAudio: true,
        audioFormat: 'mp3',
        q: true,
      },
      {
        cwd: folder,
      }
    )
      .then(() => {
        count++
        console.log(`slurped ${song.link}`.green)
      })
      .catch((err) => {
        console.log(`couldnt get ${song.link}`.red)
      })
  }
  console.log(`Downloaded ${count} songs.`.green.inverse)
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      useCreateIndex: true,
    })
    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline)
  } catch (error) {
    console.log(`Error: ${error.message}`.red.underline.bold)
    process.exit(1)
  }
}

const Music = () => {
  const musicSchema = mongoose.Schema({
    link: {
      type: String,
      required: true,
    },
    dateSaved: {
      type: Date,
      default: Date.now,
    },
    requester: {
      type: String,
    },
  })
  return mongoose.model('music', musicSchema)
}

try {
  downloadAllSongs()
} catch (e) {
  console.error(`Error: ${e.message}`.red.bold.inverse)
}
