const mongoose = require('mongoose')
const picSchema = mongoose.Schema({
  filepath: {
    type: String,
    required: true,
  },
  dateSaved: {
    type: Date,
    default: Date.now,
  },
  sender: {
    type: String,
  },
})

module.exports = mongoose.model('picture', picSchema)
