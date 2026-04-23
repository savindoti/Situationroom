import { useState, useEffect, useMemo, useRef } from 'react';
import { SupportTask } from '../types';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, LayersControl, Polygon, GeoJSON, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { geocodeLocation } from '../services/geocode';
import { useOverpassPOIs } from '../hooks/useOverpassPOIs';
import { X, Layers } from 'lucide-react';

// Fix leaflet default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons for POIs
const createCustomIcon = (color: string) => {
  return new L.DivIcon({
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
    className: 'custom-poi-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

const icons = {
  hospitals: createCustomIcon('#ef4444'),
  health_posts: createCustomIcon('#f97316'),
  school: createCustomIcon('#3b82f6'),
  helipad: createCustomIcon('#8b5cf6'),
  airport: createCustomIcon('#14b8a6'),
  task: createCustomIcon('#22c55e')
};

// Map Bounding Box Tracker
function BoundsTracker({ setBounds }: { setBounds: (b: [number, number, number, number]) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      setBounds([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
    }
  });

  useEffect(() => {
    const b = map.getBounds();
    setBounds([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
  }, [map, setBounds]);

  return null;
}

export function MapModal({ onClose, tasks }: { onClose: () => void, tasks: SupportTask[] }) {
  const [nepalGeoJSON, setNepalGeoJSON] = useState<any>(null);
  const [taskCoords, setTaskCoords] = useState<{task: SupportTask, coords: [number, number]}[]>([]);
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);
  
  const [activePOIs, setActivePOIs] = useState<string[]>([]);
  const [mapStyle, setMapStyle] = useState<'clustered' | 'scattered'>('scattered');
  
   const [adminBoundary, setAdminBoundary] = useState<'province' | 'district' | 'municipal'>('province');
  const [adminGeoJSON, setAdminGeoJSON] = useState<any>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  
  const { pois, loading: poisLoading } = useOverpassPOIs(mapBounds, activePOIs);

  useEffect(() => {
    setAdminLoading(true);
    let url = '';
    // Use user-requested oknp.org boundaries exclusively
    if (adminBoundary === 'province') url = 'https://localboundries.oknp.org/js/province.geojson';
    if (adminBoundary === 'district') url = 'https://localboundries.oknp.org/js/district.geojson';
    if (adminBoundary === 'municipal') url = 'https://localboundries.oknp.org/js/municipality.geojson';

    if (url) {
        fetch(url)
           .then(r => r.json())
           .then(data => {
               setAdminGeoJSON(data);
               setAdminLoading(false);
           })
           .catch(e => {
               console.warn("Could not fetch admin boundary layer:", e);
               setAdminGeoJSON(null);
               setAdminLoading(false);
           });
    } else {
        setAdminLoading(false);
    }
  }, [adminBoundary]);

  useEffect(() => {
    // Fetch newly created Nepal OSM Boundary (Chuchhe map) for the mask
    fetch('/nepal.json')
      .then(r => r.json())
      .then(data => {
         if (data.features && data.features.length > 0 && data.features[0].geometry) {
            setNepalGeoJSON(data.features[0].geometry);
         }
      })
      .catch(e => {
        console.warn("Could not fetch local Nepal outline. Error:", e.message);
      });
  }, []);

  useEffect(() => {
    let active = true;
    const fetchCoords = async () => {
       // Reset mapped coordinates when tasks change drastically
       setTaskCoords([]);
       
       for (const task of tasks) {
         if (!active) break;
         if (task.municipal && task.district) {
           const coords = await geocodeLocation(task.municipal, task.district);
           if (coords && active) {
             setTaskCoords(prev => {
                // Avoid dropping duplicates if already processed, but add instantly
                if (prev.find(p => p.task.id === task.id)) return prev;
                return [...prev, { task, coords }];
             });
           }
         }
       }
    };
    fetchCoords();
    return () => { active = false; };
  }, [tasks]);

  // Create an inverted polygon to mask areas outside Nepal
  // Leaflet Polygon can take an array of arrays. The first array is the outer bounds (world).
  // The subsequent arrays are the "holes".
  const maskCoordinates = useMemo(() => {
    if (!nepalGeoJSON || !nepalGeoJSON.coordinates) return null;
    const worldBounds = [
      [90, -180],
      [90, 180],
      [-90, 180],
      [-90, -180]
    ];
    // GeoJSON coords are [lng, lat], Leaflet wants [lat, lng]
    
    let holes: any[] = [];
    const extractHoles = (coords: any[]) => {
       if (typeof coords[0][0] === 'number') {
          // This is a single ring [lng, lat][]
          holes.push(coords.map((c: any) => [c[1], c[0]]));
       } else {
          coords.forEach(extractHoles);
       }
    };
    extractHoles(nepalGeoJSON.coordinates);

    return [worldBounds, ...holes] as [number, number][][];
  }, [nepalGeoJSON]);

  const togglePOI = (type: string) => {
    setActivePOIs(prev => prev.includes(type) ? prev.filter(p => p !== type) : [...prev, type]);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-2 sm:p-6 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full h-full max-h-screen flex flex-col overflow-hidden relative">
        <div className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-gray-900 dark:text-white">Situation Map</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Nepal Support Task Visualizer</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                <button 
                  onClick={() => setMapStyle('scattered')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mapStyle === 'scattered' ? 'bg-white shadow-sm dark:bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  Scatter View
                </button>
                <button 
                  onClick={() => setMapStyle('clustered')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mapStyle === 'clustered' ? 'bg-white shadow-sm dark:bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  Cluster View
                </button>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
             </button>
          </div>
        </div>
        
        <div className="flex-1 bg-gray-100 dark:bg-slate-800 relative">
           <MapContainer 
             center={[28.3949, 84.1240]} 
             zoom={7} 
             style={{ height: '100%', width: '100%', background: '#a5c9f3' }}
             maxBounds={[[26, 79], [31, 89]]}
             minZoom={6}
           >
             <BoundsTracker setBounds={setMapBounds} />
             
             <LayersControl position="topright">
               <LayersControl.BaseLayer checked name="Minimal Web Map (CartoDB Positron)">
                 <TileLayer
                   attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                   url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                 />
               </LayersControl.BaseLayer>
               <LayersControl.BaseLayer name="Google Roads Network">
                 <TileLayer
                   attribution='&copy; Google Maps'
                   url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                 />
               </LayersControl.BaseLayer>
               <LayersControl.BaseLayer name="Google Hybrid (Satellite + Roads)">
                 <TileLayer
                   attribution='&copy; Google Maps'
                   url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                 />
               </LayersControl.BaseLayer>
               <LayersControl.BaseLayer name="Street Map (OSM)">
                 <TileLayer
                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                 />
               </LayersControl.BaseLayer>
               <LayersControl.BaseLayer name="Satellite (Esri)">
                 <TileLayer
                   attribution='&copy; Esri'
                   url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                 />
               </LayersControl.BaseLayer>

               <LayersControl.Overlay name="Live Traffic / Blockages (Google)" checked>
                 <TileLayer
                   attribution='&copy; Google Maps Traffic'
                   url="https://mt1.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}"
                 />
               </LayersControl.Overlay>
             </LayersControl>

             {/* Faded Masking Outer Area */}
             {nepalGeoJSON && (
                <GeoJSON 
                   key="nepal-boundary"
                   data={nepalGeoJSON as any}
                   style={{
                       color: '#1e40af', // Match the OKNP admin boundary color exactly for consistent shape
                       weight: 2.5,      // Strong outer boundary
                       fillOpacity: 0
                   }}
                />
             )}

             {/* OKNP Admin Boundaries */}
             {adminGeoJSON && (
                <GeoJSON 
                   key={`admin-layer-${adminBoundary}`}
                   data={adminGeoJSON as any}
                   style={{
                       color: '#1e40af', // Blue borders for admin 
                       weight: 1,
                       fillOpacity: 0.05, // Slight tint
                       fillColor: '#3b82f6'
                   }}
                   onEachFeature={(feature, layer) => {
                       // Add a simple popup for the name of the region
                       if (feature.properties) {
                          const name = feature.properties.TARGET || feature.properties.DISTRICT || feature.properties.GaPa_NaPa || feature.properties.Province || "Region";
                          layer.bindTooltip(name, { sticky: true });
                       }
                   }}
                />
             )}

             {/* Static Province Labels */}
             {mapStyle === 'scattered' && [
                { name: 'SUDURPASHCHIM', lat: 29.3, lng: 81.0 },
                { name: 'KARNALI', lat: 29.2, lng: 82.2 },
                { name: 'LUMBINI', lat: 28.0, lng: 82.8 },
                { name: 'GANDAKI', lat: 28.4, lng: 84.0 },
                { name: 'BAGMATI', lat: 27.6, lng: 85.3 },
                { name: 'MADHESH', lat: 26.9, lng: 85.5 },
                { name: 'PROVINCE 1', lat: 27.2, lng: 87.3 }
             ].map(prov => (
                <Marker 
                  key={prov.name} 
                  position={[prov.lat, prov.lng]} 
                  icon={new L.DivIcon({
                    html: `<div style="font-size: 10px; font-weight: 800; color: #111827; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap;">${prov.name}</div>`,
                    className: 'province-label-icon',
                    iconSize: [100, 20],
                    iconAnchor: [50, 10]
                  })}
                  interactive={false}
                />
             ))}
             
             {maskCoordinates && (
                <Polygon 
                  positions={maskCoordinates} 
                  pathOptions={{ color: 'transparent', fillColor: '#000000', fillOpacity: 0.7 }} 
                  interactive={false}
                />
             )}

             {/* Moded Task Markers */}
             <MarkerClusterGroup 
               chunkedLoading 
               maxClusterRadius={mapStyle === 'clustered' ? 50 : 1}
               spiderfyOnMaxZoom={true}
               iconCreateFunction={(cluster: any) => {
                  const count = cluster.getChildCount();
                  const size = Math.min(24 + (count * 2), 60);
                  return L.divIcon({
                    html: `<div style="background-color: #334155; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: ${Math.max(12, size/2.5)}px; font-weight: bold;">${count}</div>`,
                    className: 'cluster-dot-icon',
                    iconSize: [size, size],
                    iconAnchor: [size/2, size/2]
                  });
               }}
             >
               {taskCoords.map((item, idx) => {
                   let fillColor = '#f97316'; // Pending - Orange
                   if (item.task.status === 'Ongoing') fillColor = '#ef4444'; // Ongoing - Red
                   if (item.task.status === 'Resolved') fillColor = '#22c55e'; // Resolved - Green
                   
                   return (
                     <Marker 
                        key={`${idx}-${item.task.id}`}
                        position={item.coords}
                        icon={new L.DivIcon({
                            html: `<div style="background-color: ${fillColor}; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">1</div>`,
                            className: 'scatter-dot-icon',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })}
                     >
                       <Popup className="rounded-lg">
                          <div className="max-w-[200px]">
                             <span className="text-[10px] uppercase font-bold text-blue-600 block mb-1">{item.task.status}</span>
                             <h4 className="font-bold text-sm text-gray-900">{item.task.organization}</h4>
                             <p className="text-xs text-gray-600 mt-1">{item.task.details}</p>
                             <div className="mt-2 text-[10px] text-gray-500 border-t pt-1 border-gray-100">
                               {item.task.municipal}, {item.task.district}
                             </div>
                          </div>
                       </Popup>
                       <Tooltip sticky direction="top">
                           <span className="font-bold">{item.task.organization}</span> - {item.task.status}
                       </Tooltip>
                     </Marker>
                   );
               })}
             </MarkerClusterGroup>

             {/* Overpass POIs */}
             {pois.map(poi => {
               let icon = icons.school;
               let label = "POI";
               if (poi.type === 'hospital' || poi.type === 'clinic') { icon = icons.hospitals; label = poi.tags.name || "Hospital"; }
               if (poi.type === 'health_post') { icon = icons.health_posts; label = poi.tags.name || "Health Post"; }
               if (poi.type === 'helipad') { icon = icons.helipad; label = poi.tags.name || "Helipad"; }
               if (poi.type === 'aerodrome') { icon = icons.airport; label = poi.tags.name || "Airport"; }
               if (poi.type === 'school') { label = poi.tags.name || "School"; }

               return (
                 <Marker key={poi.id} position={[poi.lat, poi.lon]} icon={icon}>
                   <Popup><span className="font-bold">{label}</span> <br/><span className="text-xs text-gray-500">{poi.type}</span></Popup>
                 </Marker>
               );
             })}
           </MapContainer>

           {/* Boundary controls */}
           <div className="absolute bottom-4 left-4 z-[400] flex flex-col gap-3">
             {/* Admin Bounds Toggle Controls */}
             <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-3 max-w-xs transition-colors">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                   <Layers className="w-4 h-4 text-blue-500" />
                   <span className="font-bold text-xs uppercase tracking-wide text-gray-700 dark:text-gray-200">Administrative Boundaries</span>
                   {adminLoading && <span className="ml-auto flex w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>}
                </div>
                <div className="flex flex-wrap gap-2">
                   {['province', 'district', 'municipal'].map((type) => (
                      <button 
                         key={type}
                         onClick={() => setAdminBoundary(type as any)} 
                         className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border transition-all ${adminBoundary === type ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-700'}`}
                      >
                         {type}
                      </button>
                   ))}
                </div>
             </div>

             {/* POI Toggle Controls */}
             <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-3 max-w-xs transition-colors">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                   <Layers className="w-4 h-4 text-blue-500" />
                   <span className="font-bold text-xs uppercase tracking-wide text-gray-700 dark:text-gray-200">Critical Infrastructure</span>
                   {poisLoading && <span className="ml-auto flex w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>}
                </div>
                <div className="flex flex-wrap gap-2">
                   <button onClick={() => togglePOI('hospitals')} className={`text-[10px] px-2 py-1 rounded border transition-colors ${activePOIs.includes('hospitals') ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-500/30 dark:text-red-400' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'}`}>Hospitals</button>
                   <button onClick={() => togglePOI('health_posts')} className={`text-[10px] px-2 py-1 rounded border transition-colors ${activePOIs.includes('health_posts') ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-500/30 dark:text-orange-400' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'}`}>Health Posts</button>
                   <button onClick={() => togglePOI('helipads')} className={`text-[10px] px-2 py-1 rounded border transition-colors ${activePOIs.includes('helipads') ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/30 dark:text-purple-400' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'}`}>Helipads</button>
                   <button onClick={() => togglePOI('airports')} className={`text-[10px] px-2 py-1 rounded border transition-colors ${activePOIs.includes('airports') ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/30 dark:border-teal-500/30 dark:text-teal-400' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'}`}>Airports</button>
                   <button onClick={() => togglePOI('schools')} className={`text-[10px] px-2 py-1 rounded border transition-colors ${activePOIs.includes('schools') ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500/30 dark:text-blue-400' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'}`}>Schools</button>
                </div>
             </div>
           </div>

           {/* Map Legend */}
           <div className="absolute bottom-4 right-4 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-3 transition-colors">
              <span className="font-bold text-xs uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-2 block border-b border-gray-100 dark:border-slate-800 pb-2">Task Status</span>
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f97316] border border-white dark:border-slate-800 shadow-sm"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">Pending</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444] border border-white dark:border-slate-800 shadow-sm"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">Ongoing</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#22c55e] border border-white dark:border-slate-800 shadow-sm"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">Resolved</span>
                 </div>
                 <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-100 dark:border-slate-800">
                    <div className="w-4 h-4 rounded-full bg-[#334155] border border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[8px] font-bold text-white">#</div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">Multiple Tasks</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
