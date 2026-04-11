exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); } 
  catch { return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) }; }

  const { prompt, userId } = body;

  if (!prompt || !prompt.trim()) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Prompt required' }) };
  }

  const KIE_API_KEY = process.env.KIE_API_KEY;
  if (!KIE_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'API key not configured in Netlify' }) };
  }

  // Exact payload as per kie.ai official docs
  const payload = {
    model: 'kling-2.6/text-to-video',
    input: {
      prompt: prompt.trim(),
      sound: false,
      aspect_ratio: '16:9',
      duration: '10'
    }
  };

  try {
    const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('kie.ai createTask response:', JSON.stringify(data));

    if (data.code !== 200) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, error: data.msg || `API error: ${data.code}` })
      };
    }

    const taskId = data.data?.taskId;
    if (!taskId) {
      return { statusCode: 200, body: JSON.stringify({ success: false, error: 'No taskId received from kie.ai' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, taskId })
    };

  } catch (err) {
    console.error('generate-video error:', err.message);
    return { statusCode: 200, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
