const check = async () => {
    try {
        const c = await fetch('https://polygons.openstreetmap.fr/get_geojson.py?id=184633&params=0');
        const data = await c.json();
        console.log("OSM Geojson got:", data.type);
    } catch(e) { console.error("Error:", e.message) }
}
check();
