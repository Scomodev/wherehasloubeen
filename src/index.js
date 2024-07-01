import L from 'leaflet';
import 'leaflet.heat';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

let map = null; // Variable to hold the map instance

// Function to initialize or reinitialize the map
function initMap() {
    if (!map) {
        map = L.map('map').setView([51.505, -0.09], 13); // Adjust coordinates and zoom level

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
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

        if (map) {
            L.heatLayer(heatData, { radius: 25 }).addTo(map);
        } else {
            console.warn('Map is not initialized.');
        }
    } catch (error) {
        console.error('Error displaying heatmap:', error);
    }
}

// Function to handle Strava authentication
document.getElementById('authButton').addEventListener('click', () => {
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=activity:read`;
});

// Main function to initialize map and fetch/display heatmap
async function main() {
    try {
        let accessToken = localStorage.getItem('strava_access_token');

        if (!accessToken && code) {
            accessToken = await fetchAccessToken(code);
            localStorage.setItem('strava_access_token', accessToken);
        }

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

// Call main function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', main);
