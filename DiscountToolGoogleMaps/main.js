let map;
let autoCompleteStart;
let autoCompleteEnd;
let routeControl;


// This function is for gathering information from the Google Sheets
async function fetchLocations() {
  const pilotCSVUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTttM3XVDav2NLAIlSgDEbO7-gOVe6E3lGDau76EazO4iXTuswuhsfjgVWdE_tWIKMHmP6pTcL4s_0L/pub?output=csv';
  const caseyCSVUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTttM3XVDav2NLAIlSgDEbO7-gOVe6E3lGDau76EazO4iXTuswuhsfjgVWdE_tWIKMHmP6pTcL4s_0L/pub?output=csv&sheet=Page2';

  try {
    const pilotResponse = await fetch(pilotCSVUrl);
    if (!pilotResponse.ok) throw new Error("Error loading Pilot data");

    const caseyResponse = await fetch(caseyCSVUrl);
    if (!caseyResponse.ok) throw new Error("Error loading Casey data");

    const pilotCsvText = await pilotResponse.text();
    const caseyCsvText = await caseyResponse.text();

    const pilotData = Papa.parse(pilotCsvText, { header: true, skipEmptyLines: true }).data;
    const caseyData = Papa.parse(caseyCsvText, { header: true, skipEmptyLines: true }).data;

    const pilotLocations = pilotData.map((row) => ({
      lat: parseFloat(row.Latitude),
      lng: parseFloat(row.Longitude),
      city: row.City,
      state: row.St,
      haulersPrice: parseFloat(row['HaulersPrice']),
      type: 'Pilot',
    }));

    const caseyLocations = caseyData.map((row) => ({
      lat: parseFloat(row.Latitude),
      lng: parseFloat(row.Longitude),
      city: row.City,
      state: row.St,
      haulersPrice: parseFloat(row['HaulersPrice']),
      type: 'Casey',
    }));

    const allLocations = [...pilotLocations, ...caseyLocations];
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

    try {
      // Wait for the fast route to be calculated
      const fastRouteResponse = await directionsService.route(fastRouteRequest);

      // Display the fastest route
      if (fastRouteResponse.status === "OK") {
        directionsRenderer.setDirections(fastRouteResponse);
      } else {
        alert("Fastest route request failed: " + fastRouteResponse.status);
      }
    } catch (error) {
      alert("Route calculation failed: " + error.message);
    }
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
    if (location.lat && location.lng) {
      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: map,
        title: `${location.city}, ${location.state}`,
        icon: location.type === 'Pilot'
          ? {
              url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
              scaledSize: new google.maps.Size(32, 32),
            }
          : {
              url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
              scaledSize: new google.maps.Size(32, 32),
            },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <h3>${location.city}, ${location.state}</h3>
          <p><strong>Haulers Price:</strong> $${location.haulersPrice.toFixed(2)}</p>
          <p><strong>Type:</strong> ${location.type} Gas Station</p>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });
    } else {
      console.warn("Invalid location data:", location);
    }
  });
}

// Initialize the map when the page loads
window.onload = initMap;
