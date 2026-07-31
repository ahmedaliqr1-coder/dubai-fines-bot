import axios from "axios";
import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ProxyAgent } from "proxy-agent";

const execFileAsync = promisify(execFile);

let cachedProxyUrl: string | null | undefined;
let cachedProxyAgent: ProxyAgent | null | undefined;

const DEFAULT_HTTP_AGENT = new http.Agent({
  keepAlive: true,
  maxSockets: Number.parseInt(process.env.OUTBOUND_HTTP_MAX_SOCKETS || "200", 10) || 200,
  maxFreeSockets: Number.parseInt(process.env.OUTBOUND_HTTP_MAX_FREE_SOCKETS || "50", 10) || 50,
});

const DEFAULT_HTTPS_AGENT = new https.Agent({
  keepAlive: true,
  maxSockets: Number.parseInt(process.env.OUTBOUND_HTTPS_MAX_SOCKETS || "200", 10) || 200,
  maxFreeSockets: Number.parseInt(process.env.OUTBOUND_HTTPS_MAX_FREE_SOCKETS || "50", 10) || 50,
});

function normalizeProxyUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function isDubaiPoliceProxyEnabled() {
  const raw = process.env.DUBAI_POLICE_PROXY_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function getDubaiPoliceProxyUrl() {
  if (!isDubaiPoliceProxyEnabled()) return null;

  const raw = [
    process.env.DUBAI_POLICE_PROXY_URL,
    process.env.OUTBOUND_PROXY_URL,
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
  ].find((value) => typeof value === "string" && value.trim());

  return raw ? normalizeProxyUrl(raw) : null;
}

function redactProxyUrl(proxyUrl: string | null) {
  if (!proxyUrl) return "none";

  try {
    const parsed = new URL(proxyUrl);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "[invalid proxy url]";
  }
}

function getProxyAgent() {
  const proxyUrl = getDubaiPoliceProxyUrl();
  if (!proxyUrl) return null;

  if (cachedProxyUrl === proxyUrl && cachedProxyAgent) {
    return cachedProxyAgent;
  }

  cachedProxyUrl = proxyUrl;
  cachedProxyAgent = new ProxyAgent({
    getProxyForUrl: () => proxyUrl,
  });
  console.log(`[Scraper] Dubai Police proxy enabled via ${redactProxyUrl(proxyUrl)}`);
  return cachedProxyAgent;
}

function getAxiosNetworkConfig() {
  const proxyAgent = getProxyAgent();
  if (!proxyAgent) {
    return {
      httpAgent: DEFAULT_HTTP_AGENT,
      httpsAgent: DEFAULT_HTTPS_AGENT,
    };
  }

  return {
    httpAgent: proxyAgent,
    httpsAgent: proxyAgent,
    proxy: false as const,
  };
}

function getPlaywrightProxyConfig() {
  const proxyUrl = getDubaiPoliceProxyUrl();
  if (!proxyUrl) return undefined;

  const parsed = new URL(proxyUrl);
  const server = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;

  return {
    server,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
  };
}

function normalizeBaseUrl(raw: string) {
  return raw.trim().replace(/\/+$/, "");
}

function isDubaiPoliceRelayEnabled() {
  const raw = process.env.DUBAI_POLICE_RELAY_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function getDubaiPoliceRelayBaseUrl() {
  const raw = process.env.DUBAI_POLICE_RELAY_URL?.trim();
  if (!raw) return null;
  return normalizeBaseUrl(raw);
}

function getDubaiPoliceRelayToken() {
  return process.env.DUBAI_POLICE_RELAY_TOKEN?.trim() || "";
}

async function requestViaRelay<T = AnyRecord>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T | null> {
  if (!isDubaiPoliceRelayEnabled()) return null;

  const relayBaseUrl = getDubaiPoliceRelayBaseUrl();
  if (!relayBaseUrl) {
    throw new Error("Dubai Police relay is enabled but DUBAI_POLICE_RELAY_URL is missing");
  }

  const relayToken = getDubaiPoliceRelayToken();
  if (!relayToken) {
    throw new Error("Dubai Police relay is enabled but DUBAI_POLICE_RELAY_TOKEN is missing");
  }

  const response = await axios.request({
    method,
    url: `${relayBaseUrl}${path}`,
    data: body,
    timeout: 30000,
    validateStatus: () => true,
    headers: {
      "x-relay-token": relayToken,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
  });

  if (response.status >= 400) {
    const message = response.data?.errorMessage || `Relay returned HTTP ${response.status}`;
    throw new Error(message);
  }

  return (response.data?.data ?? null) as T | null;
}

function buildPlaywrightLaunchArgs() {
  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ];
}

function buildPlaywrightContextOptions() {
  return {
    locale: "ar-AE",
    userAgent: API_HEADERS["User-Agent"],
  };
}


export interface FineResult {
  fineNumber?: string;
  fineDate?: string;
  description?: string;
  descriptionAr?: string;
  amount?: string;
  blackPoints?: number;
  isPaid?: "paid" | "unpaid" | "partial";
  fineType?: "payable" | "blackpoints" | "unpayable" | "impound";
  location?: string;
  locationAr?: string;
  ticketNo?: string;
  trafficDepartment?: string;
  trafficDepartmentAr?: string;
  violationCode?: string;
  source?: string;
  sourceAr?: string;
  speed?: string;
}

export interface ScraperResult {
  success: boolean;
  fines: FineResult[];
  totalAmount?: string;
  errorMessage?: string;
  ownerInfo?: {
    maskedMobileNumber?: string;
  };
}

type AnyRecord = Record<string, any>;

interface ResolvedPlateCodeMeta {
  resolvedPlateCodeId: number;
  plateCat: number;
}

export interface PlateCodeOption {
  value: string;
  label: string;
  labelEn: string;
  labelAr: string;
  categoryId: number;
  codeId: number;
}

interface PlateCodeCacheEntry {
  expiresAt: number;
  codes: AnyRecord[];
  options: PlateCodeOption[];
}

interface ExplicitPlateMeta {
  plateCodeId?: number;
  plateCategory?: number;
}

interface StaticPlateSourceEntry {
  sourceId?: number;
  codes?: AnyRecord[];
}

type StaticPlateDataset = Record<string, StaticPlateSourceEntry>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadStaticPlateData(): StaticPlateDataset {
  try {
    const raw = readFileSync(path.join(__dirname, "plate-data-all.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as StaticPlateDataset : {};
  } catch (error) {
    console.warn("[Scraper] Failed to load static plate data fallback", error);
    return {};
  }
}

const STATIC_PLATE_DATA = loadStaticPlateData();

// قائمة الإمارات مع الكودات الحقيقية من موقع شرطة دبي
export const PLATE_SOURCES = [
  { value: "DXB", label: "دبي", labelEn: "Dubai" },
  { value: "AUH", label: "أبوظبي", labelEn: "Abu Dhabi" },
  { value: "SHJ", label: "الشارقة", labelEn: "Sharjah" },
  { value: "AJM", label: "عجمان", labelEn: "Ajman" },
  { value: "UMQ", label: "أم القيوين", labelEn: "Umm Al Quwain" },
  { value: "RAK", label: "رأس الخيمة", labelEn: "Ras Al Khaimah" },
  { value: "FUJ", label: "الفجيرة", labelEn: "Fujairah" },
  { value: "OMN", label: "عُمان", labelEn: "Oman" },
  { value: "QAT", label: "قطر", labelEn: "Qatar" },
  { value: "KWT", label: "الكويت", labelEn: "Kuwait" },
  { value: "BAH", label: "البحرين", labelEn: "Bahrain" },
  { value: "KSA", label: "السعودية", labelEn: "Saudi Arabia" },
];

const OFFICIAL_PLATE_SOURCE_IDS: Record<string, number> = {
  BAH: 35,
  KSA: 84,
  OMN: 103,
  QAT: 118,
  KWT: 129,
};

function resolvePlateSourceApiValue(plateSrcCode: string): string {
  const normalizedPlateSrcCode = normalizeCompare(plateSrcCode);
  const staticSourceId = parsePositiveInt(getStaticPlateSourceData(normalizedPlateSrcCode)?.sourceId);
  if (staticSourceId) return String(staticSourceId);

  const mappedSourceId = OFFICIAL_PLATE_SOURCE_IDS[normalizedPlateSrcCode];
  return mappedSourceId ? String(mappedSourceId) : normalizedPlateSrcCode;
}

// كودات دبي المعروفة محليًا كمرجع سريع عندما ينجح المطابقة المباشرة
export const PLATE_CODES = [
  { value: "2", label: "A", categoryId: 2 },
  { value: "3", label: "B", categoryId: 2 },
  { value: "4", label: "C", categoryId: 2 },
  { value: "5", label: "D", categoryId: 2 },
  { value: "6", label: "E", categoryId: 2 },
  { value: "7", label: "F", categoryId: 2 },
  { value: "68", label: "G", categoryId: 2 },
  { value: "70", label: "H", categoryId: 2 },
  { value: "71", label: "I", categoryId: 2 },
  { value: "78", label: "J", categoryId: 2 },
  { value: "80", label: "K", categoryId: 2 },
  { value: "74", label: "L", categoryId: 2 },
  { value: "69", label: "M", categoryId: 2 },
  { value: "95", label: "N", categoryId: 2 },
  { value: "88", label: "O", categoryId: 2 },
  { value: "93", label: "Q", categoryId: 2 },
  { value: "79", label: "R", categoryId: 2 },
  { value: "87", label: "S", categoryId: 2 },
  { value: "97", label: "T", categoryId: 2 },
  { value: "98", label: "U", categoryId: 2 },
  { value: "86", label: "V", categoryId: 2 },
  { value: "99", label: "W", categoryId: 2 },
  { value: "100", label: "X", categoryId: 2 },
  { value: "102", label: "Y", categoryId: 2 },
  { value: "101", label: "Z", categoryId: 2 },
];

const DUBAI_POLICE_API = "https://www.dubaipolice.gov.ae/dpapp";
const PLATE_CODE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const plateCodeCache = new Map<string, PlateCodeCacheEntry>();

const API_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ar,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer:
    "https://www.dubaipolice.gov.ae/app/services/fine-payment/details",
  Origin: "https://www.dubaipolice.gov.ae",
};

const API_GET_HEADERS = {
  Accept: API_HEADERS.Accept,
  "Accept-Language": API_HEADERS["Accept-Language"],
  "User-Agent": API_HEADERS["User-Agent"],
  Referer: API_HEADERS.Referer,
  Origin: API_HEADERS.Origin,
};

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵٦٧٨٩".indexOf(d)));
}

function normalizeCompare(value: unknown) {
  return normalizeDigits(String(value ?? ""))
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizeLooseCompare(value: unknown) {
  return normalizeCompare(value).replace(/[\s\-_/]+/g, "");
}

function parsePositiveInt(value: unknown): number | undefined {
  const normalized = normalizeDigits(String(value ?? "")).trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseRawJson(raw: unknown): AnyRecord | null {
  if (raw && typeof raw === "object") return raw as AnyRecord;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("<")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractCodes(data: AnyRecord | null): AnyRecord[] {
  if (!data) return [];
  const possible = [
    data.codes,
    data.results?.codes,
    data.result?.codes,
    data.data?.codes,
    data.items,
  ];
  for (const candidate of possible) {
    if (Array.isArray(candidate)) return candidate as AnyRecord[];
  }
  return [];
}

function extractPlateCodeId(code: AnyRecord): number | undefined {
  return parsePositiveInt(code.value ?? code.id ?? code.codeId ?? code.plateCodeId);
}

function extractPlateCategory(code: AnyRecord): number {
  return parsePositiveInt(code.categoryId ?? code.plateCat ?? code.category) ?? 2;
}

function getPlateCodeDisplayLabel(code: AnyRecord): string {
  return String(
    code.labelEn
      ?? code.label
      ?? code.labelAr
      ?? code.descriptionEn
      ?? code.description
      ?? code.descriptionAr
      ?? code.name
      ?? code.code
      ?? code.value
      ?? code.id
      ?? ""
  ).trim();
}

function mapCodeToPlateCodeOption(code: AnyRecord): PlateCodeOption | null {
  const codeId = extractPlateCodeId(code);
  if (!codeId) return null;

  const labelEn = String(code.labelEn ?? code.label ?? code.descriptionEn ?? code.description ?? code.name ?? code.code ?? codeId).trim();
  const labelAr = String(code.labelAr ?? code.descriptionAr ?? code.label ?? code.description ?? labelEn).trim();
  const label = labelEn || labelAr || String(codeId);

  return {
    value: String(codeId),
    label,
    labelEn,
    labelAr,
    categoryId: extractPlateCategory(code),
    codeId,
  };
}

function dedupePlateCodeOptions(options: PlateCodeOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = `${option.codeId}:${option.categoryId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getStaticPlateSourceData(plateSrcCode: string): StaticPlateSourceEntry | null {
  const normalizedPlateSrcCode = normalizeCompare(plateSrcCode);
  const sourceData = STATIC_PLATE_DATA[normalizedPlateSrcCode];
  return sourceData && typeof sourceData === "object" ? sourceData : null;
}

function getStaticPlateCodeOptions(plateSrcCode: string): PlateCodeOption[] {
  const staticCodes = extractCodes(getStaticPlateSourceData(plateSrcCode) as AnyRecord | null);
  if (staticCodes.length) {
    return dedupePlateCodeOptions(staticCodes.map(mapCodeToPlateCodeOption).filter(Boolean) as PlateCodeOption[]);
  }

  if (normalizeCompare(plateSrcCode) !== "DXB") return [];

  return PLATE_CODES.map((code) => ({
    value: String(code.value),
    label: code.label,
    labelEn: code.label,
    labelAr: code.label,
    categoryId: code.categoryId || 2,
    codeId: Number.parseInt(code.value, 10),
  }));
}

function getStaticPlateCodeRecords(plateSrcCode: string): AnyRecord[] {
  const staticCodes = extractCodes(getStaticPlateSourceData(plateSrcCode) as AnyRecord | null);
  if (staticCodes.length) return staticCodes;

  if (normalizeCompare(plateSrcCode) !== "DXB") return [];

  return PLATE_CODES.map((option) => ({
    value: option.value,
    codeId: Number.parseInt(option.value, 10),
    plateCodeId: Number.parseInt(option.value, 10),
    label: option.label,
    labelEn: option.label,
    labelAr: option.label,
    categoryId: option.categoryId,
    plateCat: option.categoryId,
  }));
}

function getCachedPlateCodeEntry(plateSrcCode: string) {
  const cacheKey = normalizeCompare(plateSrcCode);
  const cached = plateCodeCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    plateCodeCache.delete(cacheKey);
    return null;
  }
  return cached;
}

function setCachedPlateCodeEntry(plateSrcCode: string, codes: AnyRecord[]) {
  const cacheKey = normalizeCompare(plateSrcCode);
  const options = dedupePlateCodeOptions(codes.map(mapCodeToPlateCodeOption).filter(Boolean) as PlateCodeOption[]);
  const entry: PlateCodeCacheEntry = {
    expiresAt: Date.now() + PLATE_CODE_CACHE_TTL_MS,
    codes,
    options,
  };
  plateCodeCache.set(cacheKey, entry);
  return entry;
}

async function fetchPlateCodesViaCurl(plateSrcCode: string): Promise<AnyRecord[]> {
  try {
    const curlArgs = [
      "-sS",
      `${DUBAI_POLICE_API}/finespayment/getPlateData/${encodeURIComponent(resolvePlateSourceApiValue(plateSrcCode))}`,
      ...Object.entries(API_GET_HEADERS).flatMap(([key, value]) => ["-H", `${key}: ${value}`]),
    ];

    const { stdout } = await execFileAsync("curl", curlArgs, {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    return extractCodes(parseRawJson(stdout));
  } catch (error) {
    console.warn(`[Scraper] curl fallback failed for plate data ${plateSrcCode}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

function resolvePlateCodeMetaFromList(
  codes: AnyRecord[],
  requestedPlateCode: string
): ResolvedPlateCodeMeta | null {
  const wantedExact = normalizeCompare(requestedPlateCode);
  const wantedLoose = normalizeLooseCompare(requestedPlateCode);
  if (!wantedExact) return null;

  const isMatch = (code: AnyRecord, loose = false) => {
    const candidates = [
      code.value,
      code.id,
      code.codeId,
      code.plateCodeId,
      code.label,
      code.labelEn,
      code.labelAr,
      code.description,
      code.descriptionEn,
      code.descriptionAr,
      code.name,
      code.code,
    ];
    return candidates.some((candidate) => {
      const normalized = loose ? normalizeLooseCompare(candidate) : normalizeCompare(candidate);
      return normalized === (loose ? wantedLoose : wantedExact);
    });
  };

  const matched = codes.find((code) => isMatch(code, false)) ?? codes.find((code) => isMatch(code, true));
  const resolvedPlateCodeId = parsePositiveInt(
    matched?.value ?? matched?.id ?? matched?.codeId ?? matched?.plateCodeId ?? requestedPlateCode
  );

  if (!resolvedPlateCodeId) return null;

  return {
    resolvedPlateCodeId,
    plateCat: extractPlateCategory(matched ?? {}),
  };
}

function resolvePlateCodeMeta(
  plateSrcCode: string,
  requestedPlateCode: string,
  codesFromApi: AnyRecord[] = [],
  explicitMeta: ExplicitPlateMeta = {}
): ResolvedPlateCodeMeta {
  const explicitCodeId = parsePositiveInt(explicitMeta.plateCodeId);
  const explicitPlateCategory = parsePositiveInt(explicitMeta.plateCategory);
  if (explicitCodeId) {
    return {
      resolvedPlateCodeId: explicitCodeId,
      plateCat: explicitPlateCategory ?? 2,
    };
  }

  const fromApi = resolvePlateCodeMetaFromList(codesFromApi, requestedPlateCode);
  if (fromApi) return fromApi;

  const normalizedPlateSrcCode = normalizeCompare(plateSrcCode) || "DXB";
  const fromStatic = resolvePlateCodeMetaFromList(getStaticPlateCodeRecords(normalizedPlateSrcCode), requestedPlateCode);
  if (fromStatic) return fromStatic;

  const fromDubaiFallback = normalizedPlateSrcCode === "DXB"
    ? null
    : resolvePlateCodeMetaFromList(getStaticPlateCodeRecords("DXB"), requestedPlateCode);
  if (fromDubaiFallback) return fromDubaiFallback;

  return {
    resolvedPlateCodeId: parsePositiveInt(requestedPlateCode) ?? 0,
    plateCat: explicitPlateCategory ?? 2,
  };
}

function isDubaiPoliceNoFinesLikeResponse(data: AnyRecord) {
  const errorCode = String(data?.errorCode ?? data?.code ?? "").trim();
  const errorMessage = String(data?.errorMessage ?? data?.message ?? "").trim().toLowerCase();
  const results = data?.results && typeof data.results === "object" ? data.results : {};
  const tickets = Array.isArray(results?.tickets) ? results.tickets : [];
  const confisticated = Array.isArray(results?.confisticated)
    ? results.confisticated
    : Array.isArray(results?.confiscated)
      ? results.confiscated
      : [];

  if (tickets.length > 0 || confisticated.length > 0) return false;

  return (
    errorCode === "DP_Ex_Code_000"
    || errorMessage.includes("no outstanding fines")
    || errorMessage.includes("no fines")
  );
}

function resolveTicketFineType(ticket: AnyRecord): FineResult["fineType"] {
  if (ticket?.isPayable === 2) return "payable";
  if (ticket?.isPayable === 1 && ticket?.licenseShouldbePresented) return "blackpoints";
  if (ticket?.isPayable === 1 && !ticket?.licenseShouldbePresented) return "unpayable";
  return "impound";
}

function mapTicketToFineResult(ticket: AnyRecord): FineResult {
  const dateTime = ticket.ticketDate && ticket.ticketTime
    ? `${ticket.ticketDate} ${ticket.ticketTime}`
    : ticket.ticketDate || ticket.date || "";

  const violation = ticket.ticketViolation
    || ticket.violationDescriptionAr
    || ticket.violationDescriptionEn
    || ticket.description
    || "";

  const sourceText = ticket.beneficiary
    || ticket.trafficDepartmentEn
    || ticket.trafficDepartment
    || "";

  const speedValue = ticket.ticketSpeed?.toString()
    || ticket.vehicleSpeed?.toString()
    || ticket.measuredSpeed?.toString()
    || ticket.speed?.toString()
    || "";

  return {
    fineNumber: ticket.ticketNo?.toString(),
    fineDate: dateTime,
    description: violation,
    descriptionAr: ticket.violationDescriptionAr || ticket.ticketViolation,
    amount: ticket.ticketTotalFine?.toString()
      || ticket.ticketFine?.toString()
      || ticket.totalFine?.toString()
      || ticket.amount?.toString(),
    blackPoints: ticket.offenseBlackPionts || ticket.offenseBlackPoints || ticket.blackPoints || 0,
    isPaid: ticket.isPaid ? "paid" : "unpaid",
    fineType: resolveTicketFineType(ticket),
    location: ticket.location || ticket.locationEn || "",
    locationAr: ticket.location || "",
    ticketNo: ticket.ticketNo?.toString(),
    trafficDepartment: sourceText,
    trafficDepartmentAr: ticket.beneficiary || "",
    violationCode: ticket.violationCode?.toString(),
    source: sourceText,
    sourceAr: ticket.beneficiary || "",
    speed: speedValue || undefined,
  };
}

function mapConfisticatedToFineResult(item: AnyRecord): FineResult {
  const sourceText = item.beneficiary
    || item.trafficDepartmentEn
    || item.trafficDepartment
    || "";

  return {
    fineNumber: item.ticketNo?.toString() || item.vehicleConfiscationId?.toString(),
    fineDate: item.bookingDate || item.ticketDate || item.date || "",
    description: item.violationRglDescription
      || item.ticketViolation
      || item.violationDescriptionEn
      || item.description
      || item.descEn
      || item.descAr
      || "",
    descriptionAr: item.violationRglDescription
      || item.ticketViolation
      || item.violationDescriptionAr
      || item.descAr
      || item.description
      || "",
    amount: item.ticketTotalFine?.toString()
      || item.totalFine?.toString()
      || item.confiscationAmount?.toString()
      || item.amount?.toString()
      || "0",
    blackPoints: item.offenseBlackPionts || item.offenseBlackPoints || item.blackPoints || 0,
    isPaid: item.isPaid ? "paid" : "unpaid",
    fineType: "impound",
    location: item.location || item.locationEn || item.impoundLocation || "",
    locationAr: item.location || item.impoundLocation || "",
    ticketNo: item.ticketNo?.toString() || item.vehicleConfiscationId?.toString(),
    trafficDepartment: sourceText || item.branchEn || item.trafficDepartment?.toString() || "",
    trafficDepartmentAr: item.beneficiary || item.branchAr || "",
    violationCode: item.violationCode?.toString() || item.vehicleConfiscationId?.toString(),
    source: sourceText || item.branchEn || item.trafficDepartment?.toString() || "",
    sourceAr: item.beneficiary || item.branchAr || "",
    speed: item.vehicleSpeed?.toString() || item.ticketSpeed?.toString() || undefined,
  };
}

function mapApiDataToScraperResult(data: AnyRecord | null): ScraperResult {
  if (!data) {
    return {
      success: false,
      fines: [],
      errorMessage: "تعذّر قراءة استجابة خدمة شرطة دبي. يرجى المحاولة مرة أخرى.",
    };
  }

  const results = data.results && typeof data.results === "object" ? data.results : {};
  const tickets: AnyRecord[] = Array.isArray(results.tickets) ? results.tickets : [];
  const confisticated: AnyRecord[] = Array.isArray(results.confisticated)
    ? results.confisticated
    : Array.isArray(results.confiscated)
      ? results.confiscated
      : [];
  const ownerInfo = results.ownerInfo;

  if (!data.resCode && isDubaiPoliceNoFinesLikeResponse(data)) {
    return {
      success: true,
      fines: [],
      totalAmount: "0.00",
      ownerInfo: ownerInfo
        ? { maskedMobileNumber: ownerInfo.maskedMobileNumber }
        : undefined,
    };
  }

  if (!data.resCode) {
    return {
      success: false,
      fines: [],
      errorMessage: data.message || data.errorMessage || "لم يتم العثور على بيانات للوحة المدخلة",
    };
  }


  const fines: FineResult[] = [
    ...tickets.map(mapTicketToFineResult),
    ...confisticated.map(mapConfisticatedToFineResult),
  ];

  const totalAmount = fines.reduce((sum, fine) => {
    return sum + Number.parseFloat(fine.amount?.replace(/[^0-9.]/g, "") || "0");
  }, 0);

  return {
    success: true,
    fines,
    totalAmount: totalAmount.toFixed(2),
    ownerInfo: ownerInfo
      ? { maskedMobileNumber: ownerInfo.maskedMobileNumber }
      : undefined,
  };
}

async function performHttpQuery(
  plateSrcCode: string,
  plateNo: string,
  resolvedPlateCodeId: number,
  plateCat: number
): Promise<AnyRecord | null> {
  const apiPlateSource = resolvePlateSourceApiValue(plateSrcCode);

  const response = await axios.post(
    `${DUBAI_POLICE_API}/finespayment/searchFines`,
    {
      inquiryType: 3,
      plateNo,
      plateCat,
      plateSrcCode: apiPlateSource,
      plateCodeId: resolvedPlateCodeId,
    },
    {
      headers: API_HEADERS,
      timeout: 20000,
      responseType: "text",
      transformResponse: [(data) => data],
      validateStatus: () => true,
      ...getAxiosNetworkConfig(),
    }
  );

  if (response.status >= 400) {
    throw new Error(`Dubai Police API returned HTTP ${response.status}`);
  }

  return parseRawJson(response.data);
}

export async function fetchPlateCodesFromApi(plateSrcCode: string, options?: { forceRefresh?: boolean }) {
  const normalizedPlateSrcCode = normalizeCompare(plateSrcCode);
  const cached = !options?.forceRefresh ? getCachedPlateCodeEntry(normalizedPlateSrcCode) : null;
  if (cached) {
    return cached.codes;
  }

  try {
    let codes: AnyRecord[] = [];

    const response = await axios.get(
      `${DUBAI_POLICE_API}/finespayment/getPlateData/${resolvePlateSourceApiValue(normalizedPlateSrcCode)}`,
      {
        headers: API_GET_HEADERS,
        timeout: 10000,
        responseType: "text",
        transformResponse: [(data) => data],
        validateStatus: () => true,
        ...getAxiosNetworkConfig(),
      }
    );

    if (response.status < 400) {
      codes = extractCodes(parseRawJson(response.data));
    }

    if (!codes.length) {
      codes = await fetchPlateCodesViaCurl(normalizedPlateSrcCode);
    }

    if (!codes.length) {
      codes = getStaticPlateCodeRecords(normalizedPlateSrcCode);
    }

    setCachedPlateCodeEntry(normalizedPlateSrcCode, codes);
    return codes;
  } catch {
    const fallbackCodes = getCachedPlateCodeEntry(normalizedPlateSrcCode)?.codes
      ?? await fetchPlateCodesViaCurl(normalizedPlateSrcCode)
      ?? getStaticPlateCodeRecords(normalizedPlateSrcCode);

    if (fallbackCodes.length) {
      setCachedPlateCodeEntry(normalizedPlateSrcCode, fallbackCodes);
    }

    return fallbackCodes.length ? fallbackCodes : getStaticPlateCodeRecords(normalizedPlateSrcCode);
  }
}

export async function getPlateCodeOptions(plateSrcCode: string) {
  const normalizedPlateSrcCode = normalizeCompare(plateSrcCode);
  const cached = getCachedPlateCodeEntry(normalizedPlateSrcCode);
  if (cached) {
    return cached.options;
  }

  const codes = await fetchPlateCodesFromApi(normalizedPlateSrcCode);
  return getCachedPlateCodeEntry(normalizedPlateSrcCode)?.options
    ?? dedupePlateCodeOptions(codes.map(mapCodeToPlateCodeOption).filter(Boolean) as PlateCodeOption[]);
}

export async function scrapeDubaiFines(
  plateSrcCode: string,
  plateNo: string,
  plateCodeId: string,
  explicitMeta: ExplicitPlateMeta = {}
): Promise<ScraperResult> {
  const normalizedPlateSrcCode = normalizeCompare(plateSrcCode);
  const normalizedPlateNo = normalizeDigits(String(plateNo ?? "")).trim();
  const normalizedPlateCode = String(plateCodeId ?? "").trim();

  // 1. Resolve metadata first
  const apiCodes = await fetchPlateCodesFromApi(normalizedPlateSrcCode);
  const { resolvedPlateCodeId, plateCat } = resolvePlateCodeMeta(normalizedPlateSrcCode, normalizedPlateCode, apiCodes, explicitMeta);

  console.log(
    `[Scraper] Starting inquiry: plateNo=${normalizedPlateNo} plateSrcCode=${normalizedPlateSrcCode} code=${normalizedPlateCode} id=${resolvedPlateCodeId} cat=${plateCat}`
  );

  // 2. Path A: Direct API (with optional Proxy support)
  try {
    const data = await performHttpQuery(
      normalizedPlateSrcCode,
      normalizedPlateNo,
      resolvedPlateCodeId,
      plateCat
    );

    if (data) {
      console.log("[Scraper] Direct API success");
      return mapApiDataToScraperResult(data);
    }
  } catch (err: any) {
    console.warn(`[Scraper] Direct API failed: ${err?.message || "unknown error"}`);
  }

  // 3. Path B: Relay Fallback (if enabled)
  if (isDubaiPoliceRelayEnabled()) {
    try {
      console.log("[Scraper] Attempting Relay fallback...");
      const relayResult = await requestViaRelay<ScraperResult>("POST", "/relay/scrape", {
        plateSource: normalizedPlateSrcCode,
        plateNumber: normalizedPlateNo,
        plateCode: normalizedPlateCode,
        plateCodeId: resolvedPlateCodeId,
        plateCategory: plateCat,
      });

      if (relayResult && relayResult.success) {
        console.log("[Scraper] Relay fallback success");
        return relayResult;
      }
    } catch (relayErr: any) {
      console.warn(`[Scraper] Relay fallback failed: ${relayErr?.message || "unknown error"}`);
    }
  }

  // 4. Path C: Browser Fallback (Playwright with optional Proxy)
  console.log("[Scraper] Switching to browser fallback...");
  return await tryPlaywrightFallback(
    normalizedPlateSrcCode,
    normalizedPlateNo,
    normalizedPlateCode,
    plateCat,
    resolvedPlateCodeId
  );
}

const PLAYWRIGHT_FALLBACK_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.PLAYWRIGHT_FALLBACK_CONCURRENCY || "3", 10) || 3
);
let activePlaywrightFallbacks = 0;
const playwrightFallbackWaiters: Array<() => void> = [];

async function withPlaywrightFallbackSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activePlaywrightFallbacks >= PLAYWRIGHT_FALLBACK_CONCURRENCY) {
    await new Promise<void>((resolve) => {
      playwrightFallbackWaiters.push(resolve);
    });
  }

  activePlaywrightFallbacks += 1;
  try {
    return await task();
  } finally {
    activePlaywrightFallbacks = Math.max(0, activePlaywrightFallbacks - 1);
    const next = playwrightFallbackWaiters.shift();
    if (next) next();
  }
}

async function tryPlaywrightFallback(
  plateSrcCode: string,
  plateNo: string,
  requestedPlateCode: string,
  initialPlateCat: number,
  initialResolvedPlateCodeId?: number
): Promise<ScraperResult> {
  return await withPlaywrightFallbackSlot(async () => {
    let browser: any = null;

    try {
    const { chromium } = await import("playwright");
    const executablePaths = [
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/usr/bin/google-chrome",
      undefined,
    ];

    for (const execPath of executablePaths) {
      try {
        const launchOpts: AnyRecord = {
          headless: true,
          args: buildPlaywrightLaunchArgs(),
        };
        const playwrightProxy = getPlaywrightProxyConfig();
        if (playwrightProxy) {
          launchOpts.proxy = playwrightProxy;
          console.log(`[Scraper] Playwright proxy enabled via ${redactProxyUrl(getDubaiPoliceProxyUrl())}`);
        }
        if (execPath) launchOpts.executablePath = execPath;
        browser = await chromium.launch(launchOpts);
        console.log(`[Scraper] Playwright launched with: ${execPath || "default"}`);
        break;
      } catch {
        continue;
      }
    }

    if (!browser) {
      return {
        success: false,
        fines: [],
        errorMessage: "تعذّر الاتصال بموقع شرطة دبي. يرجى المحاولة مرة أخرى لاحقاً.",
      };
    }

    const page = await browser.newPage(buildPlaywrightContextOptions());

    await page.goto(
      "https://www.dubaipolice.gov.ae/app/services/fine-payment/details",
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await page.waitForTimeout(3500);

    const browserResult = await page.evaluate(async (params: {
      plateSrcCode: string;
      plateNo: string;
      requestedPlateCode: string;
      initialPlateCat?: number;
      initialResolvedPlateCodeId?: number;
    }) => {
      const {
        plateSrcCode,
        plateNo,
        requestedPlateCode,
        initialPlateCat,
        initialResolvedPlateCodeId,
      } = params;
      const normalizeDigits = (value: string) => value
        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵٦٧٨٩".indexOf(d)));

      const normalizeCompare = (value: unknown) => normalizeDigits(String(value ?? ""))
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

      const parsePositiveInt = (value: unknown) => {
        const normalized = normalizeDigits(String(value ?? "")).trim();
        if (!/^\d+$/.test(normalized)) return undefined;
        const parsed = Number.parseInt(normalized, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      };

      const parseJsonResponse = async (response: Response) => {
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch {
          return { __raw: text, __status: response.status };
        }
      };

      let codes: any[] = [];
      try {
        const sourceIdMap: Record<string, number> = { BAH: 35, KSA: 84, OMN: 103, QAT: 118, KWT: 129 };
        const apiPlateSource = sourceIdMap[normalizeCompare(plateSrcCode)] ? String(sourceIdMap[normalizeCompare(plateSrcCode)]) : plateSrcCode;
        const codesResponse = await fetch(`/dpapp/finespayment/getPlateData/${apiPlateSource}`, {
          headers: { Accept: "application/json, text/plain, */*" },
          credentials: "include",
        });
        const codesData = await parseJsonResponse(codesResponse);
        codes = Array.isArray(codesData?.codes)
          ? codesData.codes
          : Array.isArray(codesData?.results?.codes)
            ? codesData.results.codes
            : [];
      } catch {
        codes = [];
      }

      const wanted = normalizeCompare(requestedPlateCode);
      const matched = codes.find((code) => {
        const candidates = [
          code.value,
          code.id,
          code.codeId,
          code.plateCodeId,
          code.label,
          code.labelEn,
          code.labelAr,
          code.description,
          code.descriptionEn,
          code.descriptionAr,
          code.name,
          code.code,
        ];
        return candidates.some((candidate) => normalizeCompare(candidate) === wanted);
      });

      const resolvedPlateCodeId = parsePositiveInt(
        matched?.value ?? matched?.id ?? matched?.codeId ?? matched?.plateCodeId ?? initialResolvedPlateCodeId ?? requestedPlateCode
      ) ?? 0;
      const resolvedPlateCat = parsePositiveInt(
        matched?.categoryId ?? matched?.plateCat ?? matched?.category ?? initialPlateCat
      ) ?? 2;

      const searchResponse = await fetch("/dpapp/finespayment/searchFines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
        },
        credentials: "include",
        body: JSON.stringify({
          inquiryType: 3,
          plateNo,
          plateCat: resolvedPlateCat,
          plateSrcCode,
          plateCodeId: resolvedPlateCodeId,
        }),
      });

      const searchData = await parseJsonResponse(searchResponse);
      return {
        resolvedPlateCodeId,
        resolvedPlateCat,
        searchData,
      };
    }, {
      plateSrcCode,
      plateNo,
      requestedPlateCode,
      initialPlateCat,
      initialResolvedPlateCodeId: initialResolvedPlateCodeId ?? null,
    });

    await browser.close().catch(() => {});
    browser = null;

    const parsed = parseRawJson(browserResult?.searchData);
    if (parsed) {
      console.log(
        `[Scraper] Browser fallback resolved plateCodeId=${browserResult?.resolvedPlateCodeId} plateCat=${browserResult?.resolvedPlateCat}`
      );
      return mapApiDataToScraperResult(parsed);
    }

    return {
      success: false,
      fines: [],
      errorMessage: "تعذّر الاتصال بموقع شرطة دبي. يرجى المحاولة مرة أخرى.",
    };
    } catch (err: any) {
      console.error("[Scraper] Playwright fallback error:", err?.message || err);
      return {
        success: false,
        fines: [],
        errorMessage: "تعذّر الاتصال بموقع شرطة دبي. يرجى المحاولة مرة أخرى لاحقاً.",
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  });
}
