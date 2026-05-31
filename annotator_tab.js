const state = {
  video: null,
  fps: 30,
  totalFrames: 0,
  currentFrame: 0,
  isPlaying: false,
  playbackSpeed: 0.25,
  uesoFrame: null,
  uescFrame: null,
  annotations: [],
  videoName: '',
  animId: null,
  sugUESO: null,
  sugUESC: null,
  diffData: [],
  queue: [],       // [{ file, status: 'pending'|'done' }]
  queueIndex: -1,
};

function loadFilesFromInput(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  state.queue = files.map(f => ({ file: f, status: 'pending' }));
  state.queueIndex = 0;
  renderQueue();
  loadQueueItem(0);
}

function loadQueueItem(index) {
  if (index < 0 || index >= state.queue.length) return;
  state.queueIndex = index;
  state.uesoFrame = null;
  state.uescFrame = null;
  state.sugUESO = null;
  state.sugUESC = null;
  state.diffData = [];
  document.getElementById('suggestion-panel').style.display = 'none';
  renderQueue();
  loadVideo({ target: { files: [state.queue[index].file] } });
}

function prevVideo() {
  if (state.queueIndex > 0) loadQueueItem(state.queueIndex - 1);
}

function nextVideo() {
  if (state.queueIndex < state.queue.length - 1) loadQueueItem(state.queueIndex + 1);
}

function renderQueue() {
  const card = document.getElementById('queue-card');
  if (state.queue.length <= 1) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const done = state.queue.filter(q => q.status === 'done').length;
  document.getElementById('queue-count').textContent = `${done}/${state.queue.length}`;

  const wrap = document.getElementById('queue-list-wrap');
  wrap.innerHTML = state.queue.map((item, i) => {
    const active = i === state.queueIndex ? 'queue-item-active' : '';
    const icon = item.status === 'done' ? '✓' : '·';
    const iconColor = item.status === 'done' ? 'var(--accent)' : 'var(--text-dim)';
    const short = item.file.name.length > 22 ? item.file.name.slice(0, 20) + '…' : item.file.name;
    return `<div class="queue-item ${active}" onclick="loadQueueItem(${i})" title="${item.file.name}">
      <span style="color:${iconColor};font-weight:700;min-width:14px;">${icon}</span>
      <span>${short}</span>
    </div>`;
  }).join('');

  // mostrar/esconder botões de navegação
  const hasPrev = state.queueIndex > 0;
  const hasNext = state.queueIndex < state.queue.length - 1;
  document.getElementById('btn-prev').style.display = hasPrev ? 'inline-flex' : 'none';
  document.getElementById('btn-next').style.display = hasNext ? 'inline-flex' : 'none';
}

function loadVideo(event) {
  const file = event.target.files[0];
  if (!file) return;
  console.log('[loadVideo] arquivo selecionado:', file.name, file.type, file.size);
  const url = URL.createObjectURL(file);
  state.videoName = file.name;
  state.uesoFrame = null;
  state.uescFrame = null;
  state.sugUESO = null;
  state.sugUESC = null;
  state.diffData = [];

  const vid = document.getElementById('hidden-video');
  vid.src = url;
  vid.load();
  console.log('[loadVideo] vid.src definido, aguardando metadata...');

  vid.onerror = (e) => {
    console.error('[loadVideo] ERRO ao carregar vídeo:', vid.error);
  };

  vid.onloadedmetadata = () => {
    console.log('[loadVideo] metadata carregada! dimensões:', vid.videoWidth, 'x', vid.videoHeight, 'duração:', vid.duration);
    state.video = vid;
    state.fps = 30;
    state.totalFrames = Math.floor(vid.duration * state.fps);

    document.getElementById('drop-zone').style.display = 'none';
    document.getElementById('video-container').style.display = 'block';

    const canvas = document.getElementById('main-canvas');
    canvas.width = vid.videoWidth || 640;
    canvas.height = vid.videoHeight || 480;

    document.getElementById('video-name').textContent = file.name;
    document.getElementById('status-dot').classList.add('active');
    document.getElementById('status-text').textContent = 'Vídeo carregado';
    document.getElementById('total-frames').textContent = state.totalFrames;

    ['btn-ueso','btn-uesc','btn-auto','btn-save'].forEach(id => {
      document.getElementById(id).disabled = false;
    });

    updateMarkers();
    toast('Vídeo carregado! Pressione A para auto-detectar.', 3000);
  };

  vid.onloadeddata = () => {
    console.log('[loadVideo] onloadeddata disparado, indo para frame 0...');
    vid.currentTime = 0;
  };

  vid.onseeked = () => {
    console.log('[loadVideo] onseeked disparado, currentTime:', vid.currentTime);
    renderFrame();
  };

  const dz = document.getElementById('drop-zone');
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag-over'); };
  dz.ondragleave = () => dz.classList.remove('drag-over');
  dz.ondrop = e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) { event.target.files = e.dataTransfer.files; loadVideo({target:{files:[f]}}); }
  };
}

