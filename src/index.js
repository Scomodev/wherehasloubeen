import L from 'leaflet';
import 'leaflet.heat';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

// Function to handle Strava authentication
document.getElementById('authButton').addEventListener('click', () => {
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=activity:read`;
});

// Function to extract URL parameter
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Check if code is available in URL (returned from Strava OAuth)
const code = getUrlParameter('code');

// Main function to handle token retrieval and heatmap display
async function main() {
    try {
        let accessToken = localStorage.getItem('strava_access_token');

        if (!accessToken && code) {
            // Retrieve access token from Strava using code
            accessToken = await fetchAccessToken(code);
            localStorage.setItem('strava_access_token', accessToken);
        }

        if (!accessToken) {
            displayStatus('Not authorized with Strava');
            return;
        }

        displayStatus('Authorized with Strava');
        await displayHeatmap(accessToken);
    } catch (error) {
        console.error('Error:', error);
        displayStatus('Error: ' + error.message);
    }
}

// Function to fetch access token from Strava API
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
        throw new Error('Failed to retrieve access token from Strava');
    }

    const data = await response.json();
    return data.access_token;
}

// Function to display status message
function displayStatus(message) {
    document.getElementById('status').innerText = message;
}

// Initialize Leaflet map
const map = L.map('map').setView([51.505, -0.09], 13); // Adjust coordinates and zoom level

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Function to fetch activities from Strava API and display heatmap
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
            if (activity.map && activity.map.summary_polyline) {
                const coords = decodePolyline(activity.map.summary_polyline);
                heatData = heatData.concat(coords);
            }
        });

        if (heatData.length > 0) {
            L.heatLayer(heatData, { radius: 25 }).addTo(map);
        } else {
            console.warn('No heat data available to display.');
        }
    } catch (error) {
        console.error('Error displaying heatmap:', error);
        displayStatus('Error displaying heatmap: ' + error.message);
    }
}

// Function to decode polyline encoded by Strava
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

// Call main function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', main);
