// ═══════════════════════════════════════════════
//  VidAI — generate-video.js
//  UPDATED: All model changes per pricing sheet
// ═══════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://higufnzhndyvuvnextqt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ═══ IP HELPER ═══
function getClientIP(event) {
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    event.headers['x-real-ip'] ||
    'unknown'
  );
}

// ═══ CHECK IP FREE TRIAL ═══
async function checkIPFreeTrial(ip) {
  if (!SUPABASE_SERVICE_KEY) return { allowed: true };
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
    if (trialCount >= 1) return { allowed: false, reason: 'free_trial_used' };
    return { allowed: true };
  } catch (e) {
    console.error('IP check error:', e.message);
    return { allowed: true };
  }
}

// ═══ RECORD IP FREE TRIAL USE ═══
async function recordIPTrial(ip) {
  if (!SUPABASE_SERVICE_KEY) return;
  try {
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

// ═══════════════════════════════════════════════
//  TOOL AVAILABILITY — only real kie.ai tools
// ═══════════════════════════════════════════════
const REAL_TOOLS = {
  ttv: true,   // Text to Video ✅
  stv: true,   // Script to Video ✅ (same as TTV)
  itv: true,   // Image to Video ✅
  pa:  true,   // Photo Animate ✅
  ls:  true,   // Lip Sync ✅
  ta:  true,   // Talking Avatar ✅
  tp:  true,   // Talking Photo ✅
  br:  true,   // Background Remove ✅
  aie: true,   // AI Enhance ✅
  se:  true,   // Sound Effects ✅ (ElevenLabs)
  cap: true,   // Auto Captions ✅ (ElevenLabs)
  vtv: true,   // Video to Video ✅ (Wan 2.7 — blocked for Free)
  stt: true,   // Style Transfer ✅ (Wan 2.7 — blocked for Free)
  cg:  true,   // Color Grading ✅ (Wan 2.7 — blocked for Free)
  sr:  true,   // Sky Replace ✅ (Wan 2.7 — blocked for Free)
  mc:  true,   // Motion Control ✅ (blocked for Free)
  ext: true,   // Video Extension ✅ (blocked for Free)
  s2v: true,   // Speech to Video ✅ (blocked for Free)
  or:  false,  // Object Remove — Coming Soon
  fs:  false,  // Face Swap — Coming Soon
  dg:  false,  // Dance Generator — Coming Soon
  ac:  false,  // Avatar Create — Coming Soon
};

// ═══ TOOLS THAT ARE BLOCKED FOR FREE TIER ═══
const FREE_BLOCKED = ['vtv','stt','cg','sr','mc','ext','s2v'];

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

  // ═══ COMING SOON CHECK ═══
  if (REAL_TOOLS[tool] === false) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        error: `Ye tool abhi coming soon hai! Text to Video, Image to Video, Lip Sync use karo.`,
        comingSoon: true
      })
    };
  }

  const isGuest = userId === 'guest';

  // ═══ FREE TIER BLOCK for certain tools ═══
  if (isGuest || quality === 'free') {
    if (FREE_BLOCKED.includes(tool)) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          error: `Ye tool Free tier mein available nahi. Good, Pro ya Premium quality choose karo.`,
          upgradeRequired: true
        })
      };
    }
  }

  // ═══ IP FREE TRIAL CHECK ═══
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

  // ═══ DURATION VALIDATION ═══
  // kie.ai accepts 5 or 10 only for video
  const dur = duration === '15' ? '10' : (duration === '5' ? '5' : '10');

  // ═══════════════════════════════════════════════
  //  BUILD PAYLOAD — per tool + tier
  // ═══════════════════════════════════════════════
  let payload;
  const endpoint = 'https://api.kie.ai/api/v1/jobs/createTask';

  // ─── 1. TEXT TO VIDEO / SCRIPT TO VIDEO ───
  if (tool === 'ttv' || tool === 'stv') {
    // Free & Good = Hailuo 2.3 (6s, 720p)
    // Pro = Kling 2.5 Turbo (10s, 1080p)
    // Premium = Kling 2.1 Master (10s, 1080p)
    let model;
    if (isGuest || quality === 'free' || quality === 'good') {
      model = 'hailuo/02-text-to-video-standard';
    } else if (quality === 'pro') {
      model = 'kling/v2-5-turbo-text-to-video';
    } else {
      model = 'kling/v2-1-master-text-to-video';
    }
    payload = {
      model,
      input: {
        prompt: prompt.trim(),
        prompt_optimizer: (quality === 'free' || quality === 'good' || isGuest),
        sound: (!isGuest && (quality === 'pro' || quality === 'premium')) ? audio : false,
        aspect_ratio: '16:9',
        duration: (isGuest || quality === 'free' || quality === 'good') ? '6' : '10'
      }
    };

  // ─── 2. IMAGE TO VIDEO / PHOTO ANIMATE ───
  } else if (tool === 'itv') {
    let model;
    if (isGuest || quality === 'free' || quality === 'good') {
      model = 'kling/v2-1-standard-image-to-video';
    } else if (quality === 'pro') {
      model = 'kling/v2-5-turbo-image-to-video';
    } else {
      model = 'kling/v2-1-master-image-to-video';
    }
    payload = {
      model,
      input: {
        prompt: prompt.trim(),
        sound: false,
        aspect_ratio: '16:9',
        duration: '5'
      }
    };

  // ─── 3. PHOTO ANIMATE ───
  } else if (tool === 'pa') {
    // Free = Wan 2.2 580p, Good/Pro = Wan 2.2 720p, Premium = Wan 2.2 Replace
    let model;
    if (isGuest || quality === 'free') {
      model = 'wan/2-2-animate-move-580p';
    } else if (quality === 'premium') {
      model = 'wan/2-2-animate-replace';
    } else {
      model = 'wan/2-2-animate-move';
    }
    payload = {
      model,
      input: {
        prompt: prompt.trim(),
        aspect_ratio: '9:16',
        duration: '5'
      }
    };

  // ─── 4. LIP SYNC / TALKING PHOTO / TALKING AVATAR ───
  } else if (tool === 'ls' || tool === 'tp' || tool === 'ta') {
    // Free = InfiniteTalk 480p (5s), Good/Pro = Avatar Standard (15s), Premium = Avatar Pro (15s)
    let model;
    let avatarDuration;
    if (isGuest || quality === 'free') {
      model = 'infinitalk/from-audio';
      avatarDuration = '5';
    } else if (quality === 'premium') {
      model = 'kling/ai-avatar-pro';
      avatarDuration = '15';
    } else {
      model = 'kling/ai-avatar-standard';
      avatarDuration = '15';
    }
    payload = {
      model,
      input: {
        prompt: prompt.trim(),
        aspect_ratio: '16:9',
        duration: avatarDuration
      }
    };

  // ─── 5. VIDEO TO VIDEO / STYLE TRANSFER / COLOR GRADING / SKY REPLACE ───
  } else if (['vtv', 'stt', 'cg', 'sr'].includes(tool)) {
    // Good = 5s 720p (80cr), Pro = 10s 720p (160cr), Premium = 5s 1080p (120cr)
    let resolution = quality === 'premium' ? '1080p' : '720p';
    let videoDur = quality === 'pro' ? '10' : '5';
    payload = {
      model: 'wan/2-7-videoedit',
      input: {
        prompt: prompt.trim(),
        resolution,
        duration: videoDur
      }
    };

  // ─── 6. MOTION CONTROL ───
  } else if (tool === 'mc') {
    // Good/Pro = Kling 2.6 MC (10s, 720p), Premium = Kling 3.0 MC (10s, 720p)
    let model = quality === 'premium' ? 'kling/v3-0-motion-control' : 'kling/v2-6-motion-control';
    payload = {
      model,
      input: {
        prompt: prompt.trim(),
        aspect_ratio: '16:9',
        duration: '10'
      }
    };

  // ─── 7. VIDEO EXTENSION ───
  } else if (tool === 'ext') {
    // Good/Pro = Grok Extend +10s, Premium = Veo Extend Fast
    let model = quality === 'premium' ? 'google/veo-extend-fast' : 'grok/video-extend';
    payload = {
      model,
      input: {
        prompt: prompt.trim(),
        duration: '10'
      }
    };

  // ─── 8. SPEECH TO VIDEO ───
  } else if (tool === 's2v') {
    payload = {
      model: 'wan/2-2-a14b-speech-to-video-turbo',
      input: {
        prompt: prompt.trim(),
        resolution: '720p'
      }
    };

  // ─── 9. SOUND EFFECTS ───
  } else if (tool === 'se') {
    payload = {
      model: 'elevenlabs/sound-effect-v2',
      input: {
        prompt: prompt.trim()
      }
    };

  // ─── 10. AUTO CAPTIONS ───
  } else if (tool === 'cap') {
    payload = {
      model: 'elevenlabs/speech-to-text',
      input: {
        prompt: prompt.trim()
      }
    };

  // ─── 11. BACKGROUND REMOVE ───
  } else if (tool === 'br') {
    payload = {
      model: 'recraft/remove-background',
      input: {
        prompt: prompt.trim()
      }
    };

  // ─── 12. AI ENHANCE / UPSCALE ───
  } else if (tool === 'aie') {
    let model = quality === 'premium' ? 'google/veo-upscale-4k' : 'google/veo-upscale';
    payload = {
      model,
      input: {
        prompt: prompt.trim()
      }
    };

  // ─── FALLBACK — TTV ───
  } else {
    payload = {
      model: 'hailuo/02-text-to-video-standard',
      input: {
        prompt: prompt.trim(),
        prompt_optimizer: true,
        sound: false,
        aspect_ratio: '16:9',
        duration: '6'
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
    console.log(`[${tool}][${quality}] kie.ai response:`, JSON.stringify(data));

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

    // Record IP trial only after successful API call
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
