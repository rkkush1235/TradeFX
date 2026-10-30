import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { MARKET_SYMBOL_MAP, POLL_INTERVAL_MS, TRADED_ASSETS } from "@/utils/constants";
import { safeNumber } from "@/utils/format";
import { CandlePoint, MarketPrice, MarketSnapshot } from "@/types";

function isValidPrice(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function parseApiNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value);
  return Number.NaN;
}

// Fix: normalize unrealistic market values before storing/rendering.
function normalizeUsdPrice(symbol: string, raw: unknown) {
  const value = safeNumber(raw, 0, 1e9);
  const key = symbol.toUpperCase();

  const ranges: Record<string, { min: number; max: number }> = {
    BTC: { min: 1_000, max: 10_000_000 },
    ETH: { min: 10, max: 1_000_000 },
    SOL: { min: 0.1, max: 100_000 },
    BNB: { min: 1, max: 100_000 },
    XRP: { min: 0.001, max: 1_000 },
    DOGE: { min: 0.0001, max: 100 },
    GOLD: { min: 500, max: 50_000 },
    SILVER: { min: 1, max: 5_000 },
    "EUR/USD": { min: 0.1, max: 5 },
    "GBP/USD": { min: 0.1, max: 5 },
    "USD/JPY": { min: 10, max: 500 },
    "AUD/USD": { min: 0.1, max: 5 },
    "USD/CAD": { min: 0.1, max: 5 },
  };

  const range = ranges[key];
  if (!range) return value;
  if (value < range.min || value > range.max) return 0;
  return value;
}

function deriveChange(current: unknown, previous?: unknown) {
  const curr = safeNumber(current);
  const prev = safeNumber(previous);
  if (curr <= 0 || prev <= 0) return 0;
  return safeNumber(((curr - prev) / prev) * 100, 0, 10_000);
}

async function fetchCryptoPrices() {
  try {
    const ids = [
      MARKET_SYMBOL_MAP.BTC,
      MARKET_SYMBOL_MAP.ETH,
      MARKET_SYMBOL_MAP.SOL,
      MARKET_SYMBOL_MAP.BNB,
      MARKET_SYMBOL_MAP.XRP,
      MARKET_SYMBOL_MAP.DOGE,
    ].join(",");

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { cache: "no-store" },
    );

    if (!res.ok) throw new Error(`coingecko failed: ${res.status}`);

    const json = (await res.json()) as Record<string, { usd: number; usd_24h_change: number }>;
    if (!isValidPrice(json?.bitcoin?.usd)) {
      throw new Error("coingecko invalid payload");
    }
    return json;
  } catch {
    const [priceRes, statRes] = await Promise.all([
      fetch(
        "https://data-api.binance.vision/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22,%22BNBUSDT%22,%22XRPUSDT%22,%22DOGEUSDT%22%5D",
        { cache: "no-store" },
      ),
      fetch(
        "https://data-api.binance.vision/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22,%22BNBUSDT%22,%22XRPUSDT%22,%22DOGEUSDT%22%5D",
        { cache: "no-store" },
      ),
    ]);

    const prices = (await priceRes.json()) as Array<{ symbol: string; price: string }>;
    const stats = (await statRes.json()) as Array<{ symbol: string; priceChangePercent: string }>;

    const p = (symbol: string) => parseApiNumber(prices.find((row) => row.symbol === symbol)?.price ?? 0);
    const c = (symbol: string) => parseApiNumber(stats.find((row) => row.symbol === symbol)?.priceChangePercent ?? 0);

    return {
      bitcoin: { usd: p("BTCUSDT"), usd_24h_change: c("BTCUSDT") },
      ethereum: { usd: p("ETHUSDT"), usd_24h_change: c("ETHUSDT") },
      solana: { usd: p("SOLUSDT"), usd_24h_change: c("SOLUSDT") },
      binancecoin: { usd: p("BNBUSDT"), usd_24h_change: c("BNBUSDT") },
      ripple: { usd: p("XRPUSDT"), usd_24h_change: c("XRPUSDT") },
      dogecoin: { usd: p("DOGEUSDT"), usd_24h_change: c("DOGEUSDT") },
    };
  }
}

