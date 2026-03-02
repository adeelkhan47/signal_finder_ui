import { useState, useRef, useEffect, useCallback } from 'react';
import type { Earthquake } from '../types/earthquake';
import type { Channel } from '../types/channel';

/**
 * Parse date and hour from WAV filename.
 * Supports: "C01 _ 2026/01/15 _ 08hs..." or "C01 _ 2026:01:16 _ 06hs..." (slash or colon in date)
 */
function parseWavTimestamp(name: string): number | null {
  const normalized = name.replace(/[/:]/g, '-');
  const match = normalized.match(/[\s_]*(\d{4})-(\d{2})-(\d{2})[\s_]+(\d{1,2})hs/);
  if (match) {
    const [, y, m, d, h] = match;
    const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10), parseInt(h!, 10), 0, 0);
    return date.getTime();
  }
  const dateMatch = normalized.match(/(\d{4})[-\/](\d{2})[-\/](\d{2})/);
  const hourMatch = normalized.match(/(\d{1,2})hs/);
  if (dateMatch && hourMatch) {
    const [, y, m, d] = dateMatch;
    const h = hourMatch[1];
    const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10), parseInt(h!, 10), 0, 0);
    return date.getTime();
  }
  return null;
}

function getHourKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}`;
}

interface WavFileInfo {
  file: File;
  startTime: number;
  hourKey: string;
}

interface GetWavResult {
  list: WavFileInfo[];
  allWavNames: string[];
  /** When using folder picker: number of entries seen (0 = folder returned empty) */
  entriesCount?: number;
  /** When using file input with webkitdirectory: folder name from first file's path */
  folderName?: string;
}

async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    if (handle.queryPermission) {
      const state = await handle.queryPermission({ mode: 'read' });
      if (state === 'granted') return true;
      if (handle.requestPermission && state === 'prompt') {
        const result = await handle.requestPermission({ mode: 'read' });
        return result === 'granted';
      }
      return state === 'granted';
    }
    return true;
  } catch {
    return false;
  }
}

async function getWavFilesFromHandleRecursive(
  handle: FileSystemDirectoryHandle,
  list: WavFileInfo[],
  allWavNames: string[],
  folderPath: string,
  logEntries: (kind: string, name: string) => void,
): Promise<void> {
  const allowed = await ensureReadPermission(handle);
  if (!allowed) {
    console.warn('[WavWaveformPanel] No read permission for folder:', folderPath);
    return;
  }
  for await (const [, entry] of handle.entries()) {
    logEntries(entry.kind, entry.name);
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.wav')) {
      allWavNames.push(entry.name);
      const file = await (entry as FileSystemFileHandle).getFile();
      const startTime = parseWavTimestamp(entry.name);
      if (startTime != null) {
        list.push({ file, startTime, hourKey: getHourKey(startTime) });
      }
    } else if (entry.kind === 'directory') {
      await getWavFilesFromHandleRecursive(
        entry as FileSystemDirectoryHandle,
        list,
        allWavNames,
        `${folderPath}/${entry.name}`,
        logEntries,
      );
    }
  }
}

async function getWavFilesFromHandle(handle: FileSystemDirectoryHandle): Promise<GetWavResult> {
  const list: WavFileInfo[] = [];
  const allWavNames: string[] = [];
  const entriesSeen: { kind: string; name: string }[] = [];

  console.group('[WavWaveformPanel] Folder selected:', handle.name);
  try {
    const allowed = await ensureReadPermission(handle);
    if (!allowed) {
      console.error('[WavWaveformPanel] Read permission denied for folder:', handle.name);
    }
    await getWavFilesFromHandleRecursive(
      handle,
      list,
      allWavNames,
      handle.name,
      (kind, name) => entriesSeen.push({ kind, name }),
    );
    console.log('All entries in folder (and subfolders):', entriesSeen.length, entriesSeen);
    console.log('All .wav file names found:', allWavNames.length, allWavNames);
    if (allWavNames.length > 0) {
      allWavNames.forEach((name, i) => console.log(`  [${i + 1}] ${name}`));
    }
  } finally {
    console.groupEnd();
  }

  list.sort((a, b) => a.startTime - b.startTime);
  return { list, allWavNames, entriesCount: entriesSeen.length };
}

async function getWavFilesFromInput(files: FileList | null): Promise<GetWavResult> {
  const list: WavFileInfo[] = [];
  const allWavNames: string[] = [];
  let folderName: string | undefined;
  if (!files || files.length === 0) {
    console.log('[WavWaveformPanel] File input: no files selected');
    return { list, allWavNames };
  }
  const firstFile = files[0];
  const relativePath = (firstFile as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (relativePath && relativePath.includes('/')) {
    folderName = relativePath.split('/')[0];
  }
  console.group('[WavWaveformPanel] Files selected via input (count:', files.length, folderName ? `, folder: ${folderName}` : '', ')');
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file!.name.toLowerCase().endsWith('.wav')) {
      allWavNames.push(file!.name);
      const startTime = parseWavTimestamp(file!.name);
      if (startTime != null) {
        list.push({ file: file!, startTime, hourKey: getHourKey(startTime) });
      }
    }
  }
  console.log('All .wav file names:', allWavNames.length, allWavNames);
  allWavNames.forEach((name, i) => console.log(`  [${i + 1}] ${name}`));
  console.groupEnd();
  list.sort((a, b) => a.startTime - b.startTime);
  return { list, allWavNames, folderName };
}

const EXPECTED_FORMAT =
  'C01 _ 2026/01/15 _ 08hs... or C01 _ 2026:01:16 _ 06hs... (date with / or :)';

function buildNoMatchError(allWavNames: string[], folderReturnedZeroEntries?: boolean): string {
  const total = allWavNames.length;
  const samples = allWavNames.slice(0, 5);
  const sampleList = samples.length ? samples.map((n) => `"${n}"`).join(', ') : '(none)';
  const parts = [
    'No WAV files matched the date/hour pattern.',
    `Expected format: ${EXPECTED_FORMAT}`,
    total === 0
      ? 'No .wav files were found in the selected folder (or subfolders). Check that you selected the correct folder.'
      : `Found ${total} .wav file(s) in folder; none matched. Sample names seen: ${sampleList}${total > 5 ? ` … and ${total - 5} more` : ''}.`,
  ];
  if (folderReturnedZeroEntries && total === 0) {
    parts.push(
      " Workaround: use the file input — click the folder name field above and choose the same folder; the browser will list the files directly.",
    );
  }
  return parts.join(' ');
}

const DEFAULT_SAMPLE_RATE = 44100;
const SECONDS_PER_HOUR = 3600;
const MAX_DISPLAY_SAMPLES = 2 * 1024 * 1024;
const WAV_READ_CHUNK = 256 * 1024;

function inferChannelNickFromNames(names: string[]): string | null {
  for (const name of names) {
    const match = name.match(/^\s*([A-Za-z0-9]+)[\s_]/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

interface WindowMetrics {
  channelNick: string;
  channelName: string | null;
  distanceKm: number;
  centerTargetMs: number;
  centerMaxMs: number;
  deltaMs: number;
}

interface WavHeader {
  dataOffset: number;
  dataSize: number;
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
}

function parseWavHeaderFull(buffer: ArrayBuffer): WavHeader | null {
  const view = new DataView(buffer);
  if (buffer.byteLength < 44) return null;
  let offset = 12;
  let sampleRate = 44100;
  let numChannels = 1;
  let bitsPerSample = 16;
  while (offset + 8 <= buffer.byteLength) {
    const chunkId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'fmt ') {
      const format = view.getUint16(offset + 8, true);
      if (format !== 1) return null;
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
      offset += 8 + chunkSize;
      continue;
    }
    if (chunkId === 'data') {
      return { dataOffset: offset + 8, dataSize: chunkSize, sampleRate, numChannels, bitsPerSample };
    }
    offset += 8 + chunkSize;
  }
  return null;
}

async function readWavDownsampled(
  file: File,
  targetSamples: number,
  out: Float32Array,
  outOffset: number,
): Promise<boolean> {
  const headBlob = file.slice(0, 4096);
  const headBuf = await headBlob.arrayBuffer();
  const header = parseWavHeaderFull(headBuf);
  if (!header || header.bitsPerSample !== 16) return false;
  const bytesPerSample = 2 * header.numChannels;
  const totalSamples = Math.floor(header.dataSize / bytesPerSample);
  if (totalSamples === 0) return false;
  const step = totalSamples / Math.max(1, targetSamples);
  let readOffset = header.dataOffset;
  let sourceIndex = 0;
  const chunkSize = Math.max(WAV_READ_CHUNK, bytesPerSample * 1024);
  let outIdx = 0;
  while (readOffset < header.dataOffset + header.dataSize && outIdx < targetSamples) {
    const toRead = Math.min(chunkSize, header.dataOffset + header.dataSize - readOffset);
    const blob = file.slice(readOffset, readOffset + toRead);
    const chunk = await blob.arrayBuffer();
    readOffset += toRead;
    const view = new DataView(chunk);
    const samplesInChunk = Math.floor(chunk.byteLength / bytesPerSample);
    for (let i = 0; i < samplesInChunk && outIdx < targetSamples; i++) {
      const takeAt = Math.floor(outIdx * step);
      if (sourceIndex === takeAt) {
        const v = view.getInt16(i * bytesPerSample, true);
        out[outOffset + outIdx] = v / 32768;
        outIdx++;
      }
      sourceIndex++;
    }
  }
  while (outIdx < targetSamples) {
    out[outOffset + outIdx] = 0;
    outIdx++;
  }
  return true;
}

interface WavWaveformPanelProps {
  selectedEarthquake: Earthquake | null;
  channels: Channel[];
  velocityTarget: string;
  deltaVelocity: string;
  /** UTC offset in hours for local time (EQ time + UTC); used for velocity calc */
  utcOffsetHours?: string;
}

function formatClockWithDate(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${hh}:${mm}:${ss}  ${day}/${month}/${year}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatTimeTargetShort(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${hh}:${mm}  ${day}/${month}/${year}`;
}

