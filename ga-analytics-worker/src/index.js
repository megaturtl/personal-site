import { SignJWT, importPKCS8 } from 'jose';

// Configuration
const allowedOrigins = [
    'https://turtl.cc',
    'https://turtl.neocities.org',
    'https://turtl.nekoweb.org',
    'http://localhost:8080',
];

// 30 minutes
const CACHE_TTL = 1800;
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
        ...(cache && { 'Cache-Control': CACHE_CONTROL }),
    };

    return new Response(JSON.stringify(data), { status, headers });
};

const createErrorResponse = (
    message,
    status = 500,
    corsHeaders,
    details = null,
    // By default, do not cache errors
    cache = false
) =>
    createResponse(
        { error: message, ...(details && { details }) },
        status,
        corsHeaders,
        cache
    );

async function getFromCache(request) {
    const cache = caches.default;
    const cachedResponse = await cache.match(request);
    return cachedResponse || null;
}

async function cacheResponse(request, response) {
    const cache = caches.default;
    await cache.put(request, response.clone());
    return response;
}

// GA API helpers
async function getAccessToken(env) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const privateKeyPem = env.GA_PRIVATE_KEY.replace(/\\n/g, '\n');
        const cryptoKey = await importPKCS8(privateKeyPem, 'RS256');
        const tokenUrl = 'https://oauth2.googleapis.com/token';

        const jwt = await new SignJWT({
            scope: 'https://www.googleapis.com/auth/analytics.readonly',
        })
            .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
            .setIssuer(env.GA_CLIENT_EMAIL)
            .setSubject(env.GA_CLIENT_EMAIL)
            .setAudience(tokenUrl)
            .setIssuedAt(now)
            .setExpirationTime(now + 3600)
            .sign(cryptoKey);

        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Failed to retrieve access token: ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        return tokenData.access_token;
    } catch (error) {
        throw new Error(`Access token error: ${error.message}`);
    }
}

async function fetchAnalyticsData(accessToken, env) {
    try {
        const propertyId = env.GA_PROPERTY_ID;
        const analyticsUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

        const reportResponse = await fetch(analyticsUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }],
                metrics: [{ name: 'totalUsers' }],
            }),
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            throw new Error(`GA4 API error: ${reportResponse.status} - ${errorText}`);
        }

        const reportData = await reportResponse.json();
        const totalUsers =
            reportData?.rows?.[0]?.metricValues?.[0]?.value || null;

        if (!totalUsers) {
            throw new Error('Invalid analytics data format (no totalUsers)');
        }

        return { totalUsers };
    } catch (error) {
        throw new Error(`Analytics data error: ${error.message}`);
    }
}

const routes = {
    '': async (request, env, corsHeaders) => {
        // Try to get from cache first
        const cachedResponse = await getFromCache(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Fetch fresh data
        const accessToken = await getAccessToken(env);
        const analyticsData = await fetchAnalyticsData(accessToken, env);

        // Create response (caching handled in main fetch handler)
        return createResponse(analyticsData, 200, corsHeaders);
    },
};

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin');
        
        // Reject unauthorized origins immediately
        if (origin && !allowedOrigins.includes(origin)) {
            return createErrorResponse('Unauthorized', 403, corsHeaders, 'Origin not allowed', false);
        }
        
        const corsHeaders = getCorsHeaders(origin);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Check rate limit using client's IP as the key
        const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
        const rateLimitResult = await env.API_RATE_LIMITER.limit({ key: clientIP });

        // Add rate limit headers to all responses
        corsHeaders['X-RateLimit-Limit'] = '60';
        corsHeaders['X-RateLimit-Period'] = '60';
        
        if (!rateLimitResult.success) {
            return createErrorResponse('Too many requests', 429, corsHeaders, null, false);
        }

        // Only allow GET requests
        if (request.method !== 'GET') {
            return createErrorResponse('Method not allowed', 405, corsHeaders, null, false);
        }

        try {
            // Always use the root handler since this worker is mounted at /analytics
            const handler = routes[''];
            if (!handler) {
                return createErrorResponse('Not found', 404, corsHeaders, null, false);
            }

            const response = await handler(request, env, corsHeaders);

            // Cache successful responses
            if (response.status === 200) {
                return cacheResponse(request, response);
            }
            return response;
        } catch (error) {
            console.error('Analytics error:', error);
            return createErrorResponse(
                'Failed to fetch analytics data',
                500,
                corsHeaders,
                error.message,
                false
            );
        }
    },
};