const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book",
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  price: {
    type: Number,
    required: true
  }
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  addressLine1: {
    type: String,
    required: true
  },
  addressLine2: String,
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  postalCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  }
});

const trackingSchema = new mongoose.Schema({
  carrier: {
    type: String,
    required: true
  },
  trackingNumber: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'],
    default: 'pending'
  },
  estimatedDelivery: Date,
  lastUpdated: Date,
  history: [{
    status: String,
    location: String,
    timestamp: Date,
    description: String
  }]
});

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
    default: "pending"
  },
  shippingAddress: {
    type: shippingAddressSchema,
    required: true
  },
  tracking: {
    type: trackingSchema
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  paymentId: {
    type: String
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet'],
    required: true
  },
  emailNotifications: {
    orderConfirmation: {
      type: Boolean,
      default: true
    },
    shippingUpdates: {
      type: Boolean,
      default: true
    },
    deliveryConfirmation: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Order", orderSchema);
