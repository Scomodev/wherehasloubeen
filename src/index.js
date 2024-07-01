import L from 'leaflet';
import 'leaflet.heat';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

let map = null;
let mapInitialized = false;

function initMap() {
    if (!mapInitialized) {
        if (map) {
            map.remove();
        }

        map = L.map('map').setView([51.505, -0.09], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        mapInitialized = true;
    }
}

async function displayHeatmap(accessToken) {
    try {
        const response = await fetch(`${STRAVA_API_URL}/athlete/activities`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch activities from Strava API');
        }

        const activities = await response.json();
        let heatData = [];

        activities.forEach(activity => {
            if (activity.type === 'Run' && activity.map && activity.map.summary_polyline) {
                const coords = decodePolyline(activity.map.summary_polyline);
                heatData = heatData.concat(coords);
            }
        });

        if (map && heatData.length > 0) {
            map.eachLayer(layer => {
                if (!layer._url) {
                    map.removeLayer(layer);
                }
            });

            L.heatLayer(heatData, { radius: 25 }).addTo(map);
        } else {
            console.warn('Map is not initialized or no data for heatmap.');
        }
    } catch (error) {
        console.error('Error displaying heatmap:', error);
    }
}

function decodePolyline(encoded) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
}

document.getElementById('authButton').addEventListener('click', () => {
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=activity:read,activity:read_all`;
});

async function main() {
    try {
        let accessToken = localStorage.getItem('strava_access_token');
        let refreshToken = localStorage.getItem('strava_refresh_token');

        const code = getUrlParameter('code');
        if (!accessToken && code) {
            const tokens = await fetchAccessToken(code);
            accessToken = tokens.access_token;
            refreshToken = tokens.refresh_token;
            localStorage.setItem('strava_access_token', accessToken);
            localStorage.setItem('strava_refresh_token', refreshToken);
        }

        if (accessToken) {
            initMap();
            try {
                await displayHeatmap(accessToken);
            } catch (error) {
                if (error.message.includes('401')) {
                    console.warn('Access token expired, refreshing...');
                    const tokens = await refreshAccessToken(refreshToken);
                    accessToken = tokens.access_token;
                    refreshToken = tokens.refresh_token;
                    localStorage.setItem('strava_access_token', accessToken);
                    localStorage.setItem('strava_refresh_token', refreshToken);
                    await displayHeatmap(accessToken);
                } else {
                    throw error;
                }
            }
        } else {
            console.warn('Access token not available.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

async function fetchAccessToken(code) {
    const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch access token');
    }

    return await response.json();
}

async function refreshAccessToken(refreshToken) {
    const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })
    });

    if (!response.ok) {
        throw new Error('Failed to refresh access token');
    }

    return await response.json();
}

main();
