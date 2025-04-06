const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const generateSummary = require('../utils/generateSummary');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Keyword-based fallback category detector
const getFallbackCategory = (text) => {
  const lowered = text.toLowerCase();
  if (/jee|neet|upsc|competitive/.test(lowered)) return 'Competitive';
  if (/cbse|ncert|class|school|syllabus/.test(lowered)) return 'Education';
  if (/story|fiction|novel|fantasy/.test(lowered)) return 'Fiction';
  return 'Other';
};

router.post('/extract-book-info', async (req, res) => {
  const { extractedText } = req.body;

  // 🔍 Log incoming input
  console.log("📥 Extracted Text Received:\n", extractedText);

  if (!extractedText) {
    return res.status(400).json({ error: 'Extracted text is required' });
  }

  const messages = [
    {
      role: "user",
      content: `You are an AI assistant that helps users extract clean, structured book information from scanned or OCR-processed cover text of second-hand books.

From the following text, extract and return these three fields ONLY:
- "title": The exact title of the book. Include subtitles if present.
- "subject": The general subject, genre, or field (e.g. Physics, History, Novel, Startups, Biology, etc.)
- "condition": Choose from this fixed list: [New, Like New, Good, Acceptable, Condition not clear]. If there's no mention of physical condition, set this as "Condition not clear".

⚠️ Guidelines:
- Your output must be valid JSON — do NOT use markdown, quotes, or extra formatting.
- Do not hallucinate missing data.
- Keep all values concise and human-readable.
- Don't explain anything. Just return the raw JSON object.

Book Cover Text:
"""${extractedText}"""
Respond only in this format:
{
  "title": "",
  "subject": "",
  "condition": ""
}`
    }
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages,
        max_tokens: 150,
        temperature: 0.2
      }),
    });

    const result = await response.json();

    console.log("🧠 Groq Response:\n", JSON.stringify(result, null, 2));
    console.log("📌 Model used:", result.model);
    console.log("📊 Token usage:", result.usage);

    const rawContent = result.choices?.[0]?.message?.content || "{}";
    const cleaned = rawContent.replace(/```json|```/g, '').trim();

    let bookInfo;
    try {
      bookInfo = JSON.parse(cleaned);
    } catch (err) {
      console.error("❌ JSON parse error from Groq content:\n", rawContent);
      return res.status(500).json({ error: 'Invalid JSON format from Groq response.' });
    }

    const category = getFallbackCategory(extractedText);

    let summary = "Summary not available";
    try {
      summary = await generateSummary(bookInfo);
    } catch (err) {
      console.error("❌ Summary generation failed:", err.message);
    }

    return res.json({
      ...bookInfo,
      category,
      summary
    });

  } catch (err) {
    console.error("❌ Groq API Error:", err);
    return res.status(500).json({ error: 'Failed to extract book information from Groq.' });
  }
});

module.exports = router;
