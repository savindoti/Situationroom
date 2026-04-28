const check = async () => {
    try {
        const c = await fetch('https://nominatim.openstreetmap.org/search?country=nepal&format=json', {
            headers: {'User-Agent': 'ais-test'}
        });
        const data = await c.json();
        console.log("Nepal OSM ID:", data[0].osm_type, data[0].osm_id);
    } catch(e) { console.log(e); }
}
check();
