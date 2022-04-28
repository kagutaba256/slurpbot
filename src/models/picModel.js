import mongoose from 'mongoose'
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

export default mongoose.model('picture', picSchema)
