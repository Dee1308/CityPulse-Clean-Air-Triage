/**
 * CityPulse Mumbai — Full-Stack Server
 * Express Backend API + Vite Dev Server Middleware
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { MUMBAI_WARDS, MUMBAI_STATIONS, KNOWN_HOTSPOTS } from './src/data/mumbaiWardsAndStations';
import { 
  getStationsLiveSnapshot, 
  fetchStationData, 
  getDataQualityReport, 
  ingestAllStations 
} from './src/server/ingestionEngine';
import { runFixabilityAnalysis } from './src/server/fixabilityEngine';
import { getAllStationForecasts, generateStationForecast } from './src/server/forecastEngine';
import { analyzeHotspotPlume } from './src/server/plumeEngine';
import { 
  generatePrioritizedInspectionCandidates, 
  updateInspectionItem, 
  getActiveInspectionPlan 
} from './src/server/inspectionEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  app.use(express.json());

  // --- API ROUTES ---

  // 1. Static Metadata: Wards, Stations, Hotspots
  app.get('/api/stations', (_req: Request, res: Response) => {
    res.json({
      stations: MUMBAI_STATIONS,
      wards: MUMBAI_WARDS,
      hotspots: KNOWN_HOTSPOTS
    });
  });

  // 2. Live Air Quality & Weather Snapshot for all Mumbai Stations
  app.get('/api/air-quality/live', async (req: Request, res: Response) => {
    try {
      const force = req.query.refresh === 'true';
      if (force) {
        await ingestAllStations(true);
      }
      const snapshot = await getStationsLiveSnapshot();
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        snapshot
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Station Detail & Hourly History
  app.get('/api/air-quality/station/:id', async (req: Request, res: Response) => {
    try {
      const stationId = req.params.id;
      const data = await fetchStationData(stationId);
      const station = MUMBAI_STATIONS.find(s => s.id === stationId);
      res.json({
        success: true,
        station,
        airQuality: data.airQuality,
        weather: data.weather
      });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  });

  // 4. Fixability Analysis & Attribution
  app.get('/api/fixability', async (req: Request, res: Response) => {
    try {
      const uncertainty = Number(req.query.uncertainty) || 80;
      const validBand = (uncertainty === 70 || uncertainty === 90) ? uncertainty : 80;
      const results = await runFixabilityAnalysis(validBand as 70 | 80 | 90);
      res.json({
        success: true,
        uncertaintyBand: validBand,
        results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Hourly Forecasts (Next 12-24h)
  app.get('/api/forecasts', async (_req: Request, res: Response) => {
    try {
      const forecasts = await getAllStationForecasts();
      res.json({
        success: true,
        forecasts
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/forecasts/station/:id', async (req: Request, res: Response) => {
    try {
      const stationId = req.params.id;
      const forecast = await generateStationForecast(stationId);
      res.json({
        success: true,
        forecast
      });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  });

  // 6. Upwind vs Downwind Plume Analysis
  app.get('/api/plume/analysis', async (req: Request, res: Response) => {
    try {
      const hotspotId = req.query.hotspotId as string | undefined;
      const plumeResults = await analyzeHotspotPlume(hotspotId);
      res.json({
        success: true,
        analyses: plumeResults
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Inspection Planning & Squad Allocation
  app.get('/api/inspections', async (req: Request, res: Response) => {
    try {
      const capacity = Number(req.query.capacity) || 3;
      const uncertainty = Number(req.query.uncertainty) || 80;
      const validBand = (uncertainty === 70 || uncertainty === 90) ? uncertainty : 80;
      
      const active = getActiveInspectionPlan();
      const plan = active.length > 0 
        ? active 
        : await generatePrioritizedInspectionCandidates(capacity, validBand as 70 | 80 | 90);

      res.json({
        success: true,
        capacity,
        uncertaintyBand: validBand,
        plan
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/inspections/generate', async (req: Request, res: Response) => {
    try {
      const capacity = Number(req.body.capacity) || 3;
      const uncertainty = Number(req.body.uncertainty) || 80;
      const plan = await generatePrioritizedInspectionCandidates(capacity, uncertainty as 70 | 80 | 90);
      res.json({
        success: true,
        plan
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/inspections/:id', (req: Request, res: Response) => {
    const candidateId = req.params.id;
    const updated = updateInspectionItem(candidateId, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Inspection item not found.' });
    }
    res.json({
      success: true,
      item: updated
    });
  });

  // 8. Data Quality & Freshness Summary
  app.get('/api/data-quality', async (_req: Request, res: Response) => {
    try {
      const report = await getDataQualityReport();
      res.json({
        success: true,
        report
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. Manual Ingestion Sync Trigger
  app.post('/api/sync', async (_req: Request, res: Response) => {
    try {
      await ingestAllStations(true);
      const report = await getDataQualityReport();
      res.json({
        success: true,
        message: 'Manual synchronization completed successfully across 16 Mumbai stations.',
        report
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`CityPulse Mumbai municipal server operational on http://0.0.0.0:${port}`);
  });
}

createServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
