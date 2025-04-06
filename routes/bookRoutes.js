const express = require("express");
const router = express.Router();
const multer = require("multer");
const Book = require("../models/Book");
const User = require("../models/User");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");
const generateSummary = require("../utils/generateSummary");
const verifyToken = require('../middleware/auth');

// ✅ Set up image storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// ✅ FIX: Get all books
router.get("/", async (req, res) => {
  try {
    console.log("📚 Fetching all books...");
    
    // First, let's get all books without population to see what we have
    const allBooks = await Book.find();
    console.log("📚 Total books found:", allBooks.length);
    console.log("📚 Book IDs:", allBooks.map(b => b._id));
    
    // Check each book's data
    allBooks.forEach((book, index) => {
      console.log(`\nBook ${index + 1}:`, {
        id: book._id,
        title: book.title,
        sellerId: book.sellerId,
        hasImages: book.images && book.images.length > 0,
        category: book.category,
        condition: book.condition,
        price: book.price
      });
    });


    // Now get books with populated seller info
    const books = await Book.find()
      .sort("-createdAt")
      .populate({
        path: "sellerId",
        select: "name email",
        options: { retainNullValues: true }
      });
    
    // Map books to ensure they all have valid data
    const processedBooks = books.map(book => {
      const bookObj = book.toObject();
      
      // If seller doesn't exist, provide default values
      if (!bookObj.sellerId) {
        bookObj.sellerId = {
          name: "Unknown Seller",
          email: "unknown@bookhive.com"
        };
      }
      
      return bookObj;
    });
    
    console.log(`\n✅ Found ${processedBooks.length} books after processing`);
    console.log("📚 Sample processed book:", JSON.stringify(processedBooks[0], null, 2));
    
    res.json(processedBooks);
  } catch (err) {
    console.error("❌ Error fetching books:", err);
    console.error("Error details:", err.stack);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Diagnostic route to check database state
router.get("/diagnostic", async (req, res) => {
  try {
    // Get all books
    const books = await Book.find().lean();
    
    // Get all users
    const users = await User.find().lean();
    
    // Analyze books
    const booksAnalysis = {
      totalBooks: books.length,
      booksWithoutSeller: books.filter(b => !b.sellerId).length,
      booksWithInvalidSeller: books.filter(b => {
        return b.sellerId && !users.some(u => u._id.toString() === b.sellerId.toString())
      }).length,
      bookCategories: books.reduce((acc, book) => {
        acc[book.category] = (acc[book.category] || 0) + 1;
        return acc;
      }, {})
    };
    
    // Analyze users
    const usersAnalysis = {
      totalUsers: users.length,
      usersWithListings: users.filter(u => u.listings && u.listings.length > 0).length,
      totalListings: users.reduce((sum, user) => sum + (user.listings?.length || 0), 0)
    };
    
    res.json({
      booksAnalysis,
      usersAnalysis,
      sampleBook: books[0],
      sampleUser: users[0]
    });
  } catch (err) {
    console.error("❌ Error in diagnostic route:", err);
    res.status(500).json({ error: err.message });
  }
});

// Debug route to check raw database state
router.get("/debug-db", async (req, res) => {
  try {
    // Get raw database state
    const dbState = {
      // Get all collections
      collections: mongoose.connection.collections,
      // Check database connection
      dbStatus: mongoose.connection.readyState,
      // Get all books without any processing
      rawBooks: await mongoose.connection.db.collection('books').find({}).toArray(),
      // Get all users without any processing
      rawUsers: await mongoose.connection.db.collection('users').find({}).toArray()
    };

    console.log("🔍 Database State:", {
      connectionStatus: dbState.dbStatus,
      collectionsFound: Object.keys(dbState.collections),
      rawBooksCount: dbState.rawBooks.length,
      rawUsersCount: dbState.rawUsers.length
    });

    res.json({
      connectionStatus: dbState.dbStatus === 1 ? 'connected' : 'disconnected',
      collections: Object.keys(dbState.collections),
      rawBooks: dbState.rawBooks,
      rawUsers: dbState.rawUsers
    });
  } catch (err) {
    console.error("❌ Error checking database state:", err);
    res.status(500).json({ error: err.message });
  }
});


// GET /api/books/mine
router.get('/mine', auth, async (req, res) => {
  try {
    const books = await Book.find({ sellerId: req.user.userId });
    res.json(books);
  } catch (err) {
    console.error('Error fetching seller books:', err);
    res.status(500).json({ error: 'Failed to fetch seller books' });
  }
});

   // ✅ Get books near user location (within 10km)
   router.get('/nearby', async (req, res) => {
    const { lat, lng } = req.query;
  
    console.log("📥 Nearby fetch request received.");
    console.log("📍 Coordinates received:", { lat, lng });
  
    if (!lat || !lng) {
      console.warn("⚠️ Missing latitude or longitude in request.");
      return res.status(400).json({ error: "Missing latitude or longitude" });
    }
  
    try {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
  
      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        console.error("❌ Invalid coordinates received:", { lat, lng });
        return res.status(400).json({ error: "Invalid coordinates" });
      }
  
      const books = await Book.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parsedLng, parsedLat],
            },
            $maxDistance: 10000, // 10km
          },
        },
      });
  
      console.log(`✅ Found ${books.length} nearby book(s).`);
      books.forEach((book, index) => {
        console.log(`📘 Book ${index + 1}:`, {
          title: book.title,
          coordinates: book.location?.coordinates || "No location data",
        });
      });
  
      res.json(books);
    } catch (err) {
      console.error("❌ Failed to fetch nearby books:", err);
      res.status(500).json({ error: "Failed to fetch nearby books" });
    }
  });
  

