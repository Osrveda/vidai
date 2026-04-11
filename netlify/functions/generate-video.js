// ═══════════════════════════════════════════════
//  VidAI — generate-video.js
//  IP-based free trial protection + all 19 tools
// ═══════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://higufnzhndyvuvnextqt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Service role key (not anon)

// ═══ IP HELPER ═══
function getClientIP(event) {
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    event.headers['x-real-ip'] ||
    'unknown'
  );
}

// ═══ CHECK IP FREE TRIAL (Supabase) ═══
async function checkIPFreeTrial(ip) {
  if (!SUPABASE_SERVICE_KEY) return { allowed: true }; // Fallback if not configured

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ip_trials?ip_address=eq.${encodeURIComponent(ip)}&select=trial_count,last_trial`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const rows = await res.json();

    if (!rows || rows.length === 0) return { allowed: true, isNew: true };

    const row = rows[0];
    const trialCount = row.trial_count || 0;

    if (trialCount >= 1) {
      return { allowed: false, reason: 'free_trial_used' };
    }

    return { allowed: true };
  } catch (e) {
    console.error('IP check error:', e.message);
    return { allowed: true }; // On error, allow (don't block legit users)
  }
}

// ═══ RECORD IP FREE TRIAL USE ═══
async function recordIPTrial(ip) {
  if (!SUPABASE_SERVICE_KEY) return;

  try {
    // Upsert — insert or increment
    await fetch(`${SUPABASE_URL}/rest/v1/ip_trials`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        ip_address: ip,
        trial_count: 1,
        last_trial: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error('Record IP error:', e.message);
  }
}

// ═══ REAL KIE.AI MODEL MAP ═══
const modelMap = {
  // TEXT TO VIDEO — all real
  free:    'kling-1.6/text-to-video',
  good:    'kling-2.0/text-to-video',
  pro:     'kling-2.5/text-to-video',
  premium: 'kling-2.6/text-to-video'
};

// ═══ WHAT TOOLS ARE ACTUALLY AVAILABLE ON KIE.AI ═══
const REAL_TOOLS = {
  ttv: true,  // Text to Video ✅
  stv: true,  // Script to Video ✅ (same as TTV)
  itv: true,  // Image to Video ✅
  pa:  true,  // Photo Animate ✅ (same as ITV)
  ls:  true,  // Lip Sync ✅ (kling/ai-avatar-standard)
  ta:  true,  // Talking Avatar ✅ (kling/ai-avatar-standard)
  tp:  true,  // Talking Photo ✅ (kling/ai-avatar-standard)
  br:  true,  // Background Remove ✅ (recraft/remove-background)
  aie: true,  // AI Enhance ✅ (topaz/image-upscale)
  // Below: NOT available on kie.ai — will return COMING SOON error
  fs:  false, // Face Swap
  dg:  false, // Dance Generator
  ac:  false, // Avatar Create
  vtv: false, // Video to Video
  stt: false, // Style Transfer
  cg:  false, // Color Grading
  sr:  false, // Sky Replace
  or:  false, // Object Remove
  cap: false, // Auto Captions
  se:  false, // Sound Effects
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) }; }

  const {
    prompt,
    userId = 'guest',
    tool = 'ttv',
    quality = 'free',
    duration = '5',
    audio = false
  } = body;

  if (!prompt || !prompt.trim()) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Prompt required' }) };
  }

  const KIE_API_KEY = process.env.KIE_API_KEY;
  if (!KIE_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'API key not configured in Netlify' }) };
  }

  // ═══ TOOL AVAILABILITY CHECK ═══
  if (REAL_TOOLS[tool] === false) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        error: `${tool.toUpperCase()} tool coming soon! Abhi Text to Video, Image to Video, Lip Sync, Background Remove use karo.`,
        comingSoon: true
      })
    };
  }

  // ═══ IP-BASED FREE TRIAL PROTECTION ═══
  const isGuest = userId === 'guest';
  if (isGuest) {
    const clientIP = getClientIP(event);
    const ipCheck = await checkIPFreeTrial(clientIP);

    if (!ipCheck.allowed) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          error: 'Free trial already used on this network. Sign up for more videos!',
          requireSignup: true
        })
      };
    }
  }

  // ═══ DURATION — kie.ai accepts 5 or 10 only ═══
  const dur = duration === '15' ? '10' : (duration === '5' ? '5' : '10');

  // ═══ BUILD PAYLOAD based on REAL kie.ai models ═══
  let payload;
  let endpoint = 'https://api.kie.ai/api/v1/jobs/createTask';

  if (tool === 'ttv' || tool === 'stv') {
    payload = {
      model: isGuest ? modelMap.free : (modelMap[quality] || modelMap.free),
      input: {
        prompt: prompt.trim(),
        sound: (!isGuest && (quality === 'pro' || quality === 'premium')) ? audio : false,
        aspect_ratio: '16:9',
        duration: isGuest ? '5' : dur
      }
    };

  } else if (tool === 'itv' || tool === 'pa') {
    payload = {
      model: (isGuest || quality === 'free') ? 'kling-1.6/image-to-video' : 'kling-2.6/image-to-video',
      input: {
        prompt: prompt.trim(),
        sound: false,
        aspect_ratio: '16:9',
        duration: isGuest ? '5' : dur
      }
    };

  } else if (tool === 'ls' || tool === 'ta' || tool === 'tp') {
    // Lip Sync / Talking Avatar — use kie.ai avatar model
    payload = {
      model: quality === 'premium' ? 'kling/ai-avatar-pro' : 'kling/ai-avatar-standard',
      input: {
        prompt: prompt.trim(),
        aspect_ratio: '16:9',
        duration: '15' // Avatar always 15s
      }
    };

  } else if (tool === 'br') {
    // Background Remove — recraft
    payload = {
      model: 'recraft/remove-background',
      input: {
        prompt: prompt.trim()
      }
    };

  } else if (tool === 'aie') {
    // AI Enhance — topaz upscale
    payload = {
      model: 'topaz/image-upscale',
      input: {
        prompt: prompt.trim()
      }
    };

  } else {
    // Fallback — TTV
    payload = {
      model: isGuest ? modelMap.free : (modelMap[quality] || modelMap.free),
      input: {
        prompt: prompt.trim(),
        sound: false,
        aspect_ratio: '16:9',
        duration: isGuest ? '5' : dur
      }
    };
  }

  // ═══ API CALL ═══
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(`[${tool}] kie.ai response:`, JSON.stringify(data));

    if (data.code !== 200) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, error: data.msg || `API error: ${data.code}` })
      };
    }

    const taskId = data.data?.taskId;
    if (!taskId) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, error: 'No taskId from kie.ai' })
      };
    }

    // ═══ RECORD IP TRIAL USE (only after successful API call) ═══
    if (isGuest) {
      const clientIP = getClientIP(event);
      await recordIPTrial(clientIP);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, taskId })
    };

  } catch (err) {
    console.error('generate-video error:', err.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
