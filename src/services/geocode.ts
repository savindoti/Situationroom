import * as turf from '@turf/turf';

let geoJSONCache: any = null;

export const geocodeLocation = async (municipal: string, district: string): Promise<[number, number] | null> => {
  const cacheKey = `geocode_photon_${municipal}_${district}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }

  // 1. Try to find the center from the local GeoJSON first for accuracy
  try {
     if (!geoJSONCache) {
         const res = await fetch('https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-municipalities.geojson');
         if (res.ok) {
             geoJSONCache = await res.json();
         }
     }
     
     if (geoJSONCache && geoJSONCache.features) {
         const dNormalized = (district || '').toLowerCase().replace(/\s/g, '');
         const mNormalized = (municipal || '').toLowerCase().replace(/municipality|rural|metropolitan|sub-metropolitan|\s/g, '');
         
         const match = geoJSONCache.features.find((f: any) => {
             const fDist = (f.properties.DISTRICT || '').toLowerCase().replace(/\s/g, '');
             const fMuni = (f.properties.NAME || '').toLowerCase().replace(/municipality|rural|metropolitan|sub-metropolitan|\s/g, '');
             return fDist === dNormalized && fMuni.includes(mNormalized);
         });

         if (match) {
             const center = turf.centerOfMass(match);
             const coords: [number, number] = [center.geometry.coordinates[1], center.geometry.coordinates[0]];
             localStorage.setItem(cacheKey, JSON.stringify(coords));
             return coords;
         }
     }
  } catch (e) {
     console.warn("Failed local geojson geocode", e);
  }

  // Very slight delay for rate limiting
  await new Promise(resolve => setTimeout(resolve, 150));

  try {
    const query = encodeURIComponent(`${municipal}, ${district}, Nepal`);
    const res = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=1`);
    if (!res.ok) throw new Error("API not ok");
    const data = await res.json();
    
    if (data && data.features && data.features.length > 0) {
      // Photon returns coordinates as [lon, lat]
      const coords: [number, number] = [data.features[0].geometry.coordinates[1], data.features[0].geometry.coordinates[0]];
      localStorage.setItem(cacheKey, JSON.stringify(coords));
      return coords;
    }
    
    // Fallback to district only
    const distQuery = encodeURIComponent(`${district}, Nepal`);
    const distRes = await fetch(`https://photon.komoot.io/api/?q=${distQuery}&limit=1`);
    if (distRes.ok) {
        const distData = await distRes.json();
        if (distData && distData.features && distData.features.length > 0) {
            const coords: [number, number] = [distData.features[0].geometry.coordinates[1], distData.features[0].geometry.coordinates[0]];
            localStorage.setItem(cacheKey, JSON.stringify(coords));
            return coords;
        }
    }
  } catch (error: any) {
    console.error("Geocoding failed:", error.message);
  }
  return null;
};
