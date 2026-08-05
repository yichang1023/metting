(() => {
  'use strict';

  const MODES = {
    speech:   { label: '逐字稿最佳化', minKbps: 18, maxKbps: 40, preferredKbps: 28, wavSampleRate: 16000 },
    balanced: { label: '平衡音質', minKbps: 28, maxKbps: 56, preferredKbps: 40, wavSampleRate: 24000 },
    quality:  { label: '較高音質', minKbps: 40, maxKbps: 80, preferredKbps: 56, wavSampleRate: 48000 }
  };

  const OUTPUT_FORMATS = {
    ogg: { label: 'OGG／Opus', extension: 'ogg', mime: 'audio/ogg', requiresEncoder: true },
    wav: { label: 'WAV／PCM 16-bit', extension: 'wav', mime: 'audio/wav', requiresEncoder: false }
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function formatTime(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
  }

  function safeBaseName(name) {
    return (String(name || '錄音').replace(/\.[^.]+$/, '') || '錄音').replace(/[\\/:*?"<>|]/g, '_');
  }

  function getControl(control = {}) {
    return {
      async checkpoint() {
        if (typeof control.throwIfCancelled === 'function') control.throwIfCancelled();
        if (typeof control.waitIfPaused === 'function') await control.waitIfPaused();
        if (typeof control.throwIfCancelled === 'function') control.throwIfCancelled();
      },
      progress(percent, title, detail) {
        if (typeof control.onProgress === 'function') control.onProgress(percent, title, detail);
      }
    };
  }

  function browserSupported(formatKey = 'ogg') {
    const baseSupported = typeof AudioContext !== 'undefined' && typeof OfflineAudioContext !== 'undefined';
    if (!baseSupported) return false;
    const format = OUTPUT_FORMATS[formatKey] || OUTPUT_FORMATS.ogg;
    if (!format.requiresEncoder) return true;
    return typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined';
  }

  async function loadDuration(file) {
    return new Promise((resolve, reject) => {
      const media = document.createElement(file.type?.startsWith('video/') ? 'video' : 'audio');
      const url = URL.createObjectURL(file);
      media.preload = 'metadata';
      media.onloadedmetadata = () => {
        const d = media.duration;
        URL.revokeObjectURL(url);
        Number.isFinite(d) && d > 0 ? resolve(d) : reject(new Error('無法讀取錄音長度。'));
      };
      media.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('瀏覽器無法讀取這個檔案格式。'));
      };
      media.src = url;
    });
  }

  function getPlan(durationSec, options = {}) {
    const mode = MODES[options.mode] || MODES.speech;
    const format = OUTPUT_FORMATS[options.outputFormat] || OUTPUT_FORMATS.ogg;
    const limitMb = Math.max(1, Math.min(100, Number(options.limitMb) || 14.5));
    const autoSplit = Boolean(options.autoSplit);
    const targetBytes = limitMb * 1024 * 1024;

    if (format === OUTPUT_FORMATS.wav) {
      const sampleRate = mode.wavSampleRate;
      const bytesPerSecond = sampleRate * 2;
      const estimatedTotalBytes = 44 + durationSec * bytesPerSecond;
      const safeTargetBytes = Math.max(1, targetBytes * 0.98 - 44);
      let parts = 1;
      if (autoSplit && estimatedTotalBytes > targetBytes) {
        parts = Math.max(1, Math.ceil(durationSec / (safeTargetBytes / bytesPerSecond)));
      }
      return {
        mode, format, limitMb, targetBytes, parts,
        partDuration: durationSec / parts,
        sampleRate,
        kbps: Math.round(sampleRate * 16 / 1000),
        estimatedTotalBytes
      };
    }

    const payloadSafety = 0.86;
    const availableBps = targetBytes * 8 * payloadSafety / durationSec;
    let kbps = Math.min(Math.floor(availableBps / 1000), mode.maxKbps);
    let parts = 1;
    let partDuration = durationSec;

    if (autoSplit && kbps < mode.minKbps) {
      partDuration = targetBytes * 8 * payloadSafety / (mode.minKbps * 1000);
      parts = Math.ceil(durationSec / partDuration);
      partDuration = durationSec / parts;
      kbps = Math.min(mode.maxKbps, Math.max(mode.minKbps, Math.floor(targetBytes * 8 * payloadSafety / partDuration / 1000)));
    } else {
      kbps = Math.max(8, kbps);
    }

    return { mode, format, limitMb, targetBytes, kbps, parts, partDuration, sampleRate: null };
  }

  async function getSupportedEncoderConfig(bitrate) {
    const candidates = [16000, 48000];
    for (const sampleRate of candidates) {
      const config = {
        codec: 'opus',
        sampleRate,
        numberOfChannels: 1,
        bitrate: Math.max(6000, Math.round(bitrate * 1000))
      };
      try {
        const result = await AudioEncoder.isConfigSupported(config);
        if (result.supported) return result.config || config;
      } catch (_) {}
    }
    throw new Error('此瀏覽器不支援 Opus 音訊編碼。請改用最新版 Chrome 或 Edge。');
  }

  async function decodeSource(file, ctl) {
    await ctl.checkpoint();
    ctl.progress(4, '讀取錄音', '正在將來源錄音解碼到瀏覽器記憶體…');
    const ctx = new AudioContext();
    try {
      const arrayBuffer = await file.arrayBuffer();
      await ctl.checkpoint();
      return await ctx.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      await ctx.close().catch(() => {});
    }
  }

  async function renderMonoSegment(sourceBuffer, startSec, segmentDuration, sampleRate, ctl) {
    await ctl.checkpoint();
    const frames = Math.max(1, Math.ceil(segmentDuration * sampleRate));
    const offline = new OfflineAudioContext(1, frames, sampleRate);
    const source = offline.createBufferSource();
    source.buffer = sourceBuffer;
    source.connect(offline.destination);
    source.start(0, startSec, segmentDuration);
    const rendered = await offline.startRendering();
    await ctl.checkpoint();
    return rendered.getChannelData(0).slice();
  }

  function makeOpusHead(inputSampleRate) {
    const b = new Uint8Array(19);
    b.set(new TextEncoder().encode('OpusHead'), 0);
    const v = new DataView(b.buffer);
    b[8] = 1;
    b[9] = 1;
    v.setUint16(10, 312, true);
    v.setUint32(12, inputSampleRate, true);
    v.setInt16(16, 0, true);
    b[18] = 0;
    return b;
  }

  function makeOpusTags() {
    const vendor = new TextEncoder().encode('Meeting Audio Compressor');
    const b = new Uint8Array(8 + 4 + vendor.length + 4);
    b.set(new TextEncoder().encode('OpusTags'), 0);
    const v = new DataView(b.buffer);
    v.setUint32(8, vendor.length, true);
    b.set(vendor, 12);
    v.setUint32(12 + vendor.length, 0, true);
    return b;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let r = i << 24;
      for (let j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1);
      table[i] = r >>> 0;
    }
    return table;
  })();

  function oggCrc(data) {
    let crc = 0;
    for (let i = 0; i < data.length; i++) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ data[i]) & 0xff]) >>> 0;
    return crc >>> 0;
  }

  function writeUint64LE(view, offset, value) {
    const big = BigInt(Math.max(0, Math.round(value)));
    view.setUint32(offset, Number(big & 0xffffffffn), true);
    view.setUint32(offset + 4, Number((big >> 32n) & 0xffffffffn), true);
  }

  function packetSegments(packetLength) {
    const segs = [];
    let left = packetLength;
    while (left >= 255) { segs.push(255); left -= 255; }
    segs.push(left);
    if (packetLength > 0 && packetLength % 255 === 0) segs.push(0);
    return segs;
  }

  function makeOggPage(packets, serial, sequence, granule, headerType) {
    const lacing = [];
    let bodyLength = 0;
    for (const packet of packets) {
      lacing.push(...packetSegments(packet.length));
      bodyLength += packet.length;
    }
    if (lacing.length > 255) throw new Error('Ogg 頁面資料過大。');

    const page = new Uint8Array(27 + lacing.length + bodyLength);
    page.set([0x4f, 0x67, 0x67, 0x53], 0);
    page[4] = 0;
    page[5] = headerType;
    const view = new DataView(page.buffer);
    writeUint64LE(view, 6, granule);
    view.setUint32(14, serial >>> 0, true);
    view.setUint32(18, sequence >>> 0, true);
    view.setUint32(22, 0, true);
    page[26] = lacing.length;
    page.set(lacing, 27);
    let offset = 27 + lacing.length;
    for (const packet of packets) { page.set(packet, offset); offset += packet.length; }
    view.setUint32(22, oggCrc(page), true);
    return page;
  }

  function muxOggOpus(packets, inputSampleRate, totalFrames) {
    const serial = (crypto.getRandomValues(new Uint32Array(1))[0] || 1) >>> 0;
    const pages = [];
    let sequence = 0;
    pages.push(makeOggPage([makeOpusHead(inputSampleRate)], serial, sequence++, 0, 0x02));
    pages.push(makeOggPage([makeOpusTags()], serial, sequence++, 0, 0x00));
    const ratio = 48000 / inputSampleRate;
    const packetsPerPage = 50;
    let consumedFrames = 0;

    for (let i = 0; i < packets.length; i += packetsPerPage) {
      const group = packets.slice(i, i + packetsPerPage);
      consumedFrames += group.reduce((sum, p) => sum + p.frames, 0);
      const isLast = i + packetsPerPage >= packets.length;
      const clampedFrames = isLast ? totalFrames : consumedFrames;
      const granule = 312 + Math.round(clampedFrames * ratio);
      pages.push(makeOggPage(group.map(p => p.data), serial, sequence++, granule, isLast ? 0x04 : 0x00));
    }
    return new Blob(pages, { type: 'audio/ogg' });
  }

  async function encodeOpus(pcm, config, onProgress, ctl) {
    const packets = [];
    let encoderError = null;
    const encoder = new AudioEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        const durationUs = Number(chunk.duration || 20000);
        const frames = Math.max(1, Math.round(durationUs * config.sampleRate / 1_000_000));
        packets.push({ data, frames, timestamp: Number(chunk.timestamp || 0) });
      },
      error: (err) => { encoderError = err; }
    });
    encoder.configure(config);

    const frameSize = Math.max(1, Math.round(config.sampleRate * 0.02));
    const total = pcm.length;
    let encodedFrames = 0;

    for (let offset = 0; offset < total; offset += frameSize) {
      if (offset % (frameSize * 25) === 0) await ctl.checkpoint();
      const count = Math.min(frameSize, total - offset);
      const block = new Float32Array(frameSize);
      block.set(pcm.subarray(offset, offset + count));
      const timestamp = Math.round(offset * 1_000_000 / config.sampleRate);
      const audioData = new AudioData({
        format: 'f32-planar', sampleRate: config.sampleRate,
        numberOfFrames: frameSize, numberOfChannels: 1,
        timestamp, data: block
      });
      encoder.encode(audioData);
      audioData.close();
      encodedFrames += count;

      if (encoder.encodeQueueSize > 20) await sleep(0);
      if (offset % (frameSize * 50) === 0) onProgress(encodedFrames / total);
    }

    await encoder.flush();
    encoder.close();
    if (encoderError) throw encoderError;
    packets.sort((a, b) => a.timestamp - b.timestamp);
    return muxOggOpus(packets, config.sampleRate, pcm.length);
  }

  async function encodeWav(pcm, sampleRate, onProgress, ctl) {
    const dataSize = pcm.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeText = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    writeText(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, dataSize, true);

    const chunkSize = 250000;
    for (let i = 0; i < pcm.length; i++) {
      const sample = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      if (i > 0 && i % chunkSize === 0) {
        await ctl.checkpoint();
        onProgress(i / pcm.length);
        await sleep(0);
      }
    }
    onProgress(1);
    return new Blob([buffer], { type: 'audio/wav' });
  }

  async function encodeSegment(sourceBuffer, startSec, segmentDuration, plan, partIndex, totalParts, ctl) {
    if (plan.format.extension === 'wav') {
      ctl.progress(12 + ((partIndex - 1) / totalParts) * 83, `處理第 ${partIndex}/${totalParts} 段`, `正在轉為單聲道 WAV（${plan.sampleRate / 1000} kHz／16-bit PCM）…`);
      const pcm = await renderMonoSegment(sourceBuffer, startSec, segmentDuration, plan.sampleRate, ctl);
      const blob = await encodeWav(pcm, plan.sampleRate, (fraction) => {
        const partBase = 18 + ((partIndex - 1) / totalParts) * 78;
        const partSpan = 72 / totalParts;
        ctl.progress(partBase + fraction * partSpan, `輸出第 ${partIndex}/${totalParts} 段`, `WAV ${plan.sampleRate / 1000} kHz／16-bit・${Math.round(fraction * 100)}%`);
      }, ctl);
      return { blob, kbps: plan.kbps, sampleRate: plan.sampleRate, formatLabel: plan.format.label };
    }

    let workingKbps = plan.kbps;
    let blob = null;
    let usedSampleRate = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      await ctl.checkpoint();
      const config = await getSupportedEncoderConfig(workingKbps);
      usedSampleRate = config.sampleRate;
      ctl.progress(12 + ((partIndex - 1) / totalParts) * 83, `處理第 ${partIndex}/${totalParts} 段`, `正在轉為單聲道語音格式（${config.sampleRate / 1000} kHz）…`);
      const pcm = await renderMonoSegment(sourceBuffer, startSec, segmentDuration, config.sampleRate, ctl);
      blob = await encodeOpus(pcm, config, (fraction) => {
        const partBase = 18 + ((partIndex - 1) / totalParts) * 78;
        const partSpan = 72 / totalParts;
        ctl.progress(partBase + fraction * partSpan, `壓縮第 ${partIndex}/${totalParts} 段`, `Opus ${workingKbps} kbps・${Math.round(fraction * 100)}%`);
      }, ctl);

      if (blob.size <= plan.targetBytes || attempt === 3) break;
      workingKbps = Math.max(8, Math.floor(workingKbps * plan.targetBytes / blob.size * 0.90));
      ctl.progress(20, `重新調整第 ${partIndex} 段`, `第一次輸出為 ${(blob.size / 1048576).toFixed(1)} MB，正在降低至 ${workingKbps} kbps。`);
    }
    return { blob, kbps: workingKbps, sampleRate: usedSampleRate, formatLabel: plan.format.label };
  }

  async function compress(file, options = {}, control = {}) {
    if (!(file instanceof Blob) || !file.size) throw new Error('請先選擇錄音檔。');
    const outputFormat = options.outputFormat || 'ogg';
    if (!browserSupported(outputFormat)) {
      throw new Error(outputFormat === 'ogg'
        ? '此瀏覽器缺少 Opus 編碼功能，請使用最新版 Chrome 或 Edge。'
        : '此瀏覽器無法進行離線音訊處理。');
    }

    const ctl = getControl(control);
    const durationSec = Number(options.durationSec) || await loadDuration(file);
    const plan = getPlan(durationSec, { ...options, outputFormat });
    const sourceBuffer = await decodeSource(file, ctl);
    const actualDuration = sourceBuffer.duration;
    const partDuration = actualDuration / plan.parts;
    const base = safeBaseName(options.displayName || file.name || '錄音');
    const outputs = [];

    for (let i = 0; i < plan.parts; i++) {
      await ctl.checkpoint();
      const start = i * partDuration;
      const duration = Math.min(partDuration, actualDuration - start);
      const result = await encodeSegment(sourceBuffer, start, duration, plan, i + 1, plan.parts, ctl);
      const suffix = plan.parts > 1 ? `_第${String(i + 1).padStart(2, '0')}段` : '_壓縮版';
      outputs.push({
        ...result,
        name: `${base}${suffix}.${plan.format.extension}`,
        duration,
        mimeType: plan.format.mime,
        size: result.blob.size
      });
    }

    ctl.progress(100, '壓縮完成', `已產生 ${outputs.length} 個檔案。`);
    return { outputs, plan, durationSec: actualDuration, durationText: formatTime(actualDuration) };
  }

  window.MeetingAudioCompressor = {
    MODES,
    OUTPUT_FORMATS,
    browserSupported,
    loadDuration,
    getPlan,
    compress
  };
})();
