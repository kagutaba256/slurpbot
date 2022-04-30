import dotenv from "dotenv"
dotenv.config({ path: './config/config.env' })
import colors from "colors"
import discord, { MessageAttachment } from "discord.js"
import { v4 } from 'uuid'
import {sha1File} from 'sha1-file'
import fs from "fs"
import { reactToMessage } from './utils/messageUtils.js'
import { connectDB } from './utils/db.js'
import TikTok from './models/tiktokModel.js'
import Music from './models/musicModel.js'
import Pic from './models/picModel.js'
import {
  isSlurpable,
  isNonPostable,
  downloadVideoWithYdl,
  makeVideoSmaller,
  downloadFile,
} from './utils/videoUtils.js'
import { isMusicLink, downloadMusicWithYdl } from './utils/musicUtils.js'

connectDB()

const client = new discord.Client({intents: ["GUILDS", "GUILD_MESSAGES"]})
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`.bgGreen.black)
  client.user.setActivity('with my slurper', {
    type: 'PLAYING',
  })
})

client.on('messageCreate', async (message) => {
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
            if (!(await checkFileSize(response.filepath, 7.8))) {
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
            await message.reply({embeds: [], files: [smallerPath]})
            console.log(`sent ${smallerPath}`)
	          await message.suppressEmbeds(true)
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
        for (a in message.attachments) {
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
        await message.react('845870164973191168')
      } catch (err) {
        console.error(err)
        await reactToMessage(message, '❗')
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
    } else if (content.includes('github')) {
      printGithubLink(message)
    }
  }
})

const printGoogleDriveLink = async (message) => {
  await message.reply(process.env.GOOGLE_DRIVE_LINK)
}

const printGithubLink = async (message) => {
  await message.reply(process.env.GITHUB_LINK)
}

const printHelpMessage = async (message) => {
  let helpMessage = `
    \`\`\`==🍹== SLURPBOT'S CURRENT COMMANDS ==🍹==\n
    !help - prints this message.
    !random - sends a random video
    !slurpfolder - links to the slurpfolder (google drive)
    !github - links to the github repo
    \`\`\`
  `
  await message.reply(helpMessage)
}

const getTimeString = (date) =>
  date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) +
  ' ' +
  date.toLocaleTimeString()

const getNumberOfDays = (difference) =>
  (difference / (1000 * 3600 * 24)).toFixed(0)

const sendRandomVideo = async (message) => {
  try {
    console.log(`${message.author.tag} requests random video`)
    await reactToMessage(message, '🔍')
    const results = await TikTok.find()
    let path
    let randomResult
    for (let i = 0; i < results.length; i++) {
      randomResult = results[Math.floor(Math.random() * results.length)]
      if (
        randomResult.smallpath &&
        (await fs.existsSync(randomResult.smallpath))
      ) {
        console.log(`found a smallpath`.blue.inverse)
        path = randomResult.smallpath
        break
      } else if (
        randomResult.filepath &&
        (await fs.existsSync(randomResult.filepath))
      ) {
        if (await checkFileSize(randomResult.filepath, 7.0)) {
          console.log(`found a regular path`.yellow.inverse)
          path = randomResult.filepath
          break
        }
      }
    }
    if (await fs.existsSync(path)) {
      console.log(`found ${path}`)
      await reactToMessage(message, '⬆️')
      const { link, requester, dateConverted } = randomResult

      let msg = `\`ORIGINAL LINK:\` ${link}\n\`REQUESTER:\` ${requester}\n\`DATE SLURPED:\` ${getTimeString(
        dateConverted
      )}`
      console.log(`uploading ${path}...`)
      await message.reply({content: msg, files: [path]})
      await reactToMessage(message, '🎲')
      console.log(`done uploading ${path}`)
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
      if (result.smallpath) contentPath = result.smallpath
      else contentPath = result.filepath
    }
    let text = `\`\`\`diff\n- ALREADY LINKED BY ${
      result.requester
    } ON ${getTimeString(result.dateConverted)}\n`
    const timePassed = Date.now() - result.dateConverted
    text += `- (${getNumberOfDays(timePassed)} DAYS AGO)\n`
    text += '```'
    if (result.messageid) {
      const original = await message.channel.messages.fetch(result.messageid)
      text += '```diff\n- THIS IS A REPLY TO THE ORIGINAL LINK.```'
      original.reply(text)
    } else message.reply(text)
    console.log('uploading old video...')
    await message.reply({embeds: [], files: [contentPath]})
    console.log(`done uploading ${contentPath}`)
    await reactToMessage(message, '🤡')
    await message.suppressEmbeds(true)
  } catch (err) {
    console.error(err)
    await reactToMessage(message, '🤡')
  }
}

client.login(process.env.TOKEN)
