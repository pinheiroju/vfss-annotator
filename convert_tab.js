// -- tabs -- 
function switchTab(name) {
    document.getElementById('tab-converter').style.display = name === 'converter' ? 'block' : 'none';
    document.getElementById('tab-annotator').style.display = name === 'annotator'  ? 'block' : 'none';
    document.querySelectorAll('.tab').forEach((t, i) => {
      t.classList.toggle('active', (i === 0 && name === 'converter') || (i === 1 && name === 'annotator'));
    });
  }
  
  
  const conv = {
    files: [],
    ffmpeg: null,
    loaded: false,
  };
  

  const convDZ = document.getElementById('conv-drop-zone');
  convDZ.ondragover = e => { e.preventDefault(); convDZ.classList.add('drag-over'); };
  convDZ.ondragleave = () => convDZ.classList.remove('drag-over');
  convDZ.ondrop = e => {
    e.preventDefault();
    convDZ.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.toLowerCase().endsWith('.avi')
    );
    if (files.length) setConvFiles(files);
    else toast('⚠ Selecione apenas arquivos .avi', 2500);
  };
  
  function convFilesSelected(event) {
    const files = Array.from(event.target.files);
    if (files.length) setConvFiles(files);
  }
  
  function setConvFiles(files) {
    conv.files = files.map(f => ({ file: f, status: 'waiting' }));
    renderConvList();
    document.getElementById('conv-file-list').style.display = 'block';
    document.getElementById('conv-drop-zone').style.display = 'none';
    document.getElementById('btn-convert').disabled = false;
    document.getElementById('btn-conv-clear').style.display = 'inline-flex';
  }

  function clearConvFiles() {
    conv.files = [];
    document.getElementById('conv-items').innerHTML = '';
    document.getElementById('conv-file-list').style.display = 'none';
    document.getElementById('conv-drop-zone').style.display = 'flex';
    document.getElementById('btn-convert').disabled = true;
    document.getElementById('btn-conv-clear').style.display = 'none';
    document.getElementById('conv-overall-label').textContent = '';
    document.getElementById('conv-file-input').value = '';
  }
  
  function renderConvList() {
    const wrap = document.getElementById('conv-items');
    wrap.innerHTML = conv.files.map((item, i) => `
      <div class="conv-item" id="conv-item-${i}">
        <span class="conv-filename" title="${item.file.name}">${item.file.name}</span>
        <span class="conv-size">${(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
        <span class="conv-status waiting" id="conv-status-${i}">Aguardando</span>
        <div class="conv-progress-bar">
          <div class="conv-progress-fill" id="conv-prog-${i}"></div>
        </div>
      </div>
    `).join('');
  }
  
  function setItemStatus(i, status, label) {
    const el = document.getElementById(`conv-status-${i}`);
    if (!el) return;
    el.className = `conv-status ${status}`;
    el.textContent = label;
  }
  
  function setItemProgress(i, pct) {
    const el = document.getElementById(`conv-prog-${i}`);
    if (el) el.style.width = pct + '%';
  }
  
  async function createFFmpegInstance() {
    const { createFFmpeg, fetchFile } = FFmpeg;
    const instance = createFFmpeg({
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    });
    await instance.load();
    conv.fetchFile = fetchFile;
    return instance;
  }

  async function loadFFmpeg() {
    if (conv.loaded) return true;  // já carregou, reutiliza

    document.getElementById('conv-loading').style.display = 'block';
    document.getElementById('conv-status-text').textContent = 'Carregando FFmpeg…';

    try {
      conv.ffmpeg = await createFFmpegInstance();
      conv.loaded = true;
      document.getElementById('conv-loading').style.display = 'none';
      document.getElementById('conv-status-dot').classList.add('active');
      document.getElementById('conv-status-text').textContent = 'FFmpeg pronto';
      return true;
    } catch (err) {
      document.getElementById('conv-loading').style.display = 'none';
      document.getElementById('conv-status-text').textContent = 'Erro ao carregar FFmpeg';
      console.error('FFmpeg load error:', err);
      toast('⚠ Erro ao carregar FFmpeg. Verifique sua conexão.', 4000);
      return false;
    }
  }


  async function startConversion() {
    document.getElementById('btn-convert').disabled = true;

    // Sempre cria uma instância nova para garantir memória limpa
    const ok = await loadFFmpeg();
    if (!ok) {
      document.getElementById('btn-convert').disabled = false;
      return;
    }

    let done = 0;

    for (let i = 0; i < conv.files.length; i++) {
      const { file } = conv.files[i];
      const inputName  = 'input.avi';
      const outputName = file.name.replace(/\.avi$/i, '.mp4');

      setItemStatus(i, 'loading', 'Convertendo…');
      setItemProgress(i, 10);

      try {
        // Reinicia o FFmpeg a cada 5 arquivos para liberar memória
        if (i > 0 && i % 5 === 0) {
          document.getElementById('conv-status-text').textContent = `Liberando memória… (${i}/${conv.files.length})`;
          conv.ffmpeg = await createFFmpegInstance();
          document.getElementById('conv-status-text').textContent = 'FFmpeg pronto';
        }

        const ffmpeg = conv.ffmpeg;

        ffmpeg.FS('writeFile', inputName, await conv.fetchFile(file));
        setItemProgress(i, 30);

        await ffmpeg.run(
          '-i', inputName,
          '-c:v', 'libx264',
          '-profile:v', 'baseline',
          '-pix_fmt', 'yuv420p',
          '-crf', '18',
          '-movflags', 'faststart',
          outputName
        );

        setItemProgress(i, 80);

        const data = ffmpeg.FS('readFile', outputName);
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url  = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = outputName;
        a.click();

        try { ffmpeg.FS('unlink', inputName); } catch(_) {}
        try { ffmpeg.FS('unlink', outputName); } catch(_) {}

        setItemProgress(i, 100);
        setItemStatus(i, 'done', '✓ Baixado');
        done++;

      } catch (err) {
        console.error(`Erro ao converter ${file.name}:`, err);
        setItemStatus(i, 'error', '✗ Erro');
        setItemProgress(i, 0);

        // Se o FFmpeg travou, recria para o próximo arquivo
        try { conv.ffmpeg = await createFFmpegInstance(); } catch(_) {}
      }
    }
  
    document.getElementById('conv-overall-label').textContent =
      `${done} de ${conv.files.length} convertido(s)`;
    document.getElementById('btn-convert').disabled = false;
  
    if (done === conv.files.length) {
      toast(`✓ ${done} arquivo(s) convertido(s) e baixado(s)!`, 3000);
    } else {
      toast(`⚠ ${done} de ${conv.files.length} convertido(s). Verifique os erros.`, 3500);
    }
  }
  