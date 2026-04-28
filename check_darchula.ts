const check = async () => {
    try {
        const c = await fetch('https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-districts-new.geojson');
        const data = await c.json();
        const darchula = data.features.find(f => f.properties.DISTRICT && f.properties.DISTRICT.toLowerCase() === 'darchula');
        console.log("Darchula found:", !!darchula);
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
        search(darchula.geometry.coordinates);
        console.log("Darchula Bounds:", minX, minY, "to", maxX, maxY);
    } catch(e) { console.error("Error:", e.message) }
}
check();
