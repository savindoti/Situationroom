const check = async () => {
    try {
        const c = await fetch('https://nominatim.openstreetmap.org/search?q=Limpiyadhura&format=json', {
            headers: {'User-Agent': 'ais-test'}
        });
        const data = await c.json();
        console.log("Limpiyadhura:", data);
    } catch(e) { console.log(e); }
}
check();
