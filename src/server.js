require('dotenv').config({ path: './config/config.env' })
require('colors')
const discord = require('discord.js')
require('./utils/ExtendedMessage')
const {
  isTiktokLink,
  downloadTiktokVideo,
  makeVideoSmaller,
} = require('./utils/tiktokUtils')
const client = new discord.Client()

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`.bgGreen.black)
  client.user.setActivity('with my slurper', {
    type: 'PLAYING',
  })
})

client.on('message', async (message) => {
  if (message.author.bot) return
  if (message.channel.id !== process.env.CHANNEL_ID) return
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
      const response = await downloadTiktokVideo(link)
      await message.reactions.removeAll()
      if (response) {
        await message.react('💱')
        try {
          const smallerPath =
            process.env.VIDEO_SMALLER_PATH + '/smaller-' + response.filename
          await makeVideoSmaller(response.filepath, smallerPath, 8000000)
          console.log(`uploading ${smallerPath}...`)
          await message.reactions.removeAll()
          await message.react('⬆️')
          await message.inlineReply(
            '```▬▬▬▬▬▬▬▬▬▬▬▬ஜ۩۞۩ஜ▬▬▬▬▬▬▬▬▬▬▬▬­­­­­­­­­­­­­­­­▬▬▬\n' +
              '🍹👍 ANOTHER SUCCESSFUL SLURP 👍🍹\n' +
              '▬▬▬▬▬▬▬▬▬▬▬▬ஜ۩۞۩ஜ▬▬▬▬▬▬▬▬▬▬▬▬­­­­­­­­­­­­­­­­▬▬▬\n' +
              `Author: ${response.author}\nTitle: ${response.title}\n\`\`\``,
            {
              files: [smallerPath],
            }
          )
          console.log(`sent ${smallerPath}`)
        } catch (err) {
          console.error(err)
        }
        await message.reactions.removeAll()
        await message.react('💾')
      } else {
        await message.react('❌')
      }
    } catch (err) {
      console.error(err)
      await message.reactions.removeAll()
      await message.react('❗')
    }
  }
})

client.login(process.env.TOKEN)
