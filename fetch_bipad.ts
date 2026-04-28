const check = async () => {
    try {
        const c = await fetch('https://bipadportal.gov.np/api/v1/spatial/province/');
        const data = await c.json();
        console.log("Bipad Province length:", data.features?.length);
    } catch(e) { console.error("Error:", e.message) }
}
check();
