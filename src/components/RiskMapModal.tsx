import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SupportTask, RiskArea, UserRole } from '../types';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polygon, GeoJSON, useMapEvents, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { motion, AnimatePresence } from 'motion/react';
import { X, Layers, Maximize, Minimize, Map as MapIcon, ChevronDown, Upload, Download, Activity, List, Search, Trash, Database, Edit2, Check, Square, CheckSquare, ShieldAlert, AlertTriangle, RotateCcw, Target, Clock, Waves, CloudRain, Flame, Zap, CloudFog, ChevronUp, Filter, BarChart2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { useAuth } from '../context/AuthContext';
import * as Papa from 'papaparse';
import * as xlsx from 'xlsx';
import toast from 'react-hot-toast';
import { locations, provinces, getDistrictsByProvince, getMunicipalsByDistrict } from '../data/locations';

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
  task: createCustomIcon('#22c55e'),
  low_risk: createCustomIcon('#22c55e'),     // Green
  medium_risk: createCustomIcon('#f97316'),  // Yellow/Orange
  high_risk: createCustomIcon('#ef4444')     // Red
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
  '1': 'Province 1',
  '2': 'Madhesh',
  '3': 'Bagmati',
  '4': 'Gandaki',
  '5': 'Lumbini',
  '6': 'Karnali',
  '7': 'Sudurpaschim'
};

