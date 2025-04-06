const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const multer = require("multer");
const upload = multer();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

router.post("/predict-price", async (req, res) => {
  const { title, category, condition, mrp } = req.body;

  if (!title || !category || !condition) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const messages = [
    {
      role: "user",
      content: `You are an expert AI assistant that predicts highly accurate resale prices for second-hand books in the Indian student market.
  
  🎯 Your goal is to estimate the **most realistic resale price in INR** (₹), factoring in:
  - The book's name and academic subject
  - Demand level (e.g., NEET/JEE prep books > NCERT > storybooks/novels)
  - Condition: New, Like New, Good, Acceptable, Condition not clear
  - Informal resale platforms: Telegram groups, OLX, college swaps, book meetups
  ${mrp ? `- Printed MRP: ₹${mrp}. This is a pricing ceiling. New books should be close to MRP, others discounted accordingly.` : ''}
  
  📈 Condition logic:
  - "New": Price must be **close to MRP but always lower**, especially if it’s an academic book.
  - "Like New": Moderate discount (15–30%) based on popularity.
  - "Good": Reasonable markdown, reflects visible use.
  - "Acceptable": Steep markdown, used but still usable.
  - "Condition not clear": Be conservative.
  
  🧠 Use these examples as soft anchors:
  - "Concepts of Physics Vol. 1" (New, MRP ₹580): 480  
  - "Concepts of Physics Vol. 1" (Good): 240  
  - "NCERT Bio Class 11" (Like New): 150  
  - "Wings of Fire" (Novel, Good): 90  
  - "Class 6 Geography NCERT" (Acceptable): 60  
  - "RD Sharma Class 10" (Good): 180
  
  📏 Rules:
  - No fixed price jumps — vary based on subject, condition, and demand
  - Avoid unrealistic or generic prices
  - Do NOT output ₹ symbol, decimals, or extra text
  - ONLY return a clean integer like: 140
  
  Book Info:
  - Title: ${title}
  - Subject: ${category}
  - Condition: ${condition}`
    }
  ];
  

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages,
        temperature: 0.35,
        max_tokens: 12,
      }),
    });

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content?.trim();
    const price = parseInt((content || "").match(/\d+/)?.[0]);

    if (isNaN(price)) {
      throw new Error("Invalid AI price format");
    }

    return res.json({ price });
  } catch (err) {
    console.error("❌ AI Price Prediction Error:", err.message);
    return res.status(500).json({ error: "Failed to predict price", details: err.message });
  }
});

const fallbackExtract = async (imageBuffer) => {
  try {
    // 🧠 Step 1: Convert buffer to base64 string for AI
    const base64Image = imageBuffer.toString("base64");

    // 🧠 Step 2: Send to Groq or OpenRouter with prompt
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          {
            role: "user",
            content: `You're an AI that extracts book info from raw OCR images.
Given this base64 image, return a JSON with fields:
- title
- author
- subject
- condition (one of: New, Like New, Good, Acceptable, Condition not clear)
- summary

Base64 image:
"""${base64Image}"""`,
          },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    const match = content.match(/{[\s\S]*}/);
    if (!match) throw new Error("No valid JSON found");

    return JSON.parse(match[0]);
  } catch (err) {
    console.error("❌ fallbackExtract error:", err.message);
    throw err;
  }
};

router.post("/extract-book-details", upload.single('image'), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    // 🔥 Call your fallback AI logic here
    const bookInfo = await fallbackExtract(imageBuffer); // your own function
    res.json(bookInfo);
  } catch (error) {
    console.error("❌ AI Fallback error:", error);
    res.status(500).json({ error: "AI fallback failed" });
  }
});


module.exports = router;
