const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Book = require("../models/Book");
const User = require("../models/User");
const Address = require("../models/Address");
const auth = require("../middleware/auth");
const Cart = require("../models/Cart");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Get all orders for the authenticated user
router.get("/", auth, async (req, res) => {
  try {
    console.log("Fetching orders for user:", req.user.Id);
    
    const orders = await Order.find({ userId: req.user.Id })
      .populate('items.bookId')
      .populate('items.sellerId', 'name')
      .sort({ createdAt: -1 });
    
    console.log("Found orders:", orders.length);
    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ 
      error: "Server error",
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Get a single order by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id,
      userId: req.user.Id 
    })
      .populate('items.bookId')
      .populate('items.sellerId', 'name');

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    console.error("❌ Error fetching order:", err);
    res.status(500).json({ 
      error: "Server error",
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Create order and initialize payment
router.post('/create', auth, async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    
    if (!addressId || !paymentMethod) {
      return res.status(400).json({ error: 'Address ID and payment method are required' });
    }

    // Get shipping address
    const address = await Address.findOne({ _id: addressId, userId: req.user.Id });
    if (!address) {
      return res.status(404).json({ error: 'Shipping address not found' });
    }

    // Get cart items
    const cart = await Cart.findOne({ userId: req.user.Id })
      .populate('items.bookId');

    if (!cart || !cart.items.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Calculate total amount
    const amount = cart.items.reduce((sum, item) => sum + item.bookId.price, 0);

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `order_${Date.now()}`
    });

    // Create order in database
    const order = new Order({
      userId: req.user.Id,
      items: cart.items.map(item => ({
        bookId: item.bookId._id,
        sellerId: item.bookId.sellerId,
        price: item.bookId.price
      })),
      totalAmount: amount,
      status: 'pending',
      razorpayOrderId: razorpayOrder.id,
      paymentMethod,
      shippingAddress: {
        fullName: address.fullName,
        phoneNumber: address.phoneNumber,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country
      }
    });

    await order.save();

    res.json({
      orderId: razorpayOrder.id,
      amount: amount * 100,
      currency: 'INR'
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify payment and update order status
router.post('/verify', auth, async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    // Verify Razorpay signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + '|' + paymentId)
      .digest('hex');

    if (generated_signature !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Update order status
    const order = await Order.findOne({ razorpayOrderId: orderId })
      .populate('items.bookId');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = 'confirmed';
    order.paymentId = paymentId;
    await order.save();

    // Clear cart
    await Cart.findOneAndUpdate(
      { userId: req.user.Id },
      { items: [] }
    );

    // Send order confirmation email
    const user = await User.findById(req.user.Id);
    if (order.emailNotifications.orderConfirmation) {
      await sendEmail(user.email, 'orderConfirmation', { order, user });
    }

    res.json({ message: 'Payment verified successfully' });
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Update order tracking
router.put('/:id/tracking', auth, async (req, res) => {
  try {
    const { carrier, trackingNumber, status, location, estimatedDelivery } = req.body;
    
    const order = await Order.findOne({ 
      _id: req.params.id,
      userId: req.user.Id 
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.tracking = {
      carrier,
      trackingNumber,
      status,
      estimatedDelivery,
      lastUpdated: new Date(),
      history: [
        ...(order.tracking?.history || []),
        {
          status,
          location,
          timestamp: new Date(),
          description: `Order ${status} at ${location}`
        }
      ]
    };

    await order.save();

    // Send shipping update email
    const user = await User.findById(req.user.Id);
    if (order.emailNotifications.shippingUpdates) {
      await sendEmail(user.email, 'shippingUpdate', { 
        order, 
        user,
        update: { status, location, estimatedDelivery }
      });
    }

    res.json(order);
  } catch (err) {
    console.error('Error updating tracking:', err);
    res.status(500).json({ error: 'Failed to update tracking' });
  }
});

// Update order status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    const order = await Order.findOne({ 
      _id: req.params.id,
      userId: req.user.Id 
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = status;
    await order.save();

    // Send delivery confirmation email
    if (status === 'delivered') {
      const user = await User.findById(req.user.Id);
      if (order.emailNotifications.deliveryConfirmation) {
        await sendEmail(user.email, 'deliveryConfirmation', { order, user });
      }
    }

    res.json(order);
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Update email notification preferences
router.put('/:id/notifications', auth, async (req, res) => {
  try {
    const { orderConfirmation, shippingUpdates, deliveryConfirmation } = req.body;
    
    const order = await Order.findOne({ 
      _id: req.params.id,
      userId: req.user.Id 
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.emailNotifications = {
      orderConfirmation,
      shippingUpdates,
      deliveryConfirmation
    };

    await order.save();
    res.json(order);
  } catch (err) {
    console.error('Error updating notification preferences:', err);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

module.exports = router;