const axios = require('axios');

async function getAddressFromCoordinates(latitude, longitude) {
  const geocodingServices = [
    {
      name: 'Nominatim',
      url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      headers: {
        'User-Agent': 'MyApp/1.0 (contact@example.com)'
      },
      parser: (data) => {
        if (data && data.address) {
          const addr = data.address;
          return [
            addr.house_number,
            addr.road,
            addr.neighbourhood || addr.suburb,
            addr.city || addr.town || addr.village,
            addr.state,
            addr.country
          ].filter(Boolean).join(', ');
        }
        return data.display_name || null;
      }
    },
    {
      name: 'BigDataCloud',
      url: `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      headers: {},
      parser: (data) => {
        if (data && data.locality) {
          return [data.locality, data.principalSubdivision, data.countryName].filter(Boolean).join(', ');
        }
        return null;
      }
    },
    {
      name: 'LocationIQ',
      url: `https://us1.locationiq.com/v1/reverse.php?key=${process.env.LOCATIONIQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
      headers: {},
      parser: (data) => {
        if (data && data.address) {
          const addr = data.address;
          return [
            addr.house_number,
            addr.road,
            addr.neighbourhood || addr.suburb,
            addr.city || addr.town || addr.village,
            addr.state,
            addr.country
          ].filter(Boolean).join(', ');
        }
        return null;
      }
    }
  ];

  for (const service of geocodingServices) {
    try {
      const response = await axios.get(service.url, {
        headers: service.headers,
        timeout: 5000
      });

      const address = service.parser(response.data);
      if (address) {
        console.log(`Geocoding success: ${service.name} - ${address}`);
        return address;
      }
    } catch (error) {
      console.warn(`Geocoding failed for ${service.name}: ${error.message}`);
    }
  }

  return `Location: ${latitude}, ${longitude}`;
}

module.exports = getAddressFromCoordinates;