function renderFrame() {
  if (!state.video) return;
  const vid = state.video;
  const canvas = document.getElementById('main-canvas');
  const ctx = canvas.getContext('2d');
  ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

  if (state.uesoFrame !== null) {
    const pct = state.uesoFrame / state.totalFrames;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5,3]);
    const x = pct * canvas.width;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 14px JetBrains Mono, monospace';
    ctx.fillText('UESO', x + 6, 20);
  }
  if (state.uescFrame !== null) {
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 2;
    ctx.setLineDash([5,3]);
    const x = (state.uescFrame / state.totalFrames) * canvas.width;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff4d6d';
    ctx.font = 'bold 14px JetBrains Mono, monospace';
    ctx.fillText('UESC', x + 6, 38);
  }

  updateUI();
}

function updateUI() {
  if (!state.video) return;
  const vid = state.video;
  const frame = Math.floor(vid.currentTime * state.fps);
  state.currentFrame = frame;

  document.getElementById('cur-frame').textContent = frame;
  document.getElementById('cur-time').textContent = vid.currentTime.toFixed(3);

  const pct = (vid.currentTime / vid.duration) * 100;
  document.getElementById('timeline-progress').style.width = pct + '%';

  updateMarkers();
  updateMetrics();
}

function updateMarkers() {
  if (!state.video) return;
  const dur = state.video.duration;

  const setMarker = (id, frame, show) => {
    const el = document.getElementById(id);
    if (!show || frame === null) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = ((frame / (state.totalFrames || 1)) * 100) + '%';
  };

  setMarker('marker-ueso', state.uesoFrame, state.uesoFrame !== null);
  setMarker('marker-uesc', state.uescFrame, state.uescFrame !== null);
  setMarker('marker-suggestion', state.sugUESO, state.sugUESO !== null && state.uesoFrame === null);

  const hl = document.getElementById('dur-highlight');
  if (state.uesoFrame !== null && state.uescFrame !== null && state.uesoFrame < state.uescFrame) {
    const left = (state.uesoFrame / state.totalFrames) * 100;
    const right = (state.uescFrame / state.totalFrames) * 100;
    hl.style.display = 'block';
    hl.style.left = left + '%';
    hl.style.width = (right - left) + '%';
  } else {
    hl.style.display = 'none';
  }
}

function updateMetrics() {
  const fmt = (f, type) => {
    if (f === null) return '<span style="color:var(--border)">—</span>';
    const t = (f / state.fps).toFixed(3);
    return f;
  };
  const fmtT = (f) => f === null ? '<span style="color:var(--border)">—</span>' : (f/state.fps).toFixed(3) + 's';

  document.getElementById('m-ueso').innerHTML = state.uesoFrame !== null ? state.uesoFrame : '<span style="color:var(--border)">—</span>';
  document.getElementById('m-ueso-t').innerHTML = fmtT(state.uesoFrame);
  document.getElementById('m-uesc').innerHTML = state.uescFrame !== null ? state.uescFrame : '<span style="color:var(--border)">—</span>';
  document.getElementById('m-uesc-t').innerHTML = fmtT(state.uescFrame);

  if (state.uesoFrame !== null && state.uescFrame !== null) {
    const ms = Math.round(((state.uescFrame - state.uesoFrame) / state.fps) * 1000);
    document.getElementById('m-dur').textContent = ms + ' ms';
  } else {
    document.getElementById('m-dur').innerHTML = '<span style="color:var(--border)">—</span>';
  }
}

function togglePlay() {
  if (!state.video) return;
  if (state.isPlaying) {
    state.video.pause();
    state.isPlaying = false;
    document.getElementById('play-btn').innerHTML = '<kbd>Espaço</kbd> Play';
    cancelAnimationFrame(state.animId);
  } else {
    state.video.play();
    state.isPlaying = true;
    document.getElementById('play-btn').innerHTML = '<kbd>Espaço</kbd> Pause';
    loop();
  }
}

