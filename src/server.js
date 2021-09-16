require('dotenv').config({ path: './config/config.env' })
require('colors')
const discord = require('discord.js')
require('./utils/ExtendedMessage')
const { v4 } = require('uuid')
const sha1File = require('sha1-file')
const fs = require('fs')
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
    if (link === null) {
      return
    }
    if (isSlurpable(link)) {
      try {
        console.log(`checking if ${link} exists...`)
        const result = await TikTok.findOne({ link })
        if (result) {
          console.log(`link found at ${result.id}`)
          await alreadyBeenPosted(message, link, result)
          return
        }
        console.log(`[PROCESSING]: ${link} for posting...`)
        await reactToMessage(message, '⬇️')
        // download video
        console.log(`downloading ${link}...`)
        const response = await downloadVideoWithYdl(link)
        if (response) {
          console.log(`checking ${link}'s hash...'`)
          const hash = await sha1File(response.filepath)
          const result = await TikTok.findOne({ hash })
          if (result) {
            console.log(`hash found at ${result.id}`)
            await alreadyBeenPosted(message, link, result)
            console.log(`deleting ${response.filepath}...`)
            await fs.unlinkSync(response.filepath)
            console.log(`deleted ${response.filepath}`)
            return
          }
          let smallerPath = null
          if (!isNonPostable(link)) {
            let shouldShrink = false
            console.log(`converting ${response.filepath}`)
            if (!(await checkFileSize(response.filepath, 8))) {
              console.log(
                `we need to shrink ${response.filepath}`.yellow.inverse
              )
              shouldShrink = true
            }
            await reactToMessage(message, '🔄')
            smallerPath =
              process.env.VIDEO_SMALLER_PATH + '/smaller-' + response.filename
            await makeVideoSmaller(response.filepath, smallerPath, shouldShrink)
            console.log(`uploading ${smallerPath}...`)
            await reactToMessage(message, '⬆️')
            let msg = ''
            await message.inlineReply(msg, {
              files: [smallerPath],
            })
            console.log(`sent ${smallerPath}`)
          }
          const options = {
            vid_id: response.id,
            link,
            requester: message.author.tag,
            filename: response.filename,
            filepath: response.filepath,
            smallpath: smallerPath,
            hash,
            messageid: message.id,
          }
          try {
            console.log(`writing ${response.id} to db...`)
            await TikTok.create(options)
            console.log(`written.`)
          } catch (err) {
            console.error(`error writing to db: ${err}`)
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
  } else if (message.channel.id === process.env.REQUESTS_CHANNEL_ID) {
    const prefix = '!'
    const { content } = message
    if (!content.startsWith(prefix)) return
    if (content.includes('help')) {
      printHelpMessage(message)
    } else if (content.includes('random')) {
      sendRandomVideo(message)
    } else if (content.includes('slurpfolder')) {
      printGoogleDriveLink(message)
    }
  }
})

const printGoogleDriveLink = async (message) => {
  await message.inlineReply(process.env.GOOGLE_DRIVE_LINK)
}

const printHelpMessage = async (message) => {
  let helpMessage = `
    \`\`\`==🍹== SLURPBOT'S CURRENT COMMANDS ==🍹==\n
    !help - prints this message.
    !random - sends a random video
    !slurpfolder - links to the slurpfolder (google drive)
    \`\`\`
  `
  await message.inlineReply(helpMessage)
}

const getTimeString = (date) =>
  date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) +
  ' ' +
  date.toLocaleTimeString()

const sendRandomVideo = async (message) => {
  try {
    console.log(`${message.author.tag} requests random video`)
    await reactToMessage(message, '🔍')
    const results = await TikTok.find()
    let randomResult
    for (i = 0; i < results.length; i++) {
      randomResult = results[Math.floor(Math.random() * results.length)]
      if (
        //TODO TEMPORARY
        randomResult.filepath &&
        (await fs.existsSync(randomResult.filepath))
      ) {
        if (await checkFileSize(randomResult.filepath, 8)) {
          break
        }
        // else if(randomResult.smallpath) {
        //   break
        //   }
      }
    }
    if (await fs.existsSync(randomResult.filepath)) {
      console.log(`found ${randomResult.link}`)
      await reactToMessage(message, '⬆️')
      const { link, requester, dateConverted, smallpath, filepath } =
        randomResult

      // TODO TEMPORARY FUNCTIONALITY

      let msg = `\`ORIGINAL LINK:\` ${link}\n\`REQUESTER:\` ${requester}\n\`DATE SLURPED:\` ${getTimeString(
        dateConverted
      )}`
      console.log(`uploading ${filepath}...`)
      await message.inlineReply(msg, {
        files: [filepath],
      })
      await reactToMessage(message, '🎲')
      console.log(`done uploading ${filepath}`)
      return
    }
    await reactToMessage(message, '❌')
    return
  } catch (err) {
    console.error(err)
    await reactToMessage(message, '❗')
    return
  }
}

const checkFileSize = async (file, target) => {
  const { size } = await fs.statSync(file)
  const bigness = size / (1024 * 1024)
  return bigness < target
}

const alreadyBeenPosted = async (message, link, result) => {
  try {
    await reactToMessage(message, '⬆️')
    let contentPath = null
    if (!isNonPostable(link)) {
      if (result.smallerPath) contentPath = result.smallpath
      else contentPath = result.filepath
    }
    let text = `\`\`\`diff\n- ALREADY LINKED BY ${
      result.requester
    } ON ${getTimeString(result.dateConverted)}.\`\`\``
    if (result.messageid) {
      const original = await message.channel.messages.fetch(result.messageid)
      text += '```diff\n- THIS IS A REPLY TO THE ORIGINAL LINK.```'
      original.inlineReply(text)
    } else message.inlineReply(text)
    console.log('uploading old video...')
    await message.inlineReply('', { files: [contentPath] })
    console.log(`done uploading ${contentPath}`)
    await reactToMessage(message, '🤡')
  } catch (err) {
    console.error(err)
    await reactToMessage(message, '🤡')
  }
}

client.login(process.env.TOKEN)
