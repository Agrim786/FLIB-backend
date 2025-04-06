const path = require("path");
const fs = require("fs");


if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const credsPath = path.join(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS);
  fs.writeFileSync(tempPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tempPath;
}
const express = require("express");
const multer = require("multer");
const vision = require("@google-cloud/vision");
const fetch = require("node-fetch");


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});


router.post("/extract-text", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded." });
    }

    const imageBuffer = req.file.buffer;

    // 🧠 Step 1: Google Vision OCR
    const [result] = await client.documentTextDetection({ image: { content: imageBuffer } });

    const text = result.fullTextAnnotation?.text;
    if (!text) {
      return res.status(500).json({ error: "No text detected from image." });
    }

    console.log("🧠 Extracted Text from Vision API:", text);

    // 🔁 Step 2: Send to Groq (LLaMA3)
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          {
            role: "user",
            content: `You are an AI assistant helping users list second-hand books for resale based on OCR data from book covers.

Extract and return the following fields only:
- "title": The exact name of the book (include subtitles)
- "author": Include all names listed on the cover (e.g. Peter Thiel **with** Blake Masters). Don’t omit co-authors.
- "subject": The specific subject, genre, or academic field the book belongs to. Examples include: Physics, Chemistry, Biology, History, Startups, Novels, Self-Help, Competitive Exams (like NEET/JEE), etc. Avoid generic terms like "Education" or "Non-Fiction" unless absolutely no better match exists.
- "condition": Choose strictly from this fixed list: [New, Like New, Good, Acceptable, Condition not clear]. 
  - Use clues like worn edges, highlights, torn pages, crisp binding, or visible wear.
  - If the physical condition isn't clearly stated or implied, return: "Condition not clear".
  - Do **not** invent or assume quality based on the book’s type or content.
- "summary": A short and clear 2-3 sentence summary that describes what the book is about and why it may be useful or interesting to a buyer.

⚠️ Rules:
- If any field is missing from text, either skip it or set to "Condition not clear"
- NO explanations. Respond in raw JSON only.
Text:
"""${text}"""`,
          },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    const groqResult = await groqResponse.json();
console.log("🧠 FULL Groq Result:\n", JSON.stringify(groqResult, null, 2));

if (!groqResult.choices || !groqResult.choices[0]?.message?.content) {
  return res.status(500).json({ error: "Groq response was empty or malformed", groqResult });
}
const aiText = groqResult.choices[0].message.content;

console.log("📦 Groq Raw Output:", aiText);

const match = aiText.match(/{[\s\S]*}/);
if (!match) {
  return res.status(500).json({ error: "No valid JSON found in Groq response", raw: aiText });
}

let extractedInfo;
try {
  extractedInfo = JSON.parse(match[0]);
} catch (parseErr) {
  console.error("❌ JSON parse failed:", parseErr.message);
  return res.status(500).json({ error: "Failed to parse JSON from Groq", raw: match[0] });
}

// 🛡️ Fallbacks for missing fields
if (!extractedInfo.summary) {
  extractedInfo.summary = "Summary not available";
}

const loweredText = text.toLowerCase();
if (
  extractedInfo.subject === "Education" ||
  extractedInfo.subject === "Non-Fiction" ||
  !extractedInfo.subject
) {
  if (loweredText.includes("neet") || loweredText.includes("biology")) {
    extractedInfo.subject = "NEET - Biology";
  } else if (loweredText.includes("physics") || loweredText.includes("class 12")) {
    extractedInfo.subject = "Physics - Class 12";
  }
}

// ✅ Overrule "Good" if visible damage is present in text
// 🛡️ Enhanced condition analysis
const conditionText = loweredText;

if (extractedInfo.condition === "Condition not clear") {
  if (/torn|damaged|worn out|very old|creased|scribbled|dog-eared|rough|dirty|stains|loose/i.test(conditionText)) {
    extractedInfo.condition = "Acceptable";
  } else if (/highlighted|used|folded|annotated|repaired|old|underlined/i.test(conditionText)) {
    extractedInfo.condition = "Good";
  } else if (/clean|like new|no marks|no writing|untouched|unused|intact|excellent|crisp/i.test(conditionText)) {
    extractedInfo.condition = "Like New";
  }
}

// 🔁 Downgrade if contradictions detected
if (
  extractedInfo.condition === "Like New" &&
  /highlighted|used|writing|underlined|creased|annotated|scribbled/i.test(conditionText)
) {
  extractedInfo.condition = "Good";
}

if (
  extractedInfo.condition === "Good" &&
  /torn|scribbled|very old|creased|repaired|dirty|stained|worn out/i.test(conditionText)
) {
  extractedInfo.condition = "Acceptable";
}



// 🧱 Ensure core fields exist
["title", "subject", "condition"].forEach((key) => {
  if (!extractedInfo[key]) {
    extractedInfo[key] = "Unknown";
  }
});

return res.json(extractedInfo);


  } catch (err) {
    console.error("🔥 Vision OCR or Groq AI Error:", err.message);
    return res.status(500).json({ error: "OCR or AI processing failed", details: err.message });
  }
});

router.post("/extract-mrp", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded." });
    }

    const imageBuffer = req.file.buffer;

    const [result] = await client.documentTextDetection({
      image: { content: imageBuffer },
    });

    const text = result.fullTextAnnotation?.text;
    if (!text) {
      return res.status(500).json({ error: "No text detected from image." });
    }

    console.log("💰 Raw MRP Text Block:\n", text);

    // Regex to extract MRP in various formats like ₹350, Rs. 399, M.R.P.: ₹299
    let mrp;
const lines = text.split('\n');
const mrpCandidates = [];

// First priority: lines that explicitly mention MRP
for (let line of lines) {
  const lower = line.toLowerCase();
  const isMRPLine = /(?:mrp|price|amount)/i.test(line);
  const isSuspicious = /isbn|code|barcode/.test(lower);

  if (isMRPLine && !isSuspicious) {
    const match = line.match(/(?:₹|rs\.?|mrp[:\s]*)\s*(\d{2,4})(?:\.\d{2})?/i);
    if (match) {
      const value = parseInt(match[1]);
      if (value >= 100 && value <= 2000) {
        console.log("🔍 High-confidence MRP line:", line);
        mrpCandidates.push(value);
      }
    }
  }
}

// Fallback: any clean 3–4 digit number in a line without suspicious words
if (!mrpCandidates.length) {
  for (let line of lines) {
    const lower = line.toLowerCase();
    const match = line.match(/(\d{3,4})/);
    const isSuspicious = /isbn|barcode|code|978|91\d{8}/.test(lower);

    if (match && !isSuspicious) {
      const value = parseInt(match[1]);
      if (value >= 100 && value <= 2000) {
        mrpCandidates.push(value);
      }
    }
  }
}

// Pick the best MRP
if (mrpCandidates.length) {
  mrp = Math.min(...mrpCandidates); // 🧠 MRP is usually the lowest valid candidate near MRP text
  console.log("💰 MRP extracted:", mrp);
} else {
  console.warn("⚠️ No valid MRP found on back cover.");
}



  return res.json({ mrp }); // ✅ Send extracted value// No MRP found
  } catch (err) {
    console.error("❌ MRP Extraction Error:", err.message);
    return res.status(500).json({ error: "Failed to extract MRP", details: err.message });
  }
});

module.exports = router;
