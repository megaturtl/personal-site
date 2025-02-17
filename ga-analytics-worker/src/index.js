import { SignJWT, importPKCS8 } from 'jose';

const allowedOrigins = [
    'https://turtl.cc',
    'https://turtl.neocities.org',
    'https://turtl.nekoweb.org',
	'http://localhost:8080'
];

export default {
    async fetch(request, env, ctx) {
        const origin = request.headers.get('Origin');
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
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
                return new Response('Failed to retrieve access token', {
                    status: 500,
                    headers: corsHeaders
                });
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

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
                return new Response('Failed to fetch GA4 data', {
                    status: 500,
                    headers: corsHeaders
                });
            }

            const reportData = await reportResponse.json();
            let totalUsers = 0;
            if (
                reportData?.rows &&
                reportData.rows.length > 0 &&
                reportData.rows[0].metricValues?.[0]?.value
            ) {
                totalUsers = reportData.rows[0].metricValues[0].value;
            }

            return new Response(JSON.stringify({ totalUsers }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders  // Apply dynamic CORS headers
                }
            });
        } catch (err) {
            console.error(err);
            return new Response('Internal Server Error', {
                status: 500,
                headers: corsHeaders
            });
        }
    },
};
