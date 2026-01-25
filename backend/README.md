# Wooly Backend

A simple Node.js backend server that proxies AI requests to OpenAI, keeping your API key secure.

## Setup

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure your API key
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Start the server
```bash
npm start
```

The server will run at `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /health
```
Returns `{ status: 'ok', message: 'Wooly backend is running!' }`

### Get AI Recommendations
```
POST /api/recommendations
Content-Type: application/json

{
  "productName": "Cotton T-Shirt",
  "materials": [
    { "name": "cotton", "percentage": 60 },
    { "name": "polyester", "percentage": 40 }
  ],
  "price": "29.99",
  "site": "zara.com"
}
```

**Response:**
```json
{
  "success": true,
  "recommendation": "AI-generated sustainability advice...",
  "searchQuery": "organic cotton t-shirt",
  "searchUrl": "https://www.zara.com/search?..."
}
```

## Deployment Options

For production, deploy to:
- **Vercel** (free tier available)
- **Railway** (~$5/month)
- **Render** (free tier available)
- **Fly.io** (free tier available)
- **Cloudflare Workers** (free tier available)

Remember to update `BACKEND_URL` in `background.js` after deploying!

## Security Notes

- Never commit your `.env` file
- The API key is only stored on the server
- In production, consider adding rate limiting
- You can add user authentication if needed
