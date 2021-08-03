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
})

module.exports = mongoose.model('music', musicSchema)
