const urls = [
  'https://raw.githubusercontent.com/Saugat-Bhattarai/Nepal-JSON/master/nepal.geojson',
  'https://raw.githubusercontent.com/rumeshnpl/nepal-map-geojson/main/nepal.geojson',
  'https://raw.githubusercontent.com/Bimal1412/Nepal-Local-Level-GeoJSON/master/nepal.geojson',
  'https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal.geojson',
  'https://raw.githubusercontent.com/sbks/nepal-geojson/master/nepal.geojson',
  'https://raw.githubusercontent.com/brihat-sharma/nepal-geojson/master/nepal.geojson'
];

async function run() {
  for (const u of urls) {
     try {
       const res = await fetch(u);
       if (res.ok) {
           const data = await res.json();
           console.log("OK:", u, "features:", data.features?.length || "no features");
       } else {
           console.log("FAIL:", u, res.status);
       }
     } catch(e) {
       console.log("ERR:", u, e.message);
     }
  }
}
run();
