import fs from 'fs';
const urls = [
    'https://raw.githubusercontent.com/chakradarraju/Nepal-Geojsons/master/nepal_districts.geojson',
    'https://raw.githubusercontent.com/bhuwansha/nepal-boundary/main/nepal_admin_level_3.geojson',
    'https://raw.githubusercontent.com/dpendra/nepal-geojson/master/nepal-districts.geojson'
];

async function check() {
   for (let u of urls) {
       try {
           const r = await fetch(u);
           if (r.ok) {
               console.log("Found:", u);
               const d = await r.json();
               console.log("Length:", d.features.length);
           }
       } catch(e) {}
   }
}
check();
