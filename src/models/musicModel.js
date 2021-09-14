const mongoose = require('mongoose')
const musicSchema = mongoose.Schema({
  link: {
    type: String,
    required: true,
  },
  dateSaved: {
    type: Date,
    default: Date.now,
  },
  requester: {
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
  guid: {
    type: String,
    required: true,
  },
})

module.exports = mongoose.model('music', musicSchema)
