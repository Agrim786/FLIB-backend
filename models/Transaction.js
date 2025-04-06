const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  amountPaid: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  razorpayPaymentId: String,
  shippingDetails: {
    address: String,
    trackingId: String,
    carrier: String,
    status: {
      type: String,
      enum: ['Processing', 'Shipped', 'Delivered'],
      default: 'Processing'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);