type ForexPair = "EUR/USD" | "GBP/USD" | "USD/JPY" | "AUD/USD" | "USD/CAD";

const FOREX_PAIRS: ForexPair[] = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD"];
// Reference rates only publish once per business day, so polling faster just burns requests.
const FOREX_CACHE_MS = 10 * 60_000;

let forexCache: { prices: Record<string, MarketPrice>; fetchedAt: number } | null = null;
let forexRequest: Promise<Record<string, MarketPrice>> | null = null;

function pairFromUsdRates(pair: ForexPair, rates: Record<string, number>) {
  const [base, quote] = pair.split("/");
  const foreign = base === "USD" ? quote : base;
  const rate = rates[foreign];
  if (!isValidPrice(rate)) return 0;
  // Rates are quoted per 1 USD; invert for XXX/USD pairs.
  return normalizeUsdPrice(pair, base === "USD" ? rate : 1 / rate);
}

async function requestForexPrices(): Promise<Record<string, MarketPrice>> {
  const start = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  const res = await fetch(
    `https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,GBP,JPY,AUD,CAD&from=${start}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`forex api failed: ${res.status}`);

  const rows = (await res.json()) as Array<{ date: string; quote: string; rate: number }>;
  const byDay = new Map<string, Record<string, number>>();
  for (const row of rows) {
    byDay.set(row.date, { ...byDay.get(row.date), [row.quote]: row.rate });
  }
  const days = Array.from(byDay.keys()).sort();
  if (!days.length) throw new Error("forex api returned no rates");

  const latest = byDay.get(days[days.length - 1])!;
  const previous = days.length > 1 ? byDay.get(days[days.length - 2]) : undefined;
  const now = Date.now();

  return Object.fromEntries(
    FOREX_PAIRS.map((pair) => {
      const priceUsd = pairFromUsdRates(pair, latest);
      const prevPrice = previous ? pairFromUsdRates(pair, previous) : 0;
      return [
        pair,
        {
          symbol: pair,
          category: "forex",
          priceUsd,
          change24h: deriveChange(priceUsd, prevPrice),
          updatedAt: now,
        } satisfies MarketPrice,
      ];
    }),
  );
}

export async function fetchLiveForexPrices(previous?: MarketSnapshot) {
  const now = Date.now();
  if (!forexCache || now - forexCache.fetchedAt > FOREX_CACHE_MS) {
    forexRequest ??= requestForexPrices().finally(() => {
      forexRequest = null;
    });
    try {
      forexCache = { prices: await forexRequest, fetchedAt: now };
    } catch {
      if (!forexCache) {
        // Keep whatever the caller already had rather than dropping prices to 0.
        const fallback = Object.fromEntries(
          FOREX_PAIRS.map((pair) => [pair, previous?.prices?.[pair]]).filter(([, row]) => row),
        ) as Record<string, MarketPrice>;
        return { prices: fallback, updatedAt: previous?.updatedAt ?? now };
      }
    }
  }

  return { prices: forexCache.prices, updatedAt: forexCache.fetchedAt };
}

// gold-api.com: free spot XAU/XAG, no key and no call limit. It has no 24h change; the feed
// takes GOLD's change from Kraken PAXG instead.
async function fetchMetalPrice(symbol: "GOLD" | "SILVER") {
  const code = symbol === "GOLD" ? "XAU" : "XAG";

  try {
    const res = await fetch(`https://api.gold-api.com/price/${code}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`gold-api failed: ${res.status}`);

    const payload = (await res.json()) as { price?: number };
    const normalized = normalizeUsdPrice(symbol, parseApiNumber(payload.price));
    if (!isValidPrice(normalized)) {
      throw new Error(`invalid ${symbol} price`);
    }
    return { price: normalized, change: Number.NaN };
  } catch {
    return { price: Number.NaN, change: Number.NaN };
  }
}

