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

// This function is for gathering information from the Google Sheets
async function fetchLocations() {
  const pilotCSVUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTttM3XVDav2NLAIlSgDEbO7-gOVe6E3lGDau76EazO4iXTuswuhsfjgVWdE_tWIKMHmP6pTcL4s_0L/pub?output=csv';
  const caseyCSVUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS54WS48Ol3EXpqVS-2Rw7ePnqwFcnkiVzfONIGxIJqpWuruNuphr_qhpNFbVgHVrchKyjkCBfjM_zK/pub?gid=1692662712&single=true&output=csv';

  try {
    // Fetch Pilot data from Sheet 1
    const pilotResponse = await fetch(pilotCSVUrl);
    if (!pilotResponse.ok) throw new Error("Error loading Pilot data");

    // Fetch Casey data from Sheet 2
    const caseyResponse = await fetch(caseyCSVUrl);
    if (!caseyResponse.ok) throw new Error("Error loading Casey data");

    const pilotCsvText = await pilotResponse.text();
    const caseyCsvText = await caseyResponse.text();

    // Parse CSV data into JSON arrays
    const pilotData = Papa.parse(pilotCsvText, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
    const caseyData = Papa.parse(caseyCsvText, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;

    // Map Pilot data to desired structure
    const pilotLocations = pilotData.map((row) => {
      return {
        locationNumberP: String(row['Location #']),
        latP: parseFloat(row.Latitude),
        lngP: parseFloat(row.Longitude),
        cityP: row.City,
        stateP: row.St,
        haulersPriceP: parseFloat(row['HaulersPrice']),
        typeP: 'Pilot',
      };
    });

    // Map Casey data to desired structure
    const caseyLocations = caseyData.map((row) => {
      return {
        locationNumberC: String(row['Location #']),
        latC: parseFloat(row.Latitude),
        lngC: parseFloat(row.Longitude),
        cityC: row.City,
        stateC: row.State,
        haulersPriceC: parseFloat(row['HaulersPrice']),
        typeC: 'Casey',
      };
    });

    

    // Log the results
    console.log("Pilot Locations (length):", pilotLocations.length);
    console.log("Casey Locations (length):", caseyLocations.length);
    console.log("Pilot Data Sample: ", JSON.stringify(pilotData[0]));
    console.log("Casey Data Sample: ", JSON.stringify(caseyData[0]));

    // Combine the Pilot and Casey locations
    const allLocations = [...pilotLocations, ...caseyLocations];
    console.log("Total Locations (Pilot + Casey):", allLocations.length);

    // Return all locations
    return allLocations;
  } catch (error) {
    console.error("Error fetching locations:", error);
    return [];
  }
}

// This function initializes the map onto the page
async function initMap() {
  const mapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 5,
  };

  map = new google.maps.Map(document.getElementById("map"), mapOptions);
  directionsService = new google.maps.DirectionsService();

  // Create the Autocomplete object for start address
  autoCompleteStart = new google.maps.places.Autocomplete(
    document.getElementById("start")
  );
  autoCompleteStart.addListener("place_changed", onPlaceChangedStart);

  // Create the Autocomplete object for end address
  autoCompleteEnd = new google.maps.places.Autocomplete(
    document.getElementById("end")
  );
  autoCompleteEnd.addListener("place_changed", onPlaceChangedEnd);

  const geocoder = new google.maps.Geocoder();
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  console.log("DirectionsService initialized:", directionsService);
  directionsServiceReady = true;
  isMapReady = true;

  document.addEventListener('DOMContentLoaded', () => {

    // Add event listener for the "Calculate Route" button
    document
    .getElementById("calculateRoute")
    .addEventListener("click", async () => {
      console.log("directionsService on click:", directionsService);
      if (directionsServiceReady) {
        // Call performRoute after ensuring directionsService is initialized
        await performRoute();
      } else {
        console.log("Directions Service is not initialized yet.");
      }
    });


    
    // Add event listener for the "Toggle Stations" button
    document
      .getElementById("toggleStations")
      .addEventListener("click", toggleGasStations);
  });

  const locations = await fetchLocations();
  plotLocationsOnMap(map, locations);
}

async function highlightStationsAlongRoute(routePolyline) {
  const bufferDistance = 5000; // 5 km buffer distance
  const updatedMarkers = [];
  const highlightedStations = [];

  // Clear the highlighted stations list
  const highlightedStationsContainer = document.getElementById("highlightedStationsList");
  highlightedStationsContainer.innerHTML = "";

  gasStationMarkers.forEach((marker) => {
    const markerPosition = marker.getPosition();
    let isNearRoute = false;

    // Check if the marker is near the route
    for (let i = 0; i < routePolyline.length - 1; i++) {
      const segmentStart = routePolyline[i];
      const segmentEnd = routePolyline[i + 1];

      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        markerPosition,
        segmentStart
      );

      if (distance <= bufferDistance) {
        isNearRoute = true;
        break;
      }
    }

    // Highlight marker if near the route
    if (isNearRoute) {
      marker.setIcon({
        url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png", // Highlighted icon
        scaledSize: new google.maps.Size(32, 32),
      });
      updatedMarkers.push(marker);

      // Extract station info
      const stationType = marker.stationType; // Use the stationType property
      const stationTitle = marker.getTitle();
      const haulersPrice = marker.haulersPrice;

      // Add station details to the list as a card
      highlightedStations.push({ title: stationTitle, type: stationType, haulersPrice });

      const stationCard = document.createElement("div");
      stationCard.classList.add("station-card");

      const stationDetails = `
        <div>
          <h4>${stationType} Station</h4>
          <p>${stationTitle}</p>
          <p><b>Hauler's Price:</b> $${haulersPrice.toFixed(2)}</p>
        </div>
      `;
      stationCard.innerHTML = stationDetails;

      // Add a click event to center map on this station
      stationCard.addEventListener("click", () => {
        map.setCenter(marker.getPosition());
        map.setZoom(15);
      });

      highlightedStationsContainer.appendChild(stationCard);
    } else {
      // Set default icon based on station type
      const defaultIconUrl =
        marker.stationType === "Pilot"
          ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
          : "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";

      marker.setIcon({
        url: defaultIconUrl, // Default icon based on type
        scaledSize: new google.maps.Size(32, 32),
      });
    }
  });

  console.log("Stations near the route:", updatedMarkers.length);
  console.log("Highlighted Stations:", highlightedStations);
}





