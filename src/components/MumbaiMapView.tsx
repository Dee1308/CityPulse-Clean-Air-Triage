/**
 * Interactive Mumbai Map — Civic Geospatial Air Quality & Fixability Map
 * Uses Leaflet with CartoDB Positron basemap.
 * Displays verified CPCB/MPCB stations, 24 BMC ward centroids, wind vectors, and key hotspot activity nodes.
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Layers, 
  RotateCcw, 
  MapPin, 
  Wind, 
  ShieldAlert, 
  Flame, 
  Construction, 
  Factory, 
  X, 
  ArrowUpRight,
  List
} from 'lucide-react';
import { MonitoringStation, WardInfo, KnownPollutionHotspot, FixabilityResult } from '../types';
import { getPM25Category, formatNumber } from '../utils/colors';

interface MumbaiMapViewProps {
  stations: MonitoringStation[];
  wards: WardInfo[];
  hotspots: KnownPollutionHotspot[];
  liveSnapshot: any[];
  fixabilityResults: FixabilityResult[];
  onSelectStationForAnalysis: (stationId: string) => void;
}

export const MumbaiMapView: React.FC<MumbaiMapViewProps> = ({
  stations,
  wards,
  hotspots,
  liveSnapshot,
  fixabilityResults,
  onSelectStationForAnalysis
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);
  const wardsLayerRef = useRef<L.LayerGroup | null>(null);

  const [mapMode, setMapMode] = useState<'PM25' | 'EXCESS' | 'WARD_COVERAGE'>('PM25');
  const [showHotspots, setShowHotspots] = useState(true);
  const [showWards, setShowWards] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [showAccessibleList, setShowAccessibleList] = useState(false);

  // Default Mumbai Center [19.0760, 72.8777], Zoom 11
  const MUMBAI_CENTER: [number, number] = [19.0850, 72.8750];
  const MUMBAI_ZOOM = 11;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MUMBAI_CENTER,
      zoom: MUMBAI_ZOOM,
      zoomControl: false,
      attributionControl: true
    });

    // Clean CartoDB Positron basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = L.layerGroup().addTo(map);
    wardsLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Layers when state changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing layers
    markersLayerRef.current?.clearLayers();
    hotspotsLayerRef.current?.clearLayers();
    wardsLayerRef.current?.clearLayers();

    // 1. Render Wards Layer (Centroids and Coverage status)
    if (showWards && wardsLayerRef.current) {
      wards.forEach(w => {
        const isMonitored = w.coverageStatus === 'DIRECT_STATION';
        const isProxy = w.coverageStatus === 'NEIGHBORING_PROXY';
        const color = isMonitored ? '#0d9488' : isProxy ? '#f59e0b' : '#ef4444';

        const wardCircle = L.circle(w.centroid, {
          radius: isMonitored ? 1200 : 900,
          color: color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.08,
          dashArray: isMonitored ? undefined : '4, 4'
        });

        wardCircle.bindTooltip(`Ward ${w.code}: ${w.name} (${w.coverageStatus.replace('_', ' ')})`, {
          direction: 'top',
          className: 'text-xs'
        });

        wardsLayerRef.current?.addLayer(wardCircle);
      });
    }

    // 2. Render Hotspots Layer (Construction, Landfills, Industrial)
    if (showHotspots && hotspotsLayerRef.current) {
      hotspots.forEach(h => {
        let badgeColor = '#b45309';
        let iconSymbol = '🏗️';
        if (h.category === 'WASTE_DUMPING_GROUND') {
          badgeColor = '#c2410c';
          iconSymbol = '🗑️';
        } else if (h.category === 'INDUSTRIAL_CLUSTER') {
          badgeColor = '#475569';
          iconSymbol = '🏭';
        }

        const iconHtml = `
          <div style="background-color: ${badgeColor}; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; box-shadow: 0 2px 6px rgba(0,0,0,0.25); border: 2px solid white;">
            ${iconSymbol}
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-hotspot-pin',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const marker = L.marker([h.lat, h.lng], { icon: customIcon });
        marker.bindPopup(`
          <div style="padding: 10px; font-family: sans-serif; font-size: 12px; max-width: 240px;">
            <div style="font-weight: bold; color: #0f172a; margin-bottom: 4px;">${h.name}</div>
            <div style="color: #475569; font-size: 11px; margin-bottom: 6px;">Ward ${h.ward} · ${h.category.replace('_', ' ')}</div>
            <div style="color: #334155; line-height: 1.3;">${h.description}</div>
          </div>
        `);
        hotspotsLayerRef.current?.addLayer(marker);
      });
    }

    // 3. Render Stations Layer
    if (markersLayerRef.current) {
      liveSnapshot.forEach(item => {
        const st = item.station as MonitoringStation;
        const aq = item.latestAQ;
        const pm25 = aq?.pm2_5;
        const fixResult = fixabilityResults.find(r => r.stationId === st.id);

        let displayValue = '';
        let badgeBg = '#94a3b8';
        let badgeBorder = '#64748b';

        if (mapMode === 'PM25') {
          const cat = getPM25Category(pm25);
          displayValue = pm25 !== null && pm25 !== undefined ? Math.round(pm25).toString() : '—';
          badgeBg = cat.hex;
          badgeBorder = cat.hex;
        } else if (mapMode === 'EXCESS') {
          const excess = fixResult?.modeledLocalExcess ?? 0;
          displayValue = `+${Math.round(excess)}`;
          badgeBg = excess > (fixResult?.uncertaintyThreshold ?? 15) ? '#d97706' : '#64748b';
          badgeBorder = excess > 0 ? '#b45309' : '#475569';
        } else {
          // Ward coverage mode
          displayValue = st.ward;
          badgeBg = '#0d9488';
          badgeBorder = '#0f766e';
        }

        const isSelected = selectedStationId === st.id;
        const isStale = item.freshnessStatus !== 'ONLINE_HEALTHY';

        const markerHtml = `
          <div style="
            background: white; 
            border: 2px solid ${isSelected ? '#0f172a' : badgeBorder}; 
            border-radius: 8px; 
            padding: 3px 6px; 
            box-shadow: 0 3px 8px rgba(0,0,0,0.18); 
            display: flex; 
            align-items: center; 
            gap: 4px; 
            font-family: 'JetBrains Mono', monospace; 
            font-size: 11px; 
            font-weight: 700; 
            cursor: pointer;
            white-space: nowrap;
            transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
            transition: transform 0.15s ease;
          ">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${badgeBg};"></span>
            <span style="color: #0f172a;">${displayValue}</span>
            ${isStale ? '<span style="font-size: 9px; color: #d97706;" title="Stale">⚠️</span>' : ''}
          </div>
        `;

        const stationDivIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-station-pin',
          iconSize: [60, 26],
          iconAnchor: [30, 13]
        });

        const marker = L.marker([st.lat, st.lng], { icon: stationDivIcon });
        marker.on('click', () => {
          setSelectedStationId(st.id);
        });

        marker.bindTooltip(`<strong>${st.name}</strong><br/>Ward ${st.ward} · PM2.5: ${formatNumber(pm25)} µg/m³`, {
          direction: 'top',
          className: 'text-xs'
        });

        markersLayerRef.current?.addLayer(marker);
      });
    }
  }, [mapMode, showHotspots, showWards, liveSnapshot, fixabilityResults, selectedStationId]);

  const resetView = () => {
    mapInstanceRef.current?.setView(MUMBAI_CENTER, MUMBAI_ZOOM);
    setSelectedStationId(null);
  };

  const selectedItem = liveSnapshot.find(s => s.station.id === selectedStationId);
  const selectedFixResult = fixabilityResults.find(r => r.stationId === selectedStationId);

  return (
    <div className="space-y-4">
      {/* Top Map Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
            <span>Geospatial Decision Support</span>
            <span aria-hidden="true">·</span>
            <span>Real CartoDB Positron Basemap</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Mumbai Ambient Monitoring & Coverage Map
          </h1>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-md text-xs font-medium">
            <button
              onClick={() => setMapMode('PM25')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                mapMode === 'PM25' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Observed PM2.5
            </button>
            <button
              onClick={() => setMapMode('EXCESS')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                mapMode === 'EXCESS' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Modeled Local Excess
            </button>
            <button
              onClick={() => setMapMode('WARD_COVERAGE')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                mapMode === 'WARD_COVERAGE' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ward Coverage
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-700 ml-2">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={(e) => setShowHotspots(e.target.checked)}
                className="rounded text-teal-600"
              />
              <span>Hotspots</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={showWards}
                onChange={(e) => setShowWards(e.target.checked)}
                className="rounded text-teal-600"
              />
              <span>24 Wards</span>
            </label>
          </div>

          <button
            onClick={resetView}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer ml-1"
            title="Reset Map Center to Mumbai"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowAccessibleList(!showAccessibleList)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors flex items-center gap-1 cursor-pointer"
            title="Toggle Accessible Table View"
          >
            <List className="w-3.5 h-3.5" />
            <span>{showAccessibleList ? 'Hide List' : 'Station List'}</span>
          </button>
        </div>
      </div>

      {/* Map & Drawer Split Container */}
      <div className="relative bg-slate-100 border border-slate-200 rounded-lg overflow-hidden shadow-xs h-[640px]">
        {/* Leaflet Container */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Map Legend (Bottom Left) */}
        <div className="absolute bottom-4 left-4 z-400 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg p-3 text-xs shadow-md max-w-xs">
          <div className="font-semibold text-slate-800 mb-1.5">
            {mapMode === 'PM25' ? 'Observed PM2.5 (NAAQS µg/m³)' : mapMode === 'EXCESS' ? 'Local Excess Anomaly' : 'BMC Ward Coverage'}
          </div>

          {mapMode === 'PM25' ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />Good (0-30)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-600" />Satisfactory (31-60)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Moderate (61-90)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />Poor (91-120)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600" />Very Poor (121-250)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-950" />Severe (&gt;250)</span>
              </div>
            </div>
          ) : mapMode === 'EXCESS' ? (
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                <span>Statistically significant excess above uncertainty threshold</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span>Excess within regional/meteorological tolerance</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                <span>Direct CAAQMS Station In Ward</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Neighboring Proxy Station</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>Unmonitored Ward Gap</span>
              </div>
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
            Source: CPCB/MPCB CAAQMS & Open-Meteo
          </div>
        </div>

        {/* Selected Station Slide-Over Panel */}
        {selectedItem && (
          <div className="absolute top-4 right-4 bottom-4 z-400 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl flex flex-col justify-between overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  Ward {selectedItem.station.ward}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  {selectedItem.station.name}
                </h3>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {selectedItem.station.environment} · {selectedItem.station.operator}
                </div>
              </div>
              <button
                onClick={() => setSelectedStationId(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Readings Block */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <div className="text-slate-500 text-[11px]">Observed PM2.5</div>
                  <div className="font-mono text-lg font-bold text-slate-900 mt-0.5">
                    {formatNumber(selectedItem.latestAQ?.pm2_5)} <span className="text-xs font-normal">µg/m³</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <div className="text-slate-500 text-[11px]">Modeled Local Excess</div>
                  <div className="font-mono text-lg font-bold text-amber-700 mt-0.5">
                    +{selectedFixResult?.modeledLocalExcess ?? 0} <span className="text-xs font-normal">µg/m³</span>
                  </div>
                </div>
              </div>

              {/* Fixability Attribution Verdict */}
              {selectedFixResult && (
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <div className="font-semibold text-slate-800 mb-1">Attribution Verdict:</div>
                  <div className="font-medium text-slate-900 text-xs">
                    {selectedFixResult.verdictLabel}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    {selectedFixResult.evidenceNarrative}
                  </p>
                </div>
              )}

              {/* Weather & Atmospheric Parameters */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1 text-[11px]">
                <div className="font-semibold text-slate-800 mb-1">Atmospheric Telemetry:</div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Boundary Layer Height:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItem.latestWeather?.boundaryLayerHeightM ?? '—'} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Surface Wind Vector:</span>
                  <span className="font-mono text-slate-800">{selectedItem.latestWeather?.windSpeedKmh} km/h @ {selectedItem.latestWeather?.windDirectionDeg}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dispersion Index:</span>
                  <span className="font-mono text-slate-800">{selectedFixResult?.dispersionIndex ?? 1.0}</span>
                </div>
              </div>

              {/* Nearby Hotspots / Construction */}
              {selectedFixResult?.investigationLeads && selectedFixResult.investigationLeads.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-800 mb-1">Contextual Investigation Leads:</div>
                  <div className="space-y-1.5">
                    {selectedFixResult.investigationLeads.map((lead, i) => (
                      <div key={i} className="p-2 rounded bg-white border border-slate-200 text-[11px]">
                        <strong className="text-slate-900">{lead.label}:</strong> {lead.recommendedAction}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Timestamp: {selectedItem.latestAQ?.timestampIST?.split(' ')[1] || 'Live'}
              </span>
              <button
                onClick={() => onSelectStationForAnalysis(selectedItem.station.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Full Evidence</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Accessible Station List Alternative (for screen-reader / non-map navigation) */}
      {showAccessibleList && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-3">
            Accessible Station List & Geographic Registry
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3">Station Name</th>
                  <th className="py-2.5 px-3">Ward</th>
                  <th className="py-2.5 px-3">Coordinates</th>
                  <th className="py-2.5 px-3">PM2.5 (µg/m³)</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Local Excess</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liveSnapshot.map(item => {
                  const st = item.station as MonitoringStation;
                  const aq = item.latestAQ;
                  const fix = fixabilityResults.find(r => r.stationId === st.id);
                  const cat = getPM25Category(aq?.pm2_5);
                  return (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{st.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">Ward {st.ward}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{st.lat.toFixed(4)}, {st.lng.toFixed(4)}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{formatNumber(aq?.pm2_5)}</td>
                      <td className="py-2.5 px-3"><span className={`px-1.5 py-0.5 rounded ${cat.bgColor} ${cat.textColor}`}>{cat.label}</span></td>
                      <td className="py-2.5 px-3 font-mono text-amber-700">+{fix?.modeledLocalExcess ?? 0} µg/m³</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
