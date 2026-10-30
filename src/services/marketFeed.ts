import {
  emptySnapshot,
  fetchLiveForexPrices,
  fetchLiveMarketSnapshot,
  fetchLiveMetalPrices,
} from "@/services/marketService";
import { MarketPrice, MarketSnapshot } from "@/types";

type Listener = (snapshot: MarketSnapshot) => void;

let snapshotCache: MarketSnapshot = emptySnapshot();
const listeners = new Set<Listener>();
let forexTimer: ReturnType<typeof setInterval> | null = null;
let metalTimer: ReturnType<typeof setInterval> | null = null;
let forexInFlight = false;
let metalInFlight = false;
let started = false;
let bootstrapped = false;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

// Kraken pushes many ticks per second; batching keeps mobile renders down to a few per second.
const NOTIFY_THROTTLE_MS = 500;
// Forex reference rates are cached for minutes in marketService, so poll slowly.
const FOREX_POLL_MS = 60_000;
// gold-api.com spot metals refresh every few seconds and need no key.
const METAL_POLL_MS = 15_000;

// Live forex and crypto come from Kraken's public feed (no key, no call limits, reachable where
// Binance is blocked, e.g. India). ECB rates are the forex backup.
const KRAKEN_WS_URL = "wss://ws.kraken.com/v2";
const KRAKEN_SYMBOLS: Record<string, { asset: string; category: MarketPrice["category"] }> = {
  "EUR/USD": { asset: "EUR/USD", category: "forex" },
  "GBP/USD": { asset: "GBP/USD", category: "forex" },
  "AUD/USD": { asset: "AUD/USD", category: "forex" },
  "USD/JPY": { asset: "USD/JPY", category: "forex" },
  "USD/CAD": { asset: "USD/CAD", category: "forex" },
  "BTC/USD": { asset: "BTC", category: "crypto" },
  "ETH/USD": { asset: "ETH", category: "crypto" },
  "SOL/USD": { asset: "SOL", category: "crypto" },
  "BNB/USD": { asset: "BNB", category: "crypto" },
  "XRP/USD": { asset: "XRP", category: "crypto" },
  "DOGE/USD": { asset: "DOGE", category: "crypto" },
};
// PAXG is a gold-backed token; only its 24h change is used, for GOLD (gold-api has no change).
const KRAKEN_GOLD_PROXY = "PAXG/USD";
// After this long without a Kraken tick, the ECB rate is allowed to fill that pair.
const KRAKEN_STALE_MS = 5 * 60_000;
// Above 0.1% spread the bid/ask mid is not trusted.
const KRAKEN_MAX_SPREAD = 0.001;
// Kraken forex ticks more than 1% away from the ECB reference are treated as bad prints.
const KRAKEN_MAX_DEVIATION = 0.01;
const ecbReference: Record<string, number> = {};

let krakenSocket: WebSocket | null = null;
let krakenReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let krakenReconnectAttempts = 0;
const krakenUpdatedAt: Record<string, number> = {};
let goldChangePercent = Number.NaN;

function toFinitePositive(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.NaN;
  return parsed;
}

function toFiniteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
}

function notifyListeners() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    listeners.forEach((listener) => listener(snapshotCache));
  }, NOTIFY_THROTTLE_MS);
}