// ✅ Get book by ID
router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate("sellerId", "name");

    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.json(book);
  } catch (err) {
    console.error("❌ Error fetching book:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Add new book (Authenticated)
router.post("/add", auth, upload.array("images", 5), async (req, res) => {
  console.log("📥 Multer files received:", req.files?.length || 0);

  try {
    const { title, category, condition, price } = req.body;
    const location = JSON.parse(req.body.location || "{}");

    console.log("📝 Form Data:", { title, category, condition, price });
    console.log("📍 Parsed location from client:", location);

    if (!title || !category || !condition || !price) {
      console.warn("⚠️ Missing required fields");
      return res.status(400).json({ error: "All fields are required!" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      console.error("❌ User not found for ID:", req.user.userId);
      return res.status(404).json({ error: "User not found" });
    }

    const imageUrls = req.files.map((file) => `/uploads/${file.filename}`);
    console.log("🖼️ Image URLs saved:", imageUrls);

    const bookDetailsForAI = {
      title,
      category,
      condition,
      author: req.body.author,
      publisher: req.body.publisher,
      class: req.body.class,
      description: req.body.description
    };

    let summary = "Summary not available";
    try {
      summary = await generateSummary(bookDetailsForAI);
      console.log("🧠 AI Summary generated.");
    } catch (err) {
      console.warn("⚠️ AI Summary generation failed:", err.message);
    }

    const book = new Book({
      title,
      category,
      condition,
      price,
      description: req.body.description || "",
      author: req.body.author || "",
      publisher: req.body.publisher || "",
      class: req.body.class || "",
      summary,
      sellerId: req.user.userId,
      images: imageUrls,
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
      },
      createdAt: new Date(),
    });

    await book.save();
    user.listings.push(book._id);
    await user.save();

    console.log("✅ Book added to DB:", book.title, "| Book ID:", book._id.toString());
    res.json(book);
  } catch (err) {
    console.error("❌ Error adding book:", err);
    res.status(500).json({ error: "Server error" });
  }
});


 

// ✅ Delete book (Authenticated)
router.delete("/:id", auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    // ✅ Ensure only the owner can delete it
    if (book.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Unauthorized action" });
    }

    await book.remove();

    // ✅ Remove book from user's listings
    await User.findByIdAndUpdate(req.user.userId, { $pull: { listings: book._id } });

    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting book:", err);
    res.status(500).json({ error: "Server error" });
  }
});
 
 // 🚩 Add clearly as a separate route (as shared earlier)
router.get("/related/:id", async (req, res) => {
  try {
    const currentBook = await Book.findById(req.params.id);
    if (!currentBook) {
      return res.status(404).json({ error: "Book not found" });
    }

    const relatedBooks = await Book.find({
      _id: { $ne: req.params.id },
      category: currentBook.category
    })
    .limit(5)
    .populate("sellerId", "name email");

    res.json(relatedBooks);
  } catch (err) {
    console.error("❌ Error fetching related books:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
