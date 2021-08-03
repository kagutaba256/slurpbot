exports.isMusicLink = (link) => {
  const valid = [
    'http',
    'https',
    'youtube.com',
    'youtu.be',
    'soundcloud.com',
    'bandcamp.com',
    'spotify.com',
  ]
  return new RegExp(valid.join('|')).test(link)
}
