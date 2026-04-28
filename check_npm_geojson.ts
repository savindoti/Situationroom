import ng from 'nepal-geojson';
import fs from 'fs';

console.log("Exported:", Object.keys(ng));
console.log("Districts:", ng.districts?.features?.length);
const c = ng.districts?.features.find(f => f.properties.district === 'Darchula' || f.properties.DISTRICT === 'Darchula' || f.properties.DIST_EN === 'Darchula');
if (c) {
   let minX = 180, maxX = -180, minY = 90, maxY = -90;
        const search = (arr) => {
            arr.forEach(a => {
                if(typeof a[0] === 'number') {
                    if(a[0] < minX) minX = a[0];
                    if(a[0] > maxX) maxX = a[0];
                    if(a[1] < minY) minY = a[1];
                    if(a[1] > maxY) maxY = a[1];
                } else if (Array.isArray(a)) {
                    search(a);
                }
            })
        }
        search(c.geometry.coordinates);
        console.log("Darchula Bounds:", minX, minY, "to", maxX, maxY);
}
