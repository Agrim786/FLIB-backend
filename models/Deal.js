const mongoose = require('mongoose');

const DealSchema = new mongoose.Schema({
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'In Transit', 'Completed'],
    default: 'Pending',
  },
  method: {
    type: String,
    enum: ['pickup', 'courier'],
    required: true,
  },
  time: {
    type: Date,
  },
  rating: {
    stars: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
}, { timestamps: true });

module.exports = mongoose.model('Deal', DealSchema);
