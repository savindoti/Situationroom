import { writeFileSync } from 'fs';
import ng from 'nepal-geojson';

const c = ng.country();
writeFileSync('public/nepal-country.geojson', JSON.stringify(c));

const p = ng.province();
writeFileSync('public/nepal-provinces.geojson', JSON.stringify(p));

const d = ng.districts();
writeFileSync('public/nepal-districts.geojson', JSON.stringify(d));

console.log("Written!");
