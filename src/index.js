import L from 'leaflet';
import 'leaflet.heat';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

document.getElementById('authButton').addEventListener('click', () => {
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=activity:read`;
});

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

const code = getUrlParameter('code');

if (code) {
    fetch('https://www.strava.com/oauth/token', {
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
    })
        .then(response => response.json())
        .then(data => {
            console.log('Access Token:', data.access_token);
            localStorage.setItem('strava_access_token', data.access_token);
            document.getElementById('status').innerText = 'Authorized with Strava';
            displayHeatmap(data.access_token);
        })
        .catch(error => console.error('Error:', error));
} else {
    const savedToken = localStorage.getItem('strava_access_token');
    if (savedToken) {
        document.getElementById('status').innerText = 'Using saved Strava token';
        displayHeatmap(savedToken);
    } else {
        document.getElementById('status').innerText = 'Not authorized with Strava';
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

// Initialize the map
const map = L.map('map').setView([51.505, -0.09], 13); // Change to your desired location

// Load and display a tile layer on the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Fetch and display heatmap
async function displayHeatmap(accessToken) {
    const response = await fetch('https://www.strava.com/api/v3/athlete/activities', {
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    });
    const activities = await response.json();
    let heatData = [];

    activities.forEach(activity => {
        if (activity.map && activity.map.summary_polyline) {
            const coords = decodePolyline(activity.map.summary_polyline);
            heatData = heatData.concat(coords);
        }
    });

    L.heatLayer(heatData, { radius: 25 }).addTo(map);
}
