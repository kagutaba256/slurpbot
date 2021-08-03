exports.isMusicLink = (link) => {
  const valid = [
    'youtube.com',
    'youtu.be',
    'soundcloud.com',
    'bandcamp.com',
    'spotify.com',
  ]
  return new RegExp(valid.join('|')).test(link)
}
