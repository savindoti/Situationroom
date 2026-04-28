const checkUrls = async () => {
    try {
        const c = await fetch('https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-districts-new.geojson');
        const cData = await c.json();
        console.log("Country structure:", cData.type, "features:", cData.features?.length);
        if (cData.features?.length > 0) {
            console.log("First feature config type:", cData.features[0].geometry?.type);
        }
    } catch (e) {
        console.log("Error:", e);
    }
}
checkUrls();
