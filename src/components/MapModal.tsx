import { useState, useEffect, useMemo, useRef } from 'react';
import { SupportTask } from '../types';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polygon, GeoJSON, useMapEvents, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { geocodeLocation } from '../services/geocode';
import { useOverpassPOIs } from '../hooks/useOverpassPOIs';
import { X, Layers, Maximize, Minimize, Eye, EyeOff, Calendar, Clock, List, Map as MapIcon, ChevronDown } from 'lucide-react';
import { subDays, format, isAfter, isBefore } from 'date-fns';

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
  hydropower: createCustomIcon('#ca8a04'),
  blocked_road: createCustomIcon('#000000'), // Blocked Road Icon (Black)
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

const PROVINCE_MAP: Record<string, string> = {
  '1': 'Koshi',
  '2': 'Madhesh',
  '3': 'Bagmati',
  '4': 'Gandaki',
  '5': 'Lumbini',
  '6': 'Karnali',
  '7': 'Sudurpaschim'
};

const getRegionName = (properties: any) => {
    let name = properties.TARGET || properties.NAME || properties.DISTRICT || properties.GaPa_NaPa || properties.Province || properties.STATE_NAME || properties.PROVINCE || "Region";
    if (PROVINCE_MAP[name]) {
        name = PROVINCE_MAP[name];
    } else if (typeof name === 'string' && name.toLowerCase().startsWith('province ')) {
        const num = name.split(' ')[1];
        if (PROVINCE_MAP[num]) name = PROVINCE_MAP[num];
    }
    if (properties.LEVEL) name += " (" + properties.LEVEL + ")";
    return name;
};

export const NEPAL_MAP_URLS = {
  COUNTRY_OUTLINE: "/nepal-country.geojson",
  PROVINCE_OUTLINE: "/nepal-provinces.geojson",
  DISTRICT_OUTLINE: "/nepal-districts.geojson",
  MUNICIPAL_OUTLINE: "https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-municipalities.geojson"
};

