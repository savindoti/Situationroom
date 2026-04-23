import { useState, useEffect } from 'react';

export type POI = {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
  type: string;
};

export function useOverpassPOIs(bounds: [number, number, number, number] | null, types: string[]) {
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bounds || types.length === 0) {
      setPois([]);
      return;
    }

    const [south, west, north, east] = bounds;
    
    // Construct overpass query
    let queryItems = '';
    
    if (types.includes('hospitals')) queryItems += `node["amenity"="hospital"](${south},${west},${north},${east});`;
    if (types.includes('health_posts')) queryItems += `node["amenity"="clinic"](${south},${west},${north},${east});node["amenity"="health_post"](${south},${west},${north},${east});`;
    if (types.includes('helipads')) queryItems += `node["aeroway"="helipad"](${south},${west},${north},${east});`;
    if (types.includes('airports')) queryItems += `node["aeroway"="aerodrome"](${south},${west},${north},${east});`;
    if (types.includes('schools')) queryItems += `node["amenity"="school"](${south},${west},${north},${east});`;

    if (!queryItems) return;

    const query = `[out:json][timeout:25];(${queryItems});out body;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    let active = true;
    setLoading(true);

    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(res => {
        if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") === -1) {
          throw new Error("Overpass API did not return JSON");
        }
        return res.json();
      })
      .then(data => {
        if (!active) return;
        if (data && data.elements) {
          const parsed = data.elements
            .filter((e: any) => e.lat && e.lon)
            .map((e: any) => ({
              id: e.id,
              lat: e.lat,
              lon: e.lon,
              tags: e.tags || {},
              type: e.tags.amenity || e.tags.aeroway || 'unknown'
            }));
          setPois(parsed);
        }
      })
      .catch(err => {
        console.error("Overpass query failed:", err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [bounds, types.join(',')]);

  return { pois, loading };
}
