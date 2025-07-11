const axios = require('axios');


// async function getAddressFromCoordinates(latitude, longitude) {
//   const geocodingServices = [
//     {
//       name: 'Nominatim',
//       url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
//       headers: {
//         'User-Agent': 'MyApp/1.0 (contact@example.com)'
//       },
//       parser: (data) => {
//         if (data && data.address) {
//           const addr = data.address;
//           return [
//             addr.house_number,
//             addr.road,
//             addr.neighbourhood || addr.suburb,
//             addr.city || addr.town || addr.village,
//             addr.state,
//             addr.country
//           ].filter(Boolean).join(', ');
//         }
//         return data.display_name || null;
//       }
//     },
//     {
//       name: 'BigDataCloud',
//       url: `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
//       headers: {},
//       parser: (data) => {
//         if (data && data.locality) {
//           return [data.locality, data.principalSubdivision, data.countryName].filter(Boolean).join(', ');
//         }
//         return null;
//       }
//     },
//     {
//       name: 'LocationIQ',
//       url: `https://us1.locationiq.com/v1/reverse.php?key=${process.env.LOCATIONIQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
//       headers: {},
//       parser: (data) => {
//         if (data && data.address) {
//           const addr = data.address;
//           return [
//             addr.house_number,
//             addr.road,
//             addr.neighbourhood || addr.suburb,
//             addr.city || addr.town || addr.village,
//             addr.state,
//             addr.country
//           ].filter(Boolean).join(', ');
//         }
//         return null;
//       }
//     }
//   ];

//   for (const service of geocodingServices) {
//     try {
//       const response = await axios.get(service.url, {
//         headers: service.headers,
//         timeout: 5000
//       });

//       const address = service.parser(response.data);
//       if (address) {
//         console.log(`Geocoding success: ${service.name} - ${address}`);
//         return address;
//       }
//     } catch (error) {
//       console.warn(`Geocoding failed for ${service.name}: ${error.message}`);
//     }
//   }

//   return `Location: ${latitude}, ${longitude}`;
// }


async function getAddressFromCoordinates(latitude, longitude) {
  const services = [
    // Service 1: OpenStreetMap Nominatim (with proper headers)
    async () => {
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18&extratags=1`,
          {
            headers: {
              'User-Agent': 'YourAppName/1.0 (your-email@example.com)', // Replace with your app name and email
              'Accept': 'application/json',
              'Accept-Language': 'en'
            },
            timeout: 10000
          }
        );
        
        if (response.data && response.data.display_name) {
          const addr = response.data.address || {};
          const formattedAddress = [
            addr.house_number,
            addr.road,
            addr.neighbourhood || addr.suburb,
            addr.city || addr.town || addr.village,
            addr.state_district || addr.state,
            addr.country
          ].filter(Boolean).join(', ');
          
          return formattedAddress || response.data.display_name;
        }
        return null;
      } catch (error) {
        console.error('Nominatim geocoding error:', error.message);
        return null;
      }
    },

    // Service 2: LocationIQ (Free tier: 5000 requests/day)
    async () => {
      try {
        // You need to sign up at https://locationiq.com/ and get a free API key
        const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY; // Add to your .env file
        
        if (!LOCATIONIQ_API_KEY) {
          return null;
        }
        
        const response = await axios.get(
          `https://us1.locationiq.com/v1/reverse.php?key=${LOCATIONIQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
          {
            timeout: 10000
          }
        );
        
        if (response.data && response.data.display_name) {
          return response.data.display_name;
        }
        return null;
      } catch (error) {
        console.error('LocationIQ geocoding error:', error.message);
        return null;
      }
    },

    // Service 3: OpenCage (Free tier: 2500 requests/day)
    async () => {
      try {
        // You need to sign up at https://opencagedata.com/ and get a free API key
        const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY; // Add to your .env file
        
        if (!OPENCAGE_API_KEY) {
          return null;
        }
        
        const response = await axios.get(
          `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${OPENCAGE_API_KEY}&language=en&pretty=1`,
          {
            timeout: 10000
          }
        );
        
        if (response.data && response.data.results && response.data.results.length > 0) {
          return response.data.results[0].formatted;
        }
        return null;
      } catch (error) {
        console.error('OpenCage geocoding error:', error.message);
        return null;
      }
    },

    // Service 4: BigDataCloud (Free tier: 10000 requests/month)
    async () => {
      try {
        const response = await axios.get(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          {
            timeout: 10000
          }
        );
        
        if (response.data && response.data.locality) {
          const addr = response.data;
          const formattedAddress = [
            addr.locality,
            addr.city,
            addr.principalSubdivision,
            addr.countryName
          ].filter(Boolean).join(', ');
          
          return formattedAddress || `${addr.locality}, ${addr.countryName}`;
        }
        return null;
      } catch (error) {
        console.error('BigDataCloud geocoding error:', error.message);
        return null;
      }
    }
  ];

  // Try each service in order
  for (const service of services) {
    try {
      const address = await service();
      if (address) {
        console.log('Successfully got address:', address);
        return address;
      }
    } catch (error) {
      console.error('Service error:', error.message);
      continue;
    }
  }

  // If all services fail, return coordinates
  return `Coordinates: ${latitude}, ${longitude}`;
}

// Alternative: Simple IP-based location service (as last resort)
async function getLocationFromIP() {
  try {
    const response = await axios.get('http://ip-api.com/json/', {
      timeout: 5000
    });
    
    if (response.data && response.data.city) {
      return `${response.data.city}, ${response.data.regionName}, ${response.data.country}`;
    }
    return null;
  } catch (error) {
    console.error('IP location error:', error.message);
    return null;
  }
}


module.exports = getAddressFromCoordinates;
