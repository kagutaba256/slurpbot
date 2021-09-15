require('dotenv').config({ path: './config/config.env' })
require('colors')
const discord = require('discord.js')
require('./utils/ExtendedMessage')
const { v4 } = require('uuid')
const { reactToMessage } = require('./utils/messageUtils')
const { connectDB } = require('./utils/db')
const TikTok = require('./models/tiktokModel')
const Music = require('./models/musicModel')
const Pic = require('./models/picModel')
const {
  isSlurpable,
  isNonPostable,
  downloadVideoWithYdl,
  makeVideoSmaller,
  downloadFile,
} = require('./utils/videoUtils')
const { isMusicLink, downloadMusicWithYdl } = require('./utils/musicUtils')

connectDB()

const client = new discord.Client()
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`.bgGreen.black)
  client.user.setActivity('with my slurper', {
    type: 'PLAYING',
  })
})

client.on('message', async (message) => {
  if (message.author.bot) return
  if (message.channel.id === process.env.VIDEO_CHANNEL_ID) {
    if (message.attachments.size > 0) {
      const a = message.attachments.array()[0]
      if (a.url.indexOf('mp4', a.url.length - 'mp4'.length) !== -1) {
        try {
          const randomGuid = v4()
          const randomFileName = randomGuid + '.mp4'
          const filepath = process.env.VIDEO_PATH + '/' + randomFileName
          console.log(`downloading ${a.name} as ${randomFileName}`)
          await reactToMessage(message, '⬇️')
          downloadFile(a.url, filepath)
          console.log(`done downloading ${randomFileName}.`)
          options = {
            vid_id: randomGuid,
            requester: message.author.tag,
            filename: randomFileName,
            filepath,
          }
          await TikTok.create(options)
          console.log(`sent ${randomGuid} to db`)
          await reactToMessage(message, '💾')
        } catch (err) {
          console.error(err)
          await reactToMessage(message, '❗')
        }
      }
      return
    }
    let link = null
    message.content.split(' ').map((word) => {
      if (isSlurpable(word)) link = word
    })
    if (link === null) return
    if (isSlurpable(link)) {
      try {
        console.log(`checking if ${link} exists...`)
        const result = await TikTok.findOne({ link })
        if (result) {
          await reactToMessage(message, '⬆️')
          let contentPath = null
          if (!isNonPostable(link)) contentPath = result.filepath
          await message.inlineReply(
            `\`\`\`diff\n- ALREADY LINKED BY ${result.requester} ON ${result.dateConverted}.\`\`\``
          )
          await message.inlineReply('', { files: [contentPath] })
          await reactToMessage(message, '🤡')
          return
        }
        console.log(`[PROCESSING]: ${link} for posting...`)
        await reactToMessage(message, '⬇️')
        // download video
        console.log(`downloading ${link}...`)
        const response = await downloadVideoWithYdl(link)
        if (response) {
          const options = {
            vid_id: response.id,
            link,
            requester: message.author.tag,
            filename: response.filename,
            filepath: response.filepath,
          }
          try {
            console.log(`writing ${response.id} to db...`)
            await TikTok.create(options)
            console.log(`written.`)
          } catch (err) {
            console.error(`error writing to db: ${err}`)
          }
          if (!isNonPostable(link)) {
            await reactToMessage(message, '🔄')
            const smallerPath =
              process.env.VIDEO_SMALLER_PATH + '/smaller-' + response.filename
            await makeVideoSmaller(response.filepath, smallerPath, 8000000)
            console.log(`uploading ${smallerPath}...`)
            await reactToMessage(message, '⬆️')
            let msg = ''
            await message.inlineReply(msg, {
              files: [smallerPath],
            })
            console.log(`sent ${smallerPath}`)
          }
          await reactToMessage(message, '💾')
        } else {
          await reactToMessage(message, '❌')
        }
      } catch (err) {
        console.error(err)
        await reactToMessage(message, '❗')
      }
    }
  } else if (message.channel.id === process.env.MUSIC_CHANNEL_ID) {
    let link = null
    message.content.split(' ').map((word) => {
      if (isMusicLink(word)) link = word
    })
    if (link === null) return
    console.log(`saving music ${link}...`)
    await reactToMessage(message, '⬇️')
    const { id, filename, filepath } = await downloadMusicWithYdl(link)
    await Music.create({
      guid: id,
      link,
      filename,
      filepath,
      requester: message.author.tag,
    })
    console.log(`saved ${link}`)
    await reactToMessage(message, '💾')
  } else if (message.channel.id === process.env.PICS_CHANNEL_ID) {
    if (message.attachments.size > 0) {
      try {
        for (attachment in message.attachments.array()) {
          let a = message.attachments.array()[attachment]
          console.log(`downloading ${a.name}`)
          await reactToMessage(message, '⬇️')
          const filepath = process.env.PIC_PATH + '/' + a.name
          downloadFile(a.url, filepath)
          console.log(`done downloading ${a.name}.`)
          console.log(`sending ${a.name} to db...`)
          await Pic.create({
            sender: message.author.tag,
            filepath,
          })
          console.log(`sent`)
        }
        await reactToMessage(message, '💾')
      } catch (err) {
        console.error(err)
        await reactToMessage(message, '❗')
        await message.react('💾')
      }
    }
  }
})

client.login(process.env.TOKEN)
