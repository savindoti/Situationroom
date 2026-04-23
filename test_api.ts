import fs from 'fs';

const checkUrls = async () => {
    try {
        const res = await fetch('https://localboundries.oknp.org/js/ward.geojson');
        console.log("ward status:", res.status);
    } catch (e) {
        console.log("Error:", e);
    }
}
checkUrls();
