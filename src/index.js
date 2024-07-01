import L from 'leaflet';
import 'leaflet.heat';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

let map = null; // Variable to hold the map instance
let mapInitialized = false; // Flag to track if map is initialized

// Function to initialize Leaflet map
function initMap() {
    if (!mapInitialized) {
        if (map) {
            map = map.off();
            map = map.remove(); // Remove existing map instance if it exists
        }

        map = L.map('map').setView([51.505, -0.09], 13); // Default coordinates and zoom level

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        mapInitialized = true;
    }
}

// Function to display heatmap on the map
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

        if (map && heatData.length > 0) {
            // Clear existing layers if any
            map.eachLayer(layer => {
                if (!layer._url) { // Check if layer is not a tile layer
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

// Function to handle Strava authentication
document.getElementById('authButton').addEventListener('click', () => {
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=activity:read`;
});

// Main function to initialize map and fetch/display heatmap
async function main() {
    try {
        let accessToken = localStorage.getItem('strava_access_token');

        // Check if access token is not available and code is in URL
        const code = getUrlParameter('code');
        if (!accessToken && code) {
            accessToken = await fetchAccessToken(code);
            localStorage.setItem('strava_access_token', accessToken);
        }

        // Check if access token is still not available
        if (!accessToken) {
            console.warn('Access token not available.');
            return;
        }

        initMap(); // Initialize map if not already initialized
        await displayHeatmap(accessToken);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Function to extract URL parameter
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
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

// Call main function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', main);
