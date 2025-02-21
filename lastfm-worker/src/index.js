const allowedOrigins = [
    'https://turtl.cc',
    'https://turtl.neocities.org',
    'https://turtl.nekoweb.org',
    'http://localhost:8080'
];

const CACHE_TTL = 6; // seconds
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;

// Shared utilities
const getCorsHeaders = (origin) => ({
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
});

const createResponse = (data, status = 200, corsHeaders, cache = true) => {
    const headers = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(cache && { 'Cache-Control': CACHE_CONTROL })
    };
    
    return new Response(JSON.stringify(data), { status, headers });
};

const createErrorResponse = (
    message, 
    status = 500, 
    corsHeaders, 
    details = null,
    cache = status === 404 // Only cache 404s by default
) => createResponse(
    { error: message, ...(details && { details }) },
    status,
    corsHeaders,
    cache
);

async function getFromCache(request, env) {
    const cache = caches.default;
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    return null;
}

async function cacheResponse(request, response, env) {
    const cache = caches.default;
    await cache.put(request, response.clone());
    return response;
}

const fetchLastFM = async (method, params, env) => {
  const baseURL = 'https://ws.audioscrobbler.com/2.0/';
  const url = new URL(baseURL);
  url.search = new URLSearchParams({
    method,
    format: 'json',
    api_key: env.LASTFM_API_KEY,
    ...params
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Last.fm API error: ${response.status}`);
  }
  
  const data = await response.json();
  if (data.error) {
    throw new Error(data.message || 'Last.fm API error');
  }
  
  return data;
};

// converts unix time to relative time text
function relativeTime(time, time_text) {
  const time_now = Math.round(Date.now() / 1000);
  const time_diff = time_now - time;

  const SEC_IN_MIN = 60;
  const SEC_IN_HOUR = SEC_IN_MIN * 60;
  const SEC_IN_DAY = SEC_IN_HOUR * 24;

  if (time_diff < SEC_IN_HOUR) {
    const minutes = Math.round(time_diff / SEC_IN_MIN);
    return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
  }
  if (time_diff < SEC_IN_DAY) {
    const hours = Math.round(time_diff / SEC_IN_HOUR);
    return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
  }
  return time_text;
}

// Shared track fetching logic
async function fetchCurrentTrack(env) {
    const data = await fetchLastFM('user.getrecenttracks', {
        limit: 1,
        user: env.LASTFM_USERNAME
    }, env);

    const track = data.recenttracks?.track?.[0];
    if (!track) {
        return null;
    }

    return track;
}

// Route handlers
const routes = {
    'now-playing': (env, corsHeaders) => getNowPlaying(env, corsHeaders),
    'now-playing-preview': (env, corsHeaders) => getNowPlayingPreview(env, corsHeaders),
    'artist-info': (env, corsHeaders, params) => {
        const artistName = params.get('artist');
        if (!artistName) {
            return createErrorResponse('Artist name is required', 400, corsHeaders, null, false);
        }
        return getArtistInfo(env, artistName, corsHeaders);
    },
    'track-info': (env, corsHeaders, params) => {
        const trackName = params.get('track');
        const artist = params.get('artist');
        if (!trackName || !artist) {
            return createErrorResponse('Track name and artist are required', 400, corsHeaders, null, false);
        }
        return getTrackInfo(env, artist, trackName, corsHeaders);
    }
};

export default {
    async fetch(request, env, ctx) {
        const origin = request.headers.get('Origin');
        
        // Reject unauthorized origins immediately
        if (origin && !allowedOrigins.includes(origin)) {
            return createErrorResponse('Unauthorized', 403, corsHeaders, null, false);
        }
        
        const corsHeaders = getCorsHeaders(origin);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Check rate limit using only the client's IP as the key
        const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
        const rateLimitResult = await env.API_RATE_LIMITER.limit({ key: clientIP });

        // Add rate limit headers to all responses
        corsHeaders['X-RateLimit-Limit'] = '60';
        corsHeaders['X-RateLimit-Period'] = '60';
        
        if (!rateLimitResult.success) {
            return createErrorResponse('Too many requests', 429, corsHeaders, null, false);
        }

        // Try to get from cache first
        const cachedResponse = await getFromCache(request, env);
        if (cachedResponse) {
            return cachedResponse;
        }

        const url = new URL(request.url);
        // Normalize path by removing extra slashes and getting last segment
        const endpoint = url.pathname.replace(/\/+/g, '/').split('/').filter(Boolean).pop();
        
        try {
            const handler = routes[endpoint];
            if (!handler) {
                return createErrorResponse('Not found', 404, corsHeaders);
            }

            const response = await handler(env, corsHeaders, url.searchParams);

            // Cache successful responses
            if (response.status === 200) {
                return cacheResponse(request, response, env);
            }
            return response;
        } catch (error) {
            console.error(`Error in ${endpoint}:`, error);
            return createErrorResponse(error.message, 500, corsHeaders);
        }
    }
};

async function getNowPlaying(env, corsHeaders) {
    const track = await fetchCurrentTrack(env);
    if (!track) {
        return createErrorResponse('No track data found', 404, corsHeaders);
    }

    const relativeTimeStr = track.date ? 
        relativeTime(parseInt(track.date.uts), track.date['#text']) : 
        null;

    return createResponse({
        track: {
            name: track.name,
            url: track.url,
            loved: track['@attr']?.loved === 'true',
            imageSmall: track.image?.[1]?.['#text'],
            imageMedium: track.image?.[2]?.['#text'],
            imageLarge: track.image?.[3]?.['#text']
        },
        artist: {
            name: track.artist?.['#text'] || track.artist?.name,
            url: track.artist?.url || `https://www.last.fm/music/${encodeURIComponent(track.artist?.['#text'] || track.artist?.name)}`
        },
        album: track.album?.['#text'] ? {
            name: track.album['#text'],
            url: `https://www.last.fm/music/${encodeURIComponent(track.artist?.['#text'] || track.artist?.name)}/${encodeURIComponent(track.album['#text'])}`
        } : null,
        isNowPlaying: track['@attr']?.nowplaying === 'true',
        playedAt: track['@attr']?.nowplaying ? null : relativeTimeStr
    }, 200, corsHeaders);
}

