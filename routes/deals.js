const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Deal = require('../models/Deal');
const Book = require('../models/Book');
const auth = require('../middleware/auth');

// ✅ CREATE a deal (POST /api/deals)
router.post('/', authMiddleware, async (req, res) => {
  const { bookId, method, time } = req.body;
  const buyerId = req.user.userId;

  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // 🛑 Prevent seller from buying their own book
    if (book.sellerId.toString() === buyerId) {
      return res.status(403).json({ message: "You can't buy your own book" });
    }

    // 🔁 Prevent duplicate deal
    const existingDeal = await Deal.findOne({ book: bookId, buyer: buyerId });
    if (existingDeal) {
      return res.status(200).json(existingDeal); // return existing
    }

    const deal = await Deal.create({
      book: bookId,
      buyer: buyerId,
      seller: book.sellerId,
      status: 'Pending',
      method,
      time
    });

    console.log("✅ Deal created:", deal);

    const fullDeal = await Deal.findById(deal._id).populate('book buyer seller');

    // 🔔 Notify seller via Socket.IO
    const io = req.app.get('io');
    io.to(book.sellerId.toString()).emit('new-meet-request', {
      message: `${fullDeal.buyer.name} wants to meet for "${book.title}"`,
      bookId: book._id,
      buyerName: fullDeal.buyer.name
    });

    res.status(201).json(fullDeal);
  } catch (error) {
    console.error("❌ Error creating deal:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

  
// GET /api/deals/seller
router.get('/seller', auth, async (req, res) => {
  try {
    const deals = await Deal.find({ seller: req.user.userId }).populate('book buyer');
    res.json(deals);
  } catch (err) {
    console.error('Error fetching seller deals:', err);
    res.status(500).json({ error: 'Failed to fetch seller deals' });
  }
});
// ✅ GET Deals as Buyer
router.get('/buyer', authMiddleware, async (req, res) => {
  try {
    const deals = await Deal.find({ buyer: req.user.userId })
      .populate('book')
      .populate('seller', 'name');

       // ✅ Remove deals where book is missing (deleted book, maybe)
    const validDeals = deals.filter(deal => deal.book !== null);

    res.json(deals);
  } catch (err) {
    console.error("❌ Error fetching buyer deals:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/sold-count', auth, async (req, res) => {
  try {
    const count = await Deal.countDocuments({ status: 'Sold' });
    res.json({ count });
  } catch (err) {
    console.error('Error counting sold deals:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ✅ FETCH a deal by ID (GET /api/deals/:id)
router.get('/:id([0-9a-fA-F]{24})', async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('book')
      .populate('buyer', 'name')
      .populate('seller', 'name');
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    res.json(deal);
  } catch (err) {
    console.error('❌ Error fetching deal by ID:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/deals/:id/complete
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  const dealId = req.params.id;

  try {
    const deal = await Deal.findById(dealId);
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    deal.status = 'Completed';
    await deal.save();

    // Delete related chat
    const Chat = require('../models/Chat');
    await Chat.deleteMany({ dealId: dealId });

    return res.json({ message: 'Deal completed and chat deleted' });
  } catch (error) {
    console.error('❌ Error completing deal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/deals/:id/rate
router.post('/:id/rate', authMiddleware, async (req, res) => {
  const { stars, comment } = req.body;

  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    deal.rating = { stars, comment, by: req.user.userId };
    await deal.save();

    return res.json({ message: 'Rating saved' });
  } catch (error) {
    console.error('❌ Error rating deal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
