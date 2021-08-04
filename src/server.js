require('dotenv').config({ path: './config/config.env' })
require('colors')
const discord = require('discord.js')
require('./utils/ExtendedMessage')
const axios = require('axios')
const { v4 } = require('uuid')
const fileDownload = require('js-file-download')
const { connectDB } = require('./utils/db')
const TikTok = require('./models/tiktokModel')
const Music = require('./models/musicModel')
const Pic = require('./models/picModel')
const {
  isTiktokLink,
  downloadTiktokVideo,
  makeVideoSmaller,
  downloadFile,
} = require('./utils/tiktokUtils')
const { isMusicLink } = require('./utils/musicUtils')

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
          await message.reactions.removeAll()
          await message.react('⬇️')
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
          await message.reactions.removeAll()
          await message.react('💾')
        } catch (err) {
          console.error(err)
          await message.reactions.removeAll()
          await message.react('❗')
        }
      }
      return
    }
    let link = null
    message.content.split(' ').map((word) => {
      if (isTiktokLink(word)) link = word
    })
    if (link === null) return
    if (isTiktokLink(link)) {
      try {
        console.log(`[PROCESSING]: ${link}`)
        await message.react('⬇️')
        // download video
        console.log(`downloading ${link}...`)
        const response = await downloadTiktokVideo(link)
        if (response) {
          try {
            let options = {}
            if (response.meta) {
              options = {
                author: response.author,
                title: response.title,
                slug: response.slug,
                filename: response.filename,
                filepath: response.filepath,
                vid_id: response.id,
                data: response.data,
                link,
                requester: message.author.tag,
              }
            } else {
              options = {
                vid_id: response.id,
                link,
                requester: message.author.tag,
                filename: response.filename,
                filepath: response.filepath,
              }
            }
            try {
              console.log(`writing ${response.id} to db...`)
              await TikTok.create(options)
              console.log(`written.`)
            } catch (err) {
              console.error(`error writing to db: ${err}`)
            }
            await message.reactions.removeAll()
            await message.react('💱')
            const smallerPath =
              process.env.VIDEO_SMALLER_PATH + '/smaller-' + response.filename
            try {
              await makeVideoSmaller(response.filepath, smallerPath, 8000000)
            } catch {
              await message.reactions.removeAll()
              await message.react('💣')
              return
            }
            console.log(`uploading ${smallerPath}...`)
            await message.reactions.removeAll()
            await message.react('⬆️')
            let msg =
              '```▬▬▬▬▬▬▬▬▬▬▬▬ஜ۩۞۩ஜ▬▬▬▬▬▬▬▬▬▬▬▬­­­­­­­­­­­­­­­­▬▬▬\n' +
              '🍹👍 ANOTHER SUCCESSFUL SLURP 👍🍹\n' +
              '▬▬▬▬▬▬▬▬▬▬▬▬ஜ۩۞۩ஜ▬▬▬▬▬▬▬▬▬▬▬▬­­­­­­­­­­­­­­­­▬▬▬\n'
            if (response.meta) {
              msg += `Author: ${response.author}\nTitle: ${response.title}\n`
            }
            msg += '```'
            try {
              await message.inlineReply(msg, {
                files: [smallerPath],
              })
              console.log(`sent ${smallerPath}`)
              await message.reactions.removeAll()
              await message.react('💾')
            } catch (err) {
              console.error(err)
              await message.reactions.removeAll()
              await message.react('❌')
              await message.react('⬆')
            }
          } catch (err) {
            console.error(err)
            await message.reactions.removeAll()
            await message.react('❌')
            await message.react('💾')
          }
        } else {
          await message.react('❌')
        }
      } catch (err) {
        console.error(err)
        await message.reactions.removeAll()
        await message.react('❗')
      }
    }
  } else if (message.channel.id === process.env.MUSIC_CHANNEL_ID) {
    let link = null
    message.content.split(' ').map((word) => {
      if (isMusicLink(word)) link = word
    })
    if (link === null) return
    console.log(`saving music ${link}...`)
    await Music.create({
      link,
      requester: message.author.tag,
    })
    console.log(`saved ${link}`)
    await message.react('💾')
  } else if (message.channel.id === process.env.PICS_CHANNEL_ID) {
    if (message.attachments.size > 0) {
      try {
        for (attachment in message.attachments.array()) {
          let a = message.attachments.array()[attachment]
          console.log(`downloading ${a.name}`)
          await message.reactions.removeAll()
          await message.react('⬇️')
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
        await message.reactions.removeAll()
        await message.react('💾')
      } catch (err) {
        console.error(err)
        await message.reactions.removeAll()
        await message.react('❗')
        await message.react('💾')
      }
    }
  }
})

client.login(process.env.TOKEN)
