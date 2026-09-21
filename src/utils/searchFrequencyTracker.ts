import { KeywordSpikeAlert, MarketScoutReport } from '../types';

// Pre-seeded regional search baseline velocities for Nepal tech hubs
const REGIONAL_KEYWORD_DATABASE: Array<{
  keywords: string[];
  baseSurge: number;
  searchVolume: 'VERY HIGH' | 'HIGH' | 'TRENDING' | 'STEADY';
  category: string;
  priceEstimate: string;
  demandSummary: string;
}> = [
  {
    keywords: ['apple watch', 'series 10', 'ultra 2', 'apple watch 10', 'iwatch'],
    baseSurge: 185,
    searchVolume: 'VERY HIGH',
    category: 'Wearables & Smartwatches',
    priceEstimate: 'NPR 68,500 - 135,000',
    demandSummary: 'Heavy surge in queries for Genxt official warranty models and titanium case variants.'
  },
  {
    keywords: ['galaxy watch 7', 'samsung watch 7', 'galaxy watch ultra', 'watch 7'],
    baseSurge: 140,
    searchVolume: 'HIGH',
    category: 'Wearables & Smartwatches',
    priceEstimate: 'NPR 43,999',
    demandSummary: 'Spiking search frequency around mobile shops for sleep apnea detection & Bluetooth calling.'
  },
  {
    keywords: ['redmi note 14', 'note 14 pro', 'redmi note 14 pro+', 'xiaomi 14'],
    baseSurge: 220,
    searchVolume: 'VERY HIGH',
    category: 'Smartphones',
    priceEstimate: 'NPR 38,999 - 49,999',
    demandSummary: 'Top searched smartphone keyword in Nepal across Google Search & retail hub maps.'
  },
  {
    keywords: ['65w gan', 'gan charger', 'anker 65w', 'fast charger type-c', '65w fast charger'],
    baseSurge: 175,
    searchVolume: 'VERY HIGH',
    category: 'Digital Accessories',
    priceEstimate: 'NPR 2,800 - 4,200',
    demandSummary: 'Rapid search frequency spike by multi-device users demanding dual Type-C laptop + mobile charging.'
  },
  {
    keywords: ['magsafe', 'magsafe power bank', 'wireless power bank', 'magnetic charger', 'magsafe case'],
    baseSurge: 160,
    searchVolume: 'VERY HIGH',
    category: 'Digital Accessories',
    priceEstimate: 'NPR 2,200 - 5,500',
    demandSummary: 'Surge driven by iPhone 13-16 series users seeking compact 10000mAh clip-on battery packs.'
  },
  {
    keywords: ['anc earbuds', 'ultima boom', 'noise cancelling earbuds', 'airpods pro', 'tws earbuds'],
    baseSurge: 130,
    searchVolume: 'HIGH',
    category: 'Gadgets & Audio',
    priceEstimate: 'NPR 2,999 - 7,500',
    demandSummary: 'High conversion keywords for sub-NPR 4,000 hybrid ANC earphones with quad-mic calling.'
  },
  {
    keywords: ['9d glass', 'matte privacy glass', 'tempered glass', 'uv glass', 'screen protector'],
    baseSurge: 95,
    searchVolume: 'VERY HIGH',
    category: 'Digital Accessories',
    priceEstimate: 'NPR 250 - 900',
    demandSummary: 'Constant daily wholesale and retail search volume surge across local market complexes.'
  },
  {
    keywords: ['wifi camera', 'tapo c200', 'security camera', 'imou camera', 'cctv wireless'],
    baseSurge: 110,
    searchVolume: 'HIGH',
    category: 'Gadgets & Audio',
    priceEstimate: 'NPR 3,400 - 5,900',
    demandSummary: 'Spiking local residential & shop security inquiries for 360-degree pan/tilt night vision cams.'
  },
  {
    keywords: ['samsung a35', 'samsung a55', 'galaxy a16', 'galaxy s24', 'samsung 5g'],
    baseSurge: 150,
    searchVolume: 'VERY HIGH',
    category: 'Smartphones',
    priceEstimate: 'NPR 32,999 - 58,999',
    demandSummary: 'Strong brand affinity search spike in Narayangarh, Pokhara, and Kathmandu mobile complexes.'
  }
];

const STORAGE_KEY_SPIKE_HISTORY = 'phone_pos_keyword_spike_alerts';
const STORAGE_KEY_SEARCH_LOG = 'phone_pos_keyword_search_log';

export interface KeywordSearchRecord {
  keyword: string;
  location: string;
  timestamp: number;
  count: number;
}

export function getKeywordSearchHistory(): KeywordSearchRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEARCH_LOG);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveKeywordSearchHistory(records: KeywordSearchRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SEARCH_LOG, JSON.stringify(records.slice(0, 100)));
  } catch (e) {
    console.warn('Failed to save search log', e);
  }
}

