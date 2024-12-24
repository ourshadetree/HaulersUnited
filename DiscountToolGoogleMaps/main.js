let map;
let autoCompleteStart;
let autoCompleteEnd;
let routeControl;


// This function is for gathering information from the Google Sheets
async function fetchLocations() {
  const pilotCSVUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTttM3XVDav2NLAIlSgDEbO7-gOVe6E3lGDau76EazO4iXTuswuhsfjgVWdE_tWIKMHmP6pTcL4s_0L/pub?output=csv';
  const caseyCSVUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS54WS48Ol3EXpqVS-2Rw7ePnqwFcnkiVzfONIGxIJqpWuruNuphr_qhpNFbVgHVrchKyjkCBfjM_zK/pub?gid=1692662712&single=true&output=csv'; // Correct URL for Sheet 2 (Casey)

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
        latP: parseFloat(row.Latitude),  // Changed to latP
        lngP: parseFloat(row.Longitude), // Changed to lngP
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
        latC: parseFloat(row.Latitude),  // Changed to latC
        lngC: parseFloat(row.Longitude), // Changed to lngC
        cityC: row.City,
        stateC: row.State,
        haulersPriceC: parseFloat(row['HaulersPrice']),
        typeC: 'Casey',
      };
    });

    // Log the results
    console.log("Pilot Locations (length):", pilotLocations.length);
    console.log("Casey Locations (length):", caseyLocations.length);
    console.log("Pilot Data Sample: ", JSON.stringify(pilotData[0]));  // Log first pilot entry
    console.log("Casey Data Sample: ", JSON.stringify(caseyData[0]));  // Log first casey entry

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
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  document.querySelector("button").addEventListener("click", () => {
    performRoute(geocoder, directionsService, directionsRenderer);
  });

  const locations = await fetchLocations();
  plotLocationsOnMap(map, locations);
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
async function performRoute(geocoder, directionsService, directionsRenderer) {
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;

  if (start && end) {
    // Prepare the route request for the fastest route
    const fastRouteRequest = {
      origin: start,
      destination: end,
      travelMode: google.maps.TravelMode.DRIVING,
    };

    directionsService.route(fastRouteRequest, (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);
      } else {
        alert("Route calculation failed: " + status);
      }
    });
  } else {
    alert("Please enter both starting and destination addresses.");
  }
}







// Function to find the closest and cheapest gas station to the start point
// function findClosestAndCheapestGasStation(locations, start) {
//   const startLatLng = new google.maps.LatLng(start);
//   console.log('Start LatLng:', startLatLng);
//   let closestStation = null;
//   let minDistance = Infinity;
//   let minPrice = Infinity;

//   locations.forEach((location) => {
//     console.log('Location:', location);
//     console.log('Checking if haulersPrice < minPrice:', location.haulersPrice, '<', minPrice);
//     if (typeof location.lat === 'number' && typeof location.lng === 'number' && !isNaN(location.haulersPrice)) {
//       console.log('Latitude:', location.lat);
//       console.log('Longitude:', location.lng);
//       const stationLatLng = new google.maps.LatLng(location.lat, location.lng);

//       console.log('Station LatLng:', stationLatLng);
//       const distance = google.maps.geometry.spherical.computeDistanceBetween(startLatLng, stationLatLng);
//       console.log('Distance:', distance);
//       if (distance < minDistance) {
//         minDistance = distance;
//         closestStation = stationLatLng;
//         minPrice = location.haulersPrice;
//       }
//     } else {
//       console.error('Invalid LatLng data:', location.lat, location.lng);
//     }
    
//   });
  

//   console.log('Closest station found:', closestStation);  // Add this line to debug
//   return closestStation;
// }



// This function plots the fetched locations on the map
function plotLocationsOnMap(map, locations) {
  locations.forEach((location) => {
    // Plot Pilot locations
    if (location.latP && location.lngP) {
      const marker = new google.maps.Marker({
        position: { lat: location.latP, lng: location.lngP },
        map: map,
        title: `${location.cityP}, ${location.stateP}`,
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
          scaledSize: new google.maps.Size(32, 32),
        },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <h3>${location.cityP}, ${location.stateP}</h3>
          <p><strong>Haulers Price:</strong> $${location.haulersPriceP.toFixed(2)}</p>
          <p><strong>Type:</strong> ${location.typeP}</p> <!-- Using typeP -->
          <p><strong>Location Number:</strong> ${location.locationNumberP}</p>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });
    }
    
    // Plot Casey locations
    if (location.latC && location.lngC) {
      const marker = new google.maps.Marker({
        position: { lat: location.latC, lng: location.lngC },
        map: map,
        title: `${location.cityC}, ${location.stateC}`,
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          scaledSize: new google.maps.Size(32, 32),
        },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <h3>${location.cityC}, ${location.stateC}</h3>
          <p><strong>Haulers Price:</strong> $${location.haulersPriceC.toFixed(2)}</p>
          <p><strong>Type:</strong> ${location.typeC}</p> <!-- Using typeC -->
          <p><strong>Location Number:</strong> ${location.locationNumberC}</p>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });
    }
  });
}




// Initialize the map when the page loads
window.onload = initMap;