export async function fetchLiveMetalPrices(): Promise<Record<string, MarketPrice>> {
  const [gold, silver] = await Promise.all([fetchMetalPrice("GOLD"), fetchMetalPrice("SILVER")]);
  const now = Date.now();
  const prices: Record<string, MarketPrice> = {};
  for (const [symbol, row] of [["GOLD", gold], ["SILVER", silver]] as const) {
    if (!isValidPrice(row.price)) continue;
    prices[symbol] = { symbol, category: "metal", priceUsd: row.price, change24h: 0, updatedAt: now };
  }
  if (!Object.keys(prices).length) throw new Error("metal prices unavailable");
  return prices;
}

async function upsertMinuteCandle(symbol: string, priceUsd: number, nowMs: number) {
  const assetKey = symbol.replace("/", "_");
  const bucketTimeSec = Math.floor(nowMs / 60_000) * 60;
  const candleRef = doc(db, "marketPrices", "history", assetKey, String(bucketTimeSec));
  const snapshot = await getDoc(candleRef);

  if (!snapshot.exists()) {
    await setDoc(candleRef, {
      time: bucketTimeSec,
      open: priceUsd,
      high: priceUsd,
      low: priceUsd,
      close: priceUsd,
      updatedAt: nowMs,
    });
    return;
  }

  const prev = snapshot.data() as CandlePoint;
  await setDoc(
    candleRef,
    {
      time: bucketTimeSec,
      open: prev.open ?? priceUsd,
      high: Math.max(prev.high ?? priceUsd, priceUsd),
      low: Math.min(prev.low ?? priceUsd, priceUsd),
      close: priceUsd,
      updatedAt: nowMs,
    },
    { merge: true },
  );
}

async function buildLiveSnapshot(): Promise<MarketSnapshot> {
  const [crypto, forex, gold, silver, previousSnapshot] = await Promise.all([
    fetchCryptoPrices(),
    fetchLiveForexPrices(),
    fetchMetalPrice("GOLD"),
    fetchMetalPrice("SILVER"),
    getDoc(doc(db, "marketPrices", "latest")),
  ]);

  const now = Date.now();
  const previous = previousSnapshot.data() as MarketSnapshot | undefined;
  const previousPrices = previous?.prices ?? {};

  const pickLiveOrPrevious = (symbol: string, current: unknown, prev?: unknown) => {
    const next = normalizeUsdPrice(symbol, current);
    if (next > 0) return next;
    return normalizeUsdPrice(symbol, prev);
  };

  const prices: Record<string, MarketPrice> = {};

  for (const [symbol, row] of Object.entries(forex.prices)) {
    prices[symbol] = {
      ...row,
      priceUsd: pickLiveOrPrevious(symbol, row.priceUsd, previousPrices[symbol]?.priceUsd),
    };
  }

  const cryptoRows: Array<[string, { usd: number; usd_24h_change: number } | undefined]> = [
    ["BTC", crypto.bitcoin],
    ["ETH", crypto.ethereum],
    ["SOL", crypto.solana],
    ["BNB", crypto.binancecoin],
    ["XRP", crypto.ripple],
    ["DOGE", crypto.dogecoin],
  ];
  for (const [symbol, row] of cryptoRows) {
    prices[symbol] = {
      symbol,
      category: "crypto",
      priceUsd: pickLiveOrPrevious(symbol, row?.usd, previousPrices[symbol]?.priceUsd),
      change24h: safeNumber(row?.usd_24h_change ?? previousPrices[symbol]?.change24h),
      updatedAt: now,
    };
  }

  for (const [symbol, row] of [["GOLD", gold], ["SILVER", silver]] as const) {
    const priceUsd = pickLiveOrPrevious(symbol, row.price, previousPrices[symbol]?.priceUsd);
    // One missing metal must not sink the whole snapshot (and every other price with it).
    if (!isValidPrice(priceUsd)) continue;
    prices[symbol] = {
      symbol,
      category: "metal",
      priceUsd,
      change24h: Number.isFinite(row.change) ? row.change : safeNumber(previousPrices[symbol]?.change24h),
      updatedAt: now,
    };
  }

  return {
    prices,
    updatedAt: now,
    source: "polling",
  };
}