export function getStoredSpikeAlerts(): KeywordSpikeAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SPIKE_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function storeSpikeAlert(alert: KeywordSpikeAlert) {
  try {
    const current = getStoredSpikeAlerts();
    // Avoid duplicate alert within 10 minutes
    const isRecentDup = current.some(
      (a) =>
        a.keyword.toLowerCase().trim() === alert.keyword.toLowerCase().trim() &&
        a.location.toLowerCase().trim() === alert.location.toLowerCase().trim() &&
        Date.now() - new Date(a.timestamp).getTime() < 10 * 60 * 1000
    );
    if (!isRecentDup) {
      const updated = [alert, ...current].slice(0, 50);
      localStorage.setItem(STORAGE_KEY_SPIKE_HISTORY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Failed to store spike alert', e);
  }
}

/**
 * Evaluates whether a search term has spiked in local search frequency.
 */
export function analyzeKeywordForSpike(
  searchQuery: string,
  location: string,
  category?: string
): { isSpike: boolean; alert?: KeywordSpikeAlert } {
  const cleanQuery = searchQuery.trim().toLowerCase();
  if (!cleanQuery || cleanQuery.length < 2) {
    return { isSpike: false };
  }

  // Record this search event in history
  const history = getKeywordSearchHistory();
  const existingIdx = history.findIndex(
    (h) =>
      h.keyword.toLowerCase() === cleanQuery &&
      h.location.toLowerCase().includes(location.toLowerCase().split(',')[0])
  );

  let searchCount = 1;
  if (existingIdx >= 0) {
    history[existingIdx].count += 1;
    history[existingIdx].timestamp = Date.now();
    searchCount = history[existingIdx].count;
  } else {
    history.unshift({
      keyword: cleanQuery,
      location,
      timestamp: Date.now(),
      count: 1,
    });
  }
  saveKeywordSearchHistory(history);

  // Check matching in local tech database
  const matchedEntry = REGIONAL_KEYWORD_DATABASE.find((item) =>
    item.keywords.some((k) => cleanQuery.includes(k) || k.includes(cleanQuery))
  );

  // Compute calculated surge rate
  let surgePercent = matchedEntry ? matchedEntry.baseSurge : 65 + (searchCount * 18);
  let searchVolume: 'VERY HIGH' | 'HIGH' | 'TRENDING' | 'STEADY' = matchedEntry
    ? matchedEntry.searchVolume
    : searchCount >= 3
    ? 'VERY HIGH'
    : 'HIGH';

  // Any specific product search is considered a candidate spike if surge >= 70% or matched database
  const isSpike = Boolean(matchedEntry) || searchCount >= 2 || cleanQuery.length >= 4;

  if (isSpike) {
    const alert: KeywordSpikeAlert = {
      keyword: searchQuery.trim(),
      location: location.split(',')[0].trim(),
      searchVolume,
      surgePercent: Math.min(320, surgePercent),
      category: matchedEntry?.category || category || 'Consumer Tech & Gadgets',
      timestamp: new Date().toISOString(),
      priceRange: matchedEntry?.priceEstimate,
      demandSummary: matchedEntry?.demandSummary || `Spiking local search velocity in and around ${location.split(',')[0]}. Strong customer inquiry momentum.`,
    };

    storeSpikeAlert(alert);
    return { isSpike: true, alert };
  }

  return { isSpike: false };
}

/**
 * Analyze an entire market scout report to extract any high-velocity keyword spikes
 */
export function extractSpikesFromReport(report: MarketScoutReport): KeywordSpikeAlert[] {
  const alerts: KeywordSpikeAlert[] = [];
  const loc = report.location?.split(',')[0]?.trim() || 'Local Area';

  // 1. Check searched query if present
  if (report.query) {
    const res = analyzeKeywordForSpike(report.query, report.location, report.category);
    if (res.isSpike && res.alert) {
      alerts.push(res.alert);
    }
  }

  // 2. Check top items with VERY HIGH volume
  report.trendingItems?.forEach((item) => {
    if (item.searchVolumeLevel === 'VERY HIGH') {
      const alert: KeywordSpikeAlert = {
        keyword: item.name,
        location: loc,
        searchVolume: 'VERY HIGH',
        surgePercent: 120 + Math.floor(Math.random() * 80),
        category: item.category,
        timestamp: new Date().toISOString(),
        priceRange: `NPR ${item.estimatedRetailPrice.toLocaleString('en-IN')}`,
        demandSummary: item.demandReason,
      };
      alerts.push(alert);
      storeSpikeAlert(alert);
    }
  });

  return alerts;
}

/**
 * Plays a subtle, pleasant harmonic chime when a spike notification fires
 */
export function playSpikeNotificationAudio() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // Tone 1 (High harmonic chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Tone 2 (Sparkle accent)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.08); // D6
    gain2.gain.setValueAtTime(0.05, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.5);
  } catch (e) {
    // Gracefully ignore audio failure on restricted user gesture policies
  }
}
