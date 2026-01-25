const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors({
  origin: '*', // In production, restrict this to your extension ID
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Wooly backend is running!' });
});

// AI Recommendations endpoint
app.post('/api/recommendations', async (req, res) => {
  try {
    const { productName, materials, price, site } = req.body;

    // Validate input
    if (!productName) {
      return res.status(400).json({
        success: false,
        error: 'Product name is required'
      });
    }

    // Format materials for the prompt
    const materialsList = materials && materials.length > 0
      ? materials.map(m => `${m.percentage}% ${m.name}`).join(', ')
      : 'Unknown materials';

    // Identify problematic materials
    const syntheticMaterials = ['polyester', 'acrylic', 'nylon', 'polyamide'];
    const badMaterials = (materials || [])
      .filter(m => syntheticMaterials.some(s => m.name?.toLowerCase().includes(s)))
      .map(m => m.name);

    // Create the prompt
    const prompt = `You are a sustainable fashion expert helping someone make better clothing choices.

Product: "${productName}"
Materials: ${materialsList}
${price ? `Price: ${price}` : ''}
${badMaterials.length > 0 ? `Concerning materials: ${badMaterials.join(', ')}` : ''}

Provide a brief, helpful recommendation (max 150 words) that includes:
1. Quick assessment of the fabric quality/sustainability
2. What to look for in a better alternative (specific materials)
3. One search term they could use to find a sustainable alternative

Be friendly, concise, and practical. Use emojis sparingly.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are Wooly, a friendly sheep mascot who helps people find sustainable, high-quality clothing. Keep responses brief and helpful.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 250,
      temperature: 0.7
    });

    const recommendation = completion.choices[0].message.content.trim();

    // Generate a search query for alternatives
    const searchCompletion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Generate a SHORT search query (3-6 words) to find sustainable alternatives. Return ONLY the search query, nothing else.'
        },
        {
          role: 'user',
          content: `Find sustainable alternative for: "${productName}" (currently made of ${materialsList})`
        }
      ],
      max_tokens: 20,
      temperature: 0.5
    });

    const searchQuery = searchCompletion.choices[0].message.content.trim().replace(/^"|"$/g, '');

    // Build search URL based on site
    let searchUrl;
    const encodedQuery = encodeURIComponent(searchQuery);

    switch (site) {
      case 'zara.com':
        searchUrl = `https://www.zara.com/us/en/search?searchTerm=${encodedQuery}`;
        break;
      case 'hm.com':
        searchUrl = `https://www2.hm.com/en_us/search-results.html?q=${encodedQuery}`;
        break;
      case 'uniqlo.com':
        searchUrl = `https://www.uniqlo.com/us/en/search?q=${encodedQuery}`;
        break;
      case 'asos.com':
        searchUrl = `https://www.asos.com/us/search/?q=${encodedQuery}`;
        break;
      case 'amazon.com':
        searchUrl = `https://www.amazon.com/s?k=${encodedQuery}`;
        break;
      default:
        searchUrl = `https://www.google.com/search?tbm=shop&q=${encodedQuery}+sustainable`;
    }

    res.json({
      success: true,
      recommendation,
      searchQuery,
      searchUrl
    });

  } catch (error) {
    console.error('API Error:', error);

    // Handle specific OpenAI errors
    if (error.code === 'invalid_api_key') {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error. Please contact support.'
      });
    }

    if (error.code === 'insufficient_quota') {
      return res.status(503).json({
        success: false,
        error: 'AI service temporarily unavailable. The OpenAI quota has been exceeded.'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again in a moment.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendation. Please try again.'
    });
  }
});

// Simple AI Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { question, site, pageContext } = req.body;

    if (!question) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    // Build context string from page data
    let contextInfo = '';
    if (pageContext) {
      const parts = [];

      if (pageContext.productName) {
        parts.push(`Product: "${pageContext.productName}"`);
      }
      if (pageContext.price) {
        parts.push(`Price: ${pageContext.price}`);
      }
      if (pageContext.materials && pageContext.materials.length > 0) {
        const materialsList = pageContext.materials
          .map(m => `${m.percentage}% ${m.name}`)
          .join(', ');
        parts.push(`Materials: ${materialsList}`);
      }
      if (pageContext.site) {
        parts.push(`Site: ${pageContext.site}`);
      }

      if (parts.length > 0) {
        contextInfo = `\n\n[Current page context]\n${parts.join('\n')}`;
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are Wooly, a friendly sheep mascot who is an expert on fabric quality and sustainable fashion. You can see the product the user is currently viewing on their screen. Use this context to give specific, helpful advice about the fabric quality, sustainability, and value. Keep answers brief (2-3 sentences max) but reference the specific product details when relevant.`
        },
        { role: 'user', content: question + contextInfo }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    const answer = completion.choices[0].message.content.trim();
    res.json({ success: true, answer });

  } catch (error) {
    console.error('Chat API Error:', error.message);

    if (error.code === 'insufficient_quota') {
      return res.json({ success: false, error: 'OpenAI quota exceeded. Add credits to your account.' });
    }

    res.json({ success: false, error: 'Could not get response from AI.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🐑 Wooly backend running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);

  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY not set in .env file!');
  }
});
