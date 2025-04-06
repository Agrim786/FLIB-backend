// ✅ Load environment variables
require("dotenv").config();
console.log(`[${new Date().toISOString()}] 🔍 Loading .env Variables...`);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { OpenAI } = require("openai");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require('fs');
const Book = require('./models/Book');
const User = require('./models/User');
const { Server } = require('socket.io');
const chatRoutes = require('./routes/chatRoutes');


// ✅ Debugging: Print loaded environment variables
console.log("✅ Loaded ENV Variables:");
console.log("🔹 MONGODB_URI:", process.env.MONGODB_URI ? "Exists" : "MISSING!");
console.log("🔹 OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "Exists" : "MISSING!");
console.log("🔹 RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? "Exists" : "MISSING!");
console.log("🔹 RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "Exists" : "MISSING!");
console.log("🔹 JWT_SECRET:", process.env.JWT_SECRET ? "Exists" : "MISSING!");
console.log("🔹 OPENROUTER_API_KEY:", !!process.env.OPENROUTER_API_KEY);

// ✅ Validate required environment variables
if (!process.env.MONGODB_URI || !process.env.OPENAI_API_KEY || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.JWT_SECRET) {
  console.error("❌ ERROR: Missing critical environment variables! Check your .env file.");
  process.exit(1);
}

// ✅ Initialize Express app
const app = express();

// Configure CORS
app.use(cors({
  origin: '*', // Allow all origins during development
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Serve static files from the uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Import routes
const bookRoutes = require('./routes/bookRoutes');
const authRoutes = require('./routes/authRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const addressRoutes = require('./routes/addressRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const shippingRoutes = require('./routes/shippingRoutes');
const aiRoutes = require('./routes/aiRoutes');
const bookInfoRoutes = require('./routes/bookInfoRoutes');
const googleVisionRoutes = require('./routes/googleVisionRoutes');

// Register routes
app.use('/api/books', bookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/book-info', bookInfoRoutes);
app.use('/api/google-vision', googleVisionRoutes);


// ✅ Connect to MongoDB with retry logic
const seedInitialBooks = async () => {
  try {
    const booksCount = await Book.countDocuments();
    if (booksCount === 0) {
      console.log("🌱 No books found, seeding initial data...");
      
      // Create a test user if none exists
      let testUser = await User.findOne({ email: "test@bookhive.com" });
      if (!testUser) {
        const hashedPassword = await bcrypt.hash("test123", 10);
        testUser = await User.create({
          name: "Test User",
          email: "test@bookhive.com",
          password: hashedPassword
        });
      }
      
      // Sample books data
      const sampleBooks = [
        {
          title: "Introduction to Computer Science",
          category: "Academic",
          condition: "Like New",
          price: 29.99,
          sellerId: testUser._id,
          images: ["/uploads/sample-book1.jpg"],
          createdAt: new Date()
        },
        {
          title: "The Great Gatsby",
          category: "Fiction",
          condition: "Good",
          price: 9.99,
          sellerId: testUser._id,
          images: ["/uploads/sample-book2.jpg"],
          createdAt: new Date()
        },
        {
          title: "Data Structures and Algorithms",
          category: "Technical",
          condition: "New",
          price: 49.99,
          sellerId: testUser._id,
          images: ["/uploads/sample-book3.jpg"],
          createdAt: new Date()
        }
      ];
      
      // Insert sample books
      await Book.insertMany(sampleBooks);
      console.log("✅ Sample books added successfully!");
    }
  } catch (err) {
    console.error("❌ Error seeding books:", err);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Seed initial data after successful connection
    await seedInitialBooks();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Handle MongoDB connection errors
mongoose.connection.on('error', err => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
  connectDB();
});

// ✅ Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Book Condition Classification API (Using OpenAI)
app.post("/api/classify-book", async (req, res) => {
  try {
    const { bookDescription } = req.body;

    if (!bookDescription) {
      return res.status(400).json({ error: "Missing book description" });
    }

    console.log(`[${new Date().toISOString()}] 📩 Received book classification request: "${bookDescription}"`);

    // ✅ OpenAI API request
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a book condition classifier. Classify books as: New, Like New, Used, or Damaged." },
        { role: "user", content: `Classify this book's condition: "${bookDescription}".` },
      ],
      max_tokens: 10,
    });

    if (!response || !response.choices || response.choices.length === 0 || !response.choices[0]?.message?.content) {
      console.error("❌ OpenAI API returned an invalid response:", response);
      return res.status(500).json({ error: "Failed to classify book condition (Invalid OpenAI response)." });
    }

    const bookCondition = response.choices[0].message.content.trim();
    console.log(`[${new Date().toISOString()}] ✅ Book classified as: ${bookCondition}`);

    res.json({ condition: bookCondition });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error in OpenAI request:`, error);
    res.status(500).json({ error: "Failed to classify book condition (Server Error)" });
  }
});

// ✅ Health check route
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running smoothly!",
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// Test route to check books
app.get("/test-books", async (req, res) => {
  try {
    const books = await Book.find();
    console.log("📚 Current books in DB:", books);
    
    if (books.length === 0) {
      // Create a test user if none exists
      let testUser = await User.findOne({ email: "test@bookhive.com" });
      if (!testUser) {
        const hashedPassword = await bcrypt.hash("test123", 10);
        testUser = await User.create({
          name: "Test User",
          email: "test@bookhive.com",
          password: hashedPassword
        });
      }

      // Add a test book if none exist
      const testBook = new Book({
        title: "Test Book",
        category: "Fiction",
        condition: "New",
        price: 19.99,
        sellerId: testUser._id,  // Add the sellerId
        images: ["/uploads/test-book.jpg"],
        createdAt: new Date()
      });
      await testBook.save();
      
      // Add book to user's listings
      testUser.listings.push(testBook._id);
      await testUser.save();
      
      console.log("✅ Test book added successfully!");
    }
    
    // Fetch books again after adding test book
    const updatedBooks = await Book.find().sort("-createdAt");
    res.json({ books: updatedBooks, count: updatedBooks.length });
  } catch (err) {
    console.error("❌ Error in test-books route:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Error Handling for Uncaught Exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  // Don't exit the process, just log the error
  console.error("Stack trace:", err.stack);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err);
  // Don't exit the process, just log the error
  console.error("Stack trace:", err.stack);
});


// Deals
const dealRoutes = require('./routes/deals');
app.use('/api/deals', dealRoutes);

// ✅ Initialize Socket.IO Server
const http = require("http");
const setupSocket = require("./socket");
const server = http.createServer(app);
const io = setupSocket(server);
app.set('io', io); // ✅ Inject Socket.IO instance into Express


app.get("/test", (req, res) => {
  res.json({ message: "🔥 Backend connected successfully!" });
});
// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access from your device using: http://192.168.31.233:${PORT}`);
});

// ✅ Chat Routes
app.use('/api/chats', chatRoutes);