const getRegionName = (properties: any) => {
    let name = properties.GaPa_NaPa || properties.LU_Name || properties.PALIKA || properties.Local_Name || properties.WARD || properties.WARD_NO || properties.Ward || properties.ward || properties.TARGET || properties.NAME || properties.DISTRICT || properties.Province || properties.STATE_NAME || properties.PROVINCE || "Region";
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

export function RiskMapModal({ onClose }: { onClose: () => void }) {
  const { user, appUser, isSuperAdmin, isAdmin, canWrite } = useAuth();
  const [nepalGeoJSON, setNepalGeoJSON] = useState<any>(null);
  const [riskAreas, setRiskAreas] = useState<RiskArea[]>([]);
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mapStyle, setMapStyle] = useState<'clustered' | 'scattered'>('clustered');
  
  // Custom Map Layer State
  const [activeMapLayer, setActiveMapLayer] = useState('outline');
  const [showLiveTraffic, setShowLiveTraffic] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [screenType, setScreenType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isStatsSheetOpen, setIsStatsSheetOpen] = useState(false);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<'Low' | 'Medium' | 'High' | null>(null);
  const [selectedRiskAreaId, setSelectedRiskAreaId] = useState<string | null>(null);
  
  // Administrative Boundary state
  const [provincesData, setProvincesData] = useState<any>(null);
  const [districtsData, setDistrictsData] = useState<any>(null);
  const [localLevelsData, setLocalLevelsData] = useState<any>(null);
  const [districtWardsData, setDistrictWardsData] = useState<any>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{ boundary: 'province' | 'district' | 'municipal', region: string | null }>({ boundary: 'province', region: null });

  // Disaster Type selection
  const [selectedDisasterTypes, setSelectedDisasterTypes] = useState<string[]>([]);
  const [selectedRiskTypes, setSelectedRiskTypes] = useState<string[]>(['Low', 'Medium', 'High']);
  
  // Modal / List Popup
  const [listPopup, setListPopup] = useState<{ title: string; items: any[]; type: string } | null>(null);

  // Database View Mode
  const [viewMode, setViewMode] = useState<'map' | 'table'>('map');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<RiskArea>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [activeFilterTab, setActiveFilterTab] = useState<'location' | 'hazard' | 'history'>('location');
  const [tempProvince, setTempProvince] = useState<string>('');
  const [tempDistrict, setTempDistrict] = useState<string>('');
  const [tempMunicipality, setTempMunicipality] = useState<string>('');
  const [tempDisasterType, setTempDisasterType] = useState<string>('');
  const [isLocationPanelOpen, setIsLocationPanelOpen] = useState(true);
  const [isHazardPanelOpen, setIsHazardPanelOpen] = useState(true);
  const [tempSearch, setTempSearch] = useState<string>('');
  const [searchSuggestions, setSearchSuggestions] = useState<typeof locations>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  const handleFilterSubmit = () => {
    if (activeFilterTab === 'location') {
      if (tempMunicipality) {
        setAppliedFilters({ boundary: 'municipal', region: tempMunicipality });
      } else if (tempDistrict) {
        setAppliedFilters({ boundary: 'district', region: tempDistrict });
      } else if (tempProvince) {
        setAppliedFilters({ boundary: 'province', region: tempProvince });
      } else {
        setAppliedFilters({ boundary: 'province', region: null });
      }
    } else if (activeFilterTab === 'hazard') {
      if (tempDisasterType) {
        setSelectedDisasterTypes([tempDisasterType]);
      } else {
        setSelectedDisasterTypes([]);
      }
    }
  };

  const resetFilters = () => {
    setTempProvince('');
    setTempDistrict('');
    setTempMunicipality('');
    setTempDisasterType('');
    setTempSearch('');
    setSelectedDisasterTypes([]);
    setAppliedFilters({ boundary: 'province', region: null });
    setSelectedRiskTypes(['Low', 'Medium', 'High']);
    setSelectedRegion(null);

    if (mapRef.current) {
      mapRef.current.setView([28.3949, 84.1240], 7);
    }
  };

  const normalizeName = (name: string) => {
      if (!name) return '';
      return name.toLowerCase()
          .replace(/\b(nagarpalika|gaunpalika|gapa|napa|municipality|rural municipality|metropolitan city|sub.?metropolitan city|palika|maha.?nagarpalika|upa.?maha.?nagarpalika|rural|rm|m)\b/gi, '')
          .replace(/sh/g, 's') // Standardize pashchim/paschim etc.
          .replace(/[()_.\-]/g, ' ')
          .replace(/\s+/g, '')
          .trim();
  };

  const adminBoundary = appliedFilters.boundary;

  const getMatchedFeature = (regionName: string, boundaryType: string) => {
      const targetData = boundaryType === 'province' ? provincesData : (boundaryType === 'district' ? districtsData : localLevelsData);
      if (!targetData || !targetData.features) return null;
      const searchNorm = normalizeName(regionName);
      
      return targetData.features.find((f: any) => {
          const props = f.properties;
          const featName = getRegionName(props).toLowerCase();
          const featNorm = normalizeName(featName);
          
          return featNorm === searchNorm || featNorm.includes(searchNorm) || searchNorm.includes(featNorm);
      });
  };

  const spatiallyFilteredRiskAreas = useMemo(() => {
     let filtered = riskAreas;
     if (appliedFilters.region) {
         const search = (appliedFilters.region || '').toLowerCase().trim();
         const searchNorm = normalizeName(search);
         
         filtered = filtered.filter(r => {
             if (appliedFilters.boundary === 'province') {
                 const provNorm = normalizeName(r.province || '');
                 return provNorm === searchNorm || provNorm.includes(searchNorm) || searchNorm.includes(provNorm);
             } else if (appliedFilters.boundary === 'district') {
                 const distNorm = normalizeName(r.district || '');
                 return distNorm === searchNorm || distNorm.includes(searchNorm) || searchNorm.includes(distNorm);
             } else if (appliedFilters.boundary === 'municipal') {
                 const munNorm = normalizeName(r.municipal || '');
                 return munNorm === searchNorm || munNorm.includes(searchNorm) || munNorm.includes(munNorm);
             }
             return true;
         });
     }

     // Apply Type of Disaster filter if any
     if (selectedDisasterTypes.length > 0) {
        filtered = filtered.filter(r => selectedDisasterTypes.includes(r.typeOfDisaster || 'Unknown'));
     }

     return filtered;
  }, [riskAreas, appliedFilters, selectedDisasterTypes]);

  const selectedFeature = useMemo(() => {
     if (!appliedFilters.region) return null;
     return getMatchedFeature(appliedFilters.region, appliedFilters.boundary);
  }, [appliedFilters, provincesData, districtsData, localLevelsData]);

  // Determine what GeoJSON features to display based on selection
  const outerGeoJSONData = useMemo(() => {
    if (!appliedFilters.region || !appliedFilters.boundary) return null;
    const feat = getMatchedFeature(appliedFilters.region, appliedFilters.boundary);
    return feat ? { type: 'FeatureCollection', features: [feat] } : null;
  }, [appliedFilters, provincesData, districtsData, localLevelsData]);

  const innerGeoJSONData = useMemo(() => {
      if (!appliedFilters.region) {
          return provincesData;
      }

      if (appliedFilters.boundary === 'province') {
          // Show Districts within selected Province
          if (!districtsData) return null;
          const search = appliedFilters.region.toLowerCase();
          const filteredFeatures = districtsData.features.filter((f: any) => {
               const p = f.properties;
               const prov = (p.PROVINCE || p.Province || p.STATE_NAME || '').toString().toLowerCase();
               const provName = PROVINCE_MAP[prov] ? PROVINCE_MAP[prov].toLowerCase() : prov;
               return provName.includes(search) || search.includes(provName);
          });
          return { type: 'FeatureCollection', features: filteredFeatures };
      }

      if (appliedFilters.boundary === 'district') {
          // Show Local Levels within selected District
          if (!localLevelsData) return null;
          const search = normalizeName(appliedFilters.region);
          const filteredFeatures = localLevelsData.features.filter((f: any) => {
               const dist = normalizeName(f.properties.DISTRICT || f.properties.District || '');
               return dist === search || dist.includes(search) || search.includes(dist);
          });
          return { type: 'FeatureCollection', features: filteredFeatures };
      }

      if (appliedFilters.boundary === 'municipal') {
          // Show Wards within selected Local Level
          const search = normalizeName(appliedFilters.region);
          
          if (districtWardsData && districtWardsData.features && districtWardsData.features.length > 0) {
              const filteredWards = districtWardsData.features.filter((f: any) => {
                   const p = f.properties;
                   const mun = normalizeName(p.PALIKA || p.GaPa_NaPa || p.NAME || p.LU_Name || p.Local_Name || '');
                   return mun === search || mun.includes(search) || search.includes(mun);
              });
              
              if (filteredWards.length > 0) return { type: 'FeatureCollection', features: filteredWards };
          }
          
          // Fallback: Show the local level boundary itself from localLevelsData
          if (localLevelsData) {
              const searchRaw = (appliedFilters.region || '').toLowerCase();
              const filteredMun = localLevelsData.features.filter((f: any) => {
                  const p = f.properties;
                  const munRaw = (p.PALIKA || p.GaPa_NaPa || p.NAME || p.LU_Name || p.Local_Name || p.GaPa_NaPa || '').toLowerCase();
                  const munNorm = normalizeName(munRaw);
                  return munNorm === search || munRaw.includes(searchRaw) || searchRaw.includes(munRaw);
              });
              if (filteredMun.length > 0) return { type: 'FeatureCollection', features: filteredMun };
          }
          return null;
      }

      return provincesData;
  }, [appliedFilters, provincesData, districtsData, localLevelsData, districtWardsData]);

  // Labels to display on map
  const labelMarkers = useMemo(() => {
      if (!innerGeoJSONData || !innerGeoJSONData.features) return [];
      
      // Only show labels if we have a specific selection
      if (!appliedFilters.region) return [];

      return innerGeoJSONData.features.map((f: any, idx: number) => {
          const center = turf.centerOfMass(f);
          let name = getRegionName(f.properties);
          
          // For wards, show ward number
          if (appliedFilters.boundary === 'municipal') {
              name = f.properties.WARD || f.properties.ward || f.properties.Ward || name;
          }

          return {
              id: `${appliedFilters.boundary}-label-${idx}`,
              name,
              position: [center.geometry.coordinates[1], center.geometry.coordinates[0]] as [number, number]
          };
      });
  }, [innerGeoJSONData, appliedFilters]);

  useEffect(() => {
      if (!mapRef.current || !appliedFilters.region) return;

      if (selectedFeature) {
          const bbox = turf.bbox(selectedFeature);
          mapRef.current.fitBounds([
             [bbox[1], bbox[0]],
             [bbox[3], bbox[2]]
          ], { padding: [30, 30], maxZoom: 13 });
      } else if (!adminLoading) {
          // Fallback: use markers spatially filtered to this region
          if (spatiallyFilteredRiskAreas.length > 0) {
              const bounds = L.latLngBounds(spatiallyFilteredRiskAreas.map(r => [r.lat, r.lng]));
              mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
          } else if (appliedFilters.boundary === 'municipal') {
              toast.error("Local Level location not found.");
          }
      }
  }, [selectedFeature, appliedFilters, adminLoading, spatiallyFilteredRiskAreas]);


  const riskAreasFiltered = useMemo(() => {
     return spatiallyFilteredRiskAreas.filter(r => selectedRiskTypes.includes(r.riskType || 'Medium'));
  }, [spatiallyFilteredRiskAreas, selectedRiskTypes]);

  const typeOfDisasterCounts = useMemo(() => {
     const counts: Record<string, number> = {};
     spatiallyFilteredRiskAreas.forEach(r => {
        const type = r.typeOfDisaster;
        if (type && type.trim() !== '') {
           counts[type] = (counts[type] || 0) + 1;
        }
     });
     return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [spatiallyFilteredRiskAreas]);

  const riskAreaCounts = useMemo(() => {
     const low = spatiallyFilteredRiskAreas.filter(t => t.riskType === 'Low');
     const medium = spatiallyFilteredRiskAreas.filter(t => t.riskType === 'Medium');
     const high = spatiallyFilteredRiskAreas.filter(t => t.riskType === 'High');
     
     return {
         total: spatiallyFilteredRiskAreas.length,
         low,
         medium,
         high
     };
  }, [spatiallyFilteredRiskAreas]);

  useEffect(() => {
    const loadData = async () => {
        setAdminLoading(true);
        try {
            // Always fetch provinces and districts
            const [pRes, dRes] = await Promise.all([
                fetch(NEPAL_MAP_URLS.PROVINCE_OUTLINE),
                fetch(NEPAL_MAP_URLS.DISTRICT_OUTLINE)
            ]);
            
            if (!pRes.ok || !dRes.ok) throw new Error("Failed to fetch basic boundaries");
            
            const pData = await pRes.json();
            const dData = await dRes.json();
            setProvincesData(pData);
            setDistrictsData(dData);
        } catch (e) {
            console.error("Error loading administrative boundaries:", e);
        } finally {
            setAdminLoading(false);
        }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (appliedFilters.boundary === 'district' || appliedFilters.boundary === 'municipal') {
        if (!localLevelsData) {
            setAdminLoading(true);
            fetch(NEPAL_MAP_URLS.MUNICIPAL_OUTLINE)
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                    return r.json();
                })
                .then(data => {
                    setLocalLevelsData(data);
                    setAdminLoading(false);
                })
                .catch(e => {
                    console.error("Error loading local level data from " + NEPAL_MAP_URLS.MUNICIPAL_OUTLINE + ":", e);
                    setAdminLoading(false);
                });
        }
        
        // Find which district we are in to load wards
        let currentDistrict = '';
        if (appliedFilters.boundary === 'district') {
            currentDistrict = appliedFilters.region || '';
        } else if (appliedFilters.boundary === 'municipal' && appliedFilters.region) {
            // Find district for this municipal from locations lookup
            const loc = locations.find(l => normalizeName(l.municipal) === normalizeName(appliedFilters.region!));
            if (loc) currentDistrict = loc.district;
        }

        if (currentDistrict) {
            const distFile = currentDistrict.toLowerCase().replace(/\s+/g, '-');
            const url = `https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/wards/${distFile}.geojson`;
            
            fetch(url)
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                    return r.json();
                })
                .then(data => setDistrictWardsData(data))
                .catch(e => console.warn(`Wards for ${currentDistrict} not found at ${url}`));
        }
    }
  }, [appliedFilters.boundary, appliedFilters.region]);

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

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'risk_areas'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbAreas: RiskArea[] = [];
      snapshot.forEach((doc) => {
        dbAreas.push({ id: doc.id, ...doc.data() } as RiskArea);
      });
      setRiskAreas(dbAreas);
    }, (error) => {
      console.error('Error fetching risk areas:', error);
      toast.error('Error fetching risk areas: ' + error.message);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) setScreenType('mobile');
      else if (width < 1024) setScreenType('tablet');
      else setScreenType('desktop');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = screenType === 'mobile';
  const isTablet = screenType === 'tablet';

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!auth.currentUser) {
       toast.error("You must be logged in to upload data.");
       return;
    }

    if (file.name.toLowerCase().endsWith('.csv')) {
       Papa.parse(file, {
         header: true,
         skipEmptyLines: true,
         complete: async (results) => {
           await processRows(results.data as any[]);
         },
         error: (error) => {
           toast.error(`Error parsing file: ${(error as any).message}`);
         }
       });
    } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
       const reader = new FileReader();
       reader.onload = async (event) => {
          try {
             const data = new Uint8Array(event.target?.result as ArrayBuffer);
             const workbook = xlsx.read(data, { type: 'array' });
             const sheetName = workbook.SheetNames[0];
             const sheet = workbook.Sheets[sheetName];
             const rows = xlsx.utils.sheet_to_json(sheet);
             await processRows(rows);
          } catch(err) {
             toast.error(`Error parsing file: ${(err as any).message}`);
          }
       };
       reader.readAsArrayBuffer(file);
    } else {
       toast.error("Unsupported file type.");
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processRows = async (rows: any[]) => {
      let addedCount = 0;
      let errorsCount = 0;
      let duplicateCount = 0;
      
      // Use the snapshot of riskAreas that we already pulled locally to prevent dupes.
      const existingData = [...riskAreas];

      for (const row of rows) {
        const lat = parseFloat(row['Latitude (N)']);
        const lng = parseFloat(row['Longitude (E)']);
        
        if (isNaN(lat) || isNaN(lng) || !row['Province'] || !row['Risk Type']) {
          errorsCount++;
          continue;
        }

        const riskType = String(['Low', 'Medium', 'High'].includes(row['Risk Type']) ? row['Risk Type'] : 'Medium');
        const typeOfDisaster = String(row['Type of Disaster'] || '');
        const province = String(row['Province'] || '');
        const district = String(row['District'] || '');
        const municipal = String(row['Municipal Level'] || '');
        const wardNumber = String(row['Ward Number'] || '');
        const disasterLocation = String(row['Disaster Location'] || '');

        // Check against already submitted/existing to avoid duplicates
        const isDuplicate = existingData.some(a => 
           a.province === province &&
           a.district === district &&
           a.municipal === municipal &&
           a.wardNumber == wardNumber && // loose equality just in case of ints vs strings
           a.disasterLocation === disasterLocation &&
           Math.abs(a.lat - lat) < 0.0001 &&
           Math.abs(a.lng - lng) < 0.0001 &&
           a.typeOfDisaster === typeOfDisaster &&
           a.riskType === riskType
        );

        if (isDuplicate) {
           duplicateCount++;
           continue;
        }

        const area: Omit<RiskArea, 'id'> = {
          province,
          district,
          municipal,
          wardNumber,
          disasterLocation,
          lat,
          lng,
          typeOfDisaster,
          riskType: riskType as any,
          exposure: String(row['Exposure/Possible Impact/Risk Assessment'] || ''),
          previousDamageDetails: String(row['Details of Damage from previous Incident'] || ''),
          preparednessActions: String(row['Preparedness Actions Required for Possible Risk Reduction'] || ''),
          remarks: String(row['Remarks'] || ''),
          uploadedAt: Date.now(),
          uploaderId: user!.uid,
          uploadedByEmail: user!.email || 'unknown',
          lastUpdatedByEmail: user!.email || 'unknown',
          lastUpdatedTimestamp: Date.now()
        };

        try {
          const newDocRef = doc(collection(db, 'risk_areas'));
          await setDoc(newDocRef, area);
          existingData.push({ id: newDocRef.id, ...area });
          addedCount++;
        } catch(err: any) {
           console.error("setDoc failed:", err);
           try {
             handleFirestoreError(err, OperationType.WRITE, 'risk_areas');
           } catch (e: any) {
             toast.error('Upload Error: ' + e.message);
           }
           errorsCount++;
        }
      }
      
      if (duplicateCount > 0 && addedCount === 0) {
         toast.error(`Found ${duplicateCount} duplicate records. No new records were added.`);
      } else if (errorsCount > 0 || duplicateCount > 0) {
         toast.error(`Added ${addedCount} records. Ignored ${duplicateCount} duplicates and ${errorsCount} invalid rows.`);
      } else {
         toast.success(`Successfully uploaded ${addedCount} unique risk areas!`);
      }
  };

  const exportReport = () => {
     if (riskAreasFiltered.length === 0) {
        toast.error('No risk areas to export.');
        return;
     }

     const dataToExport = riskAreasFiltered.map(area => ({
        'Province': area.province,
        'District': area.district,
        'Municipal Level': area.municipal,
        'Ward Number': area.wardNumber,
        'Disaster Location': area.disasterLocation,
        'Type of Disaster': area.typeOfDisaster,
        'Risk Type': area.riskType,
        'Exposure/Possible Impact/Risk Assessment': area.exposure,
        'Details of Damage from previous Incident': area.previousDamageDetails,
        'Preparedness Actions Required for Possible Risk Reduction': area.preparednessActions,
        'Remarks': area.remarks,
        'Latitude': area.lat,
        'Longitude': area.lng,
     }));

     const worksheet = xlsx.utils.json_to_sheet(dataToExport);
     const workbook = xlsx.utils.book_new();
     xlsx.utils.book_append_sheet(workbook, worksheet, "Risk Areas");
     
     const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
     const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
     
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.setAttribute('download', 'Risk_Areas_Report.xlsx');
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const deleteFiltered = async () => {
    console.log("deleteFiltered called. filtered count:", riskAreasFiltered.length);
    if (riskAreasFiltered.length === 0) {
      toast.error('Nothing to delete - no records match current filters.');
      return;
    }
    
    // Superadmins can delete any. Admins can only delete their own.
    const recordsToDelete = isSuperAdmin ? riskAreasFiltered : riskAreasFiltered.filter(a => isAdmin && a.uploaderId === user?.uid);
    
    console.log("Bulk delete check:", { isSuperAdmin, isAdmin, userId: user?.uid, filteredCount: riskAreasFiltered.length, deletableCount: recordsToDelete.length });

    if (recordsToDelete.length === 0) {
      toast.error('No records found that you have permission to delete.');
      return;
    }

    const confirmMsg = isSuperAdmin 
      ? `Are you sure you want to delete ALL ${recordsToDelete.length} filtered records? This action CANNOT be undone.`
      : `Are you sure you want to delete ${recordsToDelete.length} filtered records that you uploaded?`;

    setConfirmModal({
      title: 'Bulk Delete Filtered',
      message: confirmMsg,
      onConfirm: async () => {
        const idsToDelete = recordsToDelete.map(a => a.id);
        await executeBulkDelete(idsToDelete);
        setConfirmModal(null);
      }
    });
  };

  const handleBulkDelete = async (e?: React.MouseEvent) => {
     if (e) {
        e.preventDefault();
        e.stopPropagation();
     }
     
     console.log("CRITICAL: handleBulkDelete triggered", { count: selectedRows.length, isSuperAdmin, isAdmin });
     
     if (selectedRows.length === 0) {
        toast.error('No rows selected.');
        return;
     }

     // SUPERADMINS can delete everything they select. 
     // Others are limited by our logical policy (admins only their own).
     let deletableIds: string[] = [];
     
     if (isSuperAdmin) {
        console.log("User is superadmin, allowing all selected IDs");
        deletableIds = [...selectedRows];
     } else {
        console.log("User restricted, filtering by uploaderId...");
        const recordsToProcess = riskAreas.filter(r => selectedRows.includes(r.id));
        deletableIds = recordsToProcess
           .filter(r => isAdmin && r.uploaderId === user?.uid)
           .map(r => r.id);
        console.log("Filtered deletable IDs:", deletableIds.length);
     }

     if (deletableIds.length === 0) {
        toast.error('You do not have permission to delete any of the selected records.');
        return;
     }

     const diff = selectedRows.length - deletableIds.length;
     const confirmMsg = diff > 0 
        ? `You have permission to delete ${deletableIds.length} of the ${selectedRows.length} selected records. Continue?`
        : `Are you sure you want to delete ${deletableIds.length} selected areas?`;

     setConfirmModal({
        title: 'Bulk Delete Selected',
        message: confirmMsg,
        onConfirm: async () => {
           console.log("Executing bulk delete for IDs:", deletableIds);
           await executeBulkDelete(deletableIds);
           setConfirmModal(null);
        }
     });
  };

   const executeBulkDelete = async (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      
      console.log(`Starting bulk delete for ${ids.length} records`);
      const loadingToastId = toast.loading(`Deleting ${ids.length} records...`);
      
      try {
          let deletedCount = 0;
          
          // Use batching for everything to handle potential large deletions
          const chunks = [];
          for (let i = 0; i < ids.length; i += 400) {
              chunks.push(ids.slice(i, i + 400));
          }
          
          for (const chunk of chunks) {
              const batch = writeBatch(db);
              chunk.forEach(id => {
                  batch.delete(doc(db, 'risk_areas', id));
              });
              await batch.commit();
              deletedCount += chunk.length;
              console.log(`Successfully committed batch: ${chunk.length} records`);
          }
          
          toast.dismiss(loadingToastId);
          toast.success(`Successfully deleted ${deletedCount} records.`);
          setSelectedRows([]);
      } catch (err: any) {
          toast.dismiss(loadingToastId);
          console.error("Bulk delete CRITICAL error:", err);
          
          let friendlyError = err.message;
          if (err.message?.includes('permission-denied')) {
             friendlyError = "Permission denied. You may only delete records you have permission for.";
          }
          
          toast.error('Bulk delete failed: ' + friendlyError);
      }
   };

  const handleDeleteRecord = async (id: string) => {
     const record = riskAreas.find(r => r.id === id);
     if (!record) return;

     const canDelete = isSuperAdmin || (isAdmin && record.uploaderId === user?.uid);
     if (!canDelete) {
        toast.error('You do not have permission to delete this record.');
        return;
     }

     try {
       await deleteDoc(doc(db, 'risk_areas', id));
       toast.success('Successfully deleted risk area.');
       setSelectedRows(prev => prev.filter(rId => rId !== id));
       setConfirmDeleteId(null);
     } catch (err: any) {
       try {
         handleFirestoreError(err, OperationType.DELETE, `risk_areas/${id}`);
       } catch (e: any) {
         toast.error('Error deleting area: ' + e.message);
       }
     }
  };

  const startEditing = (record: RiskArea) => {
     setEditingRowId(record.id);
     setEditFormData(record);
  };

  const saveEdit = async () => {
     if (!editingRowId) return;
     const record = riskAreas.find(r => r.id === editingRowId);
     if (!record) return;

     const canEdit = isSuperAdmin || (isAdmin && record.uploaderId === user?.uid);
     if (!canEdit) {
        toast.error('You do not have permission to edit this record.');
        return;
     }

     try {
       const updateData = {
         ...editFormData,
         lastUpdatedByEmail: user!.email || 'unknown',
         lastUpdatedTimestamp: Date.now()
       };
       await updateDoc(doc(db, 'risk_areas', editingRowId), updateData as any);
       toast.success('Record updated successfully.');
       setEditingRowId(null);
       setEditFormData({});
     } catch (err: any) {
       try {
         handleFirestoreError(err, OperationType.UPDATE, `risk_areas/${editingRowId}`);
       } catch (e: any) {
         toast.error('Error updating record: ' + e.message);
       }
     }
  };

  const cancelEdit = () => {
     setEditingRowId(null);
     setEditFormData({});
  };

  const toggleRowSelection = (id: string) => {
     setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const toggleAllSelections = () => {
     if (selectedRows.length === riskAreasFiltered.length) {
         setSelectedRows([]);
     } else {
         setSelectedRows(riskAreasFiltered.map(r => r.id));
     }
  };

  return (
    <>
     <div className={`fixed inset-0 bg-black/60 z-[100] flex items-center justify-center ${isFullscreen || isMobile ? 'p-0' : 'p-2 sm:p-6'} backdrop-blur-sm transition-all duration-300`}>
      <div className={`bg-white dark:bg-slate-900 shadow-2xl w-full h-full max-h-screen flex flex-col overflow-hidden relative ${isFullscreen || isMobile ? 'rounded-none' : 'rounded-2xl'}`}>
        <div className="flex justify-between items-center px-3 md:px-6 py-3 md:py-4 border-b border-gray-200 dark:border-slate-800 shrink-0 relative z-[1000]">
          <div className="flex items-center gap-2">
            {!isMobile && (
              <div>
                <h2 className="text-lg md:text-2xl font-serif font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Risk Map
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isSuperAdmin ? 'bg-purple-100 text-purple-700 border-purple-200' : isAdmin ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    {isSuperAdmin ? 'SUPERADMIN' : isAdmin ? 'ADMIN' : 'LOCAL USER'}
                  </span>
                </h2>
                <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400">Nepal Administrative Boundaries Visualizer</p>
              </div>
            )}
            {isMobile && (
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Risk Map
              </h2>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
             <div className="relative flex flex-col">
                 <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5" />
                    <input 
                        type="text"
                        placeholder={isMobile ? "Search..." : "Search Local Level..."}
                        className={`${isMobile ? 'w-32' : 'w-64'} pl-8 pr-1.5 sm:pr-12 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-all`}
                        value={tempSearch}
                        onChange={(e) => {
                            const val = e.target.value;
                            setTempSearch(val);
                            if (val.length > 1) {
                                const matched = locations.filter(l => 
                                    l.municipal.toLowerCase().includes(val.toLowerCase()) ||
                                    l.district.toLowerCase().includes(val.toLowerCase())
                                ).slice(0, 5);
                                setSearchSuggestions(matched);
                                setShowSuggestions(true);
                            } else {
                                setShowSuggestions(false);
                            }
                        }}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                              if (tempSearch.length > 0) {
                                 setAppliedFilters({ boundary: 'municipal', region: tempSearch });
                                 setShowSuggestions(false);
                              } else {
                                 setAppliedFilters({ boundary: 'province', region: null });
                                 setSelectedRegion(null);
                              }
                           }
                        }}
                    />
                    <button 
                        onClick={() => {
                            if (tempSearch.length > 0) {
                                setAppliedFilters({ boundary: 'municipal', region: tempSearch });
                            } else {
                                setAppliedFilters({ boundary: 'province', region: null });
                                setSelectedRegion(null);
                            }
                            setShowSuggestions(false);
                        }}
                        className="absolute right-2 px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 transition-colors hidden sm:block"
                    >
                        <Target className="w-3 h-3" />
                    </button>
                 </div>
                 
                 {showSuggestions && searchSuggestions.length > 0 && (
                     <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl z-[1001] max-h-64 overflow-y-auto overflow-x-hidden">
                        {searchSuggestions.map((loc, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setTempSearch(loc.municipal);
                                    setAppliedFilters({ boundary: 'municipal', region: loc.municipal });
                                    setShowSuggestions(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-50 dark:border-slate-700 last:border-0 transition-colors"
                            >
                                <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{loc.municipal}</div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">{loc.district}, {loc.province} Province</div>
                            </button>
                        ))}
                     </div>
                 )}
             </div>
             
             <div className="flex items-center gap-2">
               <button
                  onClick={exportReport}
                  className="hidden sm:flex items-center gap-2 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  title="Export Report"
               >
                  <Download className="w-4 h-4" />
                  Export
               </button>
               <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
               <button
                  onClick={() => fileInputRef.current?.click()}
                  className="hidden sm:flex items-center gap-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  title="Upload Extracted List"
               >
                  <Upload className="w-4 h-4" />
                  Upload
               </button>
             </div>
             <div className="relative">
               <button 
                 onClick={() => setViewMode(viewMode === 'map' ? 'table' : 'map')}
                 className={`hidden sm:flex items-center gap-2 border px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors ${viewMode === 'table' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200'}`}
               >
                 <Database className="w-3.5 h-3.5" /> 
                 {viewMode === 'map' ? 'Database View' : 'Map View'}
               </button>
             </div>
             
             {/* Custom Layers Dropdown */}
             <div className="relative group">
               <button 
                 onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
                 className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-2 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 group"
               >
                 <Layers className={`w-5 h-5 ${activeMapLayer === 'outline' ? 'text-rose-500' : 'text-gray-600 dark:text-gray-400'}`} />
                 <span className="hidden sm:inline text-xs font-bold text-gray-700 dark:text-gray-300">Map Layers</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${layerDropdownOpen ? 'rotate-180' : ''}`} />
               </button>
               
               {layerDropdownOpen && (
                 <>
                   <div className="fixed inset-0 z-40" onClick={() => setLayerDropdownOpen(false)}></div>
                   <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl rounded-xl z-50 overflow-hidden text-sm">
                     <div className="flex flex-col">
                       {[
                         { 
                           id: 'outline', 
                           name: 'Outline', 
                           desc: 'A national political and administrative boundary layer.'
                         },
                         { 
                           id: 'osm', 
                           name: 'OpenStreetMap', 
                           desc: 'Standard OpenStreetMap layer with rich geographic data.'
                         },
                         { 
                           id: 'light', 
                           name: 'Mapbox Light', 
                           desc: 'Minimal and elegant map view for better data visibility.'
                         },
                         { 
                           id: 'roads', 
                           name: 'Mapbox Roads', 
                           desc: 'High contrast map view highlighting the road network.'
                         },
                         { 
                           id: 'satellite', 
                           name: 'Mapbox Satellite', 
                           desc: 'High-resolution satellite imagery for real-world context.'
                         }
                       ].map(layer => (
                         <button
                           key={layer.id}
                           onClick={() => {
                             setActiveMapLayer(layer.id);
                             setLayerDropdownOpen(false);
                           }}
                           className={`p-3 border-b last:border-0 border-gray-100 dark:border-slate-800 transition-all flex items-start gap-2 text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 ${activeMapLayer === layer.id ? 'bg-rose-500/10 dark:bg-rose-500/20' : ''}`}
                         >
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                 <span className={`text-[11px] font-bold ${activeMapLayer === layer.id ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-gray-100'}`}>{layer.name}</span>
                                 {activeMapLayer === layer.id && <div className="w-2 h-2 rounded-full bg-rose-500"></div>}
                              </div>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">{layer.desc}</p>
                           </div>
                         </button>
                       ))}
                     </div>
                   </div>
                 </>
               )}
             </div>

             <div className="hidden sm:flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-lg mr-2">
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

             {/* Toggles removed */}
             <button onClick={toggleFullscreen} className="hidden sm:block p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                {isFullscreen ? <Minimize className="w-5 h-5 text-gray-500 dark:text-gray-400" /> : <Maximize className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
             </button>
             <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
             </button>
          </div>
        </div>
        
        <div className="flex-1 bg-gray-100 dark:bg-slate-800 relative flex overflow-hidden">
            {/* Left Side Panel - Responsive */}
            <AnimatePresence>
              {isSidePanelOpen && (
                <motion.div 
                  initial={isMobile ? { y: '100%' } : { x: -320 }}
                  animate={isMobile ? { y: 0 } : { x: 0 }}
                  exit={isMobile ? { y: '100%' } : { x: -320 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className={`${isMobile ? 'fixed inset-x-0 bottom-0 z-[600] h-[70vh] rounded-t-2xl border-t' : 'absolute left-0 top-0 bottom-0 w-[320px] border-r z-[500] shadow-2xl'} bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 flex flex-col`}
                >
                  <div className={`p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50 ${isMobile ? 'rounded-t-2xl' : ''}`}>
                     <div>
                       <h3 className="font-bold text-gray-900 dark:text-white text-lg">Risky Zones</h3>
                       <p className="text-[10px] font-black uppercase tracking-widest text-[#0B3C5D] dark:text-blue-400 mt-0.5">
                         {selectedRiskLevel ? `${selectedRiskLevel} Risk Areas` : 'Filtered areas'} • {(selectedRiskLevel ? riskAreaCounts[selectedRiskLevel.toLowerCase() as keyof typeof riskAreaCounts] : riskAreasFiltered).length} locations
                       </p>
                     </div>
                     <button 
                       onClick={() => setIsSidePanelOpen(false)}
                       className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                     >
                       {isMobile ? <X className="w-6 h-6 text-gray-500" /> : <Minimize className="w-4 h-4 text-gray-500" />}
                     </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                     {(selectedRiskLevel ? riskAreaCounts[selectedRiskLevel.toLowerCase() as keyof typeof riskAreaCounts] : riskAreasFiltered).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-50">
                           <ShieldAlert className="w-12 h-12 text-gray-300 mb-2" />
                           <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed">No risky zones found <br/> for this selection.</p>
                        </div>
                     ) : (
                        (selectedRiskLevel ? riskAreaCounts[selectedRiskLevel.toLowerCase() as keyof typeof riskAreaCounts] : riskAreasFiltered).map((item, idx: number) => (
                          <motion.button
                             key={item.id}
                             initial={{ opacity: 0, y: 5 }}
                             animate={{ opacity: 1, y: 0 }}
                             transition={{ delay: idx * 0.01 }}
                             onClick={() => {
                                setSelectedRiskAreaId(item.id);
                                if (isMobile) setIsSidePanelOpen(false);
                                if (mapRef.current) {
                                   mapRef.current.setView([item.lat, item.lng], 14);
                                }
                             }}
                             className={`w-full text-left p-3 rounded-xl border transition-all group overflow-hidden ${selectedRiskAreaId === item.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md ring-1 ring-blue-500' : 'border-gray-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-slate-800/50 shadow-sm'}`}
                          >
                             <div className="flex justify-between items-start mb-2">
                               <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${item.riskType === 'Low' ? 'bg-green-100 text-green-700' : item.riskType === 'High' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                 {item.riskType} Risk
                               </span>
                               <span className="text-[9px] font-bold text-gray-400 group-hover:text-blue-500 transition-colors">{item.district}</span>
                             </div>
                             <h4 className="text-[11px] font-bold text-gray-900 dark:text-white leading-tight mb-1">{item.municipal} • Ward {item.wardNumber}</h4>
                             <div className="space-y-1">
                               <div className="flex items-center gap-1.5 flex-wrap">
                                 <div className="p-1 bg-red-50 dark:bg-red-900/20 rounded">
                                   <ShieldAlert className="w-3 h-3 text-red-500" />
                                 </div>
                                 <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">{item.typeOfDisaster}</span>
                               </div>
                               <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 italic">{item.disasterLocation}</p>
                             </div>
                          </motion.button>
                        ))
                     )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Desktop Panel Edge Toggle Button */}
            {!isMobile && (
              <button 
                onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                className={`absolute ${isSidePanelOpen ? 'left-[320px]' : 'left-0'} top-1/2 -translate-y-1/2 w-8 h-12 bg-white dark:bg-slate-900 border-y border-r border-gray-200 dark:border-slate-800 rounded-r-lg flex items-center justify-center shadow-md z-[501] group transition-all hover:bg-gray-50 dark:hover:bg-slate-800`}
              >
                 <motion.div animate={{ rotate: isSidePanelOpen ? 0 : 180 }}>
                   <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-500 -rotate-90" />
                 </motion.div>
              </button>
            )}

           {viewMode === 'map' ? (
              <div className="flex-1 relative">
                {/* Mobile FABs */}
                {isMobile && (
                  <div className="absolute top-4 right-4 z-[450] flex flex-col gap-3">
                    <button 
                      onClick={() => setIsFilterSheetOpen(true)}
                      className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300"
                    >
                      <Filter className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setIsSidePanelOpen(true)}
                      className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300"
                    >
                      <List className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setIsStatsSheetOpen(true)}
                      className="w-10 h-10 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white"
                    >
                      <BarChart2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <MapContainer 
             ref={mapRef}
             center={[28.3949, 84.1240]} 
             zoom={7} 
             style={{ height: '100%', width: '100%', background: '#f1f5f9' }}
             maxBounds={[[26, 79], [31, 89]]}
             minZoom={6}
             maxZoom={18}
           >
             <BoundsTracker setBounds={setMapBounds} />
             
             {/* Map Layers */}
             {activeMapLayer === 'light' && (
               <TileLayer
                 attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                 url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
               />
             )}
             {activeMapLayer === 'osm' && (
               <TileLayer
                 attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
               />
             )}
             {activeMapLayer === 'roads' && (
               <TileLayer
                 attribution='&copy; Mapbox'
                 url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
               />
             )}
             {activeMapLayer === 'satellite' && (
               <TileLayer
                 attribution='&copy; Esri'
                 url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
               />
             )}
             {activeMapLayer === 'outline' && null}

             {/* Overlays removed */}
             
             {/* Boundaries Layers */}
             {outerGeoJSONData && (
                <GeoJSON 
                   key={`outer-admin-layer-${appliedFilters.boundary}-${appliedFilters.region}`}
                   data={outerGeoJSONData as any}
                   style={() => ({
                       color: '#0d6b4a',
                       weight: 3,
                       fillOpacity: 0.0,
                       interactive: false
                   })}
                />
             )}
             
             {/* Nepal Country Outline (Highest priority dark green) */}
             {nepalGeoJSON && (
                <GeoJSON 
                  data={nepalGeoJSON}
                  style={{
                    color: '#0d6b4a',
                    weight: 2,
                    fillOpacity: 0,
                    interactive: false
                  }}
                />
             )}
             
             {innerGeoJSONData && (
                <GeoJSON 
                   key={`inner-admin-layer-${appliedFilters.boundary}-${appliedFilters.region || 'all'}`}
                   data={innerGeoJSONData as any}
                   style={(feature: any) => {
                       let name = getRegionName(feature.properties);
                       const nameStr = name.toLowerCase();
                       const searchStr = appliedFilters.region ? appliedFilters.region.toLowerCase() : '';
                       const isSelected = !!searchStr && (nameStr.includes(searchStr) || searchStr.includes(nameStr));
                       
                       let strokeColor = '#0d6b4a';
                       let weight = isSelected ? 3 : 1;
                       
                       if (appliedFilters.boundary === 'district') {
                         strokeColor = '#0d6b4a';
                         weight = isSelected ? 2.5 : 0.8;
                       }
                       if (appliedFilters.boundary === 'municipal') {
                         strokeColor = '#0d6b4a';
                         weight = isSelected ? 2 : 0.5;
                       }

                       return {
                           color: strokeColor,
                           weight: weight,
                           fillOpacity: isSelected ? 0.05 : 0.01,
                           fillColor: strokeColor,
                           smoothFactor: 1.5
                       };
                   }}
                   onEachFeature={(feature, layer) => {
                       if (feature.properties) {
                          let name = getRegionName(feature.properties);
                          if (appliedFilters.boundary === 'municipal') {
                              const ward = feature.properties.WARD || feature.properties.ward || feature.properties.Ward;
                              if (ward) name = `Ward ${ward}`;
                          }
                          layer.bindTooltip(String(name), { sticky: true });
                          layer.on('click', (e: any) => {
                               L.DomEvent.stopPropagation(e);
                               setSelectedRegion(name === selectedRegion ? null : name);
                               // Only drill down if we aren't at municipal level
                               if (appliedFilters.boundary !== 'municipal') {
                                  setAppliedFilters({ boundary: appliedFilters.boundary === 'province' ? 'district' : 'municipal', region: name });
                               }
                          });
                       }
                   }}
                />
             )}

             {/* Dynamic Labels for Districts/Local Levels */}
             {labelMarkers.map(label => (
                <Marker 
                  key={label.id} 
                  position={label.position} 
                  icon={new L.DivIcon({
                    html: `<div style="font-size: ${appliedFilters.boundary === 'municipal' ? '12px' : '10px'}; font-weight: 800; color: #111827; letter-spacing: 0.02em; text-transform: uppercase; text-shadow: 0 0 2px white; text-align: center; white-space: nowrap;">${label.name}</div>`,
                    className: 'boundary-label-icon',
                    iconSize: [120, 20],
                    iconAnchor: [60, 10]
                  })}
                  interactive={false}
                />
             ))}

             {/* Faded Masking Outer Area */}
             {maskCoordinates && (
                <Polygon 
                  positions={maskCoordinates} 
                  pathOptions={{ color: 'transparent', fillColor: '#f1f5f9', fillOpacity: 0.95 }} 
                  interactive={false}
                />
             )}
             
             {/* Static Province Labels (Always show when no specific selection is active) */}
             {!appliedFilters.region && [
                { name: 'SUDURPASCHIM', lat: 29.3, lng: 81.0 },
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
                    html: `<div style="font-size: 12px; font-weight: 1000; color: #0f172a; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap;">${prov.name}</div>`,
                    className: 'province-label-icon',
                    iconSize: [140, 20],
                    iconAnchor: [70, 10]
                  })}
                  interactive={false}
                />
             ))}
             
             {/* Risk Area Markers */}
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
               {riskAreasFiltered.map((item, idx) => {
                   let fillColor = '#f97316'; // Medium - Orange
                   if (item.riskType === 'High') fillColor = '#ef4444'; // High - Red
                   if (item.riskType === 'Low') fillColor = '#22c55e'; // Low - Green
                   
                   return (
                     <Marker 
                        key={`${item.id || idx}-${selectedRiskAreaId === item.id}`}
                        position={[item.lat, item.lng]}
                        eventHandlers={{
                           click: () => setSelectedRiskAreaId(item.id),
                           popupclose: () => setSelectedRiskAreaId(null),
                           add: (e) => {
                              if (selectedRiskAreaId === item.id) {
                                 e.target.openPopup();
                              }
                           }
                        }}
                        icon={new L.DivIcon({
                            html: `<div style="background-color: ${fillColor}; width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid ${selectedRiskAreaId === item.id ? '#3b82f6' : '#fff'}; box-shadow: 0 1px 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; transform: ${selectedRiskAreaId === item.id ? 'scale(1.2)' : 'scale(1)'}; transition: all 0.2s; z-index: ${selectedRiskAreaId === item.id ? 1000 : 1};"></div>`,
                            className: 'scatter-dot-icon',
                            iconSize: [22, 22],
                            iconAnchor: [11, 11]
                        })}
                     >
                       <Popup className="rounded-lg">
                          <div className="max-w-[250px] max-h-[300px] overflow-y-auto pr-2">
                             <div className="flex justify-between items-start mb-2">
                               <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${item.riskType === 'Low' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : item.riskType === 'High' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200'}`}>{item.riskType || 'Unknown'} Risk</span>
                             </div>
                             
                             <div className="space-y-2 text-xs">
                                <div><strong className="text-gray-900 dark:text-gray-100">Local Level:</strong> <span className="text-gray-700 dark:text-gray-300">{item.municipal || '-'}</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">District:</strong> <span className="text-gray-700 dark:text-gray-300">{item.district || '-'}</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">Province:</strong> <span className="text-gray-700 dark:text-gray-300">{item.province || '-'} Province</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">Ward Number:</strong> <span className="text-gray-700 dark:text-gray-300">{item.wardNumber || '-'}</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">Type of Disaster:</strong> <span className="text-gray-700 dark:text-gray-300">{item.typeOfDisaster || '-'}</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">Risk Type:</strong> <span className="text-gray-700 dark:text-gray-300">{item.riskType || '-'}</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">Disaster Location:</strong> <span className="text-gray-700 dark:text-gray-300">{item.disasterLocation || '-'}</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">Exposure/Possible Impact:</strong> <span className="text-gray-700 dark:text-gray-300">{item.exposure || '-'}</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">Details of Damage:</strong> <span className="text-gray-700 dark:text-gray-300">{item.previousDamageDetails || '-'}</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">Preparedness Actions:</strong> <span className="text-gray-700 dark:text-gray-300">{item.preparednessActions || '-'}</span></div>
                                <div><strong className="text-gray-900 dark:text-gray-100">Remarks:</strong> <span className="text-gray-700 dark:text-gray-300">{item.remarks || '-'}</span></div>
                                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-slate-800 flex justify-end">
                                   {confirmDeleteId === item.id ? (
                                      <div className="flex items-center gap-2">
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteRecord(item.id); }}
                                            className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                                         >
                                            Confirm
                                         </button>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold"
                                         >
                                            Cancel
                                         </button>
                                      </div>
                                   ) : (
                                      <button 
                                         onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteId(item.id);
                                         }}
                                         className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded text-[10px] font-bold transition-colors"
                                      >
                                         <Trash className="w-3 h-3" />
                                         Delete Record
                                      </button>
                                   )}
                                </div>
                             </div>
                          </div>
                       </Popup>
                       <Tooltip sticky direction="top">
                           <span className="font-bold">{item.municipal}</span> - {item.typeOfDisaster} ({item.riskType} Risk)
                       </Tooltip>
                     </Marker>
                   );
               })}
             </MarkerClusterGroup>
           </MapContainer>

            <div className={`absolute top-4 ${isMobile ? 'left-4 right-4 z-[450]' : 'right-4 z-[400] w-[240px]'} flex flex-col gap-3 transition-all`}>
                {/* Advanced Filters Card - Collapsible on Mobile */}
                <AnimatePresence>
                  {(!isMobile || isFilterSheetOpen) && (
                    <motion.div 
                      initial={isMobile ? { y: '100%' } : { opacity: 0, y: -20 }}
                      animate={isMobile ? { y: 0 } : { opacity: 1, y: 0 }}
                      exit={isMobile ? { y: '100%' } : { opacity: 0, y: -20 }}
                      className={`${isMobile ? 'fixed inset-x-0 bottom-0 z-[650] h-[80vh] rounded-t-3xl border-t' : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800'} overflow-hidden flex flex-col bg-white dark:bg-slate-900`}
                    >
                      <div className={`p-4 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0 ${isMobile ? 'rounded-t-3xl border-b' : ''}`}>
                        <h3 className="font-bold text-[#1e5eba] text-lg">Map Filters</h3>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={resetFilters}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-400"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          {isMobile && (
                            <button onClick={() => setIsFilterSheetOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-500">
                              <X className="w-6 h-6" />
                            </button>
                          )}
                        </div>
                      </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-100 dark:border-slate-800 px-3 gap-4 shrink-0 bg-white dark:bg-slate-900">
                    <button 
                      onClick={() => setActiveFilterTab('location')}
                      className={`pb-2 px-1 transition-all relative ${activeFilterTab === 'location' ? 'text-[#e15462]' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Target className="w-5 h-5" />
                      {activeFilterTab === 'location' && (
                        <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-1 bg-[#e15462] rounded-t-full" />
                      )}
                    </button>
                    <button 
                      onClick={() => setActiveFilterTab('hazard')}
                      className={`pb-2 px-1 transition-all relative ${activeFilterTab === 'hazard' ? 'text-[#e15462]' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <AlertTriangle className="w-5 h-5" />
                      {activeFilterTab === 'hazard' && (
                        <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-1 bg-[#e15462] rounded-t-full" />
                      )}
                    </button>
                    <button 
                      onClick={() => setActiveFilterTab('history')}
                      className={`pb-2 px-1 transition-all relative ${activeFilterTab === 'history' ? 'text-[#e15462]' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Clock className="w-5 h-5" />
                      {activeFilterTab === 'history' && (
                        <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-1 bg-[#e15462] rounded-t-full" />
                      )}
                    </button>
                  </div>

                  <div className="p-3 overflow-y-auto max-h-[50vh] custom-scrollbar bg-white dark:bg-slate-900">
                    {activeFilterTab === 'location' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsLocationPanelOpen(!isLocationPanelOpen)}>
                          <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">Location</span>
                          {isLocationPanelOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </div>
                        
                        <AnimatePresence>
                          {isLocationPanelOpen && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="space-y-4 overflow-hidden"
                            >
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Province</label>
                                <div className="relative">
                                  <select 
                                    className="w-full bg-transparent border-b border-gray-200 dark:border-slate-800 py-1 focus:border-[#e15462] focus:outline-none text-xs appearance-none cursor-pointer pr-5 text-gray-700 dark:text-gray-300 transition-colors"
                                    value={tempProvince}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setTempProvince(val);
                                      setTempDistrict('');
                                      setTempMunicipality('');
                                    }}
                                  >
                                    <option value="">All Provinces</option>
                                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </div>

                              {tempProvince && (
                                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">District</label>
                                  <div className="relative">
                                    <select 
                                      className="w-full bg-transparent border-b border-gray-200 dark:border-slate-800 py-1 focus:border-[#e15462] focus:outline-none text-xs appearance-none cursor-pointer pr-5 text-gray-700 dark:text-gray-300 transition-colors"
                                      value={tempDistrict}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTempDistrict(val);
                                        setTempMunicipality('');
                                      }}
                                    >
                                      <option value="">All Districts</option>
                                      {getDistrictsByProvince(tempProvince).map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  </div>
                                </motion.div>
                              )}

                              {tempDistrict && (
                                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Local Level</label>
                                  <div className="relative">
                                    <select 
                                      className="w-full bg-transparent border-b border-gray-200 dark:border-slate-800 py-1 focus:border-[#e15462] focus:outline-none text-xs appearance-none cursor-pointer pr-5 text-gray-700 dark:text-gray-300 transition-colors"
                                      value={tempMunicipality}
                                      onChange={(e) => setTempMunicipality(e.target.value)}
                                    >
                                      <option value="">All Local Levels</option>
                                      {getMunicipalsByDistrict(tempDistrict).map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  </div>
                                </motion.div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {activeFilterTab === 'hazard' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsHazardPanelOpen(!isHazardPanelOpen)}>
                          <span className="font-bold text-gray-700 dark:text-gray-200 text-xs">Type of Disaster</span>
                          {isHazardPanelOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </div>

                        <AnimatePresence>
                          {isHazardPanelOpen && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-3 pt-1">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select disaster type</label>
                                  <div className="relative">
                                    <select 
                                      className="w-full bg-transparent border-b border-gray-200 dark:border-slate-800 py-1 focus:border-[#e15462] focus:outline-none text-xs appearance-none cursor-pointer pr-5 text-gray-700 dark:text-gray-300 transition-colors"
                                      value={tempDisasterType}
                                      onChange={(e) => setTempDisasterType(e.target.value)}
                                    >
                                      <option value="">Select type of disaster</option>
                                      {typeOfDisasterCounts.map(([type]) => (
                                        <option key={type} value={type}>{type}</option>
                                      ))}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {activeFilterTab === 'history' && (
                       <div className="text-center py-8 text-gray-400 italic text-sm">
                         History filters coming soon.
                       </div>
                    )}

                    <div className="mt-4">
                      <button 
                        onClick={handleFilterSubmit}
                        className="w-full bg-[#1e5eba] hover:bg-[#164a95] text-white font-bold py-2 rounded shadow-md active:scale-95 transition-all text-xs"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Statistics moved to bottom left */}
            {/* Statistics and Legend - Responsive */}
            <div className={`${isMobile ? 'fixed bottom-20 left-4 right-4' : 'absolute bottom-4 left-4 w-[280px]'} z-[400] flex flex-col gap-3 transition-colors`}>
              <AnimatePresence>
                {(!isMobile || isStatsSheetOpen) && (
                  <motion.div 
                    initial={isMobile ? { y: '100%', opacity: 0 } : { x: -20, opacity: 0 }}
                    animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
                    exit={isMobile ? { y: '100%', opacity: 0 } : { x: -20, opacity: 0 }}
                    className={`${isMobile ? 'fixed inset-x-0 bottom-0 z-[700] h-[40vh] rounded-t-3xl border-t bg-white dark:bg-slate-900 p-6' : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl shadow-lg border border-gray-100 dark:border-slate-800 p-4'}`}
                  >
                     {isMobile && (
                       <div className="flex justify-between items-center mb-6">
                         <h3 className="font-bold text-gray-900 dark:text-white text-lg">Risk Statistics</h3>
                         <button onClick={() => setIsStatsSheetOpen(false)}><X className="w-6 h-6 text-gray-500" /></button>
                       </div>
                     )}
                     <div 
                       className="text-[13px] font-bold text-gray-500 uppercase tracking-tight mb-2 cursor-pointer hover:text-blue-500 transition-colors flex items-center gap-2"
                       onClick={() => {
                         setSelectedRiskLevel(null);
                         setIsSidePanelOpen(true);
                         setSelectedRiskTypes(['Low', 'Medium', 'High']);
                         if (isMobile) setIsStatsSheetOpen(false);
                       }}
                     >
                       RISK AREAS ({riskAreaCounts.total})
                       <span className="text-[10px] lowercase font-normal bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded italic">click for all</span>
                     </div>
                     <div className="flex gap-4 items-baseline">
                        <div 
                          className="flex items-baseline gap-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 p-1 rounded transition-colors" 
                          onClick={() => {
                            setSelectedRiskLevel('Low');
                            setIsSidePanelOpen(true);
                            setSelectedRiskTypes(['Low']);
                            if (isMobile) setIsStatsSheetOpen(false);
                          }}
                        >
                           <span className="text-xl font-bold font-mono text-[#22c55e]">{riskAreaCounts.low.length}</span>
                           <span className="text-sm font-bold text-[#22c55e]">Low</span>
                        </div>
                        <div 
                          className="flex items-baseline gap-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 p-1 rounded transition-colors" 
                          onClick={() => {
                            setSelectedRiskLevel('Medium');
                            setIsSidePanelOpen(true);
                            setSelectedRiskTypes(['Medium']);
                            if (isMobile) setIsStatsSheetOpen(false);
                          }}
                        >
                           <span className="text-xl font-bold font-mono text-[#f97316]">{riskAreaCounts.medium.length}</span>
                           <span className="text-sm font-bold text-[#f97316]">Medium</span>
                        </div>
                        <div 
                          className="flex items-baseline gap-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 p-1 rounded transition-colors" 
                          onClick={() => {
                            setSelectedRiskLevel('High');
                            setIsSidePanelOpen(true);
                            setSelectedRiskTypes(['High']);
                            if (isMobile) setIsStatsSheetOpen(false);
                          }}
                        >
                           <span className="text-xl font-bold font-mono text-[#ef4444]">{riskAreaCounts.high.length}</span>
                           <span className="text-sm font-bold text-[#ef4444]">High</span>
                        </div>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

           {/* Map Legend - Hidden on mobile, accessible via Stats on mobile */}
           {!isMobile && (
             <div className="absolute bottom-4 right-4 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-3 transition-colors">
                <span className="font-bold text-xs uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-2 block border-b border-gray-100 dark:border-slate-800 pb-2 flex justify-between items-center">
                   Risk Type
                   {selectedRiskTypes.length < 3 && (
                      <button onClick={() => setSelectedRiskTypes(['Low', 'Medium', 'High'])} className="text-[10px] text-blue-500 hover:underline normal-case">Reset</button>
                   )}
                </span>
                <div className="flex flex-col gap-2">
                   <div 
                      className={`flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 p-1 -m-1 rounded transition-colors ${!selectedRiskTypes.includes('Low') ? 'opacity-40 grayscale' : ''}`}
                      onClick={() => setSelectedRiskTypes(prev => {
                          if (prev.length === 3) return ['Low'];
                          const next = prev.includes('Low') ? prev.filter(r => r !== 'Low') : [...prev, 'Low'];
                          return next.length === 0 ? ['Low', 'Medium', 'High'] : next;
                      })}
                   >
                      <div className="w-3 h-3 rounded-full bg-[#22c55e] border border-white dark:border-slate-800 shadow-sm"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-300">Low Risk</span>
                   </div>
                   <div 
                      className={`flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 p-1 -m-1 rounded transition-colors ${!selectedRiskTypes.includes('Medium') ? 'opacity-40 grayscale' : ''}`}
                      onClick={() => setSelectedRiskTypes(prev => {
                          if (prev.length === 3) return ['Medium'];
                          const next = prev.includes('Medium') ? prev.filter(r => r !== 'Medium') : [...prev, 'Medium'];
                          return next.length === 0 ? ['Low', 'Medium', 'High'] : next;
                      })}
                   >
                      <div className="w-3 h-3 rounded-full bg-[#f97316] border border-white dark:border-slate-800 shadow-sm"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-300">Medium Risk</span>
                   </div>
                   <div 
                      className={`flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 p-1 -m-1 rounded transition-colors ${!selectedRiskTypes.includes('High') ? 'opacity-40 grayscale' : ''}`}
                      onClick={() => setSelectedRiskTypes(prev => {
                          if (prev.length === 3) return ['High'];
                          const next = prev.includes('High') ? prev.filter(r => r !== 'High') : [...prev, 'High'];
                          return next.length === 0 ? ['Low', 'Medium', 'High'] : next;
                      })}
                   >
                      <div className="w-3 h-3 rounded-full bg-[#ef4444] border border-white dark:border-slate-800 shadow-sm"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-300">High Risk</span>
                   </div>
                   <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-100 dark:border-slate-800">
                      <div className="w-4 h-4 rounded-full bg-[#334155] border border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[8px] font-bold text-white">#</div>
                      <span className="text-xs text-gray-600 dark:text-gray-300">Multiple Areas</span>
                   </div>
                </div>
             </div>
           )}
           
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
                             {listPopup.type === 'risk_area' && (
                                <>
                                  <div className="flex justify-between items-start mb-1">
                                     <span className="font-bold text-gray-900 dark:text-white">{item.municipal} - Ward {item.wardNumber}</span>
                                     <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${item.riskType === 'Low' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : item.riskType === 'High' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200'}`}>{item.riskType} Risk</span>
                                  </div>
                                  <div className="space-y-1 mt-2 text-xs">
                                     <div><strong className="text-gray-700 dark:text-gray-300">Disaster Location:</strong> {item.disasterLocation || '-'}</div>
                                     <div><strong className="text-gray-700 dark:text-gray-300">Type of Disaster:</strong> {item.typeOfDisaster || '-'}</div>
                                     <div><strong className="text-gray-700 dark:text-gray-300">Exposure/Impact:</strong> {item.exposure || '-'}</div>
                                     <div><strong className="text-gray-700 dark:text-gray-300">Previous Damage:</strong> {item.previousDamageDetails || '-'}</div>
                                     <div><strong className="text-gray-700 dark:text-gray-300">Preparedness Actions:</strong> {item.preparednessActions || '-'}</div>
                                     <div><strong className="text-gray-700 dark:text-gray-300">Remarks:</strong> {item.remarks || '-'}</div>
                                     <div className="pt-2 mt-2 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                                        <button 
                                           onClick={() => handleDeleteRecord(item.id)}
                                           className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 rounded-lg text-xs font-bold transition-colors"
                                        >
                                           <Trash className="w-3.5 h-3.5" />
                                           Delete Record
                                        </button>
                                     </div>
                                  </div>
                                </>
                             )}
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           )}
           </div>
           ) : (
              <div className="absolute inset-0 bg-white dark:bg-slate-900 flex flex-col p-4 md:p-6 text-sm overflow-hidden text-gray-800 dark:text-gray-200">
                 <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                       <Database className="w-5 h-5 text-indigo-500" />
                       Risk Areas Database <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 py-0.5 px-2 rounded-full text-xs">{riskAreasFiltered.length}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                       <button onClick={toggleAllSelections} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition border border-gray-200 dark:border-slate-700">
                          {selectedRows.length === riskAreasFiltered.length ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
                          Select All
                       </button>
                       {selectedRows.length > 0 ? (
                          <button 
                            id="bulk-delete-btn"
                            onClick={(e) => handleBulkDelete(e)} 
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-lg active:scale-95 cursor-pointer"
                          >
                             <Trash className="w-4 h-4" />
                             Delete Selected ({selectedRows.length})
                          </button>
                       ) : riskAreasFiltered.length > 0 && (
                          <button 
                            onClick={deleteFiltered} 
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition border border-orange-200 dark:border-orange-800"
                          >
                             <Trash className="w-3.5 h-3.5" />
                             Delete All Filtered ({riskAreasFiltered.length})
                          </button>
                       )}
                    </div>
                 </div>

                 <div className="flex-1 overflow-auto border border-gray-200 dark:border-slate-700 rounded-xl relative shadow-sm">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                       <thead className="bg-gray-50 dark:bg-slate-800/80 backdrop-blur sticky top-0 z-10 shadow-sm border-b border-gray-200 dark:border-slate-700">
                          <tr className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                             <th className="px-4 py-3 font-bold w-12 text-center border-r border-gray-200 dark:border-slate-700"></th>
                             <th className="px-4 py-3 font-bold">Area</th>
                             <th className="px-4 py-3 font-bold">Disaster</th>
                             <th className="px-4 py-3 font-bold">Risk Level</th>
                             <th className="px-4 py-3 font-bold text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                          {riskAreasFiltered.map(area => (
                             <tr key={area.id} className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors ${selectedRows.includes(area.id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                                <td className="px-4 py-3 text-center border-r border-gray-100 dark:border-slate-800">
                                   <div 
                                      className={`w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-colors ${selectedRows.includes(area.id) ? 'bg-indigo-500' : 'border border-gray-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'}`}
                                      onClick={() => toggleRowSelection(area.id)}
                                   >
                                      {selectedRows.includes(area.id) && <Check className="w-3 h-3 text-white" />}
                                   </div>
                                </td>
                                <td className="px-4 py-3">
                                   <div className="font-semibold text-gray-900 dark:text-gray-100">{area.municipal} - Ward {area.wardNumber}</div>
                                   <div className="text-xs text-gray-500 dark:text-gray-400">{area.district}, {area.province}</div>
                                   {area.disasterLocation && <div className="text-[10px] mt-0.5 text-gray-400 dark:text-gray-500 max-w-xs truncate" title={area.disasterLocation}>{area.disasterLocation}</div>}
                                </td>
                                <td className="px-4 py-3">
                                   {editingRowId === area.id ? (
                                      <input 
                                        type="text" 
                                        value={editFormData.typeOfDisaster || ''}
                                        onChange={(e) => setEditFormData({...editFormData, typeOfDisaster: e.target.value})}
                                        className="w-full text-xs px-2 py-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                                      />
                                   ) : (
                                      <span className="text-gray-700 dark:text-gray-300 font-medium">{area.typeOfDisaster}</span>
                                   )}
                                </td>
                                <td className="px-4 py-3">
                                   {editingRowId === area.id ? (
                                      <select 
                                        value={editFormData.riskType || 'Medium'}
                                        onChange={(e) => setEditFormData({...editFormData, riskType: e.target.value as any})}
                                        className="w-full text-xs px-2 py-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner appearance-none"
                                      >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                      </select>
                                   ) : (
                                      <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${area.riskType === 'Low' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : area.riskType === 'High' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'}`}>{area.riskType} Risk</span>
                                   )}
                                </td>
                                 <td className="px-4 py-3 text-right">
                                   <div className="flex items-center justify-end gap-1">
                                      {editingRowId === area.id ? (
                                         <>
                                            <button onClick={saveEdit} className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition tooltip-top" title="Save"><Check className="w-4 h-4" /></button>
                                            <button onClick={cancelEdit} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition tooltip-top" title="Cancel"><X className="w-4 h-4" /></button>
                                         </>
                                      ) : confirmDeleteId === area.id ? (
                                         <div className="flex items-center gap-1">
                                            <button 
                                               onClick={() => handleDeleteRecord(area.id)}
                                               className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                                            >
                                               Confirm
                                            </button>
                                            <button 
                                               onClick={() => setConfirmDeleteId(null)}
                                               className="px-2 py-1 bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-300 rounded text-[10px] font-bold"
                                            >
                                               Cancel
                                            </button>
                                         </div>
                                      ) : (
                                         <>
                                            <button onClick={() => startEditing(area)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-md transition tooltip-top" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => setConfirmDeleteId(area.id)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 rounded-md transition tooltip-top" title="Delete"><Trash className="w-3.5 h-3.5" /></button>
                                         </>
                                      )}
                                   </div>
                                </td>
                             </tr>
                          ))}
                          {riskAreasFiltered.length === 0 && (
                             <tr>
                                <td colSpan={5} className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                                   No data found based on your filters.
                                </td>
                             </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           )}
        </div>
      </div>
    </div>
     <AnimatePresence>
       {confirmModal && (
         <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
           onClick={() => setConfirmModal(null)}
         >
           <motion.div
             initial={{ scale: 0.95, opacity: 0, y: 20 }}
             animate={{ scale: 1, opacity: 1, y: 0 }}
             exit={{ scale: 0.95, opacity: 0, y: 20 }}
             className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-slate-800"
             onClick={(e) => e.stopPropagation()}
           >
             <div className="p-6">
               <div className="flex items-center gap-4 mb-4">
                 <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                   <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                     {confirmModal.title}
                   </h3>
                   <p className="text-sm text-gray-500 dark:text-gray-400">
                     This action cannot be undone.
                   </p>
                 </div>
               </div>
               
               <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-8">
                 {confirmModal.message}
               </p>
               
               <div className="flex gap-3 mt-6">
                 <button
                   onClick={() => setConfirmModal(null)}
                   className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={() => {
                     confirmModal.onConfirm();
                   }}
                   className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-md shadow-red-200 dark:shadow-none transition active:scale-95"
                 >
                   Delete
                 </button>
               </div>
             </div>
           </motion.div>
         </motion.div>
       )}
     </AnimatePresence>
    </>
  );
}
