// netlify/functions/hinglish.js
// OpenAI API key netlify environment variable se aata hai — NEVER hardcode
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' })
    };
  }

  let text = '';
  try {
    const body = JSON.parse(event.body || '{}');
    text = body.text || '';
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!text.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No text provided' }) };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: 'You are an AI video prompt expert. Convert Hindi/Hinglish descriptions into professional English AI video generation prompts. Be cinematic, detailed, and specific. Reply ONLY with the English prompt — no explanation, no quotes, no extra text.'
          },
          {
            role: 'user',
            content: `Convert this to a cinematic English video prompt (max 2 sentences): ${text}`
          }
        ]
      })
    });

    const data = await response.json();
    const prompt = data.choices?.[0]?.message?.content?.trim();

    if (!prompt) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Translation failed' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error: ' + err.message })
    };
  }
};
