exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const KIE_API_KEY = process.env.KIE_API_KEY;
  if (!KIE_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { prompt, tool, userId } = body;
  if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: 'Prompt required' }) };

  try {
    // kie.ai API call
    const kieResponse = await fetch('https://api.kie.ai/v1/video/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt, model: tool || 'text-to-video' })
    });

    const kieData = await kieResponse.json();

    if (!kieResponse.ok) {
      return { statusCode: 400, body: JSON.stringify({ error: kieData.message || 'kie.ai error' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, taskId: kieData.taskId || kieData.id, data: kieData })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
