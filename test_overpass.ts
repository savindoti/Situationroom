const q = `[out:json][timeout:25];
area["ISO3166-1"="NP"][admin_level="2"]->.searchArea;
(
  node["amenity"="hospital"](area.searchArea)(27,85,28,86);
);
out body;`;
fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)
.then(r => r.json())
.then(d => console.log(d.elements?.length))
.catch(e => console.error(e));
