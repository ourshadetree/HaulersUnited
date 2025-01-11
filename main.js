let map;
let autoCompleteStart;
let autoCompleteEnd;
let routeControl;
let gasStationMarkers = [];
let pilotMarkers = [];
let caseyMarkers = [];
let areStationsVisible = true;
let directionsService = null; 
let directionsRenderer = null;
let directionsServiceReady = false;
let isMapReady = false;
let autoCompleteSingle;

// Function to handle tool selection and toggle visibility
function updateToolType() {
  const toolType = document.getElementById("toolType").value;
  const singleAddressTool = document.getElementById("singleAddressTool");
  const routeTool = document.getElementById("routeTool");
  const highlightedStationsContainer = document.getElementById("highlightedStationsContainer");
  const highlightedStationsList = document.getElementById("highlightedStationsList");

  // Hide both tools initially
  singleAddressTool.style.display = "none";
  routeTool.style.display = "none";

  // Clear the "Stations Near Route" section
  highlightedStationsList.innerHTML = "";
  highlightedStationsContainer.style.display = "none";

  // Show the selected tool
  if (toolType === "singleAddress") {
    singleAddressTool.style.display = "block";
  } else if (toolType === "createRoute") {
    routeTool.style.display = "block";
  }
}


// This function is for gathering information from the Google Sheets
async function fetchLocations() {
  const pilotCSVUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS54WS48Ol3EXpqVS-2Rw7ePnqwFcnkiVzfONIGxIJqpWuruNuphr_qhpNFbVgHVrchKyjkCBfjM_zK/pub?gid=606915630&single=true&output=csv';
  const caseyCSVUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS54WS48Ol3EXpqVS-2Rw7ePnqwFcnkiVzfONIGxIJqpWuruNuphr_qhpNFbVgHVrchKyjkCBfjM_zK/pub?gid=1692662712&single=true&output=csv';

  try {
    const pilotResponse = await fetch(pilotCSVUrl);
    if (!pilotResponse.ok) throw new Error("Error loading Pilot data");

    const caseyResponse = await fetch(caseyCSVUrl);
    if (!caseyResponse.ok) throw new Error("Error loading Casey data");

    const pilotCsvText = await pilotResponse.text();
    const caseyCsvText = await caseyResponse.text();

    const pilotData = Papa.parse(pilotCsvText, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
    const caseyData = Papa.parse(caseyCsvText, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;

    const pilotLocations = pilotData.filter((row) => {
      return (
        row["Today's Price"] !== "Out of Network" &&
        row['Retail Price'] !== "Out of Network" &&
        row["Tomorrow's Price"] !== "Out of Network"
      );
    }).map((row) => {
      return {
        locationNumberP: String(row['Location #']),
        latP: parseFloat(row.Latitude),
        lngP: parseFloat(row.Longitude),
        cityP: row.City,
        stateP: row['State/Province'],
        todaysPriceP: parseFloat(row["Today's Price"]?.replace('$', '')),
        retailPriceP: parseFloat(row['Retail Price']?.replace('$', '')),
        tomorrowPriceP: parseFloat(row["Tomorrow's Price"]?.replace('$', '')),
        hyperlinkP: row.Hyperlink,
        typeP: 'Pilot',
      };
    });

    const caseyLocations = caseyData.map((row) => {
      return {
        locationNumberC: String(row['Location #']),
        latC: parseFloat(row.Latitude),
        lngC: parseFloat(row.Longitude),
        cityC: row.City,
        stateC: row.State,
        todaysPriceC: parseFloat(row["Today'sPrice"]?.replace('$', '')),
        tomorrowPriceC: parseFloat(row["Tomorrow'sPrice"]?.replace('$', '')),
        typeC: 'Casey',
      };
    });

    return [...pilotLocations, ...caseyLocations];
  } catch (error) {
    console.error("Error fetching locations:", error);
    return [];
  }
}

window.initMap = async function initMap() {
  const mapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 5,
  };

  map = new google.maps.Map(document.getElementById("map"), mapOptions);
  directionsService = new google.maps.DirectionsService();

  autoCompleteStart = new google.maps.places.Autocomplete(
    document.getElementById("start")
  );
  autoCompleteStart.addListener("place_changed", onPlaceChangedStart);

  autoCompleteEnd = new google.maps.places.Autocomplete(
    document.getElementById("end")
  );
  autoCompleteEnd.addListener("place_changed", onPlaceChangedEnd);

  autoCompleteSingle = new google.maps.places.Autocomplete(
    document.getElementById("singleAddressInput"),
    {
      types: ["geocode"],
      componentRestrictions: { country: "us" },
    }
  );
  autoCompleteSingle.addListener("place_changed", () => {
    const place = autoCompleteSingle.getPlace();
    if (!place.geometry || !place.geometry.location) {
      alert("No details available for the selected address. Please try again.");
      return;
    }
    console.log("Selected Place:", place);
  });

  directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  directionsServiceReady = true;
  isMapReady = true;

  document.addEventListener('DOMContentLoaded', () => {

    const inputs = ["singleAddressInput", "start", "end"];
  
    inputs.forEach((id) => {
      const inputField = document.getElementById(id);
      if (inputField) {
        // Disable autocomplete for each input field
        inputField.setAttribute("autocomplete", "off");
        inputField.setAttribute("name", "no-autocomplete"); // Unique name to prevent Chrome from matching autofill profiles
        
        // Prevent browser autofill suggestions on focus
        inputField.addEventListener("focus", () => {
          inputField.setAttribute("autocomplete", "new-password");
        });
      }
    });

    document.getElementById("calculateRoute").addEventListener("click", async () => {
      if (directionsServiceReady) {
        await performRoute();
      }
    });

    document.getElementById("toggleStations").addEventListener("click", toggleGasStations);
  });

  const locations = await fetchLocations();
  plotLocationsOnMap(map, locations);
}

// Function to find gas stations near a single address
async function findStationsForSingleAddress() {
  const address = document.getElementById("singleAddressInput").value.trim();

  if (!address) {
    alert("Please enter an address.");
    return;
  }

  try {
    const geocoder = new google.maps.Geocoder();
    const geocodeResult = await new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK") {
          resolve(results[0].geometry.location);
        } else {
          reject("Geocoding failed: " + status);
        }
      });
    });

    const center = geocodeResult;

    console.log("Geocoded Center:", center); // Debugging

    const radiusInMeters = 80467; // 50 miles in meters
    const highlightedStationsContainer = document.getElementById("highlightedStationsList");
    const highlightedStationsParent = document.getElementById("highlightedStationsContainer");
    highlightedStationsContainer.innerHTML = "";

    if (gasStationMarkers.length === 0) {
      console.error("Gas Station Markers are empty!");
    }

    // Collect stations within the radius with their distances
    const stationsInRange = gasStationMarkers
      .map((marker) => {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          center,
          marker.getPosition()
        );
        return { marker, distance };
      })
      .filter(({ distance }) => distance <= radiusInMeters);

    // Sort stations by distance
    stationsInRange.sort((a, b) => a.distance - b.distance);

    if (stationsInRange.length > 0) {
      stationsInRange.forEach(({ marker, distance }) => {
        marker.setIcon({
          url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
          scaledSize: new google.maps.Size(22, 22),
        });

        const listItem = document.createElement("li");
        listItem.className = "station-list-item";

        if (marker.stationType === "Pilot") {
          listItem.innerHTML = `
            <strong>${marker.stationType} Station:</strong> ${marker.getTitle()} <br>
            <b>Distance:</b> ${(distance / 1609.34).toFixed(2)} miles <br>
            <b>Today's Price:</b> $${marker.todaysPriceP?.toFixed(2) || "N/A"} <br>
            <b>Tomorrow's Price:</b> $${marker.tomorrowPriceP?.toFixed(2) || "N/A"} <br>
            <b>Retail Price:</b> $${marker.retailPriceP?.toFixed(2) || "N/A"} <br>
            <a href="${marker.hyperlinkP}" target="_blank">Station Website</a>
          `;
        } else {
          listItem.innerHTML = `
            <strong>${marker.stationType} Station:</strong> ${marker.getTitle()} <br>
            <b>Distance:</b> ${(distance / 1609.34).toFixed(2)} miles <br>
            <b>Today's Price:</b> $${marker.todaysPriceC?.toFixed(2) || "N/A"} <br>
            <b>Tomorrow's Price:</b> $${marker.tomorrowPriceC?.toFixed(2) || "N/A"} <br>
          `;
        }

        listItem.addEventListener("click", () => {
          map.setCenter(marker.getPosition());
          map.setZoom(15);
        });

        highlightedStationsContainer.appendChild(listItem);
      });

      highlightedStationsParent.style.display = "block";
    } else {
      highlightedStationsParent.style.display = "none";
      alert("No stations found near the entered address.");
    }

    map.setCenter(center);
    map.setZoom(10); // Zoom into the area near the address
  } catch (error) {
    console.error(error);
    alert("Could not find gas stations for the entered address.");
  }
}






