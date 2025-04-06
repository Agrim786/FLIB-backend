const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Academic', 'Fiction', 'Non-Fiction', 'Technical', 'Physics', 'Biology', 'Chemistry', 'English', 'Maths', 'Hindi', 'Sanskrit', 'Social Science', 'Computer Science', 'Electronics', 'Telecom', 'Civil', 'Mechanical', 'Electrical', 'Business', 'Economics', 'Accountancy', 'Marketing', 'Management', 'Others']
  },
  condition: {
    type: String,
    required: true,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor']
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{
    type: String,
    required: true
  }],
  summary: {
    type: String,
    default: ''
  }, 
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    }
  },   
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for text search
bookSchema.index({ title: 'text', category: 'text' });
bookSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Book', bookSchema);