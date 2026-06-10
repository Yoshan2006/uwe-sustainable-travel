// --- Global Variables ---
let userLat = null;
let userLon = null;
let map = null;
let destLatGlobal = null; 
let destLonGlobal = null; 
let destNameGlobal = ""; 
let routeLayer = null;    
let destMarker = null;   

// --- New: Professional Toast Notification Function ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : '⚠️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Automatically remove the toast after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Function to handle screen transitions ---
function showScreen(screenId) {
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
    document.getElementById('backBtn').style.visibility = (screenId === 'screen2') ? 'hidden' : 'visible';
    
    // Initialize map only when navigating to screen2 and map is not loaded
    if(screenId === 'screen2' && map === null) {
        initMap();
    }
}

function goHome() { 
    showScreen('screen2'); 
}

// --- Initialize the Leaflet Map ---
function initMap() {
    map = L.map('realMap').setView([51.4545, -2.5879], 12); 

    L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps (Satellite Hybrid)'
    }).addTo(map);

    // Fetch live user location using HTML5 Geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            userLat = position.coords.latitude;
            userLon = position.coords.longitude;
            map.setView([userLat, userLon], 14);

            L.marker([userLat, userLon]).addTo(map);
            showToast("GPS Location Locked successfully!", "success");

            // Update UI with location status
            document.getElementById('locationStatus').innerText = "✅ GPS Location Locked!";
            document.getElementById('currentLocationInput').value = `Live GPS: Lat ${userLat.toFixed(3)}, Lon ${userLon.toFixed(3)}`;
            document.getElementById('searchBtn').disabled = false; 

        }, function() {
            showToast("Please allow location access for the app to work.", "error");
        });
    }
}

// Delay map initialization slightly for better UI rendering
setTimeout(initMap, 500);

