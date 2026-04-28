const urls = [
  'https://raw.githubusercontent.com/BeniDahal/nepal-geojson/master/nepal-districts.geojson',
  'https://raw.githubusercontent.com/AnishZindabad/Nepal-GeoJSON/main/nepal_districts.geojson',
  'https://raw.githubusercontent.com/Pratyoush10/Nepal-GeoJSON/master/nepal_districts.geojson',
  'https://raw.githubusercontent.com/shirish19/nepal-geojson/master/districts.geojson',
  'https://raw.githubusercontent.com/nepal-geojson/nepal-geojson.github.io/master/nepal-districts.geojson',
  'https://raw.githubusercontent.com/RamuKT/Nepal-GeoJSON/master/nepal-districts.geojson'
];

async function check() {
    for (const u of urls) {
        try {
            const r = await fetch(u);
            if(r.ok) {
                console.log("Good:", u);
            }
        }catch(e){}
    }
}
check();
