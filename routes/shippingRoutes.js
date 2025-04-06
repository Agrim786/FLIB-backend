const express = require('express');
const router = express.Router();
const axios = require('axios');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// Initialize Shiprocket client
const shiprocket = axios.create({
  baseURL: 'https://apiv2.shiprocket.in/v1/external',
  headers: {
    'Authorization': `Bearer ${process.env.SHIPROCKET_TOKEN}`
  }
});

// Get shipping options
router.post('/optimize', auth, async (req, res) => {
  try {
    const { pickup_postcode, delivery_postcode, weight } = req.body;

    const response = await shiprocket.get('/courier/serviceability', {
      params: {
        pickup_postcode,
        delivery_postcode,
        weight,
        cod: 0 // Disable Cash on Delivery
      }
    });

    // Sort options by cost and delivery time
    const options = response.data.data.available_courier_companies
      .sort((a, b) => {
        const costDiff = a.rate - b.rate;
        if (costDiff !== 0) return costDiff;
        return a.estimated_delivery_days - b.estimated_delivery_days;
      });

    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get shipping options' });
  }
});

// Create shipping order
router.post('/create-order', auth, async (req, res) => {
  try {
    const { transactionId, shippingDetails } = req.body;

    // Get transaction details
    const transaction = await Transaction.findById(transactionId)
      .populate('bookId')
      .populate('buyerId')
      .populate('sellerId');

    // Create order in Shiprocket
    const orderData = {
      order_id: transactionId,
      order_date: transaction.createdAt,
      pickup_location: 'Primary',
      billing_customer_name: transaction.buyerId.name,
      billing_address: shippingDetails.address,
      billing_city: shippingDetails.city,
      billing_pincode: shippingDetails.pincode,
      billing_state: shippingDetails.state,
      billing_country: 'India',
      billing_email: transaction.buyerId.email,
      billing_phone: shippingDetails.phone,
      order_items: [{
        name: transaction.bookId.title,
        sku: `BOOK-${transaction.bookId._id}`,
        units: 1,
        selling_price: transaction.amountPaid
      }]
    };

    const response = await shiprocket.post('/orders/create/adhoc', orderData);

    // Update transaction with shipping details
    await Transaction.findByIdAndUpdate(transactionId, {
      'shippingDetails.trackingId': response.data.shipment_id,
      'shippingDetails.carrier': response.data.courier_name,
      'shippingDetails.status': 'Processing'
    });

    res.json({
      trackingId: response.data.shipment_id,
      carrier: response.data.courier_name
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create shipping order' });
  }
});

// Track shipment
router.get('/track/:trackingId', auth, async (req, res) => {
  try {
    const response = await shiprocket.get(`/tracking/shipment/${req.params.trackingId}`);
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to track shipment' });
  }
});

module.exports = router;