async function highlightStationsAlongRoute(routePolyline) {
  const bufferDistance = 5000; // 5 km buffer
  const highlightedStationsContainer = document.getElementById("highlightedStationsList");
  highlightedStationsContainer.innerHTML = "";

  // Collect stations near the route with their distances
  const stationsNearRoute = [];

  gasStationMarkers.forEach((marker) => {
    const markerPosition = marker.getPosition();
    let isNearRoute = false;
    let minDistance = Infinity;

    for (let i = 0; i < routePolyline.length - 1; i++) {
      const segmentStart = routePolyline[i];
      const segmentEnd = routePolyline[i + 1];

      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        markerPosition,
        segmentStart
      );

      if (distance <= bufferDistance) {
        isNearRoute = true;
        minDistance = Math.min(minDistance, distance);
        break;
      }
    }

    if (isNearRoute) {
      stationsNearRoute.push({ marker, distance: minDistance });
    }
  });

  // Sort stations by distance
  stationsNearRoute.sort((a, b) => a.distance - b.distance);

  // Populate the highlighted stations list
  stationsNearRoute.forEach(({ marker, distance }) => {
    marker.setIcon({
      url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
      scaledSize: new google.maps.Size(22, 22),
    });

    const listItem = document.createElement("li");
    listItem.className = "station-list-item";

    if (marker.stationType === "Pilot") {
      listItem.innerHTML = `
        <strong>${marker.stationType} Station:</strong> ${marker.getTitle()} <br>
        <b>Distance:</b> ${(distance / 1609.34).toFixed(2)} miles <br>
        <b>Today's Price:</b> $${marker.todaysPriceP?.toFixed(2) || "N/A"} <br>
        <b>Tomorrow's Price:</b> $${marker.tomorrowPriceP?.toFixed(2) || "N/A"} <br>
        <b>Retail Price:</b> $${marker.retailPriceP?.toFixed(2) || "N/A"} <br>
        <a href="${marker.hyperlinkP}" target="_blank">Station Website</a>
      `;
    } else {
      listItem.innerHTML = `
        <strong>${marker.stationType} Station:</strong> ${marker.getTitle()} <br>
        <b>Distance:</b> ${(distance / 1609.34).toFixed(2)} miles <br>
        <b>Today's Price:</b> $${marker.todaysPriceC?.toFixed(2) || "N/A"} <br>
        <b>Tomorrow's Price:</b> $${marker.tomorrowPriceC?.toFixed(2) || "N/A"} <br>
      `;
    }

    listItem.addEventListener("click", () => {
      map.setCenter(marker.getPosition());
      map.setZoom(15);
    });

    highlightedStationsContainer.appendChild(listItem);
  });
}


