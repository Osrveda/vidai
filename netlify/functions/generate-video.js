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
    const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kling-video',
        prompt: prompt,
        duration: 5,
        aspectRatio: '16:9'
      })
    });

    const kieData = await kieResponse.json();

    if (!kieResponse.ok || kieData.code !== 200) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: kieData.msg || 'kie.ai error' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, taskId: kieData.data?.taskId })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
