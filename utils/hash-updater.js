require('dotenv').config({ path: './config/config.env' })
require('colors')
const mongoose = require('mongoose')
const sha1File = require('sha1-file')
const TikTok = require('../src/models/tiktokModel')
const fs = require('fs')

const updateHashes = async () => {
  await connectDB()
  try {
    let count = 0
    const entries = await TikTok.find()
    for (let i = 0; i < entries.length; i++) {
      let entry = entries[i]
      if (entry.filepath && fs.existsSync(entry.filepath)) {
        const hash = await sha1File(entry.filepath)
        await TikTok.updateOne({ _id: entry.id }, { hash })
        console.log(`${entry.id}'s hash is ${hash}'`.green)
        count++
      }
    }
    console.log(`updated ${count} entries`.green.inverse)
  } catch (err) {
    console.error(err)
  }
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

try {
  updateHashes()
} catch (e) {
  console.error(`Error: ${e.message}`.red.bold.inverse)
}
