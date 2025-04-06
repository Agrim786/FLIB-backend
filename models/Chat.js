const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  text: String,
  room: String,
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  senderName: String,

  // ✅ NEW: To support unread message tracking
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  read: {
    type: Boolean,
    default: false,
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Chat', chatSchema);
