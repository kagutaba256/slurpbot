exports.reactToMessage = async (message, emoji) => {
  await message.reactions.removeAll()
  await message.react(emoji)
}
