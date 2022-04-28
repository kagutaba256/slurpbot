import mongoose from 'mongoose'
const tiktokSchema = mongoose.Schema({
  title: {
    type: String,
  },
  filename: {
    type: String,
    required: true,
  },
  filepath: {
    type: String,
    required: true,
  },
  smallpath: {
    type: String,
  },
  hash: {
    type: String,
  },
  messageid: {
    type: String,
  },
  dateConverted: {
    type: Date,
    default: Date.now,
  },
  data: {
    type: Object,
  },
  vid_id: {
    type: String,
  },
  author: {
    type: String,
  },
  slug: {
    type: String,
  },
  link: {
    type: String,
  },
  requester: {
    type: String,
  },
})

export default mongoose.model('tiktok', tiktokSchema)