function onPlaceChangedStart() {
  const place = autoCompleteStart.getPlace();
  if (place.geometry) {
    map.setCenter(place.geometry.location);
    map.setZoom(15);
    new google.maps.Marker({
      map: map,
      position: place.geometry.location,
      title: place.name,
    });
  }
}

function onPlaceChangedEnd() {
  const place = autoCompleteEnd.getPlace();
  if (place.geometry) {
    map.setCenter(place.geometry.location);
    map.setZoom(15);
    new google.maps.Marker({
      map: map,
      position: place.geometry.location,
      title: place.name,
    });
  }
}

async function performRoute() {
  if (!isMapReady || !directionsService || !directionsRenderer) {
    console.error("Map, DirectionsService, or DirectionsRenderer is not ready.");
    return;
  }

  const start = document.getElementById("start").value.trim();
  const end = document.getElementById("end").value.trim();

  if (!start && !end) {
    alert("Please enter at least one address.");
    return;
  }

  const routeRequest = {
    origin: start || end,
    destination: end || start,
    travelMode: google.maps.TravelMode.DRIVING,
  };

  if (!start || !end) {
    routeRequest.destination = routeRequest.origin;
    alert("Only one address provided. Creating a route that loops back to the same location.");
  }

  try {
    const result = await new Promise((resolve, reject) => {
      directionsService.route(routeRequest, (response, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          resolve(response);
        } else {
          reject(status);
        }
      });
    });

    directionsRenderer.setDirections(result);

    const routePolyline = result.routes[0].overview_path;
    await highlightStationsAlongRoute(routePolyline);

    document.getElementById("highlightedStationsContainer").style.display = "block";
  } catch (error) {
    console.error("Error calculating route:", error);
    alert("Route calculation failed: " + error);
  }
}