export function MapModal({ onClose, tasks }: { onClose: () => void, tasks: SupportTask[] }) {
  const [nepalGeoJSON, setNepalGeoJSON] = useState<any>(null);
  const [taskCoords, setTaskCoords] = useState<{task: SupportTask, coords: [number, number]}[]>([]);
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);
  
  const [activePOIs, setActivePOIs] = useState<string[]>([]);
  const [mapStyle, setMapStyle] = useState<'clustered' | 'scattered'>('scattered');
  
  const [adminBoundary, setAdminBoundary] = useState<'province' | 'district' | 'municipal'>('province');
  const [adminGeoJSON, setAdminGeoJSON] = useState<any>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showSupportTasks, setShowSupportTasks] = useState(true);
  const [showBlockedRoads, setShowBlockedRoads] = useState(true);
  const [showFloodAlerts, setShowFloodAlerts] = useState(true);
  
  // Custom Time Filters
  const [timeFilter, setTimeFilter] = useState<'realtime' | 'custom'>('realtime');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
     start: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
     end: format(new Date(), 'yyyy-MM-dd')
  });

  // Modal / List Popup
  const [listPopup, setListPopup] = useState<{ title: string; items: any[]; type: string } | null>(null);
  
  // Custom Map Layer State
  const [activeMapLayer, setActiveMapLayer] = useState('minimal');
  const [showLiveTraffic, setShowLiveTraffic] = useState(true);
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const selectedFeature = useMemo(() => {
     if (!selectedRegion || !adminGeoJSON || !adminGeoJSON.features) return null;
     return adminGeoJSON.features.find((f: any) => {
        let name = getRegionName(f.properties);
        return name === selectedRegion;
     });
  }, [selectedRegion, adminGeoJSON]);

  const mapRef = useRef<L.Map | null>(null);

  const [apiBlockedRoads, setApiBlockedRoads] = useState<any[]>([]);
  const [apiFloodAlerts, setApiFloodAlerts] = useState<any[]>([]);

  useEffect(() => {
     // Fetch recent 200 incidents and filter locally
     fetch('/api/bipad/incidents?hazard=17&limit=200&ordering=-id')
        .then(r => r.json())
        .then(data => {
            if (data.results) {
               const roads = data.results.map((r: any) => ({
                  id: `br-${r.id}`,
                  name: r.title || 'Road/Area Blocked',
                  lat: r.point?.coordinates[1] || 0,
                  lng: r.point?.coordinates[0] || 0,
                  reason: 'Landslide',
                  status: 'Blocked',
                  severity: r.loss > 10000 ? 'High' : 'Medium',
                  startedAt: r.incidentOn || r.createdOn,
                  startedAtFormatted: new Date(r.incidentOn).toLocaleDateString(),
                  municipality: r.streetAddress || 'Unknown',
                  village: r.titleNe || 'Unknown',
               })).filter((r: any) => r.lat > 0);
               setApiBlockedRoads(roads);
            }
        }).catch(err => console.error("Error fetching blocked roads:", err));

     Promise.all([
        fetch('/api/bipad/incidents?hazard=11&limit=200&ordering=-id').then(r=>r.json()),
        fetch('/api/bipad/incidents?hazard=14&limit=200&ordering=-id').then(r=>r.json())
     ]).then(([floods, rains]) => {
         const alerts = [];
         if (floods.results) {
            alerts.push(...floods.results.map((a: any) => ({
                 id: `fa-${a.id}`,
                 type: 'Flood Alert',
                 severity: a.loss > 10000 ? 'Extreme' : 'High',
                 lat: a.point?.coordinates[1] || 0,
                 lng: a.point?.coordinates[0] || 0,
                 source: a.dataSource || 'Bipad Portal',
                 startedAt: a.incidentOn || a.createdOn,
                 startedAtFormatted: new Date(a.incidentOn).toLocaleDateString(),
                 radius: 10 + Math.random() * 10
            })));
         }
         if (rains.results) {
            alerts.push(...rains.results.map((a: any) => ({
                 id: `fa-${a.id}`,
                 type: 'Heavy Rainfall',
                 severity: 'Moderate',
                 lat: a.point?.coordinates[1] || 0,
                 lng: a.point?.coordinates[0] || 0,
                 source: a.dataSource || 'Bipad Portal',
                 startedAt: a.incidentOn || a.createdOn,
                 startedAtFormatted: new Date(a.incidentOn).toLocaleDateString(),
                 radius: 15 + Math.random() * 20
            })));
         }
         setApiFloodAlerts(alerts.filter(a => a.lat > 0));
     }).catch(err => console.error("Error fetching weather alerts:", err));

     // Fetch GDACS (Global Disaster Alert and Coordination System)
     fetch('/api/gdacs/events?eventlist=EQ,TC,FL,VO,DR')
        .then(r => r.json())
        .then(data => {
            if (data && data.features) {
                const gdacsAlerts = data.features.filter((f: any) => {
                   const [lng, lat] = f.geometry.coordinates;
                   return lat > 26 && lat < 31 && lng > 80 && lng < 89;
                }).map((f: any) => ({
                     id: `gdacs-${f.properties.eventid}`,
                     type: f.properties.eventtype === 'EQ' ? 'Earthquake Alert' : f.properties.eventtype === 'TC' ? 'Cyclone Alert' : f.properties.eventtype === 'FL' ? 'Flood Alert' : 'Disaster Alert',
                     severity: f.properties.alertlevel === 'Red' ? 'Extreme' : f.properties.alertlevel === 'Orange' ? 'High' : 'Moderate',
                     lat: f.geometry.coordinates[1],
                     lng: f.geometry.coordinates[0],
                     source: 'GDACS',
                     startedAt: f.properties.fromdate,
                     startedAtFormatted: new Date(f.properties.fromdate).toLocaleDateString(),
                     radius: 25 + Math.random() * 10
                }));
                setApiFloodAlerts(prev => [...prev, ...gdacsAlerts]);
            }
        }).catch(err => console.error("Error fetching GDACS alerts:", err));
  }, []);

  const startDateObj = new Date(dateRange.start);
  const endDateObj = new Date(dateRange.end);
  endDateObj.setHours(23, 59, 59, 999);

  const blockedRoads = useMemo(() => {
     return apiBlockedRoads.filter(r => {
        const itemDate = new Date(r.startedAt);
        return itemDate >= startDateObj && itemDate <= endDateObj;
     });
  }, [apiBlockedRoads, dateRange]);

  const floodAlerts = useMemo(() => {
     return apiFloodAlerts.filter(r => {
        const itemDate = new Date(r.startedAt);
        return itemDate >= startDateObj && itemDate <= endDateObj;
     });
  }, [apiFloodAlerts, dateRange]);
  
  const blockedRoadsFiltered = useMemo(() => {
     if (!selectedFeature) return blockedRoads;
     return blockedRoads.filter(r => {
        try {
           return turf.booleanPointInPolygon([r.lng, r.lat], selectedFeature);
        } catch(e) { return false; }
     });
  }, [blockedRoads, selectedFeature]);



  const floodAlertsFiltered = useMemo(() => {
     if (!selectedFeature) return floodAlerts;
     return floodAlerts.filter(a => {
        try {
           return turf.booleanPointInPolygon([a.lng, a.lat], selectedFeature);
        } catch(e) { return false; }
     });
  }, [floodAlerts, selectedFeature]);

  // Support tasks counts in the selected region or overall
  const taskCounts = useMemo(() => {
     let filteredTasks = tasks;
     if (selectedFeature) {
         filteredTasks = tasks.filter(t => {
            const coords = taskCoords.find(tc => tc.task.id === t.id)?.coords;
            if (!coords) return false;
            try {
               return turf.booleanPointInPolygon([coords[1], coords[0]], selectedFeature);
            } catch (e) {
               return false;
            }
         });
     }
     
     const pending = filteredTasks.filter(t => t.status === 'Pending');
     const ongoing = filteredTasks.filter(t => t.status === 'Ongoing');
     const resolved = filteredTasks.filter(t => t.status === 'Resolved');
     
     return {
         total: filteredTasks.length,
         pending,
         ongoing,
         resolved
     };
  }, [tasks, selectedFeature, taskCoords]);

  const { pois, loading: poisLoading } = useOverpassPOIs(mapBounds, activePOIs);

  // Filter POIs strictly inside Nepal
  const filteredPOIs = useMemo(() => {
    if (!pois || !nepalGeoJSON || !nepalGeoJSON.features) return pois;
    const nepalPolygon = nepalGeoJSON.features[0];
    return pois.filter((poi: any) => {
       try {
           return turf.booleanPointInPolygon([poi.lon, poi.lat], nepalPolygon);
       } catch (e) {
           return true; // if error (e.g. invalid polygon), keep it
       }
    });
  }, [pois, nepalGeoJSON]);

  // Critical Infra counts in the selected region
  const infraCounts = useMemo(() => {
     let filtered = filteredPOIs;
     if (selectedFeature) {
         filtered = filtered.filter((poi: any) => {
             try {
                 return turf.booleanPointInPolygon([poi.lon, poi.lat], selectedFeature);
             } catch (e) {
                 return false;
             }
         });
     }
     
     return {
        hospitals: filtered.filter((p: any) => p.type === 'hospital' || p.type === 'clinic').length,
        health_posts: filtered.filter((p: any) => p.type === 'health_post').length,
        helipads: filtered.filter((p: any) => p.type === 'helipad').length,
        airports: filtered.filter((p: any) => p.type === 'aerodrome').length,
        schools: filtered.filter((p: any) => p.type === 'school').length,
        hydropowers: filtered.filter((p: any) => p.type === 'plant' || p.type === 'generator').length,
     };
  }, [filteredPOIs, selectedFeature]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setAdminLoading(true);
    setAdminGeoJSON(null); // Clear old data to prevent React-Leaflet from caching stale data on new keys

    let url = '';
    if (adminBoundary === 'province') url = NEPAL_MAP_URLS.PROVINCE_OUTLINE;
    if (adminBoundary === 'district') url = NEPAL_MAP_URLS.DISTRICT_OUTLINE;
    if (adminBoundary === 'municipal') url = NEPAL_MAP_URLS.MUNICIPAL_OUTLINE;

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
    fetch(NEPAL_MAP_URLS.COUNTRY_OUTLINE)
      .then(r => r.json())
      .then(data => {
         if (data.features) {
            setNepalGeoJSON(data);
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

  // Focus on selected region
  useEffect(() => {
      if (selectedFeature && mapRef.current) {
          const bbox = turf.bbox(selectedFeature);
          // leaflet bounds [ [south, west], [north, east] ]
          mapRef.current.fitBounds([
             [bbox[1], bbox[0]],
             [bbox[3], bbox[2]]
          ], { padding: [20, 20], maxZoom: 12 });
      }
  }, [selectedFeature]);

  // Create an inverted polygon to mask areas outside Nepal
  // Leaflet Polygon can take an array of arrays. The first array is the outer bounds (world).
  // The subsequent arrays are the "holes".
  const maskCoordinates = useMemo(() => {
    if (!nepalGeoJSON || !nepalGeoJSON.features) return null;
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
    
    // We expect nepalGeoJSON to be a FeatureCollection
    const geoms = Array.isArray(nepalGeoJSON.features) ? nepalGeoJSON.features : [nepalGeoJSON];
    geoms.forEach((feature: any) => {
       if (feature.geometry && feature.geometry.coordinates) {
          extractHoles(feature.geometry.coordinates);
       }
    });

    return [worldBounds, ...holes] as [number, number][][];
  }, [nepalGeoJSON]);

  const togglePOI = (type: string) => {
    setActivePOIs(prev => prev.includes(type) ? prev.filter(p => p !== type) : [...prev, type]);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`fixed inset-0 bg-black/60 z-[100] flex items-center justify-center ${isFullscreen ? 'p-0' : 'p-2 sm:p-6'} backdrop-blur-sm transition-all duration-300`}>
      <div className={`bg-white dark:bg-slate-900 shadow-2xl w-full h-full max-h-screen flex flex-col overflow-hidden relative ${isFullscreen ? 'rounded-none' : 'rounded-2xl'}`}>
        <div className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0 relative z-[1000]">
          <div>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-gray-900 dark:text-white">Situation Map</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Nepal Support Task Visualizer</p>
          </div>
          <div className="flex items-center gap-3">
             {/* Custom Layers Dropdown */}
             <div className="relative">
               <button 
                 onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
                 className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider transition-colors"
               >
                 <MapIcon className="w-3.5 h-3.5" /> 
                 Layers
                 <ChevronDown className="w-3.5 h-3.5" />
               </button>
               
               {layerDropdownOpen && (
                 <>
                   <div className="fixed inset-0 z-40" onClick={() => setLayerDropdownOpen(false)}></div>
                   <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl rounded-xl z-50 p-2 text-sm flex flex-col gap-1">
                     <div className="px-2 py-1 text-[10px] font-bold uppercase text-gray-500 tracking-wider">Base Map</div>
                     {[
                       { id: 'minimal', name: 'Minimal Web Map' },
                       { id: 'satellite', name: 'Satellite (Esri)' },
                       { id: 'hybrid', name: 'Google Hybrid' },
                       { id: 'roads', name: 'Google Roads' },
                       { id: 'street', name: 'Street Map (OSM)' }
                     ].map(layer => (
                       <button
                         key={layer.id}
                         onClick={() => {
                           setActiveMapLayer(layer.id);
                           setLayerDropdownOpen(false);
                         }}
                         className={`text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${activeMapLayer === layer.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                       >
                         {layer.name}
                         {activeMapLayer === layer.id && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                       </button>
                     ))}
                     
                     <div className="px-2 py-1 mt-2 text-[10px] font-bold uppercase text-gray-500 tracking-wider border-t border-gray-100 dark:border-slate-700">Overlays</div>
                     <button
                       onClick={() => setShowLiveTraffic(!showLiveTraffic)}
                       className="text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                     >
                       <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showLiveTraffic ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-slate-600'}`}>
                         {showLiveTraffic && <X className="w-3 h-3 text-white" />}
                       </div>
                       Live Traffic / Blockages
                     </button>
                   </div>
                 </>
               )}
             </div>

             <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-slate-800 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700">
                <button 
                  onClick={() => {
                     setTimeFilter('realtime');
                     setDateRange({ start: format(subDays(new Date(), 1), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
                  }}
                  className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold rounded-md transition-all flex items-center gap-1 ${timeFilter === 'realtime' ? 'bg-red-50 text-red-600 shadow-sm border border-red-100 dark:bg-red-900/30 dark:border-red-900/50 dark:text-red-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                  <Clock className="w-3.5 h-3.5" /> 24 Hours
                </button>
                <div className="w-[1px] h-4 bg-gray-300 dark:bg-slate-600"></div>
                <div className="flex items-center gap-1 px-1">
                   <button 
                     onClick={() => setTimeFilter('custom')}
                     className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold rounded-md transition-all flex items-center gap-1 ${timeFilter === 'custom' ? 'bg-white shadow-sm border border-gray-200 text-blue-600 dark:bg-slate-700 dark:border-slate-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                   >
                     <Calendar className="w-3.5 h-3.5" /> Custom
                   </button>
                   {timeFilter === 'custom' && (
                     <div className="flex items-center gap-1 ml-1">
                        <input 
                          type="date" 
                          value={dateRange.start}
                          onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))}
                          className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 text-[11px] rounded px-1.5 py-1 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-gray-500">-</span>
                        <input 
                          type="date" 
                          value={dateRange.end}
                          onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))}
                          className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 text-[11px] rounded px-1.5 py-1 focus:outline-none focus:border-blue-500"
                        />
                     </div>
                   )}
                </div>
             </div>
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
             <button onClick={() => setShowSupportTasks(!showSupportTasks)} className="hidden sm:flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors" title={showSupportTasks ? "Hide Support View" : "Show Support View"}>
                {showSupportTasks ? <><Eye className="w-4 h-4 text-gray-500" /> <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Support View</span></> : <><EyeOff className="w-4 h-4 text-gray-500" /> <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">No Support</span></>}
             </button>
             <button onClick={toggleFullscreen} className="hidden sm:block p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                {isFullscreen ? <Minimize className="w-5 h-5 text-gray-500 dark:text-gray-400" /> : <Maximize className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
             </button>
             <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
             </button>
          </div>
        </div>
        
        <div className="flex-1 bg-gray-100 dark:bg-slate-800 relative">
           <MapContainer 
             ref={mapRef}
             center={[28.3949, 84.1240]} 
             zoom={7} 
             style={{ height: '100%', width: '100%', background: '#a5c9f3' }}
             maxBounds={[[26, 79], [31, 89]]}
             minZoom={6}
           >
             <BoundsTracker setBounds={setMapBounds} />
             
             {/* Map Layers */}
             {activeMapLayer === 'minimal' && (
               <TileLayer
                 attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                 url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
               />
             )}
             {activeMapLayer === 'satellite' && (
               <TileLayer
                 attribution='&copy; Esri'
                 url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
               />
             )}
             {activeMapLayer === 'hybrid' && (
               <TileLayer
                 attribution='&copy; Google Maps'
                 url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
               />
             )}
             {activeMapLayer === 'roads' && (
               <TileLayer
                 attribution='&copy; Google Maps'
                 url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
               />
             )}
             {activeMapLayer === 'street' && (
               <TileLayer
                 attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
               />
             )}

             {/* Overlays */}
             {showLiveTraffic && (
               <TileLayer
                 attribution='&copy; Google Maps Traffic'
                 url="https://mt1.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}"
               />
             )}

             {/* Faded Masking Outer Area */}
             
             {/* Admin Boundaries */}
             {adminGeoJSON && (
                <GeoJSON 
                   key={`admin-layer-${adminBoundary}-${selectedRegion || 'all'}`}
                   data={adminGeoJSON as any}
                   style={(feature: any) => {
                       let name = getRegionName(feature.properties);
                       
                       const isSelected = selectedRegion === name;
                       const hasSelection = !!selectedRegion;
                       
                       return {
                           color: isSelected ? '#1d4ed8' : '#334155',
                           weight: isSelected ? 3 : 1,
                           fillOpacity: isSelected ? 0.0 : (hasSelection ? 0.3 : 0.05),
                           fillColor: hasSelection && !isSelected ? '#0f172a' : '#3b82f6',
                           dashArray: isSelected ? '' : '2, 4'
                       };
                   }}
                   onEachFeature={(feature, layer) => {
                       // Add a simple popup for the name of the region
                       if (feature.properties) {
                          let name = getRegionName(feature.properties);
                          layer.bindTooltip(String(name), { sticky: true });
                          // Also make clickable to select
                          layer.on('click', () => {
                              setSelectedRegion(name === selectedRegion ? null : name);
                          });
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
                  pathOptions={{ color: 'transparent', fillColor: '#000000', fillOpacity: 0.85 }} 
                  interactive={false}
                />
             )}

             {/* Moded Task Markers */}
             {showSupportTasks && (
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
               {taskCoords
                 .map((item, idx) => {
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
             )}

             {/* Blocked Roads */}
             {showBlockedRoads && (
                <MarkerClusterGroup 
                  chunkedLoading 
                  maxClusterRadius={mapStyle === 'clustered' ? 50 : 1}
                  spiderfyOnMaxZoom={true}
                  iconCreateFunction={(cluster: any) => {
                      const count = cluster.getChildCount();
                      const size = Math.min(24 + (count * 2), 60);
                      return L.divIcon({
                        html: `<div style="background-color: rgba(0,0,0,0.8); width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: ${Math.max(12, size/2.5)}px; font-weight: bold;">${count}</div>`,
                        className: 'cluster-road-icon',
                        iconSize: [size, size],
                        iconAnchor: [size/2, size/2]
                      });
                  }}
                >
                    {blockedRoadsFiltered.map(r => (
                       <Marker key={r.id} position={[r.lat, r.lng]} icon={icons.blocked_road}>
                          <Popup>
                             <div className="font-bold text-sm">{r.name}</div>
                             <div className="text-xs text-red-600 font-bold uppercase mb-1">{r.status}</div>
                             <div className="text-xs text-gray-700"><strong>Started:</strong> {r.startedAtFormatted}</div>
                             <div className="text-xs text-gray-700"><strong>Municipality:</strong> {r.municipality}</div>
                             <div className="text-xs text-gray-700"><strong>Village/Tole:</strong> {r.village}</div>
                             <div className="text-xs text-gray-700 mt-1">Reason: {r.reason}</div>
                             <div className="text-[10px] text-gray-500 mt-1 bg-gray-100 p-1 rounded">Severity: {r.severity}</div>
                          </Popup>
                       </Marker>
                    ))}
                </MarkerClusterGroup>
             )}

             {/* Flood Alerts */}
             {showFloodAlerts && floodAlertsFiltered.map(a => (
                <Circle 
                   key={a.id} 
                   center={[a.lat, a.lng]} 
                   pathOptions={{ color: a.severity === 'Extreme' ? 'red' : 'orange', fillColor: a.severity === 'Extreme' ? '#fca5a5' : '#fed7aa', fillOpacity: 0.4 }} 
                   radius={a.radius * 1000}
                >
                   <Popup>
                      <div className="font-bold text-sm text-red-700">{a.type}</div>
                      <div className="text-xs font-bold uppercase mb-1">Severity: {a.severity}</div>
                      <div className="text-xs text-gray-700 mt-1">Source: {a.source}</div>
                   </Popup>
                </Circle>
             ))}

             {/* Overpass POIs */}
             {filteredPOIs.map(poi => {
               let icon = icons.school;
               let label = "POI";
               if (poi.type === 'hospital' || poi.type === 'clinic') { icon = icons.hospitals; label = poi.tags.name || "Hospital"; }
               if (poi.type === 'health_post') { icon = icons.health_posts; label = poi.tags.name || "Health Post"; }
               if (poi.type === 'helipad') { icon = icons.helipad; label = poi.tags.name || "Helipad"; }
               if (poi.type === 'aerodrome') { icon = icons.airport; label = poi.tags.name || "Airport"; }
               if (poi.type === 'plant' || poi.type === 'generator') { icon = icons.hydropower; label = poi.tags.name || "Hydropower Plant"; }
               if (poi.type === 'school') { icon = icons.school; label = poi.tags.name || "School"; }

               return (
                 <Marker key={poi.id} position={[poi.lat, poi.lon]} icon={icon}>
                   <Popup><span className="font-bold">{label}</span> <br/><span className="text-xs text-gray-500">{poi.type}</span></Popup>
                 </Marker>
               );
             })}
           </MapContainer>

           <div className="absolute top-4 right-4 z-[400] flex flex-col gap-3">
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-4 min-w-[200px] transition-colors">
                   <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-2 border-b border-gray-100 dark:border-slate-800 pb-2">{selectedRegion || 'All ' + adminBoundary + 's'}</h3>
                   
                   <div className="mb-3">
                      <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Support Tasks ({taskCounts.total})</div>
                      <div className="flex gap-2 text-xs font-semibold">
                         <span className="text-orange-500 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Pending Tasks', items: taskCounts.pending, type: 'task' })}>{taskCounts.pending.length} Pending</span>
                         <span className="text-red-500 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Ongoing Tasks', items: taskCounts.ongoing, type: 'task' })}>{taskCounts.ongoing.length} Ongoing</span>
                         <span className="text-green-500 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Resolved Tasks', items: taskCounts.resolved, type: 'task' })}>{taskCounts.resolved.length} Resolved</span>
                      </div>
                   </div>

                   <div className="mb-3">
                      <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Critical Infrastructure</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                         {activePOIs.includes('hospitals') && <div className="text-red-500 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Hospitals', items: filteredPOIs.filter(p => p.type === 'hospital' || p.type === 'clinic'), type: 'poi' })}>{infraCounts.hospitals} Hospitals</div>}
                         {activePOIs.includes('health_posts') && <div className="text-orange-500 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Health Posts', items: filteredPOIs.filter(p => p.type === 'health_post'), type: 'poi' })}>{infraCounts.health_posts} Health Posts</div>}
                         {activePOIs.includes('helipads') && <div className="text-purple-500 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Helipads', items: filteredPOIs.filter(p => p.type === 'helipad'), type: 'poi' })}>{infraCounts.helipads} Helipads</div>}
                         {activePOIs.includes('airports') && <div className="text-teal-500 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Airports', items: filteredPOIs.filter(p => p.type === 'aerodrome'), type: 'poi' })}>{infraCounts.airports} Airports</div>}
                         {activePOIs.includes('schools') && <div className="text-blue-500 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Schools', items: filteredPOIs.filter(p => p.type === 'school'), type: 'poi' })}>{infraCounts.schools} Schools</div>}
                         {activePOIs.includes('hydropowers') && <div className="text-yellow-600 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Hydropower Plants', items: filteredPOIs.filter(p => p.type === 'plant' || p.type === 'generator'), type: 'poi' })}>{infraCounts.hydropowers} Hydropower</div>}
                         {activePOIs.length === 0 && <span className="text-gray-400">None selected</span>}
                      </div>
                   </div>
                   
                   {showBlockedRoads && (
                      <div className="mb-3">
                         <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Blocked Roads</div>
                         <div className="text-lg font-bold text-black dark:text-gray-200 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Blocked Roads', items: blockedRoadsFiltered, type: 'blocked_road' })}>{blockedRoadsFiltered.length}</div>
                      </div>
                   )}
                   
                   {showFloodAlerts && (
                      <div>
                         <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Active Alerts</div>
                         <div className="text-lg font-bold text-red-600 dark:text-red-400 cursor-pointer hover:underline" onClick={() => setListPopup({ title: 'Weather & Hazards', items: floodAlertsFiltered, type: 'alert' })}>{floodAlertsFiltered.length}</div>
                      </div>
                   )}
                </div>
           </div>

           {/* Boundary controls */}
           <div className="absolute bottom-4 left-4 z-[400] flex flex-col gap-3">
             {/* Admin Bounds Toggle Controls */}
             <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-3 max-w-xs transition-colors">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                   <Layers className="w-4 h-4 text-blue-500" />
                   <span className="font-bold text-xs uppercase tracking-wide text-gray-700 dark:text-gray-200">Administrative Boundaries</span>
                   {adminLoading && <span className="ml-auto flex w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>}
                </div>
                <div className="flex flex-col gap-2">
                   <div className="flex flex-wrap gap-2">
                       {['province', 'district', 'municipal'].map((type) => (
                          <button 
                             key={type}
                             onClick={() => { setAdminBoundary(type as any); setSelectedRegion(null); }} 
                             className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border transition-all ${adminBoundary === type ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-700'}`}
                          >
                             {type}
                          </button>
                       ))}
                   </div>
                   {adminGeoJSON && adminGeoJSON.features && (
                      <select 
                         value={selectedRegion || ""} 
                         onChange={(e) => setSelectedRegion(e.target.value || null)}
                         className="text-xs p-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                      >
                         <option value="">-- All {adminBoundary}s --</option>
                         {Array.from(new Set([...adminGeoJSON.features].map((f: any) => getRegionName(f.properties)))).sort().map((name: string) => (
                            <option key={name} value={name}>{name}</option>
                         ))}
                      </select>
                   )}
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
                   <button onClick={() => togglePOI('hydropowers')} className={`text-[10px] px-2 py-1 rounded border transition-colors ${activePOIs.includes('hydropowers') ? 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-500/30 dark:text-yellow-400' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'}`}>Hydropower</button>
                   <button onClick={() => setShowBlockedRoads(!showBlockedRoads)} className={`text-[10px] px-2 py-1 rounded border transition-colors ${showBlockedRoads ? 'bg-gray-200 border-gray-400 text-black dark:bg-gray-700 dark:text-white' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:text-gray-300'}`}>Blocked Roads</button>
                   <button onClick={() => setShowFloodAlerts(!showFloodAlerts)} className={`text-[10px] px-2 py-1 rounded border transition-colors ${showFloodAlerts ? 'bg-red-200 border-red-400 text-red-900 dark:bg-red-900/50 dark:text-red-200' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:text-gray-300'}`}>Weather Alerts</button>
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
           
           {/* Data Sources Footer */}
           <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full text-[10px] text-gray-700 dark:text-gray-300 shadow-md font-medium text-center pointer-events-auto border border-gray-200 dark:border-slate-700 w-max max-w-[90vw]">
              Real-time Sources: <a href="https://bipadportal.gov.np" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Bipad Portal (Govt of Nepal)</a> for Hazards & Alerts, <a href="https://overpass-turbo.eu/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">OpenStreetMap</a> for Infrastructure
           </div>

           {/* List Details Popup */}
           {listPopup && (
              <div className="absolute inset-0 bg-black/40 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
                 <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-slate-800">
                    <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                       <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <List className="w-5 h-5 text-blue-500" />
                          {listPopup.title} <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 py-0.5 px-2 rounded-full text-xs">{listPopup.items.length}</span>
                       </h3>
                       <button onClick={() => setListPopup(null)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                          <X className="w-5 h-5 text-gray-500" />
                       </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                       {listPopup.items.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">No details found for this selection.</div>
                       ) : listPopup.items.map((item, idx) => (
                          <div key={idx} className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 p-3 rounded-lg text-sm">
                             {listPopup.type === 'alert' && (
                                <>
                                  <div className="flex justify-between items-start mb-1">
                                     <span className="font-bold text-red-700 dark:text-red-400">{item.type}</span>
                                     <span className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 px-1.5 py-0.5 rounded font-bold uppercase">{item.severity}</span>
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1"><strong>Started:</strong> {item.startedAtFormatted}</div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-500 mt-1 uppercase tracking-wide">Source: {item.source}</div>
                                </>
                             )}
                             {listPopup.type === 'blocked_road' && (
                                <>
                                  <div className="flex justify-between items-start mb-1">
                                     <span className="font-bold text-gray-900 dark:text-white">{item.name}</span>
                                     <span className="text-[10px] bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-300 px-1.5 py-0.5 rounded font-bold uppercase">Blocked directly</span>
                                  </div>
                                  <div className="text-xs text-red-600 font-medium mb-1">Due to {item.reason}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400"><strong>Location:</strong> {item.municipality}, {item.village}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400"><strong>Started:</strong> {item.startedAtFormatted}</div>
                                </>
                             )}
                             {listPopup.type === 'poi' && (
                                <>
                                  <div className="font-bold text-blue-700 dark:text-blue-400 mb-1">{item.tags?.name || 'Unnamed Facility'}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 capitalize">Type: {(item.type || '').replace('_', ' ')}</div>
                                </>
                             )}
                             {listPopup.type === 'task' && (
                                <>
                                  <div className="flex justify-between items-start mb-1">
                                     <span className="font-bold text-gray-900 dark:text-white">{item.organization}</span>
                                     <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${item.status === 'Resolved' ? 'bg-green-100 text-green-800' : item.status === 'Ongoing' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>{item.status}</span>
                                  </div>
                                  <div className="text-sm text-gray-800 dark:text-gray-200 mb-1">{item.details}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400"><strong>Location:</strong> {item.municipal}, {item.district}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400"><strong>Required By:</strong> {new Date(item.requiredBy).toLocaleDateString()}</div>
                                </>
                             )}
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
