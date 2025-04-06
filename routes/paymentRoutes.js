const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const auth = require('../middleware/auth');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create payment order
router.post('/checkout', auth, async (req, res) => {
  try {
    const { bookId } = req.body;
    
    // Get book details
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: book.price * 100, // Convert to paise
      currency: 'INR',
      receipt: `book_${bookId}`
    });

    // Create transaction record
    const transaction = new Transaction({
      buyerId: req.user.userId,
      sellerId: book.sellerId,
      bookId: book._id,
      amountPaid: book.price,
      razorpayOrderId: order.id
    });

    await transaction.save();

    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Verify payment
router.post('/verify', auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Update transaction
    await Transaction.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        paymentStatus: 'Completed',
        razorpayPaymentId: razorpay_payment_id
      }
    );

    res.json({ message: 'Payment verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

module.exports = router;