// --- Fetch Route & Travel Recommendations ---
async function getRecommendations() {
    const destInput = document.getElementById('destination').value;
    
    if (!destInput.trim()) {
        showToast("Please enter a destination or postcode!", "error");
        return;
    }

    showScreen('screen4'); 
    const weatherBanner = document.getElementById('weatherBanner');
    const recList = document.getElementById('recommendationList');
    
    weatherBanner.innerHTML = "⏳ Searching destination & calculating live traffic...";
    recList.innerHTML = ""; 

    try {
        // Step 1: Geocoding (Convert destination text to coordinates via OpenStreetMap)
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destInput)}`);
        const geoData = await geoRes.json();

        if (geoData.length === 0) {
            weatherBanner.innerHTML = "❌ Destination not found. Try a different postcode or name.";
            weatherBanner.style.background = "#f8d7da"; weatherBanner.style.color = "#721c24";
            showToast("Destination not found.", "error");
            return;
        }

        destLatGlobal = parseFloat(geoData[0].lat);
        destLonGlobal = parseFloat(geoData[0].lon);
        destNameGlobal = geoData[0].display_name.split(",")[0]; 

        // Step 2: Reverse Geocoding (Get user's current city/area name)
        const startGeoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLon}`);
        const startGeoData = await startGeoRes.json();
        const startArea = startGeoData.address.suburb || startGeoData.address.town || startGeoData.address.city || "Unknown Area";

        // Step 3: Dynamic Bus Number Logic based on origin and destination
        let busNumber = "Local Service"; 
        const destLower = destNameGlobal.toLowerCase() + destInput.toLowerCase();
        const startCityLower = (startGeoData.address.city || startGeoData.address.town || startGeoData.address.village || "unknown").toLowerCase();

        if (destLower.includes("frenchay") || destLower.includes("uwe") || destLower.includes("bs16")) {
            if (startCityLower.includes("bristol")) busNumber = "m1 / m4 (MetroBus)";
            else busNumber = "Falcon / 73 (Regional)"; 
        } else if (startCityLower.includes("taunton") || destLower.includes("taunton") || destLower.includes("ta4")) {
            busNumber = "28 / 21 (Taunton Local)";
        } else if (startCityLower !== "unknown") {
            busNumber = `${startCityLower.charAt(0).toUpperCase() + startCityLower.slice(1)} CityLine`;
        }

        // Step 4: Weather Check via Open-Meteo API
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${userLat}&longitude=${userLon}&current_weather=true`);
        const weatherData = await weatherRes.json();
        const isRaining = weatherData.current_weather.weathercode > 50; 

        // Step 5: Routing & Distance Calculation via OSRM API
        const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${userLon},${userLat};${destLonGlobal},${destLatGlobal}?overview=false`);
        const routeData = await routeRes.json();
        
        if (routeData.code !== 'Ok') throw new Error("Routing failed");

        let distanceMiles = routeData.routes[0].distance / 1609.34; 
        let realDrivingMins = Math.round(routeData.routes[0].duration / 60);
        
        let isWalkingDistance = false;
        if (distanceMiles < 0.1 || realDrivingMins === 0) {
            isWalkingDistance = true;
            distanceMiles = 0.1;
            realDrivingMins = 1;
        }

        // Travel time and cost estimations
        const busTime = realDrivingMins + Math.round(distanceMiles * 1.5); 
        const cycleTime = Math.round(realDrivingMins * 2.5); 
        const scooterTime = realDrivingMins + Math.round(distanceMiles * 2); 

        let busPrice = distanceMiles <= 5 ? 2.50 : (2.50 + ((distanceMiles - 5) * 0.20));
        let carpoolPrice = Math.max(1.00, distanceMiles * 0.12); 
        let scooterPrice = 1.00 + (scooterTime * 0.20); 

        // Simulated real-time bus schedule
        const now = new Date();
        const waitMins = (Math.floor(distanceMiles * 17) % 15) + 3; 
        const nextBus = new Date(now.getTime() + waitMins * 60000);
        const nextBusString = nextBus.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        let availableCards = "";

        // Generate dynamic UI cards based on distance and weather
        availableCards += `
            <div class="rec-card ${isRaining && distanceMiles <= 20 ? 'top-choice' : ''}" onclick="showRoute('driving', '#0056b3', 10, 'Bus')">
                <div class="card-details">
                    <h4>🚌 Bus (${busNumber}) to ${destNameGlobal.substring(0, 20)}...</h4>
                    <p style="color: #0056b3; font-weight: bold; margin-bottom: 5px;">⌚ Next Bus: ${nextBusString} (in ${waitMins} mins)</p>
                    <p>Trip: ${busTime} mins | Distance: ${distanceMiles.toFixed(1)} mi | Cost: £${busPrice.toFixed(2)}</p>
                    ${isRaining ? "<p style='color:#e3000f; font-size:12px;'>☔ Raining: Best option to stay dry.</p>" : ""}
                    <span class="green-points-tag">+10 Green Points</span>
                </div>
            </div>`;

        availableCards += `
            <div class="rec-card ${distanceMiles > 20 && !isRaining ? 'top-choice' : ''}" onclick="showRoute('driving', '#6f42c1', 15, 'Carpool')">
                <div class="card-details">
                    <h4>🚗 Carpool (with Nimal)</h4>
                    <p>Trip: ${realDrivingMins} mins | Distance: ${distanceMiles.toFixed(1)} mi | Cost: £${carpoolPrice.toFixed(2)}</p>
                    <p style="color:#555; font-size:12px;">Verified User heading from ${startArea}</p>
                    <span class="green-points-tag">+15 Green Points</span>
                </div>
            </div>`;

        if (distanceMiles <= 5) {
            availableCards += `
                <div class="rec-card ${isRaining ? 'warning' : 'top-choice'}" onclick="showRoute('bike', '#17a2b8', 10, 'E-Scooter')">
                    <div class="card-details">
                        <h4>🛴 Dott E-Scooter</h4>
                        <p>Trip: ${scooterTime} mins | Cost: ~£${scooterPrice.toFixed(2)}</p>
                        ${isRaining ? "<p style='color:red; font-size:12px;'>⚠️ Warning: Light rain outside.</p>" : "<p style='color:#28a745; font-size:12px;'>⚡ Fastest Option!</p>"}
                        <span class="green-points-tag">+10 Green Points</span>
                    </div>
                </div>`;
        }

        if (distanceMiles <= 10) {
            availableCards += `
                <div class="rec-card ${isRaining ? 'warning' : ''}" onclick="showRoute('bike', '#28a745', 20, 'Cycling')">
                    <div class="card-details">
                        <h4>🚲 Cycling</h4>
                        <p>Trip: ${cycleTime} mins | Cost: £0.00</p>
                        ${isRaining ? "<p style='color:red; font-size:12px;'>⚠️ Warning: Rain and high winds.</p>" : ""}
                        <span class="green-points-tag">+20 Green Points</span>
                    </div>
                </div>`;
        }

        // Display conditional messages in the top banner
        if (isWalkingDistance) {
            weatherBanner.innerHTML = `🚶 You are already here! This is walking distance.`;
            weatherBanner.style.background = "#d4edda"; weatherBanner.style.color = "#155724"; weatherBanner.style.borderLeftColor = "#28a745";
        } else if(distanceMiles > 10) {
            weatherBanner.innerHTML = `🌍 Long Distance Trip (${distanceMiles.toFixed(1)} miles). Micro-mobility options hidden.`;
            weatherBanner.style.background = "#e2e3e5"; weatherBanner.style.color = "#383d41"; weatherBanner.style.borderLeftColor = "#6c757d";
        } else if(isRaining) {
            weatherBanner.innerHTML = `☔ It's Raining! Temp: ${weatherData.current_weather.temperature}°C. Stay dry!`;
            weatherBanner.style.background = "#d1ecf1"; weatherBanner.style.color = "#0c5460"; weatherBanner.style.borderLeftColor = "#17a2b8";
        } else {
            weatherBanner.innerHTML = `☀️ Clear weather (${weatherData.current_weather.temperature}°C). Great day for a ride!`;
            weatherBanner.style.background = "#fff3cd"; weatherBanner.style.color = "#856404"; weatherBanner.style.borderLeftColor = "#ffc107";
        }
        
        recList.innerHTML = availableCards;

    } catch (error) {
        weatherBanner.innerHTML = "⚠️ API Error. Could not calculate live route.";
        showToast("Error loading data from servers.", "error");
        console.error(error);
    }
}

