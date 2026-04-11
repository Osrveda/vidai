exports.handler = async (event) => {
  const taskId = event.queryStringParameters?.taskId;

  if (!taskId) {
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'failed', error: 'No taskId provided' })
    };
  }

  const KIE_API_KEY = process.env.KIE_API_KEY;
  if (!KIE_API_KEY) {
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'failed', error: 'API key not configured' })
    };
  }

  try {
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`
      }
    });

    const data = await res.json();
    console.log('check-video response:', JSON.stringify(data));

    if (data.code !== 200) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'failed', error: data.msg || 'API error' })
      };
    }

    const job = data.data;
    if (!job) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'processing' })
      };
    }

    // kie.ai status: pending, processing, completed, failed
    const status = job.status?.toLowerCase() || 'processing';

    if (status === 'completed' || status === 'succeed' || status === 'success') {
      // Try multiple possible response paths
      const videoUrl =
        job.videoUrl ||
        job.output?.videoUrl ||
        job.output?.video_url ||
        job.result?.videoUrl ||
        job.works?.[0]?.video?.url ||
        job.works?.[0]?.videoUrl ||
        null;

      if (videoUrl) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed', videoUrl })
        };
      } else {
        // Completed but no URL yet — keep polling
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'processing' })
        };
      }
    }

    if (status === 'failed' || status === 'error') {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'failed', error: job.failReason || 'Generation failed' })
      };
    }

    // Still processing
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'processing', progress: job.progress || 0 })
    };

  } catch (err) {
    console.error('check-video error:', err.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'processing' }) // Don't fail — keep polling
    };
  }
};
