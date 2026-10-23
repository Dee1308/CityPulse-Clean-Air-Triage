/**
 * Live Air Quality & Telemetry Explorer
 * Full multi-pollutant telemetry across 16 CAAQMS Mumbai stations.
 * Includes official NAAQS thresholds, quality status filters, and hourly station drilldown drawer.
 */

import React, { useState } from 'react';
import { 
  Filter, 
  Search, 
  ChevronRight, 
  X, 
  Wind, 
  Thermometer, 
  Droplets, 
  ArrowUpRight, 
  Gauge, 
  Info,
  Clock
} from 'lucide-react';
import { MonitoringStation } from '../types';
import { getPM25Category, formatNumber } from '../utils/colors';

interface LiveAirQualityViewProps {
  stations: MonitoringStation[];
  liveSnapshot: any[];
  onSelectStationForAnalysis: (stationId: string) => void;
}

export const LiveAirQualityView: React.FC<LiveAirQualityViewProps> = ({
  stations,
  liveSnapshot,
  onSelectStationForAnalysis
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [environmentFilter, setEnvironmentFilter] = useState('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  // Filter stations based on search, ward, environment
  const filteredSnapshot = liveSnapshot.filter(item => {
    const st = item.station as MonitoringStation;
    const matchesSearch = st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          st.ward.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          st.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWard = wardFilter === 'ALL' || st.ward === wardFilter;
    const matchesEnv = environmentFilter === 'ALL' || st.environment === environmentFilter;
    return matchesSearch && matchesWard && matchesEnv;
  });

  const selectedItem = liveSnapshot.find(s => s.station.id === selectedStationId);

  // Unique wards for filter dropdown
  const uniqueWards = Array.from(new Set(stations.map(s => s.ward))).sort();

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Continuous Ambient Air Quality Monitoring (CAAQMS)</span>
              <span aria-hidden="true">·</span>
              <span>CPCB & MPCB Telemetry</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Live Air Quality Observations
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              Verified ground-level particulate and gaseous telemetry from Mumbai monitoring stations. Calibrated against Indian NAAQS standards.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">NAAQS 24h Limit:</span>
            <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              PM2.5: 60 µg/m³
            </span>
            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              PM10: 100 µg/m³
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search station, ward, road..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-teal-600"
            />
          </div>

          <div>
            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-teal-600"
            >
              <option value="ALL">All BMC Wards</option>
              {uniqueWards.map(w => (
                <option key={w} value={w}>Ward {w}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={environmentFilter}
              onChange={(e) => setEnvironmentFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-teal-600"
            >
              <option value="ALL">All Environments</option>
              <option value="TRAFFIC_CORRIDOR">Traffic Corridor</option>
              <option value="INDUSTRIAL">Industrial Node</option>
              <option value="RESIDENTIAL">Residential Area</option>
              <option value="COASTAL">Coastal Front</option>
              <option value="ECOLOGICAL_BUFFER">Ecological Buffer / Forest</option>
            </select>
          </div>

          <div className="flex items-center justify-end text-xs text-slate-500">
            <span>Showing <strong className="text-slate-900">{filteredSnapshot.length}</strong> of {liveSnapshot.length} stations</span>
          </div>
        </div>
      </div>

      {/* Main Telemetry Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-medium">
                <th className="py-3 px-4">Station Name</th>
                <th className="py-3 px-3">Ward</th>
                <th className="py-3 px-3">Operator</th>
                <th className="py-3 px-3 text-right">PM2.5 (µg/m³)</th>
                <th className="py-3 px-3 text-right">PM10 (µg/m³)</th>
                <th className="py-3 px-3 text-right">NO2 (µg/m³)</th>
                <th className="py-3 px-3 text-right">BLH (m)</th>
                <th className="py-3 px-3">Wind</th>
                <th className="py-3 px-3">Observed (IST)</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSnapshot.map((item) => {
                const st = item.station as MonitoringStation;
                const aq = item.latestAQ;
                const weather = item.latestWeather;
                const pm25 = aq?.pm2_5;
                const cat = getPM25Category(pm25);

                return (
                  <tr 
                    key={st.id} 
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => setSelectedStationId(st.id)}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{st.name}</div>
                      <div className="text-[11px] font-normal text-slate-500 truncate max-w-xs">
                        {st.environment.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                      Ward {st.ward}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {st.operator}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                      <span 
                        className={`inline-block px-2 py-0.5 rounded font-tabular ${cat.textColor} ${cat.bgColor} border ${cat.borderColor}`}
                      >
                        {formatNumber(pm25)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-tabular text-slate-700 whitespace-nowrap">
                      {formatNumber(aq?.pm10)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-tabular text-slate-700 whitespace-nowrap">
                      {formatNumber(aq?.no2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-tabular text-slate-600 whitespace-nowrap">
                      {weather?.boundaryLayerHeightM ?? '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                      {weather ? `${weather.windSpeedKmh} km/h ${weather.windDirectionDeg}°` : '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-tabular text-[11px]">
                      {aq?.timestampIST ? aq.timestampIST.split(' ')[1] : '—'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.freshnessStatus === 'ONLINE_HEALTHY' ? (
                        <span className="text-[11px] text-teal-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                          <span>Live</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          <span>{item.ageMinutes}m stale</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStationId(st.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="View Station Details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Station Drilldown Drawer / Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-200 flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    Station Telemetry & Ward Metadata
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {selectedItem.station.name}
                  </h2>
                  <div className="text-xs text-slate-600 mt-1">
                    Ward {selectedItem.station.ward} · {selectedItem.station.operator} · {selectedItem.station.environment}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStationId(null)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-5 space-y-5 text-xs">
                {/* Station Location & Address */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-800 mb-1">Station Coordinates & Deployment</div>
                  <div className="text-slate-600 leading-relaxed">
                    {selectedItem.station.address}
                  </div>
                  <div className="mt-2 text-[11px] font-mono text-slate-500 flex gap-4">
                    <span>Lat: {selectedItem.station.lat.toFixed(4)}°N</span>
                    <span>Lng: {selectedItem.station.lng.toFixed(4)}°E</span>
                    <span>Elevation: {selectedItem.station.elevationM}m</span>
                  </div>
                </div>

                {/* Live Pollutant Readings Grid */}
                <div>
                  <div className="font-semibold text-slate-800 mb-2">Live Ambient Pollutants</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded border border-slate-200 bg-white shadow-2xs">
                      <div className="text-slate-500 text-[11px]">PM2.5 Concentration</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-slate-900">
                          {formatNumber(selectedItem.latestAQ?.pm2_5)}
                        </span>
                        <span className="text-slate-500">µg/m³</span>
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-600">
                        {getPM25Category(selectedItem.latestAQ?.pm2_5).label}
                      </div>
                    </div>

                    <div className="p-3 rounded border border-slate-200 bg-white shadow-2xs">
                      <div className="text-slate-500 text-[11px]">PM10 Concentration</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-slate-900">
                          {formatNumber(selectedItem.latestAQ?.pm10)}
                        </span>
                        <span className="text-slate-500">µg/m³</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">Coarse particulates</div>
                    </div>

                    <div className="p-3 rounded border border-slate-200 bg-white shadow-2xs">
                      <div className="text-slate-500 text-[11px]">Nitrogen Dioxide (NO2)</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {formatNumber(selectedItem.latestAQ?.no2)}
                        </span>
                        <span className="text-slate-500">µg/m³</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">Vehicular combustion indicator</div>
                    </div>

                    <div className="p-3 rounded border border-slate-200 bg-white shadow-2xs">
                      <div className="text-slate-500 text-[11px]">Surface Ozone (O3)</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {formatNumber(selectedItem.latestAQ?.o3)}
                        </span>
                        <span className="text-slate-500">µg/m³</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">Photochemical smog oxidant</div>
                    </div>
                  </div>
                </div>

                {/* Meteorological Dispersion Parameters */}
                <div>
                  <div className="font-semibold text-slate-800 mb-2">Concurrent Atmospheric Parameters</div>
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-slate-500" />
                        Boundary Layer Height (BLH):
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {selectedItem.latestWeather?.boundaryLayerHeightM ?? '—'} meters
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Wind className="w-3.5 h-3.5 text-slate-500" />
                        Surface Wind:
                      </span>
                      <span className="font-mono text-slate-900">
                        {selectedItem.latestWeather?.windSpeedKmh} km/h @ {selectedItem.latestWeather?.windDirectionDeg}°
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Thermometer className="w-3.5 h-3.5 text-slate-500" />
                        Ambient Temperature:
                      </span>
                      <span className="font-mono text-slate-900">
                        {selectedItem.latestWeather?.temperatureC} °C
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5 text-slate-500" />
                        Relative Humidity:
                      </span>
                      <span className="font-mono text-slate-900">
                        {selectedItem.latestWeather?.relativeHumidityPct} %
                      </span>
                    </div>
                  </div>
                </div>

                {/* Site Notes */}
                <div className="p-3 rounded border border-slate-200 text-slate-600 leading-relaxed text-[11px]">
                  <strong>Site Environmental Context:</strong> {selectedItem.station.notes}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">
                Feed Age: <strong className="font-mono text-slate-800">{selectedItem.ageMinutes} mins</strong>
              </span>
              <button
                onClick={() => {
                  onSelectStationForAnalysis(selectedItem.station.id);
                  setSelectedStationId(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-md text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Analyze Fixability</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
