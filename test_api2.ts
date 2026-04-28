const checkUrls = async () => {
    try {
        const p = await fetch('https://localboundries.oknp.org/js/province.geojson');
        console.log("province status:", p.status);
        const d = await fetch('https://localboundries.oknp.org/js/district.geojson');
        console.log("district status:", d.status);
        const m = await fetch('https://localboundries.oknp.org/js/municipality.geojson');
        console.log("municipal status:", m.status);
    } catch (e) {
        console.log("Error:", e);
    }
}
checkUrls();
