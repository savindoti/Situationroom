import fs from "fs";

async function fetchNepalOSM() {
  const url = "https://nominatim.openstreetmap.org/search?country=nepal&polygon_geojson=1&format=json";
  try {
     const res = await fetch(url, { headers: { 'User-Agent': 'NepalSupportApp/1.0' } });
     const data = await res.json();
     if (data && data.length > 0) {
         console.log("Got OSM data, finding best polygon...");
         const nepal = data.find((d: any) => d.class === 'boundary' && d.type === 'administrative');
         if (nepal && nepal.geojson) {
              const geojson = {
                  type: "FeatureCollection",
                  features: [
                     { type: "Feature", properties: { name: "Nepal" }, geometry: nepal.geojson }
                  ]
              };
              fs.mkdirSync("public", { recursive: true });
              fs.writeFileSync("public/nepal.json", JSON.stringify(geojson));
              console.log("Saved public/nepal.json!");
         }
     }
  } catch(e) {
     console.error(e);
  }
}
fetchNepalOSM();