// --- Render Route on Map ---
async function showRoute(profile, routeColor, points, modeName) {
    // New: Replaced alert() with a modern Toast notification
    showToast(`Trip Confirmed: ${modeName}! +${points} Green Points added.`, 'success');

    try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${userLon},${userLat};${destLonGlobal},${destLatGlobal}?overview=full&geometries=geojson`);
        const data = await res.json();

        if (data.code !== 'Ok') throw new Error("Route geometry failed");

        // Remove previous routes and markers if they exist
        if (routeLayer) map.removeLayer(routeLayer);
        if (destMarker) map.removeLayer(destMarker);

        // Draw the new route polyline
        const routeGeoJSON = data.routes[0].geometry;
        routeLayer = L.geoJSON(routeGeoJSON, {
            style: { color: routeColor, weight: 6, opacity: 0.8 }
        }).addTo(map);

        // New: Added a simple pin without the default popup
        destMarker = L.marker([destLatGlobal, destLonGlobal]).addTo(map);

        // Adjust map view to fit the route perfectly
        map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
        showScreen('screen2');

        // New: Display destination name in the custom top banner
        document.getElementById('topDestName').innerText = destNameGlobal;
        document.getElementById('topDestBanner').style.display = 'block';

        // Update the floating search bar to act as a 'Cancel Navigation' button
        const floatingSearch = document.querySelector('.floating-search');
        floatingSearch.innerHTML = `🗺️ Navigating via ${modeName}... (Click to cancel)`;
        floatingSearch.style.background = routeColor;
        floatingSearch.style.color = "white";
        
        floatingSearch.onclick = function() {
            // Cancel Navigation Logic
            if (routeLayer) map.removeLayer(routeLayer);
            if (destMarker) map.removeLayer(destMarker);
            
            // New: Hide the custom destination banner
            document.getElementById('topDestBanner').style.display = 'none';

            // Reset search bar state
            this.innerHTML = "📍 Where are you going?";
            this.style.background = "white";
            this.style.color = "#555";
            this.onclick = function() { showScreen('screen3'); };
            map.setView([userLat, userLon], 14); 
        };

    } catch (error) {
        showToast("Could not load the route map graphically.", "error");
    }
}