function handleKrakenMessage(raw: unknown) {
  if (typeof raw !== "string") return;

  let parsed: { channel?: string; data?: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (parsed.channel !== "ticker" || !Array.isArray(parsed.data)) return;

  const now = Date.now();
  const prices = { ...snapshotCache.prices };
  let changed = false;

  for (const row of parsed.data) {
    const symbol = typeof row.symbol === "string" ? row.symbol : "";

    if (symbol === KRAKEN_GOLD_PROXY) {
      goldChangePercent = toFiniteNumber(row.change_pct);
      if (prices.GOLD && Number.isFinite(goldChangePercent)) {
        prices.GOLD = { ...prices.GOLD, change24h: goldChangePercent };
        changed = true;
      }
      continue;
    }

    const target = KRAKEN_SYMBOLS[symbol];
    if (!target) continue;

    // Mid of bid/ask tracks the market between trades, but Kraken's thinner books (USD/JPY) can
    // have a spread of several percent; then the last trade is the honest price.
    const bid = toFinitePositive(row.bid);
    const ask = toFinitePositive(row.ask);
    const last = toFinitePositive(row.last);
    const tightBook = Number.isFinite(bid) && Number.isFinite(ask) && (ask - bid) / bid <= KRAKEN_MAX_SPREAD;
    const price = tightBook ? (bid + ask) / 2 : last;
    if (!Number.isFinite(price)) continue;

    // A stale trade on an illiquid pair can sit far from the real market; leave the ECB rate then.
    const reference = ecbReference[target.asset];
    if (reference && Math.abs(price - reference) / reference > KRAKEN_MAX_DEVIATION) continue;

    const changePercent = toFiniteNumber(row.change_pct);
    krakenUpdatedAt[target.asset] = now;
    prices[target.asset] = {
      symbol: target.asset,
      category: target.category,
      priceUsd: price,
      change24h: Number.isFinite(changePercent) ? changePercent : (prices[target.asset]?.change24h ?? 0),
      updatedAt: now,
    };
    changed = true;
  }

  if (!changed) return;
  snapshotCache = { ...snapshotCache, updatedAt: now, prices };
  notifyListeners();
}

function scheduleKrakenReconnect() {
  if (krakenReconnectTimer || listeners.size === 0) return;

  const delay = Math.min(1_000 * 2 ** krakenReconnectAttempts, 30_000);
  krakenReconnectAttempts += 1;

  krakenReconnectTimer = setTimeout(() => {
    krakenReconnectTimer = null;
    startKrakenStream();
  }, delay);
}

function startKrakenStream() {
  if (typeof WebSocket === "undefined") return;
  if (krakenSocket && (krakenSocket.readyState === WebSocket.OPEN || krakenSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const ws = new WebSocket(KRAKEN_WS_URL);
  krakenSocket = ws;

  ws.onopen = () => {
    krakenReconnectAttempts = 0;
    ws.send(
      JSON.stringify({
        method: "subscribe",
        params: {
          channel: "ticker",
          symbol: [...Object.keys(KRAKEN_SYMBOLS), KRAKEN_GOLD_PROXY],
          event_trigger: "bbo",
        },
      }),
    );
  };

  ws.onmessage = (event) => {
    handleKrakenMessage(event.data);
  };

  ws.onerror = () => {
    console.warn("[MarketFeed] Kraken WS error event received");
  };

  ws.onclose = () => {
    if (krakenSocket === ws) krakenSocket = null;
    if (!started || listeners.size === 0) return;
    scheduleKrakenReconnect();
  };
}

function stopKrakenStream() {
  if (krakenReconnectTimer) {
    clearTimeout(krakenReconnectTimer);
    krakenReconnectTimer = null;
  }
  krakenReconnectAttempts = 0;

  if (!krakenSocket) return;
  try {
    krakenSocket.close();
  } catch {
    return;
  } finally {
    krakenSocket = null;
  }
}

async function pollMetals() {
  if (metalInFlight) return;
  metalInFlight = true;

  try {
    const live = await fetchLiveMetalPrices();
    const prices = { ...snapshotCache.prices };
    for (const [symbol, row] of Object.entries(live)) {
      const change =
        symbol === "GOLD" && Number.isFinite(goldChangePercent) ? goldChangePercent : (prices[symbol]?.change24h ?? 0);
      prices[symbol] = { ...row, change24h: change };
    }
    snapshotCache = { ...snapshotCache, updatedAt: Date.now(), prices };
    notifyListeners();
  } catch {
    console.warn("[MarketFeed] Metal polling failed");
  } finally {
    metalInFlight = false;
  }
}

async function pollForexSnapshot() {
  if (forexInFlight) return;
  forexInFlight = true;

  try {
    const live = await fetchLiveForexPrices(snapshotCache);
    for (const [symbol, row] of Object.entries(live.prices)) {
      if (row.priceUsd > 0) ecbReference[symbol] = row.priceUsd;
    }
    // ECB is only the backup: it fills pairs Kraken never sent, or when Kraken is down and stale.
    // A quiet but connected Kraken (e.g. weekend) keeps its last live price.
    const now = Date.now();
    const krakenOpen = krakenSocket !== null && krakenSocket.readyState === krakenSocket.OPEN;
    const fallbackRows = Object.fromEntries(
      Object.entries(live.prices).filter(([symbol, row]) => {
        const lastTick = krakenUpdatedAt[symbol];
        const current = snapshotCache.prices[symbol]?.priceUsd ?? 0;
        // Also replace a Kraken print that arrived before the reference and turned out to be off.
        const offReference = row.priceUsd > 0 && Math.abs(current - row.priceUsd) / row.priceUsd > KRAKEN_MAX_DEVIATION;
        return !lastTick || offReference || (!krakenOpen && now - lastTick > KRAKEN_STALE_MS);
      }),
    );
    if (!Object.keys(fallbackRows).length) return;

    snapshotCache = {
      ...snapshotCache,
      updatedAt: Math.max(snapshotCache.updatedAt, live.updatedAt),
      prices: {
        ...snapshotCache.prices,
        ...fallbackRows,
      },
    };
    notifyListeners();
  } catch {
    console.warn("[MarketFeed] Forex polling failed");
  } finally {
    forexInFlight = false;
  }
}

async function bootstrapSnapshotOnce() {
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    const startedAt = Date.now();
    const live = await fetchLiveMarketSnapshot();
    // The WebSocket usually answers before this slower REST bootstrap; never let the older
    // bootstrap values overwrite a price that streamed in while it was loading.
    const merged = { ...snapshotCache.prices };
    for (const [symbol, row] of Object.entries(live.prices)) {
      const current = merged[symbol];
      if (!current || current.priceUsd <= 0 || current.updatedAt < startedAt) merged[symbol] = row;
    }
    snapshotCache = { ...snapshotCache, prices: merged, updatedAt: Math.max(snapshotCache.updatedAt, live.updatedAt) };
    notifyListeners();
  } catch {
    console.warn("[MarketFeed] Initial market snapshot bootstrap failed");
  }
}

function ensureFeedStarted() {
  if (started) return;
  started = true;

  void bootstrapSnapshotOnce();
  startKrakenStream();
  void pollForexSnapshot();
  void pollMetals();
  forexTimer = setInterval(pollForexSnapshot, FOREX_POLL_MS);
  metalTimer = setInterval(pollMetals, METAL_POLL_MS);
}

function maybeStopFeed() {
  if (listeners.size > 0) return;
  started = false;

  if (notifyTimer) {
    clearTimeout(notifyTimer);
    notifyTimer = null;
  }

  if (forexTimer) {
    clearInterval(forexTimer);
    forexTimer = null;
  }

  if (metalTimer) {
    clearInterval(metalTimer);
    metalTimer = null;
  }

  stopKrakenStream();
}

export function subscribeMarketFeed(listener: Listener) {
  listeners.add(listener);
  listener(snapshotCache);
  ensureFeedStarted();

  return () => {
    listeners.delete(listener);
    maybeStopFeed();
  };
}

export function getCurrentMarketSnapshot() {
  return snapshotCache;
}

export async function refreshMarketSnapshot() {
  await Promise.all([pollForexSnapshot(), pollMetals()]);
  return snapshotCache;
}