function loop() {
  renderFrame();
  if (state.isPlaying) state.animId = requestAnimationFrame(loop);
  if (state.video && state.video.ended) {
    state.isPlaying = false;
    document.getElementById('play-btn').innerHTML = '<kbd>Espaço</kbd> Play';
  }
}

function stepForward() {
  if (!state.video) return;
  state.video.currentTime = Math.min(state.video.duration, state.video.currentTime + 1/state.fps);
  setTimeout(renderFrame, 50);
}

function stepBack() {
  if (!state.video) return;
  state.video.currentTime = Math.max(0, state.video.currentTime - 1/state.fps);
  setTimeout(renderFrame, 50);
}

function setSpeed(s) {
  state.playbackSpeed = s;
  if (state.video) state.video.playbackRate = s;
  document.querySelectorAll('.speed-btn').forEach(b => {
    b.classList.toggle('active', parseFloat(b.textContent) === s);
  });
}

function seekToClick(e) {
  if (!state.video) return;
  const bar = document.getElementById('timeline-bar');
  const rect = bar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  state.video.currentTime = pct * state.video.duration;
  setTimeout(renderFrame, 50);
}

function markUESO() {
  if (!state.video) return;
  state.uesoFrame = Math.floor(state.video.currentTime * state.fps);
  toast(`UESO marcado no frame ${state.uesoFrame}`, 2000);
  renderFrame();
}

function markUESC() {
  if (!state.video) return;
  state.uescFrame = Math.floor(state.video.currentTime * state.fps);
  toast(`UESC marcado no frame ${state.uescFrame}`, 2000);
  renderFrame();
}

function saveAnnotation() {
  if (!state.video) return;
  if (state.uesoFrame === null || state.uescFrame === null) {
    toast('⚠ Marque UESO e UESC antes de salvar!', 2500); return;
  }
  if (state.uesoFrame >= state.uescFrame) {
    toast('⚠ UESO deve vir antes do UESC!', 2500); return;
  }
  const dur_ms = Math.round(((state.uescFrame - state.uesoFrame) / state.fps) * 1000);
  const ann = {
    id: Date.now(),
    filename: state.videoName,
    fps: state.fps,
    ueso_frame: state.uesoFrame,
    ueso_time: (state.uesoFrame / state.fps).toFixed(3),
    uesc_frame: state.uescFrame,
    uesc_time: (state.uescFrame / state.fps).toFixed(3),
    ues_odur_ms: dur_ms,
  };
  state.annotations.push(ann);
  renderAnnotationsList();
  updateProgress();

  if (state.queue.length > 1) {
    state.queue[state.queueIndex].status = 'done';
    renderQueue();
    const nextIdx = state.queueIndex + 1;
    if (nextIdx < state.queue.length) {
      toast(`✓ Salvo! Carregando próximo vídeo… (${nextIdx + 1}/${state.queue.length})`, 2500);
      setTimeout(() => loadQueueItem(nextIdx), 800);
    } else {
      toast(`✓ Todos os ${state.queue.length} vídeos anotados! Exporte o CSV.`, 3500);
    }
  } else {
    toast(`✓ Anotação salva! UESOdur = ${dur_ms}ms`, 3000);
  }
}

function deleteAnnotation(id) {
  state.annotations = state.annotations.filter(a => a.id !== id);
  renderAnnotationsList();
  updateProgress();
}

