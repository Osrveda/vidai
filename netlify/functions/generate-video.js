exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) }; }

  const { prompt, tool, quality, duration, userId } = body;

  if (!prompt || !prompt.trim()) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Prompt required' }) };
  }

  const KIE_API_KEY = process.env.KIE_API_KEY;
  if (!KIE_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'API key not configured' }) };
  }

  // Map tool codes to kie.ai model names
  const modelMap = {
    ttv:  { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    stv:  { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    itv:  { modelName: 'kling-v2-master', taskType: 'image_to_video' },
    pa:   { modelName: 'kling-v2-master', taskType: 'image_to_video' },
    tp:   { modelName: 'kling-v2-master', taskType: 'image_to_video' },
    vtv:  { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    fs:   { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    ls:   { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    dg:   { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    ac:   { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    ta:   { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    se:   { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    br:   { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    aie:  { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    or:   { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    cap:  { modelName: 'kling-v2-master', taskType: 'text_to_video' },
    stt:  { modelName: 'kling-v2-master', taskType: 'text_to_video' },
  };

  const { modelName, taskType } = modelMap[tool] || modelMap['ttv'];

  // Duration mapping (seconds string)
  const durMap = { '5':'5','10':'10','30':'30','60':'60','120':'120','180':'180' };
  const videoDuration = durMap[String(duration)] || '10';

  const payload = {
    modelName,
    taskType,
    input: {
      prompt: prompt.trim(),
      negative_prompt: 'blurry, low quality, watermark, text, cartoon',
      cfg_scale: 0.5,
      mode: 'std',
      aspect_ratio: '16:9',
      duration: videoDuration
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
    console.log('kie.ai response:', JSON.stringify(data));

    if (!res.ok || data.code !== 200) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, error: data.message || data.msg || `API error ${res.status}` })
      };
    }

    const taskId = data.data?.task_id || data.data?.taskId || data.taskId;
    if (!taskId) {
      return { statusCode: 200, body: JSON.stringify({ success: false, error: 'No taskId in response' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, taskId })
    };

  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