export function WavWaveformPanel({
  selectedEarthquake,
  channels,
  velocityTarget,
  deltaVelocity,
  utcOffsetHours = '',
}: WavWaveformPanelProps) {
  const [folderName, setFolderName] = useState<string>('');
  const [combinedSamples, setCombinedSamples] = useState<Float32Array | null>(null);
  const [sampleRate, setSampleRate] = useState(DEFAULT_SAMPLE_RATE);
  const [timeRange, setTimeRange] = useState<{ start: number; end: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [verticalZoom, setVerticalZoom] = useState(1);
  const [verticalPan, setVerticalPan] = useState(0);
  const [verticalPanBounds, setVerticalPanBounds] = useState<[number, number]>([0, 0]);
  const [resizeKey, setResizeKey] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAmpRef = useRef<number>(0);
  const lastPanBoundsRef = useRef<[number, number]>([0, 0]);
  const verticalDragStartYRef = useRef<number>(0);
  const verticalDragStartPanRef = useRef<number>(0);
  const didVerticalDragRef = useRef<boolean>(false);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const [wavChannelNick, setWavChannelNick] = useState<string | null>(null);
  const [windowMetrics, setWindowMetrics] = useState<WindowMetrics | null>(null);
  const [redLineMs, setRedLineMs] = useState<number | null>(null);

  useEffect(() => {
    const onResize = () => setResizeKey((k) => k + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setVerticalPan(0);
  }, [zoom, pan, combinedSamples]);

  useEffect(() => {
    if (!selectedEarthquake || !wavChannelNick) {
      setWindowMetrics(null);
      return;
    }
    const channel = channels.find(
      (ch) => ch.nick_name && ch.nick_name.toLowerCase() === wavChannelNick.toLowerCase(),
    ) ?? null;
    const distances = selectedEarthquake.channel_distance;
    let distRaw: string | undefined;
    if (distances && typeof distances === 'object') {
      const keysToTry = [
        wavChannelNick,
        wavChannelNick.toUpperCase(),
        wavChannelNick.toLowerCase(),
        channel?.nick_name ?? '',
      ].filter(Boolean);
      for (const k of keysToTry) {
        if (k in distances) {
          distRaw = distances[k] as string | undefined;
          if (distRaw) break;
        }
      }
      if (!distRaw) {
        const nickLower = wavChannelNick.toLowerCase();
        for (const key of Object.keys(distances)) {
          if (key.toLowerCase().includes(nickLower)) {
            distRaw = distances[key];
            if (distRaw) break;
          }
        }
      }
    }
    if (!distRaw) {
      setWindowMetrics(null);
      return;
    }
    const distanceKm = parseFloat(distRaw.replace(/\s*KM$/i, '').replace(/,/g, '.').trim());
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      setWindowMetrics(null);
      return;
    }
    const vTarget = parseFloat(velocityTarget.replace(/,/g, '.'));
    const dVel = parseFloat(deltaVelocity.replace(/,/g, '.')) || 0;
    if (!Number.isFinite(vTarget) || vTarget <= 0) {
      setWindowMetrics(null);
      return;
    }
    const vMax = vTarget + (Number.isFinite(dVel) ? dVel : 0);
    if (!Number.isFinite(vMax) || vMax <= 0) {
      setWindowMetrics(null);
      return;
    }
    const eqMs = parseInt(selectedEarthquake.time, 10);
    if (!Number.isFinite(eqMs)) {
      setWindowMetrics(null);
      return;
    }
    const targetHours = distanceKm / vTarget;
    const maxHours = distanceKm / vMax;
    const centerTargetMs = eqMs - targetHours * SECONDS_PER_HOUR * 1000;
    const centerMaxMs = eqMs - maxHours * SECONDS_PER_HOUR * 1000;
    const deltaMs = centerMaxMs - centerTargetMs;
    setWindowMetrics({
      channelNick: wavChannelNick,
      channelName: channel?.name ?? null,
      distanceKm,
      centerTargetMs,
      centerMaxMs,
      deltaMs,
    });
  }, [selectedEarthquake, wavChannelNick, channels, velocityTarget, deltaVelocity]);

  const loadAndCombine = useCallback(async (list: WavFileInfo[]) => {
    if (list.length === 0) {
      setCombinedSamples(null);
      setTimeRange(null);
      return;
    }
    setError(null);
    try {
      const firstTime = list[0]!.startTime;
      const lastTime = list[list.length - 1]!.startTime;
      const firstHour = new Date(firstTime);
      firstHour.setMinutes(0, 0, 0);
      const lastHour = new Date(lastTime);
      lastHour.setHours(lastHour.getHours() + 1, 0, 0, 0);
      const startMs = firstHour.getTime();
      const endMs = lastHour.getTime();
      const hoursSpan = (endMs - startMs) / (1000 * SECONDS_PER_HOUR);
      const numHours = Math.ceil(hoursSpan);
      const displaySamplesPerHour = Math.max(1, Math.floor(MAX_DISPLAY_SAMPLES / numHours));
      const totalDisplaySamples = displaySamplesPerHour * numHours;
      const combined = new Float32Array(totalDisplaySamples);
      const displaySampleRate = totalDisplaySamples / (hoursSpan * SECONDS_PER_HOUR);

      const byHour = new Map<string, WavFileInfo>();
      for (const w of list) {
        byHour.set(w.hourKey, w);
      }

      let offset = 0;
      let currentMs = startMs;

      while (currentMs < endMs && offset < totalDisplaySamples) {
        const hourKey = getHourKey(currentMs);
        const info = byHour.get(hourKey);
        const slotSamples = Math.min(displaySamplesPerHour, totalDisplaySamples - offset);
        if (info) {
          const ok = await readWavDownsampled(info.file, slotSamples, combined, offset);
          if (!ok) combined.fill(0, offset, offset + slotSamples);
        } else {
          combined.fill(0, offset, offset + slotSamples);
        }
        offset += slotSamples;
        currentMs += 1000 * SECONDS_PER_HOUR;
      }

      setSampleRate(displaySampleRate);
      setTimeRange({ start: startMs, end: endMs });
      setCombinedSamples(combined);
      setPan(0);
      setZoom(1);
    } catch (e) {
      setCombinedSamples(null);
      setTimeRange(null);
      setError(e instanceof Error ? e.message : 'Failed to load or decode WAV files.');
    }
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setAttribute('webkitdirectory', 'true');
    return () => {};
  }, []);

  const pickFolder = useCallback(async () => {
    setError(null);
    const useFolderPicker =
      typeof window !== 'undefined' &&
      'showDirectoryPicker' in window &&
      !/Chrome\//.test(navigator.userAgent);
    if (useFolderPicker) {
      try {
        const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        setFolderName(handle.name);
        setLoading(true);
        const { list, allWavNames, entriesCount } = await getWavFilesFromHandle(handle);
        if (list.length === 0) {
          const folderEmpty = entriesCount === 0;
          const msg = buildNoMatchError(allWavNames, folderEmpty);
          console.error('[WavWaveformPanel] No WAV files matched.', {
            allWavNames,
            entriesCount,
            expectedFormat: EXPECTED_FORMAT,
          });
          setError(msg);
          setCombinedSamples(null);
          setTimeRange(null);
        } else {
          setWavChannelNick(inferChannelNickFromNames(allWavNames));
          await loadAndCombine(list);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError(e instanceof Error ? e.message : 'Failed to read folder');
        }
      } finally {
        setLoading(false);
      }
    } else {
      inputRef.current?.click();
    }
  }, [loadAndCombine]);

  const onInputFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const { list, allWavNames, folderName: inputFolderName } = await getWavFilesFromInput(e.target.files);
    e.target.value = '';
    if (list.length === 0) {
      const msg = buildNoMatchError(allWavNames);
      console.error('[WavWaveformPanel] No WAV files matched.', { allWavNames, expectedFormat: EXPECTED_FORMAT });
      setError(msg);
      return;
    }
    setWavChannelNick(inferChannelNickFromNames(allWavNames));
    setFolderName(inputFolderName ?? '');
    setLoading(true);
    await loadAndCombine(list);
    setLoading(false);
  }, [loadAndCombine]);

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (didVerticalDragRef.current) {
        didVerticalDragRef.current = false;
        return;
      }
      const canvas = canvasRef.current;
      const samples = combinedSamples;
      if (!canvas || !samples || !timeRange) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;

      const padding = { top: 8, right: 40, bottom: 24, left: 8 };
      const graphW = rect.width - padding.left - padding.right;
      if (graphW <= 0) return;

      const totalLen = samples.length;
      const visibleLen = Math.max(1, Math.floor(totalLen / zoom));
      const startSample = Math.max(0, Math.floor(pan * Math.max(0, totalLen - visibleLen)));
      const endSample = Math.min(startSample + visibleLen, totalLen);

      const t = (x - padding.left) / graphW;
      if (t < 0 || t > 1) return;

      const sampleAt = startSample + t * (endSample - startSample);
      const timeMs = timeRange.start + (sampleAt / sampleRate) * 1000;
      setRedLineMs(timeMs);
    },
    [combinedSamples, timeRange, zoom, pan, sampleRate],
  );

  const handleCanvasWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (!combinedSamples || !timeRange) return;
      if (e.shiftKey) {
        const delta = e.deltaY > 0 ? -1 : 1;
        setVerticalZoom((v) => Math.max(1, Math.min(20, v + delta)));
        e.preventDefault();
      }
      /* Horizontal zoom only via +/− buttons, not mouse wheel */
    },
    [combinedSamples, timeRange],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (verticalZoom <= 1) return;
      verticalDragStartYRef.current = e.clientY;
      verticalDragStartPanRef.current = verticalPan;
      didVerticalDragRef.current = false;
      const onMove = (e2: MouseEvent) => {
        const [minP, maxP] = lastPanBoundsRef.current;
        const amp = lastAmpRef.current;
        if (amp <= 0) return;
        didVerticalDragRef.current = true;
        const dy = e2.clientY - verticalDragStartYRef.current;
        const panDelta = -dy / amp;
        const newPan = Math.max(
          minP,
          Math.min(maxP, verticalDragStartPanRef.current + panDelta),
        );
        setVerticalPan(newPan);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [verticalZoom, verticalPan],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const samples = combinedSamples;
    if (!canvas || !samples || samples.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1210';
    ctx.fillRect(0, 0, w, h);

    const padding = { top: 8, right: 40, bottom: 24, left: 8 };
    const graphW = w - padding.left - padding.right;
    const graphH = h - padding.top - padding.bottom;
    if (graphW <= 0 || graphH <= 0) return;

    const totalLen = samples.length;
    const visibleLen = Math.max(1, Math.floor(totalLen / zoom));
    const startSample = Math.max(0, Math.floor(pan * Math.max(0, totalLen - visibleLen)));
    const endSample = Math.min(startSample + visibleLen, totalLen);
    const slice = samples.subarray(startSample, endSample);
    if (slice.length === 0) return;

    const step = Math.max(1, Math.floor(slice.length / graphW));
    let minVal = slice[0] ?? 0;
    let maxVal = slice[0] ?? 0;
    for (let i = 0; i < slice.length; i += step) {
      const v = slice[i] ?? 0;
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    const range = Math.max(maxVal - minVal, 1e-6);
    const midVal = (minVal + maxVal) / 2;
    const visibleHalfRange = range / (2 * verticalZoom);
    const minPan = visibleHalfRange - range / 2;
    const maxPan = range / 2 - visibleHalfRange;
    lastPanBoundsRef.current = [minPan, maxPan];
    setVerticalPanBounds((prev) =>
      prev[0] === minPan && prev[1] === maxPan ? prev : [minPan, maxPan],
    );
    const viewCenterVal = Math.max(
      minVal + visibleHalfRange,
      Math.min(maxVal - visibleHalfRange, midVal + verticalPan),
    );
    const amp = (graphH / 2) / visibleHalfRange;
    lastAmpRef.current = amp;

    const midY = padding.top + graphH / 2;
    ctx.strokeStyle = '#c4a77d';
    ctx.lineWidth = Math.max(1, (dpr * 1.5) | 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < slice.length; i += step) {
      const x = padding.left + (i / slice.length) * graphW;
      const y = midY - (slice[i]! - viewCenterVal) * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const rangeMs = timeRange;
    if (rangeMs) {
      const startTimeMs = rangeMs.start + (startSample / sampleRate) * 1000;
      const endTimeMs = rangeMs.start + (endSample / sampleRate) * 1000;
      const msPerHour = 3600 * 1000;
      const minLabelSpacing = 44;
      let lastLabelX = -minLabelSpacing - 1;
      let hourTimeMs = Math.ceil(startTimeMs / msPerHour) * msPerHour;
      ctx.fillStyle = '#d4d4d4';
      ctx.font = '16px system-ui, sans-serif';
      while (hourTimeMs <= endTimeMs) {
        const d = new Date(hourTimeMs);
        const hour = d.getHours();
        const day = d.getDate();
        const sampleAtHour = ((hourTimeMs - rangeMs.start) / 1000) * sampleRate;
        const t = (sampleAtHour - startSample) / (endSample - startSample);
        let x = padding.left + t * graphW;
        if (x < padding.left || x > padding.left + graphW) {
          hourTimeMs += msPerHour;
          continue;
        }
        if (x - lastLabelX < minLabelSpacing) {
          hourTimeMs += msPerHour;
          continue;
        }
        lastLabelX = x;
        const label = `${hour} (${day})`;
        if (x <= padding.left + 16) {
          ctx.textAlign = 'left';
          ctx.fillText(label, padding.left, h - 6);
        } else if (x >= padding.left + graphW - 16) {
          ctx.textAlign = 'right';
          ctx.fillText(label, padding.left + graphW, h - 6);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(label, x, h - 6);
        }
        hourTimeMs += msPerHour;
      }
    }
    if (rangeMs && windowMetrics) {
      const drawMarker = (timeMs: number, color: string, lineWidthMultiplier = 1) => {
        const sampleAt = ((timeMs - rangeMs.start) / 1000) * sampleRate;
        const t = (sampleAt - startSample) / (endSample - startSample);
        if (t < 0 || t > 1) return;
        const x = padding.left + t * graphW;
        ctx.strokeStyle = color;
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(1.5, dpr * lineWidthMultiplier);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + graphH);
        ctx.stroke();
      };
      const drawTimeTargetLine = (timeMs: number) => {
        if (timeMs < rangeMs.start || timeMs > rangeMs.end) return;
        const sampleAt = ((timeMs - rangeMs.start) / 1000) * sampleRate;
        const t = (sampleAt - startSample) / (endSample - startSample);
        if (t < 0 || t > 1) return;
        const x = padding.left + t * graphW;
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.setLineDash([]);
        ctx.lineWidth = Math.max(2, dpr * 2);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + graphH);
        ctx.stroke();
        const triSize = 8 * dpr;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x - triSize / 2, padding.top + triSize);
        ctx.lineTo(x + triSize / 2, padding.top + triSize);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      const drawWindow = (startMs: number, endMs: number) => {
        if (endMs <= startMs) return;
        const sampleStart = ((startMs - rangeMs.start) / 1000) * sampleRate;
        const sampleEnd = ((endMs - rangeMs.start) / 1000) * sampleRate;
        const tStart = (sampleStart - startSample) / (endSample - startSample);
        const tEnd = (sampleEnd - startSample) / (endSample - startSample);
        const x1 = padding.left + Math.max(0, Math.min(1, tStart)) * graphW;
        const x2 = padding.left + Math.max(0, Math.min(1, tEnd)) * graphW;
        if (x2 <= padding.left || x1 >= padding.left + graphW || x2 <= x1) return;

        ctx.save();
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.strokeStyle = '#ffffff99';
        ctx.lineWidth = dpr;

        ctx.beginPath();
        ctx.moveTo(x1, padding.top);
        ctx.lineTo(x1, padding.top + graphH);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2, padding.top);
        ctx.lineTo(x2, padding.top + graphH);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, padding.top + 4 * dpr);
        ctx.lineTo(x2, padding.top + 4 * dpr);
        ctx.moveTo(x1, padding.top + graphH - 4 * dpr);
        ctx.lineTo(x2, padding.top + graphH - 4 * dpr);
        ctx.stroke();

        ctx.restore();
      };

      const halfWindowMs = Math.abs(windowMetrics.deltaMs);
      const leftMs = windowMetrics.centerTargetMs - halfWindowMs;
      const rightMs = windowMetrics.centerTargetMs + halfWindowMs;

      drawWindow(leftMs, rightMs);
      drawTimeTargetLine(windowMetrics.centerTargetMs);
      drawMarker(windowMetrics.centerMaxMs, '#fb923c');
    }

    if (rangeMs && redLineMs != null) {
      const sampleAt = ((redLineMs - rangeMs.start) / 1000) * sampleRate;
      const t = (sampleAt - startSample) / (endSample - startSample);
      if (t >= 0 && t <= 1) {
        const x = padding.left + t * graphW;
        ctx.strokeStyle = '#ff4d4f';
        ctx.setLineDash([]);
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + graphH);
        ctx.stroke();
      }
    }
  }, [combinedSamples, sampleRate, zoom, pan, verticalZoom, verticalPan, resizeKey, timeRange, windowMetrics, redLineMs]);

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const newZ = Math.min(100, z * 1.5);
      if (newZ === z) return z;
      setPan((p) => {
        if (!combinedSamples || !timeRange) return p;
        const totalLen = combinedSamples.length;
        const visibleLen = Math.max(1, Math.floor(totalLen / z));
        const startSample = Math.max(0, Math.floor(p * Math.max(0, totalLen - visibleLen)));
        let anchorSample = startSample + visibleLen / 2;
        if (redLineMs != null && timeRange.start <= redLineMs && redLineMs <= timeRange.end) {
          const redLineSample = ((redLineMs - timeRange.start) / 1000) * sampleRate;
          if (redLineSample >= 0 && redLineSample < totalLen) anchorSample = redLineSample;
        }
        const newVisibleLen = Math.max(1, Math.floor(totalLen / newZ));
        const maxStart = Math.max(0, totalLen - newVisibleLen);
        const newStart = Math.max(0, Math.min(maxStart, anchorSample - newVisibleLen / 2));
        return maxStart > 0 ? newStart / maxStart : 0;
      });
      return newZ;
    });
  }, [combinedSamples, timeRange, redLineMs, sampleRate]);
  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const newZ = Math.max(1, z / 1.5);
      if (newZ === z) return z;
      setPan((p) => {
        if (!combinedSamples || !timeRange) return p;
        const totalLen = combinedSamples.length;
        const visibleLen = Math.max(1, Math.floor(totalLen / z));
        const startSample = Math.max(0, Math.floor(p * Math.max(0, totalLen - visibleLen)));
        let anchorSample = startSample + visibleLen / 2;
        if (redLineMs != null && timeRange.start <= redLineMs && redLineMs <= timeRange.end) {
          const redLineSample = ((redLineMs - timeRange.start) / 1000) * sampleRate;
          if (redLineSample >= 0 && redLineSample < totalLen) anchorSample = redLineSample;
        }
        const newVisibleLen = Math.max(1, Math.floor(totalLen / newZ));
        const maxStart = Math.max(0, totalLen - newVisibleLen);
        const newStart = Math.max(0, Math.min(maxStart, anchorSample - newVisibleLen / 2));
        return maxStart > 0 ? newStart / maxStart : 0;
      });
      return newZ;
    });
  }, [combinedSamples, timeRange, redLineMs, sampleRate]);
  const verticalZoomIn = () => setVerticalZoom((v) => Math.min(20, v + 1));
  const verticalZoomOut = () => {
    setVerticalZoom((v) => {
      const next = Math.max(1, v - 1);
      if (next === 1) setVerticalPan(0);
      return next;
    });
  };
  const panLeft = () => setPan((p) => Math.max(0, p - 0.1));
  const panRight = () => setPan((p) => Math.min(1, p + 0.1));

  const [minPan, maxPan] = verticalPanBounds;
  const canVerticalPan = verticalZoom > 1 && maxPan > minPan;
  const thumbTopPercent =
    canVerticalPan
      ? ((verticalPan - minPan) / (maxPan - minPan)) * (100 - 100 / verticalZoom)
      : 0;

  const handleScrollbarTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canVerticalPan || !scrollbarTrackRef.current) return;
      const rect = scrollbarTrackRef.current.getBoundingClientRect();
      const trackH = rect.height;
      const thumbH = trackH / verticalZoom;
      const y = e.clientY - rect.top;
      const t = Math.max(0, Math.min(1, (y - thumbH / 2) / (trackH - thumbH)));
      setVerticalPan(minPan + t * (maxPan - minPan));
    },
    [canVerticalPan, verticalZoom, minPan, maxPan],
  );

  const handleScrollbarThumbMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!canVerticalPan || !scrollbarTrackRef.current) return;
      const trackRect = scrollbarTrackRef.current.getBoundingClientRect();
      const trackH = trackRect.height;
      const thumbH = trackH / verticalZoom;
      const startY = e.clientY;
      const startPan = verticalPan;
      const onMove = (e2: MouseEvent) => {
        const dy = e2.clientY - startY;
        const panRange = maxPan - minPan;
        const panPerPx = panRange / (trackH - thumbH);
        const newPan = Math.max(minPan, Math.min(maxPan, startPan + dy * panPerPx));
        setVerticalPan(newPan);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [canVerticalPan, verticalZoom, verticalPan, minPan, maxPan],
  );

  const centerOnTarget = useCallback(() => {
    if (!combinedSamples || !timeRange || !windowMetrics) return;
    const totalLen = combinedSamples.length;
    const totalTimeMs = timeRange.end - timeRange.start;
    if (totalTimeMs <= 0) return;
    const centerTargetMs = windowMetrics.centerTargetMs;
    const deltaMs = Math.abs(windowMetrics.deltaMs);
    const centerSample = ((centerTargetMs - timeRange.start) / 1000) * sampleRate;
    if (centerSample < 0 || centerSample >= totalLen) return;
    const visibleTimeMs = Math.max(totalTimeMs / 100, 2.5 * deltaMs);
    const newZoom = Math.max(1, Math.min(100, totalTimeMs / visibleTimeMs));
    const newVisibleLen = Math.max(1, Math.floor(totalLen / newZoom));
    const maxStart = Math.max(0, totalLen - newVisibleLen);
    const newStart = Math.max(0, Math.min(maxStart, centerSample - newVisibleLen / 2));
    setZoom(newZoom);
    setPan(maxStart > 0 ? newStart / maxStart : 0);
  }, [combinedSamples, timeRange, windowMetrics, sampleRate]);

  return (
    <div className="wav-panel">
      <div className="wav-panel-controls">
        <span className="wav-panel-channel">
          {wavChannelNick ? `Ch. ${wavChannelNick}` : 'Ch. —'}
        </span>
        <label className="wav-panel-folder-label">
          Name of the wavs folder (finder)
          <input
            ref={inputRef}
            type="file"
            accept=".wav"
            multiple
            className="wav-panel-input-hidden"
            onChange={onInputFiles}
          />
          <input
            type="text"
            readOnly
            className="wav-panel-folder-input"
            value={folderName || (loading ? 'Loading…' : '')}
            placeholder="Select folder"
            title="Click to select folder (or use Browse)"
            onClick={() => inputRef.current?.click()}
          />
        </label>
        <button type="button" className="wav-panel-btn" onClick={pickFolder} disabled={loading}>
          {typeof window !== 'undefined' &&
          'showDirectoryPicker' in window &&
          !/Chrome\//.test(navigator.userAgent)
            ? 'Browse…'
            : 'Select folder…'}
        </button>
        {windowMetrics ? (
          <div className="wav-panel-values">
            <span className="wav-panel-value-item">
              <strong>Time targ.</strong> {formatTimeTargetShort(windowMetrics.centerTargetMs)}
            </span>
            <span className="wav-panel-value-sep">|</span>
            <span className="wav-panel-value-item">
              <strong>ΔT</strong> {formatDuration(Math.abs(windowMetrics.deltaMs))}
            </span>
            <span className="wav-panel-value-sep">|</span>
            <span className="wav-panel-value-item">
              <strong>Dist.</strong> {windowMetrics.distanceKm.toFixed(0)} km
            </span>
            <span className="wav-panel-value-sep">|</span>
            <button
              type="button"
              className="wav-panel-center-btn"
              onClick={centerOnTarget}
              disabled={!combinedSamples?.length || !timeRange}
              title="Center view on target line and zoom to fit"
              aria-label="Center on target line"
            >
              Center
            </button>
            <span className="wav-panel-value-right">
              <span className="wav-panel-value-sep">|</span>
              <span className="wav-panel-value-item">
                <strong>Red line T:</strong>{' '}
                {redLineMs != null ? formatTimeTargetShort(redLineMs) : '—'}
              </span>
              <span className="wav-panel-value-sep">|</span>
              <span className="wav-panel-value-item">
                <strong>V:</strong>{' '}
                {(() => {
                  if (redLineMs == null || !selectedEarthquake) return '—';
                  const eqMs = parseInt(selectedEarthquake.time, 10);
                  if (!Number.isFinite(eqMs)) return '—';
                  const offsetHours = parseFloat(String(utcOffsetHours).trim()) || 0;
                  const eqLocalMs = eqMs + offsetHours * 3600 * 1000;
                  const travelTimeMs = Math.abs(redLineMs - eqLocalMs);
                  if (travelTimeMs < 1000) return '—';
                  const velocityKmh = (windowMetrics.distanceKm * 3600 * 1000) / travelTimeMs;
                  return `${velocityKmh.toLocaleString(undefined, { maximumFractionDigits: 0 })} km/h`;
                })()}
              </span>
            </span>
          </div>
        ) : wavChannelNick && (
          <div className="wav-panel-values wav-panel-values--hint">
            {selectedEarthquake
              ? 'No distance for this channel in selected earthquake. Check channel_distance keys.'
              : 'Select an earthquake in the table above to see Time target, ΔT and Distance.'}
          </div>
        )}
      </div>
      {error && (
        <div className="wav-panel-error" role="alert">
          {error}
        </div>
      )}
      <div className="wav-panel-graph-wrap">
        <div className="wav-panel-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="wav-panel-canvas"
            onClick={handleCanvasClick}
            onMouseDown={handleCanvasMouseDown}
            onWheel={handleCanvasWheel}
          />
          {verticalZoom > 1 && (
            <div
              ref={scrollbarTrackRef}
              className="wav-panel-vscroll-track"
              onClick={handleScrollbarTrackClick}
              role="scrollbar"
              aria-label="Vertical pan"
              aria-valuenow={verticalPan}
              aria-valuemin={minPan}
              aria-valuemax={maxPan}
              title="Drag or click to pan vertically"
            >
              <div
                className="wav-panel-vscroll-thumb"
                style={{
                  height: `${100 / verticalZoom}%`,
                  top: `${thumbTopPercent}%`,
                }}
                onMouseDown={handleScrollbarThumbMouseDown}
              />
            </div>
          )}
          <div className="wav-panel-zoom" title="Vertical zoom (amplitude)">
            <button type="button" className="wav-panel-zoom-btn" onClick={verticalZoomIn} title="Vertical zoom in" aria-label="Vertical zoom in">
              +
            </button>
            <button type="button" className="wav-panel-zoom-btn" onClick={verticalZoomOut} title="Vertical zoom out" aria-label="Vertical zoom out">
              −
            </button>
          </div>
        </div>
      </div>
      <div className="wav-panel-zoom-hint">
        <button type="button" className="wav-panel-nav-btn" onClick={panLeft} aria-label="Pan left">←</button>
        <span className="wav-panel-zoom-label">Zoom: {zoom.toFixed(1)}×</span>
        <button type="button" className="wav-panel-nav-btn" onClick={panRight} aria-label="Pan right">→</button>
        <button type="button" className="wav-panel-zoom-h-btn" onClick={zoomOut} title="Zoom out (time)" aria-label="Horizontal zoom out">−</button>
        <button type="button" className="wav-panel-zoom-h-btn" onClick={zoomIn} title="Zoom in (time)" aria-label="Horizontal zoom in">+</button>
        <span className="wav-panel-zoom-v-label" title="Vertical zoom">V: {verticalZoom}×</span>
      </div>
    </div>
  );
}
