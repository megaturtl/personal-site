import { SignJWT, importPKCS8 } from 'jose';

// Configuration
const allowedOrigins = [
    'https://turtl.cc',
    'https://turtl.neocities.org',
    'https://turtl.nekoweb.org',
    'http://localhost:8080'
];

// IP Whitelist - add your allowed IPs here
const allowedIPs = [
    '127.0.0.1',               // localhost
    'YOUR_IP_ADDRESS_HERE',    // your IP
    // Add more IPs as needed
];

const CACHE_TTL = 1800; // 30 minutes
const CACHE_CONTROL = `public, max-age=${CACHE_TTL}`;

// Shared utilities
const getCorsHeaders = (origin) => ({
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
});

// IP validation
const isAllowedIP = (ip) => {
    return allowedIPs.includes(ip);
};

const createResponse = (data, status = 200, corsHeaders, cache = true) => {
    const headers = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(cache && { 'Cache-Control': CACHE_CONTROL })
    };
    
    return new Response(JSON.stringify(data), { status, headers });
};

const createErrorResponse = (message, status = 500, corsHeaders, reason = '') => createResponse(
    { error: message, reason },
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

// GA API helpers
async function getAccessToken(env) {
    const now = Math.floor(Date.now() / 1000);
    const privateKeyPem = env.GA_PRIVATE_KEY.replace(/\\n/g, '\n');
    const cryptoKey = await importPKCS8(privateKeyPem, 'RS256');
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/analytics.readonly' })
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
        throw new Error('Failed to retrieve access token');
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
}

async function fetchAnalyticsData(accessToken, env) {
    const propertyId = env.GA_PROPERTY_ID;
    const analyticsUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

    const reportResponse = await fetch(analyticsUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }],
            metrics: [{ name: 'totalUsers' }]
        })
    });

    if (!reportResponse.ok) {
        const errorText = await reportResponse.text();
        console.error('GA4 API error:', reportResponse.status, errorText);
        throw new Error('Failed to fetch GA4 data');
    }

    const reportData = await reportResponse.json();
    if (!reportData?.rows?.[0]?.metricValues?.[0]?.value) {
        throw new Error('Invalid analytics data format');
    }

    return {
        totalUsers: reportData.rows[0].metricValues[0].value
    };
}

export default {
    async fetch(request, env, ctx) {
        const origin = request.headers.get('Origin');
        const corsHeaders = getCorsHeaders(origin);

        // Get client IP
        const clientIP = request.headers.get('cf-connecting-ip') || 
                        request.headers.get('x-real-ip') ||
                        '0.0.0.0';

        // Check IP whitelist (allow OPTIONS for CORS preflight)
        if (request.method !== 'OPTIONS' && !isAllowedIP(clientIP)) {
            return createErrorResponse(
                'Access denied', 
                403, 
                corsHeaders,
                'IP not in whitelist'
            );
        }

        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Only allow GET requests
        if (request.method !== 'GET') {
            return createErrorResponse('Method not allowed', 405, corsHeaders);
        }

        try {
            // Try to get from cache first
            const cachedResponse = await getFromCache(request, env);
            if (cachedResponse) {
                return cachedResponse;
            }

            // Fetch fresh data
            const accessToken = await getAccessToken(env);
            const analyticsData = await fetchAnalyticsData(accessToken, env);
            
            // Create and cache response
            const response = createResponse(analyticsData, 200, corsHeaders);
            return cacheResponse(request, response, env);
        } catch (error) {
            console.error('Analytics error:', error);
            return createErrorResponse(
                'Failed to fetch analytics data',
                500,
                corsHeaders
            );
        }
    },
};
