const check = async () => {
    try {
        const c = await fetch('https://polygons.openstreetmap.fr/get_geojson.py?id=184633&params=0');
        const data = await c.json();
        let minX = 180, maxX = -180, minY = 90, maxY = -90;
        data.coordinates.forEach(poly => {
            poly.forEach(ring => {
                ring.forEach(pt => {
                    const [x, y] = pt;
                    if(x < minX) minX = x;
                    if(x > maxX) maxX = x;
                    if(y < minY) minY = y;
                    if(y > maxY) maxY = y;
                });
            });
        });
        console.log("Bounds:", minX, minY, "to", maxX, maxY);
    } catch(e) { console.error("Error:", e.message) }
}
check();