function renderAnnotationsList() {
  const wrap = document.getElementById('ann-list-wrap');
  document.getElementById('ann-count').textContent = state.annotations.length;
  if (state.annotations.length === 0) {
    wrap.innerHTML = '<div class="empty-state">Nenhuma anotação ainda.<br>Marque UESO + UESC e pressione S.</div>';
    return;
  }
  let html = '<div class="annotations-list"><div class="ann-row header"><span>Arquivo</span><span>UESO</span><span>UESC</span><span>Dur(ms)</span><span></span></div>';
  state.annotations.slice().reverse().forEach(a => {
    const short = a.filename.length > 16 ? a.filename.slice(0,14)+'…' : a.filename;
    html += `<div class="ann-row">
      <span class="filename" title="${a.filename}">${short}</span>
      <span class="val-ueso">${a.ueso_frame}</span>
      <span class="val-uesc">${a.uesc_frame}</span>
      <span class="val-dur">${a.ues_odur_ms}</span>
      <button class="del-btn" onclick="deleteAnnotation(${a.id})">✕</button>
    </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

function updateProgress() {
  const n = state.annotations.length;
  document.getElementById('progress-label').textContent = `${n} vídeo(s) anotado(s)`;
  const pct = Math.min(n / 100 * 100, 100);
  document.getElementById('progress-bar-fill').style.width = pct + '%';
}

function exportCSV() {
  if (state.annotations.length === 0) { toast('Nenhuma anotação para exportar!', 2000); return; }
  const headers = ['filename','fps','ueso_frame','ueso_time_s','uesc_frame','uesc_time_s','ues_odur_ms'];
  const rows = state.annotations.map(a =>
    [a.filename, a.fps, a.ueso_frame, a.ueso_time, a.uesc_frame, a.uesc_time, a.ues_odur_ms].join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'anotacoes_vfss.csv'; a.click();
  toast('CSV exportado!', 2000);
}

async function runAutoDetect() {
  if (!state.video) return;
  toast('Analisando vídeo… pode levar alguns segundos.', 3000);
  document.getElementById('btn-auto').disabled = true;
  document.getElementById('btn-auto').textContent = 'Analisando...';

  await new Promise(r => setTimeout(r, 100));

  const vid = state.video;
  const canvas = document.createElement('canvas');
  const sampleW = 160;
  const sampleH = Math.round((vid.videoHeight / vid.videoWidth) * sampleW);
  canvas.width = sampleW; canvas.height = sampleH;
  const ctx = canvas.getContext('2d');

  // ROI: faixa vertical onde o EES aparece (40%–90% da altura)
  const roiTop    = Math.floor(sampleH * 0.40);
  const roiBottom = Math.floor(sampleH * 0.90);
  const roiPixels = (roiBottom - roiTop) * sampleW;

  // Captura o brilho médio (luminância) do ROI num instante t
  async function getBrightness(t) {
    vid.currentTime = t;
    await new Promise(r => { vid.onseeked = r; setTimeout(r, 200); });
    ctx.drawImage(vid, 0, 0, sampleW, sampleH);
    const px = ctx.getImageData(0, roiTop, sampleW, roiBottom - roiTop).data;
    let sum = 0;
    for (let j = 0; j < px.length; j += 4)
      sum += 0.299 * px[j] + 0.587 * px[j+1] + 0.114 * px[j+2];
    return sum / roiPixels;
  }

  // Suavização por média móvel
  function smooth(arr, w = 3) {
    return arr.map((v, i) => {
      const sl = arr.slice(Math.max(0, i-w), Math.min(arr.length, i+w+1));
      return sl.reduce((s, x) => s + x, 0) / sl.length;
    });
  }

  const totalDur = vid.duration;

  // ── PASSAGEM 1: varredura grossa (150 amostras no vídeo inteiro) ──────────
  document.getElementById('btn-auto').textContent = 'Passagem 1/2…';
  const p1n = 150;
  const p1brightness = [];
  for (let i = 0; i < p1n; i++) {
    const t = (i / (p1n - 1)) * totalDur;
    p1brightness.push(await getBrightness(t));
  }

  const p1smooth = smooth(p1brightness, 3);

  // Delta de brilho: positivo = aumento (bário chegando), negativo = queda (bário passando)
  const p1deltas = p1smooth.map((v, i) => i === 0 ? 0 : v - p1smooth[i-1]);

  // UESO rough: maior delta positivo
  let bestPos = 0;
  p1deltas.forEach((d, i) => { if (d > p1deltas[bestPos]) bestPos = i; });
  const roughUESOTime = (bestPos / (p1n - 1)) * totalDur;

  // ── PASSAGEM 2: varredura fina ao redor do evento (200 amostras em janela ampliada) ──
  document.getElementById('btn-auto').textContent = 'Passagem 2/2…';
  const p2start = Math.max(0,        roughUESOTime - 2.0);
  const p2end   = Math.min(totalDur, roughUESOTime + 6.0);
  const p2n = 200;
  const p2times      = Array.from({length: p2n}, (_, i) => p2start + (i / (p2n-1)) * (p2end - p2start));
  const p2brightness = [];
  for (const t of p2times) p2brightness.push(await getBrightness(t));

  const p2smooth = smooth(p2brightness, 3);
  const p2deltas = p2smooth.map((v, i) => i === 0 ? 0 : v - p2smooth[i-1]);

  // UESO fino: maior delta positivo na passagem 2
  let uesoIdx = 0;
  p2deltas.forEach((d, i) => { if (d > p2deltas[uesoIdx]) uesoIdx = i; });
  const uesoFrame = Math.round(p2times[uesoIdx] * state.fps);
  const uesoTimeSec = p2times[uesoIdx];

  // UESC: maior delta negativo DEPOIS do UESO
  // Restrição principal: 0.3s – 8s depois do UESO (em segundos, independente do fps)
  const minGapSec = 0.3;
  const maxGapSec = 8.0;
  let uescIdx = -1;
  let minDelta = Infinity;
  for (let i = uesoIdx + 1; i < p2deltas.length; i++) {
    const gapSec = p2times[i] - uesoTimeSec;
    if (gapSec < minGapSec) continue;
    if (gapSec > maxGapSec) break;
    if (p2deltas[i] < minDelta) { minDelta = p2deltas[i]; uescIdx = i; }
  }

  // Fallback: se não achou dentro da restrição, pega o maior delta negativo após o UESO
  if (uescIdx === -1) {
    for (let i = uesoIdx + 1; i < p2deltas.length; i++) {
      if (p2deltas[i] < minDelta) { minDelta = p2deltas[i]; uescIdx = i; }
    }
  }

  document.getElementById('btn-auto').disabled = false;
  document.getElementById('btn-auto').innerHTML = '<kbd>A</kbd> Auto-detectar';

  if (uescIdx === -1 || minDelta >= 0) {
    toast('⚠ Não foi possível detectar o fechamento. Tente marcar manualmente.', 3500);
    return;
  }

  state.sugUESO = uesoFrame;
  state.sugUESC = Math.round(p2times[uescIdx] * state.fps);
  const dur_ms  = Math.round(((state.sugUESC - state.sugUESO) / state.fps) * 1000);

  document.getElementById('sug-ueso-val').textContent = `Frame ${state.sugUESO} (${(state.sugUESO/state.fps).toFixed(3)}s)`;
  document.getElementById('sug-uesc-val').textContent = `Frame ${state.sugUESC} (${(state.sugUESC/state.fps).toFixed(3)}s)`;
  document.getElementById('sug-dur-val').textContent  = `${dur_ms} ms`;
  document.getElementById('suggestion-panel').style.display = 'block';

  updateMarkers();
  vid.currentTime = state.sugUESO / state.fps;
  setTimeout(renderFrame, 100);

  toast('Sugestão gerada! Verifique e aceite ou rejeite.', 3000);
}

function acceptSuggestion() {
  state.uesoFrame = state.sugUESO;
  state.uescFrame = state.sugUESC;
  state.sugUESO = null;
  state.sugUESC = null;
  document.getElementById('suggestion-panel').style.display = 'none';
  renderFrame();
  toast('✓ Sugestão aceita! Pressione S para salvar.', 2500);
}

function rejectSuggestion() {
  state.sugUESO = null;
  state.sugUESC = null;
  document.getElementById('suggestion-panel').style.display = 'none';
  updateMarkers();
  renderFrame();
  toast('Sugestão rejeitada. Marque manualmente.', 2000);
}

function goToSugUESO() {
  if (!state.video || state.sugUESO === null) return;
  state.video.currentTime = state.sugUESO / state.fps;
  setTimeout(renderFrame, 100);
}

function goToSugUESC() {
  if (!state.video || state.sugUESC === null) return;
  state.video.currentTime = state.sugUESC / state.fps;
  setTimeout(renderFrame, 100);
}

document.addEventListener('keydown', e => {
  if (!state.video) return;
  if (e.target.tagName === 'INPUT') return;
  switch(e.key) {
    case ' ': e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': stepForward(); break;
    case 'ArrowLeft': stepBack(); break;
    case 'o': case 'O': markUESO(); break;
    case 'c': case 'C': markUESC(); break;
    case 's': case 'S': saveAnnotation(); break;
    case 'a': case 'A': runAutoDetect(); break;
    case 'r': case 'R':
      state.uesoFrame = null; state.uescFrame = null;
      updateMarkers(); renderFrame();
      toast('Marcadores resetados', 1500); break;
  }
});

const dz = document.getElementById('drop-zone');
dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag-over'); };
dz.ondragleave = () => dz.classList.remove('drag-over');
dz.ondrop = e => {
  e.preventDefault(); dz.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
  if (files.length) loadFilesFromInput({ target: { files } });
};

let toastTimer;
function toast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}
