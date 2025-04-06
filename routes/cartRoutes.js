const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Cart = require('../models/Cart');

// Get cart items
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching cart for user:', req.user.userId);
    
    let cart = await Cart.findOne({ userId: req.user.userId })
      .populate({
        path: 'items.bookId',
        select: 'title author price images coverImage'
      });

    if (!cart) {
      console.log('No cart found, creating new cart');
      cart = new Cart({
        userId: req.user.userId,
        items: []
      });
      await cart.save();
    }

    console.log('Cart found:', cart);
    res.json(cart);
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ 
      error: 'Failed to fetch cart',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Add item to cart
router.post('/add', auth, async (req, res) => {
  try {
    const { bookId } = req.body;
    
    if (!bookId) {
      console.log('No bookId provided in request body');
      return res.status(400).json({ error: 'Book ID is required' });
    }

    console.log('Adding book to cart:', { 
      userId: req.user.userId, 
      bookId,
      requestBody: req.body 
    });
    
    // Find or create cart
    let cart = await Cart.findOne({ userId: req.user.userId });
    
    if (!cart) {
      console.log('No cart found, creating new cart');
      cart = new Cart({
        userId: req.user.userId,
        items: [{ bookId, quantity: 1 }]
      });
    } else {
      // Check if book already exists in cart
      const existingItemIndex = cart.items.findIndex(item => item.bookId.toString() === bookId);
      if (existingItemIndex >= 0) {
        console.log('Book already in cart, incrementing quantity');
        cart.items[existingItemIndex].quantity += 1;
      } else {
        console.log('Adding new book to cart');
        cart.items.push({ bookId, quantity: 1 });
      }
    }
    
    console.log('Saving cart:', cart);
    await cart.save();

    // Populate the cart with book details
    cart = await Cart.findById(cart._id)
      .populate({
        path: 'items.bookId',
        select: 'title author price images coverImage'
      });

    console.log('Updated cart:', cart);
    res.json(cart);
  } catch (err) {
    console.error('Error adding to cart:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    res.status(500).json({ 
      error: 'Failed to add item to cart',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Remove item from cart
router.delete('/remove/:bookId', auth, async (req, res) => {
  try {
    const { bookId } = req.params;
    
    console.log('Removing book from cart:', { userId: req.user.userId, bookId });
    
    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.bookId.toString() !== bookId);
    await cart.save();

    // Populate the cart with book details
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.bookId',
        select: 'title author price images coverImage'
      });

    console.log('Updated cart:', updatedCart);
    res.json(updatedCart);
  } catch (err) {
    console.error('Error removing from cart:', err);
    res.status(500).json({ 
      error: 'Failed to remove item from cart',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Update item quantity
router.put('/:bookId', auth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    console.log('Updating cart item quantity:', { userId: req.user.userId, bookId, quantity });
    
    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item.bookId.toString() === bookId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    cart.items[itemIndex].quantity = quantity;
    await cart.save();

    // Populate the cart with book details
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.bookId',
        select: 'title author price images coverImage'
      });

    console.log('Updated cart:', updatedCart);
    res.json(updatedCart);
  } catch (err) {
    console.error('Error updating quantity:', err);
    res.status(500).json({ 
      error: 'Failed to update quantity',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Clear cart
router.delete('/clear', auth, async (req, res) => {
  try {
    console.log('Clearing cart for user:', req.user.userId);
    
    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    cart.items = [];
    await cart.save();

    res.json({ message: 'Cart cleared successfully' });
  } catch (err) {
    console.error('Error clearing cart:', err);
    res.status(500).json({ 
      error: 'Failed to clear cart',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router; 