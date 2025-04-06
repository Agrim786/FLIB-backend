const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const User = require("../models/User");
const auth = require("../middleware/auth");

// ✅ Ensure JWT Secret Exists (Prevents crashes)
if (!process.env.JWT_SECRET) {
  console.error("❌ ERROR: Missing JWT_SECRET in .env file! Please set it.");
  process.exit(1);
}

// ✅ Multer setup for handling profile picture uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Helper function for consistent error response
const handleError = (res, message, statusCode = 500) => {
  console.error(`❌ Error: ${message}`);
  return res.status(statusCode).json({ error: message });
};

// ✅ Register a New User
router.post("/register", async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 📩 Incoming Register Request:`, req.body);

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return handleError(res, "All fields (name, email, password) are required!", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return handleError(res, "Invalid email format!", 400);
    }

    if (password.length < 6) {
      return handleError(res, "Password must be at least 6 characters long!", 400);
    }

    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return handleError(res, "User already exists with this email!", 409);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    console.log(`[${new Date().toISOString()}] ✅ New User Registered: ${user.email}`);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ token, user, message: "User registered successfully!" });
  } catch (err) {
    return handleError(res, "Internal server error. Please try again later.", 500);
  }
});

// ✅ Login User
router.post("/login", async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 📩 Incoming Login Request:`, {
      email: req.body.email,
      hasPassword: !!req.body.password
    });

    const { email, password } = req.body;

    // ✅ Check for missing fields
    if (!email || !password) {
      console.log("❌ Missing fields:", { email: !!email, password: !!password });
      return res.status(400).json({ error: "Both email and password are required!" });
    }

    // ✅ Find user in database
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found in database:", email);
      return res.status(401).json({ error: "Invalid credentials!" });
    }

    console.log("🔍 Found User:", { 
      email: user.email, 
      id: user._id,
      hasPassword: !!user.password 
    });

    // ✅ Compare entered password with stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("🔍 Password match result:", isMatch);

    if (!isMatch) {
      console.log("❌ Password does not match!");
      return res.status(401).json({ error: "Invalid credentials!" });
    }

    console.log("✅ Password matches!");

    // ✅ Generate JWT Token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    console.log("✅ Generated token:", token.substring(0, 20) + "...");

    // ✅ Send response
    const response = { 
      token, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      message: "Login successful!" 
    };
    console.log("📤 Sending response:", {
      hasToken: !!response.token,
      hasUser: !!response.user,
      status: 200
    });

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error in login:", err);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

// ✅ Get User Profile (Protected Route)
router.get("/profile", auth, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 🔍 Fetching Profile for User ID: ${req.user.userId}`);

    const user = await User.findById(req.user.userId).select("name email profilePic");
    if (!user) {
      return handleError(res, "User not found!", 404);
    }

    res.status(200).json(user);
  } catch (err) {
    return handleError(res, "Internal server error. Please try again later.", 500);
  }
});

// ✅ Update User Profile (Name & Profile Picture)
router.put("/update-profile", auth, upload.single("profilePic"), async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 🔄 Updating Profile for User ID: ${req.user.userId}`);

    const user = await User.findById(req.user.userId);
    if (!user) {
      return handleError(res, "User not found!", 404);
    }

    if (req.body.name) {
      user.name = req.body.name;
    }

    if (req.file) {
      const imageBuffer = req.file.buffer.toString("base64");
      user.profilePic = `data:image/jpeg;base64,${imageBuffer}`;
    }

    await user.save();
    res.status(200).json({ message: "Profile updated successfully!", user });
  } catch (err) {
    return handleError(res, "Internal server error. Please try again later.", 500);
  }
});

// ✅ Logout (Frontend Only)
router.post("/logout", auth, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 🚪 User Logged Out: ${req.user.userId}`);

    res.status(200).json({ message: "Logout successful! (Handled on frontend)" });
  } catch (err) {
    return handleError(res, "Internal server error. Please try again later.", 500);
  }
});

// ✅ Check if Email Exists
router.post("/check-email", async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 🔍 Checking Email:`, {
      email: req.body.email,
      headers: req.headers
    });

    const { email } = req.body;

    if (!email) {
      console.log("❌ No email provided");
      return handleError(res, "Email is required!", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("❌ Invalid email format:", email);
      return handleError(res, "Invalid email format!", 400);
    }

    // Convert email to lowercase for case-insensitive comparison
    const normalizedEmail = email.toLowerCase();
    console.log("🔍 Searching for user with normalized email:", normalizedEmail);

    // Use case-insensitive query
    const existingUser = await User.findOne({ 
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });
    
    console.log("🔍 Email check result:", { 
      originalEmail: email,
      normalizedEmail,
      exists: !!existingUser,
      userId: existingUser?._id,
      foundUser: existingUser ? {
        email: existingUser.email,
        name: existingUser.name
      } : null
    });

    res.status(200).json({ 
      exists: !!existingUser,
      message: existingUser ? "Email exists" : "Email not found"
    });
  } catch (err) {
    console.error("❌ Error checking email:", {
      error: err.message,
      stack: err.stack,
      email: req.body.email
    });
    
    // Handle MongoDB connection errors
    if (err.name === 'MongoServerError' || err.name === 'MongoError') {
      return handleError(res, "Database connection error. Please try again later.", 503);
    }
    
    return handleError(res, "Failed to check email. Please try again later.", 500);
  }
});

// ✅ Debug: List all users (temporary route)
router.get("/debug/users", async (req, res) => {
  try {
    console.log("🔍 Fetching all users from database");
    const users = await User.find({}, 'email name');
    console.log("Found users:", users);
    res.json({ users });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

module.exports = router;