export async function fetchLiveMarketSnapshot(): Promise<MarketSnapshot> {
  return buildLiveSnapshot();
}

export async function pollAndStoreMarketPrices(): Promise<MarketSnapshot> {
  const payload = await buildLiveSnapshot();
  const now = payload.updatedAt;

  await setDoc(doc(db, "marketPrices", "latest"), payload, { merge: true });
  await Promise.all(
    Object.values(payload.prices).map((row) => upsertMinuteCandle(row.symbol, row.priceUsd, now)),
  );
  return payload;
}

export function startMarketPolling(userId: string, isAdmin: boolean, onError?: (error: unknown) => void) {
  let mounted = true;
  const lockRef = doc(db, "system", "marketPoller");

  const claimLock = async () => {
    if (!isAdmin) return false;

    try {
      const now = Date.now();
      const ok = await runTransaction(db, async (tx) => {
        const snap = await tx.get(lockRef);
        const data = snap.data() as { ownerId?: string; heartbeat?: number } | undefined;
        const stale = !data?.heartbeat || now - data.heartbeat > 15_000;
        const isOwner = data?.ownerId === userId;
        if (stale || isOwner) {
          tx.set(lockRef, { ownerId: userId, heartbeat: now }, { merge: true });
          return true;
        }
        return false;
      });
      return ok;
    } catch {
      return false;
    }
  };

  const tick = async () => {
    if (!mounted) return;
    try {
      const hasLock = await claimLock();
      if (!hasLock) return;
      await pollAndStoreMarketPrices();
      await setDoc(lockRef, { ownerId: userId, heartbeat: Date.now() }, { merge: true });
    } catch (error) {
      onError?.(error);
    }
  };

  tick();
  const interval = setInterval(tick, POLL_INTERVAL_MS);

  return () => {
    mounted = false;
    clearInterval(interval);
  };
}

export function subscribeMarketSnapshot(
  onData: (snap: MarketSnapshot) => void,
  onError?: (error: unknown) => void,
) {
  return onSnapshot(
    doc(db, "marketPrices", "latest"),
    (snapshot) => {
      const data = snapshot.data();
      if (data) onData(data as MarketSnapshot);
    },
    (error) => onError?.(error),
  );
}

export function subscribeHistoricalCandles(
  asset: string,
  onData: (rows: CandlePoint[]) => void,
  maxRows = 240,
  onError?: (error: unknown) => void,
) {
  const candlesRef = collection(db, "marketPrices", "history", asset.replace("/", "_"));
  const candlesQuery = query(candlesRef, orderBy("time", "desc"), limit(maxRows));

  return onSnapshot(
    candlesQuery,
    (snapshot) => {
      const rows = snapshot.docs
        .map((d) => d.data() as CandlePoint)
        .sort((a, b) => a.time - b.time);
      onData(rows);
    },
    (error) => onError?.(error),
  );
}

export function emptySnapshot(): MarketSnapshot {
  const now = Date.now();
  const prices = Object.fromEntries(
    TRADED_ASSETS.map((symbol) => [
      symbol,
      {
        symbol,
        category:
          symbol === "BTC" ||
          symbol === "ETH" ||
          symbol === "SOL" ||
          symbol === "BNB" ||
          symbol === "XRP" ||
          symbol === "DOGE"
            ? "crypto"
            : symbol === "GOLD" || symbol === "SILVER"
              ? "metal"
              : "forex",
        priceUsd: 0,
        change24h: 0,
        updatedAt: now,
      } as MarketPrice,
    ]),
  );

  return { prices, updatedAt: now, source: "polling" };
}
