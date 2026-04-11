exports.handler = async (event) => {
  const taskId = event.queryStringParameters?.taskId;
  if (!taskId) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'taskId required' }) };
  }

  const KIE_API_KEY = process.env.KIE_API_KEY;
  if (!KIE_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'API key not configured' }) };
  }

  try {
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${KIE_API_KEY}` }
    });

    const data = await res.json();
    console.log('kie.ai recordInfo response:', JSON.stringify(data));

    if (data.code !== 200) {
      return { statusCode: 200, body: JSON.stringify({ status: 'error', error: data.msg }) };
    }

    const state = data.data?.state; // 'waiting' | 'queuing' | 'generating' | 'success' | 'fail'

    if (state === 'success') {
      // resultJson is a JSON string — must parse it
      let videoUrl = null;
      try {
        const result = JSON.parse(data.data.resultJson);
        videoUrl = result.resultUrls?.[0] || null;
      } catch(e) {
        console.error('resultJson parse error:', e.message);
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', videoUrl })
      };
    }

    if (state === 'fail') {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'failed', error: data.data?.failMsg || 'Generation failed' })
      };
    }

    // still processing (waiting / queuing / generating)
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'processing', state })
    };

  } catch (err) {
    console.error('check-video error:', err.message);
    return { statusCode: 200, body: JSON.stringify({ status: 'error', error: err.message }) };
  }
};
