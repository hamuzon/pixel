(() => {
  // --- サポートバージョン ---
  const SUPPORTED_VERSIONS = ["1.0"];
  const APP_NAME = "PixelDraw";
  const APP_VERSION = "1.0";
  const WIDTH = 16;
  const HEIGHT = 16;

  // パレット（透明は#00000000）
  const palette = [
    "#000000",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ffffff",
    "#00000000"
  ];
  let currentColorIndex = 0;
  let isDrawing = false;

  const paletteEl = document.getElementById("palette");
  const canvasEl = document.getElementById("canvas");
  const resetBtn = document.getElementById("btn-reset");
  const saveBtn = document.getElementById("btn-save");
  const loadBtn = document.getElementById("btn-load");
  const imgSaveBtn = document.getElementById("btn-img-save");
  const fileLoadInput = document.getElementById("file-load");
  const titleInput = document.getElementById("titleInput");

  // ピクセル生成
  for(let i=0; i<WIDTH*HEIGHT; i++){
    const pixel = document.createElement("div");
    pixel.classList.add("pixel");
    pixel.dataset.index = i;
    pixel.style.backgroundColor = palette[palette.length-1]; // 透明色デフォルト
    canvasEl.appendChild(pixel);
  }

  // パレット生成（初期）
  function createPalette(){
    paletteEl.innerHTML = "";
    palette.forEach((color, i) => {
      const btn = document.createElement("div");
      btn.className = "color-btn";
      btn.style.backgroundColor = color;
      btn.title = `色: ${color}`;
      btn.addEventListener("click", () => selectColor(i, btn));
      paletteEl.appendChild(btn);
      if(i === currentColorIndex) btn.classList.add("selected");
    });
  }

  // パレット更新（読み込み時用）
  function updatePaletteUI(newPalette){
    paletteEl.innerHTML = "";
    newPalette.forEach((color, i) => {
      const btn = document.createElement("div");
      btn.className = "color-btn";
      btn.style.backgroundColor = color;
      btn.title = `色: ${color}`;
      btn.addEventListener("click", () => selectColor(i, btn));
      paletteEl.appendChild(btn);
      if(i === currentColorIndex) btn.classList.add("selected");
    });
    // palette配列も更新
    palette.length = 0;
    newPalette.forEach(c => palette.push(c));
  }

  function selectColor(index, btnEl){
    currentColorIndex = index;
    paletteEl.querySelectorAll(".color-btn").forEach(b=>b.classList.remove("selected"));
    btnEl.classList.add("selected");
  }

  function paintPixel(pixel){
    pixel.style.backgroundColor = palette[currentColorIndex];
    pixel.dataset.colorIndex = currentColorIndex;
  }

  function onDrawChange(){
    saveToLocalStorage();
  }

  canvasEl.addEventListener("mousedown", e => {
    if(!e.target.classList.contains("pixel")) return;
    isDrawing = true;
    paintPixel(e.target);
    onDrawChange();
  });
  canvasEl.addEventListener("mouseover", e => {
    if(isDrawing && e.target.classList.contains("pixel")){
      paintPixel(e.target);
      onDrawChange();
    }
  });
  window.addEventListener("mouseup", () => {
    isDrawing = false;
  });

  resetBtn.addEventListener("click", () => {
    if(confirm("本当にボードをリセットして全てクリアしますか？")){
      canvasEl.querySelectorAll(".pixel").forEach(p => {
        p.style.backgroundColor = palette[palette.length-1]; // 透明
        delete p.dataset.colorIndex;
      });
      localStorage.removeItem("pixelDrawingData-v1");
      titleInput.value = "";
    }
  });

  saveBtn.addEventListener("click", () => {
    downloadJson();
  });

  loadBtn.addEventListener("click", () => {
    fileLoadInput.value = null;
    fileLoadInput.click();
  });

  fileLoadInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if(!file) return alert("ファイルが選択されていません。");
    if(!file.name.endsWith(".json")) return alert("JSONファイルを選択してください。");
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        let data = JSON.parse(ev.target.result);

        if(data.app !== APP_NAME){
          alert("このデータはこのアプリのものではありません。");
          return;
        }
        if(!SUPPORTED_VERSIONS.includes(data.version)){
          alert(`サポートされていないバージョンです。\n対応バージョン: ${SUPPORTED_VERSIONS.join(", ")}\n読み込んだバージョン: ${data.version}`);
          return;
        }
        if(data.version !== "1.0"){
          alert("v1.0以外のバージョンはサポートされていません。");
          return;
        }
        if(data.width !== WIDTH || data.height !== HEIGHT){
          alert("キャンバスサイズが異なります。");
          return;
        }
        if(!Array.isArray(data.pixels)){
          alert("ピクセルデータが不正です。");
          return;
        }
        if(!Array.isArray(data.palette)){
          alert("パレットデータが不正です。");
          return;
        }
        if(JSON.stringify(data.palette) !== JSON.stringify(palette)){
          alert("パレットがアプリと異なります。");
          return;
        }

        // UI更新
        updatePaletteUI(data.palette);
        fillCanvasWithCompressedPixels(data.pixels);
        titleInput.value = data.title || "";

        alert(`バージョン ${data.version} の作品を読み込みました。`);

        saveToLocalStorage();

      } catch {
        alert("JSONファイルの読み込みに失敗しました。");
      }
    };
    reader.readAsText(file);
  });

  window.addEventListener("load", () => {
    const saved = localStorage.getItem("pixelDrawingData-v1");
    if(saved){
      try {
        let data = JSON.parse(saved);
        if(data.app === APP_NAME && SUPPORTED_VERSIONS.includes(data.version) && data.width === WIDTH && data.height === HEIGHT && Array.isArray(data.pixels)){
          if(data.version !== "1.0"){
            alert("v1.0以外のバージョンはサポートされていません。");
            return;
          }
          updatePaletteUI(data.palette);
          fillCanvasWithCompressedPixels(data.pixels);
          titleInput.value = data.title || "";
          saveToLocalStorage();
        }
      } catch {}
    }
  });

  titleInput.addEventListener("input", () => saveToLocalStorage());

  imgSaveBtn.addEventListener("click", () => {
    const formats = ["png", "jpeg"];
    const oldSelect = document.getElementById("img-format-select");
    if(oldSelect) oldSelect.remove();

    const select = document.createElement("select");
    select.id = "img-format-select";
    formats.forEach(f => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      select.appendChild(option);
    });

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "保存";
    saveBtn.style.marginLeft = "8px";

    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.top = "50%";
    wrapper.style.left = "50%";
    wrapper.style.transform = "translate(-50%, -50%)";
    wrapper.style.background = "#c0c0c0";
    wrapper.style.border = "2px outset buttonface";
    wrapper.style.padding = "12px";
    wrapper.style.zIndex = "9999";
    wrapper.appendChild(select);
    wrapper.appendChild(saveBtn);
    document.body.appendChild(wrapper);

    saveBtn.addEventListener("click", () => {
      saveImage(select.value);
      wrapper.remove();
    });

    wrapper.addEventListener("click", e => {
      if(e.target === wrapper) wrapper.remove();
    });
  });

  function saveImage(format) {
    const cvs = document.createElement("canvas");
    cvs.width = WIDTH;
    cvs.height = HEIGHT;
    const ctx = cvs.getContext("2d");
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    canvasEl.querySelectorAll(".pixel").forEach((p,i) => {
      const bg = p.style.backgroundColor;
      if(bg && bg !== palette[palette.length-1]){
        const x = i % WIDTH;
        const y = Math.floor(i / WIDTH);
        ctx.fillStyle = bg;
        ctx.fillRect(x,y,1,1);
      }
    });
    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    cvs.toBlob(blob => downloadBlob(blob, `${APP_NAME}-${APP_VERSION}_${getTimestamp()}.${format}`), mime, 0.92);
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function saveToLocalStorage(){
    const data = {
      app: APP_NAME,
      version: APP_VERSION,
      width: WIDTH,
      height: HEIGHT,
      title: titleInput.value.trim() || undefined,
      palette,
      pixels: compressPixels(getCanvasColorIndices())
    };
    localStorage.setItem("pixelDrawingData-v1", JSON.stringify(data));
  }

  function downloadJson(){
    const data = {
      app: APP_NAME,
      version: APP_VERSION,
      width: WIDTH,
      height: HEIGHT,
      title: titleInput.value.trim() || undefined,
      palette,
      pixels: compressPixels(getCanvasColorIndices())
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], {type:"application/json"});
    const dt = new Date();
    const pad = n => n.toString().padStart(2,"0");
    const filename = `${APP_NAME}-VERSION-${APP_VERSION}_${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}_${pad(dt.getHours())}-${pad(dt.getMinutes())}-${pad(dt.getSeconds())}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("作品を保存しました。");
  }

  function getCanvasColorIndices(){
    const indices = [];
    canvasEl.querySelectorAll(".pixel").forEach(p => {
      const idx = p.dataset.colorIndex !== undefined ? Number(p.dataset.colorIndex) : palette.length - 1;
      indices.push(idx);
    });
    return indices;
  }

  // ピクセル配列を圧縮（3連続以上を[startIndex, count]でまとめる）
  function compressPixels(indices){
    const compressed = [];
    let i = 0;
    while(i < indices.length){
      const current = indices[i];
      let count = 1;
      while(i + count < indices.length && indices[i + count] === current){
        count++;
      }
      if(count >= 3){
        compressed.push([i, count]);
        compressed.push(current);
        i += count;
      } else {
        for(let j=0; j<count; j++){
          compressed.push(current);
        }
        i += count;
      }
    }
    return compressed;
  }

  // 圧縮されたピクセル配列を展開してキャンバスに適用 (v1.0用)
  function fillCanvasWithCompressedPixels(pixels){
    const indices = [];
    for(let i=0; i<pixels.length; i++){
      const val = pixels[i];
      if(Array.isArray(val) && val.length === 2 && typeof pixels[i+1] === "number"){
        const [start, count] = val;
        const colorIndex = pixels[i+1];
        for(let c=0; c<count; c++){
          indices[start + c] = colorIndex;
        }
        i++; // 次は色番号なのでスキップ
      } else if(typeof val === "number"){
        indices.push(val);
      }
    }
    for(let i=0; i<WIDTH*HEIGHT; i++){
      const idx = indices[i] !== undefined ? indices[i] : palette.length - 1; // 透明デフォルト
      const pixel = canvasEl.querySelector(`.pixel[data-index="${i}"]`);
      if(pixel){
        pixel.style.backgroundColor = palette[idx];
        pixel.dataset.colorIndex = idx;
      }
    }
  }

  function getTimestamp(){
    const dt = new Date();
    const pad = n => n.toString().padStart(2,"0");
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}_${pad(dt.getHours())}-${pad(dt.getMinutes())}-${pad(dt.getSeconds())}`;
  }

  createPalette();
})();
