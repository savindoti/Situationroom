const search = async () => {
  const r = await fetch('https://api.github.com/search/code?q=Limpiyadhura+extension:geojson', {
    headers: { 'User-Agent': 'node.js', 'Accept': 'application/vnd.github.v3+json'}
  });
  const data = await r.json();
  if (data.items) {
      console.log(data.items.slice(0,5).map(i => i.repository.full_name + ' / ' + i.path));
  } else {
      console.log(data);
  }
}
search();