async function getArtistInfo(env, artistName, corsHeaders) {
    const data = await fetchLastFM('artist.getinfo', {
        artist: artistName,
        username: env.LASTFM_USERNAME
    }, env);

    return createResponse({
        artist: {
            name: data.artist?.name,
            url: data.artist?.url,
            imageSmall: data.artist?.image?.[1]?.['#text'],
            imageMedium: data.artist?.image?.[2]?.['#text'],
            imageLarge: data.artist?.image?.[3]?.['#text'],
            stats: {
                userPlayCount: parseInt(data.artist?.stats?.userplaycount) || 0,
                globalPlayCount: parseInt(data.artist?.stats?.playcount) || 0,
                listeners: parseInt(data.artist?.stats?.listeners) || 0
            },
            tags: data.artist?.tags?.tag?.map(tag => ({
                name: tag.name,
                url: tag.url
            })) || []
        }
    }, 200, corsHeaders);
}

async function getTrackInfo(env, artist, trackName, corsHeaders) {
    const data = await fetchLastFM('track.getInfo', {
        artist,
        track: trackName,
        username: env.LASTFM_USERNAME
    }, env);

    return createResponse({
        track: {
            name: data.track?.name,
            url: data.track?.url,
            artist: {
                name: data.track?.artist?.name,
                url: data.track?.artist?.url
            },
            album: data.track?.album ? {
                name: data.track.album.title,
                url: data.track.album.url,
                imageSmall: data.track.album?.image?.[1]?.['#text'],
                imageMedium: data.track.album?.image?.[2]?.['#text'],
                imageLarge: data.track.album?.image?.[3]?.['#text']
            } : null,
            stats: {
                userPlayCount: parseInt(data.track?.userplaycount) || 0,
                globalPlayCount: parseInt(data.track?.playcount) || 0,
                listeners: parseInt(data.track?.listeners) || 0
            },
            tags: data.track?.toptags?.tag?.map(tag => ({
                name: tag.name,
                url: tag.url
            })) || []
        }
    }, 200, corsHeaders);
}

async function getNowPlayingPreview(env, corsHeaders) {
    const track = await fetchCurrentTrack(env);
    if (!track) {
        return createErrorResponse('No track currently playing', 404, corsHeaders);
    }

    try {
        // Get SoundCloud access token
        const tokenResponse = await fetch('https://api.soundcloud.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: env.SOUNDCLOUD_CLIENT_ID,
                client_secret: env.SOUNDCLOUD_CLIENT_SECRET
            })
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to authenticate with SoundCloud');
        }

        const { access_token } = await tokenResponse.json();
        const searchQuery = `${track.name} ${track.artist?.['#text'] || track.artist?.name}`;
        
        // Search for track on SoundCloud
        const searchResponse = await fetch(
            `https://api.soundcloud.com/tracks?q=${encodeURIComponent(searchQuery)}`,
            { headers: { Authorization: `Bearer ${access_token}` }}
        );

        if (!searchResponse.ok) {
            throw new Error('Failed to search SoundCloud');
        }

        const searchData = await searchResponse.json();
        if (searchData.length === 0) {
            return createErrorResponse('No preview available', 404, corsHeaders);
        }

        // Get stream URLs
        const foundTrack = searchData[0];
        const streamResponse = await fetch(
            `https://api.soundcloud.com/tracks/${foundTrack.id}/streams`,
            { headers: { Authorization: `Bearer ${access_token}` }}
        );

        if (!streamResponse.ok) {
            throw new Error('Failed to get stream URL');
        }

        const streamData = await streamResponse.json();
        return createResponse({
            preview: {
                previewUrl: streamData.preview_mp3_128_url,
                fullUrl: streamData.http_mp3_128_url,
                durationMs: foundTrack.duration,
                waveformUrl: foundTrack.waveform_url,
                soundCloudUrl: foundTrack.permalink_url
            },
            track: {
                name: track.name,
                artist: track.artist?.['#text'] || track.artist?.name
            }
        }, 200, corsHeaders);
    } catch (error) {
        return createErrorResponse('Failed to fetch preview', 500, corsHeaders, error.message, false);
    }
} 