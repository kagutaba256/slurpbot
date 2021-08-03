const TikTokScraper = require('tiktok-scraper')
const fileDownloader = require('js-file-download')
const axios = require('axios')
const slugify = require('slugify')
const { default: fileDownload } = require('js-file-download')
const { get } = require('mongoose')

exports.isTiktokLink = (link) => {
  return link.includes('https://' && 'tiktok.com')
}

exports.downloadTiktokVideo = async (link) => {
  const getCookieRes = await axios.get(link, { withCredentials: true })
  const cookieID = getCookieRes.headers['set-cookie'][0]
    .split(';')[0]
    .split('=')[1]
  const headers = {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.80 Safari/537.36',
    referer: 'https://www.tiktok.com/',
    //cookie: `tt_webid_v2=689854141086886123`,
    cookie: `tt_webid_v2=${cookieID}`,
  }
  const response = await TikTokScraper.getVideoMeta(link, headers)
  if (!response || !response.collector || !response.collector[0])
    throw new Error('ERROR: Could not download')
  const data = response.collector[0]
  const author = data.authorMeta.name
  const title = data.text
  const slug = slugify(title)
  const id = data.id
  const filename = process.env.VIDEO_PATH + '/' + id + '.mp4'
  const videoOptions = {
    _: ['video'],
    d: true,
    download: true,
    asyncDownload: 5,
    a: 5,
    'async-download': 5,
    filepath: process.env.VIDEO_PATH,
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.80 Safari/537.36',
      referer: 'https://www.tiktok.com/',
      //cookie: `tt_webid_v2=689854141086886123`,
      cookie: `tt_webid_v2=${cookieID}`,
    },
  }
  const videoStuff = await TikTokScraper.video(link, videoOptions)
  if (!videoStuff || !videoStuff.message)
    throw new Error('ERROR: Could not download the video')
  console.log(videoStuff)
  return { data, id, author, title, slug, filename }
}

exports.makeVideoSmaller = async (file, sizeTarget) => {}
