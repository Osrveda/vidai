exports.handler = async function(event, context) {
  const KIE_API_KEY = process.env.KIE_API_KEY;
  const taskId = event.queryStringParameters?.taskId;
  if (!taskId) return { statusCode: 400, body: JSON.stringify({ error: 'taskId required' }) };

  try {
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${KIE_API_KEY}` }
    });
    const data = await res.json();
    const status = data.data?.status;
    const videoUrl = data.data?.works?.[0]?.resource?.resource || data.data?.videoUrl || null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: status === 'succeed' ? 'completed' : status === 'failed' ? 'failed' : 'pending',
        videoUrl
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
