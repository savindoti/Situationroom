import fs from 'fs';

const query = `
[out:json][timeout:25];
relation["ISO3166-1"="NP"][admin_level="2"];
out geom;
`;

const fetchNepal = async () => {
  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter`, {
      method: 'POST',
      body: query
    });
    const data = await res.json();
    fs.writeFileSync('nepal_osm.json', JSON.stringify(data));
    console.log("Saved OSM relations", data.elements.length);
  } catch (error) {
    console.error(error);
  }
}
fetchNepal();