function plotLocationsOnMap(map, locations) {
  clearMarkers(gasStationMarkers);
  gasStationMarkers = [];

  const infoWindow = new google.maps.InfoWindow();

  locations.forEach((location, index) => {
    if (location.latP && location.lngP) {
      const pilotMarker = new google.maps.Marker({
        position: { lat: location.latP, lng: location.lngP },
        map: map,
        title: `${location.cityP}, ${location.stateP}`,
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
          scaledSize: new google.maps.Size(22, 22),
        },
      });

      pilotMarker.stationType = "Pilot";
      //pilotMarker.haulersPrice = location.todaysPriceP;
      pilotMarker.todaysPriceP = location.todaysPriceP; // Attach price information
      pilotMarker.tomorrowPriceP = location.tomorrowPriceP;
      pilotMarker.retailPriceP = location.retailPriceP;
      pilotMarker.hyperlinkP = location.hyperlinkP;

      pilotMarker.addListener("click", () => {
        infoWindow.setContent(`
          <div>
            <strong>Pilot Station</strong><br>
            <b>City:</b> ${location.cityP}, ${location.stateP}<br>
            <b>Today's Price:</b> $${location.todaysPriceP?.toFixed(2) || "N/A"}<br>
            <b>Retail Price:</b> $${location.retailPriceP?.toFixed(2) || "N/A"}<br>
            <b>Tomorrow's Price:</b> $${location.tomorrowPriceP?.toFixed(2) || "N/A"}<br>
            <a href="${location.hyperlinkP}" target="_blank">Station Website</a>
          </div>
        `);
        infoWindow.open(map, pilotMarker);
      });

      gasStationMarkers.push(pilotMarker);
    }

    if (location.latC && location.lngC) {
      const caseyMarker = new google.maps.Marker({
        position: { lat: location.latC, lng: location.lngC },
        map: map,
        title: `${location.cityC}, ${location.stateC}`,
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          scaledSize: new google.maps.Size(22, 22),
        },
      });

      caseyMarker.stationType = "Casey";
      //caseyMarker.haulersPrice = location.todaysPriceC;
      caseyMarker.todaysPriceC = location.todaysPriceC; // Attach price information
      caseyMarker.tomorrowPriceC = location.tomorrowPriceC;

      caseyMarker.addListener("click", () => {
        infoWindow.setContent(`
          <div>
            <strong>Casey Station</strong><br>
            <b>City:</b> ${location.cityC}, ${location.stateC}<br>
            <b>Today's Price:</b> $${location.todaysPriceC?.toFixed(2) || "N/A"}<br>
            <b>Tomorrow's Price:</b> $${location.tomorrowPriceC?.toFixed(2) || "N/A"}<br>
          </div>
        `);
        infoWindow.open(map, caseyMarker);
      });

      gasStationMarkers.push(caseyMarker);
    }
  });
}


function clearMarkers(markerArray) {
  markerArray.forEach(marker => marker.setMap(null));
  markerArray.length = 0;
}

function toggleGasStations() {
  areStationsVisible = !areStationsVisible;

  gasStationMarkers.forEach((marker) => {
    marker.setVisible(areStationsVisible);
  });

  const toggleButton = document.getElementById("toggleStations");
  toggleButton.textContent = areStationsVisible ? "Hide All Stations" : "Show All Stations";
}

window.addEventListener('load', initMap);