// Handle place change for the starting address
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
  } else {
    console.log("No details available for the input: " + place.name);
  }
}

// Handle place change for the destination address
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
  } else {
    console.log("No details available for the input: " + place.name);
  }
}

// This function creates the route from the start to the destination
async function performRoute() {
  if (!isMapReady || !directionsService || !directionsRenderer) {
    console.error("Map, DirectionsService, or DirectionsRenderer is not ready.");
    return;
  }

  console.log("Button clicked, performing route calculation");

  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;

  if (!start || !end) {
    alert("Please enter both starting and destination addresses.");
    return;
  }

  const routeRequest = {
    origin: start,
    destination: end,
    travelMode: google.maps.TravelMode.DRIVING,
  };

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

    // Render the route on the map
    directionsRenderer.setDirections(result);

    // Retrieve the route polyline
    const routePolyline = result.routes[0].overview_path;

    // Highlight gas stations near the route
    await highlightStationsAlongRoute(routePolyline);

    console.log("Route successfully created.");
  } catch (error) {
    console.error("Error calculating route:", error);
    alert("Route calculation failed: " + error);
  }
}


function plotLocationsOnMap(map, locations) {
  clearMarkers(gasStationMarkers);
  gasStationMarkers = []; // Reset the array

  locations.forEach((location, index) => {
    if (!location.latP || !location.lngP) {
      console.log(`Skipping Pilot location at index ${index}:`, location);
    }

    if (!location.latC || !location.lngC) {
      console.log(`Skipping Casey location at index ${index}:`, location);
    }

    // Add Pilot marker
    if (location.latP && location.lngP) {
      const pilotMarker = new google.maps.Marker({
        position: { lat: location.latP, lng: location.lngP },
        map: map,
        title: `${location.cityP}, ${location.stateP}`,
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
          scaledSize: new google.maps.Size(32, 32),
        },
      });

      const pilotInfoWindow = new google.maps.InfoWindow({
        content: `
          <div>
            <h3>Pilot Station</h3>
            <p><b>City:</b> ${location.cityP}</p>
            <p><b>State:</b> ${location.stateP}</p>
            <p><b>Hauler's Price:</b> $${location.haulersPriceP}</p>
          </div>
        `,
      });

      pilotMarker.addListener("click", () => {
        pilotInfoWindow.open(map, pilotMarker);
      });

      pilotMarker.stationType = "Pilot";
      pilotMarker.haulersPrice = location.haulersPriceP;
      gasStationMarkers.push(pilotMarker);
    }

    // Add Casey marker
    if (location.latC && location.lngC) {
      const caseyMarker = new google.maps.Marker({
        position: { lat: location.latC, lng: location.lngC },
        map: map,
        title: `${location.cityC}, ${location.stateC}`,
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          scaledSize: new google.maps.Size(32, 32),
        },
      });

      const caseyInfoWindow = new google.maps.InfoWindow({
        content: `
          <div>
            <h3>Casey Station</h3>
            <p><b>City:</b> ${location.cityC}</p>
            <p><b>State:</b> ${location.stateC}</p>
            <p><b>Hauler's Price:</b> $${location.haulersPriceC}</p>
          </div>
        `,
      });

      caseyMarker.addListener("click", () => {
        caseyInfoWindow.open(map, caseyMarker);
      });

      caseyMarker.stationType = "Casey";
      caseyMarker.haulersPrice = location.haulersPriceC;
      gasStationMarkers.push(caseyMarker);
    }
  });

  gasStationMarkers.forEach((marker, index) => {
    console.log(`Marker ${index} map:`, marker.getMap());
    console.log(`Marker ${index} visibility:`, marker.getVisible());
  });

  console.log("Total Markers Plotted:", gasStationMarkers.length);
}



function clearMarkers(markerArray) {
  markerArray.forEach(marker => marker.setMap(null)); // Remove markers from map
  markerArray.length = 0; // Clear the array
}


// Toggle the visibility of gas station markers
function toggleGasStations() {
  areStationsVisible = !areStationsVisible; // Toggle visibility state

  gasStationMarkers.forEach((marker, index) => {
    marker.setVisible(areStationsVisible); // Update visibility for all markers
    console.log(`Marker ${index} visibility set to:`, areStationsVisible);
  });

  // Update button text
  const toggleButton = document.getElementById("toggleStations");
  toggleButton.textContent = areStationsVisible ? "Hide All Stations" : "Show All Stations";

  console.log(`Gas stations are now ${areStationsVisible ? "visible" : "hidden"}.`);
}





// Initialize the map once the page is loaded
window.addEventListener('load', initMap);
