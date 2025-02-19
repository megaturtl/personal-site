const allowedOrigins = [
    'https://turtl.cc',
    'https://turtl.neocities.org',
    'https://turtl.nekoweb.org',
    'http://localhost:8080'
];

const CACHE_TTL = 3; // seconds
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

const createErrorResponse = (message, status = 500, corsHeaders, details = null) => createResponse(
    { error: message, ...(details && { details }) },
    status,
    corsHeaders,
    false // Don't cache errors
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

export default {
    async fetch(request, env, ctx) {
        const origin = request.headers.get('Origin');
        const corsHeaders = getCorsHeaders(origin);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Try to get from cache first
        const cachedResponse = await getFromCache(request, env);
        if (cachedResponse) {
            return cachedResponse;
        }

        const url = new URL(request.url);
        const endpoint = url.pathname.split('/').pop();

        try {
            let response;
            switch (endpoint) {
                case 'now-playing':
                    response = await getNowPlaying(env, corsHeaders);
                    break;
                case 'now-playing-preview':
                    response = await getNowPlayingPreview(env, corsHeaders);
                    break;
                case 'artist-info': {
                    const artistName = url.searchParams.get('artist');
                    if (!artistName) {
                        return createErrorResponse('Artist name is required', 400, corsHeaders);
                    }
                    response = await getArtistInfo(env, artistName, corsHeaders);
                    break;
                }
                case 'track-info': {
                    const trackName = url.searchParams.get('track');
                    const artist = url.searchParams.get('artist');
                    if (!trackName || !artist) {
                        return createErrorResponse('Track name and artist are required', 400, corsHeaders);
                    }
                    response = await getTrackInfo(env, artist, trackName, corsHeaders);
                    break;
                }
                default:
                    return createErrorResponse('Not found', 404, corsHeaders);
            }

            // Cache successful responses
            if (response.status === 200) {
                return cacheResponse(request, response, env);
            }
            return response;
        } catch (error) {
            console.error(`Error in ${endpoint}:`, error);
            return createErrorResponse(error.message, 500, corsHeaders);
        }
    },
};

async function getNowPlaying(env, corsHeaders) {
    const data = await fetchLastFM('user.getrecenttracks', {
        limit: 1,
        user: env.LASTFM_USERNAME
    }, env);

    if (!data.recenttracks?.track?.length) {
        return createErrorResponse('No track data found', 404, corsHeaders);
    }

    const track = data.recenttracks.track[0];
    const relativeTimeStr = track.date ? 
        relativeTime(parseInt(track.date.uts), track.date['#text']) : 
        null;

    return createResponse({
        track: {
            name: track.name,
            url: track.url,
            'image-small': track.image?.[1]?.['#text'],
            'image-medium': track.image?.[2]?.['#text'],
            'image-large': track.image?.[3]?.['#text']
        },
        artist: {
            name: track.artist?.['#text'] || track.artist?.name,
            url: track.artist?.url || `https://www.last.fm/music/${encodeURIComponent(track.artist?.['#text'] || track.artist?.name)}`
        },
        album: track.album?.['#text'] ? {
            name: track.album['#text'],
            url: `https://www.last.fm/music/${encodeURIComponent(track.artist?.['#text'] || track.artist?.name)}/${encodeURIComponent(track.album['#text'])}`
        } : null,
        nowplaying: track['@attr']?.nowplaying === 'true',
        date: track['@attr']?.nowplaying ? null : relativeTimeStr
    }, 200, corsHeaders);
}

async function getArtistInfo(env, artistName, corsHeaders) {
    const data = await fetchLastFM('artist.getinfo', {
        artist: artistName,
        username: env.LASTFM_USERNAME
    }, env);

    return createResponse({
        playcount: data.artist?.stats?.userplaycount || '0'
    }, 200, corsHeaders);
}

async function getTrackInfo(env, artist, trackName, corsHeaders) {
    const data = await fetchLastFM('track.getInfo', {
        artist,
        track: trackName,
        username: env.LASTFM_USERNAME
    }, env);

    return createResponse({
        playcount: data.track?.userplaycount || '0'
    }, 200, corsHeaders);
}

async function getNowPlayingPreview(env, corsHeaders) {
    // Get current track data
    const data = await fetchLastFM('user.getrecenttracks', {
        limit: 1,
        user: env.LASTFM_USERNAME
    }, env);

    const track = data.recenttracks?.track?.[0];
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
            preview_url: streamData.preview_mp3_128_url,
            full_url: streamData.http_mp3_128_url,
            track: track.name,
            artist: track.artist?.['#text'] || track.artist?.name,
            duration: foundTrack.duration,
            waveform_url: foundTrack.waveform_url,
            soundcloud_url: foundTrack.permalink_url
        }, 200, corsHeaders);
    } catch (error) {
        return createErrorResponse('Failed to fetch preview', 500, corsHeaders, error.message);
    }
} 