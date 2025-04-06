/**
 * Generates a concise summary of a book using OpenRouter's GPT-4 API
 * @param {Object} bookDetails - Book information object
 * @param {string} bookDetails.title - Book title
 * @param {string} bookDetails.category - Book category
 * @param {string} bookDetails.condition - Book condition
 * @param {string} [bookDetails.author] - Optional: Book author
 * @param {string} [bookDetails.publisher] - Optional: Publisher name
 * @param {string} [bookDetails.class] - Optional: Academic class/grade
 * @param {string} [bookDetails.description] - Optional: Book description
 * @returns {Promise<string>} Generated summary or fallback message
 */
const generateSummary = async (bookDetails) => {
  try {
    // Construct the prompt from available book details
    const details = [
      bookDetails.title,
      bookDetails.category,
      bookDetails.condition,
      bookDetails.author,
      bookDetails.publisher,
      bookDetails.class,
      bookDetails.description
    ].filter(Boolean).join(", ");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://bookhive.com", // Required by OpenRouter
        "X-Title": "BookHive" // Required by OpenRouter
      },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates concise, engaging summaries of books. Keep summaries to 2-3 sentences, focusing on the book's purpose and condition."
          },
          {
            role: "user",
            content: `Generate a short, engaging summary for this book: ${details}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();

  } catch (error) {
    console.error("Error generating book summary:", error);
    return "Summary not available";
  }
};

module.exports = generateSummary; 