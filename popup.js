const $ = id => document.getElementById(id);
const list = $('list');
const status = $('status');
const scanBtn = $('scan');
const selectAllBtn = $('selectAll');
const clearBtn = $('clear');
const downloadBtn = $('download');
const downloadAllBtn = $('downloadAll');
const selectionCount = $('selectionCount');
const searchInput = $('search');
const sizeFilter = $('sizeFilter');
const qualityMode = $('qualityMode');

let images = [];
let selected = new Set();

function pageScanner() {
  const out = new Map();
  const candidates = new Map();

  const toAbs = value => {
    if (!value || typeof value !== 'string') return null;
    const v = value.trim().replace(/^['"]|['"]$/g, '');
    if (!v || v.startsWith('#')) return null;
    try { return new URL(v, document.baseURI).href; } catch { return null; }
  };

  const normalizeKey = url => {
    try {
      const u = new URL(url);
      const name = decodeURIComponent(u.pathname.split('/').pop() || '')
        .replace(/[-_](?:thumb|thumbnail|small|medium|large|xl|full|original|orig|scaled|preview)(?=\.|-|_|$)/ig, '')
        .replace(/[-_]\d{2,5}x\d{2,5}(?=\.|-|_|$)/ig, '')
        .replace(/\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i, '');
      return `${u.hostname}/${name}`.toLowerCase();
    } catch { return url.toLowerCase(); }
  };

  const qualityScore = (url, width = 0, height = 0) => {
    let score = (Number(width) || 0) * (Number(height) || 0);
    const s = String(url || '').toLowerCase();
    if (/\b(original|orig|full|fullsize|hires|highres|master|source)\b/.test(s)) score += 5e12;
    if (/\b(large|xl|xxl|2048|2560|3000|4000)\b/.test(s)) score += 2e12;
    if (/\b(thumb|thumbnail|small|preview|icon|avatar)\b/.test(s)) score -= 2e12;
    const dim = s.match(/(?:^|[-_\/])(\d{3,5})x(\d{3,5})(?:[-_.\/]|$)/i);
    if (dim) score += Number(dim[1]) * Number(dim[2]);
    return score;
  };

  const add = (value, source, width = 0, height = 0, relationship = '') => {
    const url = toAbs(value);
    if (!url || !/^(https?:|data:|blob:)/i.test(url)) return;
    if (/^data:image\/svg\+xml[,;]/i.test(url) && url.length < 500) return;
    const item = {
      url,
      source,
      width: Number(width) || 0,
      height: Number(height) || 0,
      score: qualityScore(url, width, height),
      relationship
    };
    const current = out.get(url);
    if (!current || item.score > current.score) out.set(url, item);

    const key = normalizeKey(url);
    const best = candidates.get(key);
    if (!best || item.score > best.score) candidates.set(key, item);
  };

  const parseSrcset = (srcset, source, relationship = '') => {
    if (!srcset) return;
    srcset.split(',').forEach(part => {
      const bits = part.trim().split(/\s+/);
      const url = bits[0];
      let width = 0;
      if (bits[1]?.endsWith('w')) width = parseInt(bits[1], 10) || 0;
      add(url, source, width, 0, relationship);
    });
  };

  document.querySelectorAll('img').forEach(img => {
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    add(img.currentSrc, 'IMG atual', w, h, 'shown');
    add(img.src, 'IMG src', w, h, 'shown');
    [
      'data-src','data-lazy-src','data-original','data-url','data-image',
      'data-full','data-full-url','data-fullsize','data-large-file','data-orig-file',
      'data-original-src','data-zoom-image','data-hires','data-high-res-src'
    ].forEach(attr => add(img.getAttribute(attr), `IMG ${attr}`, w, h, 'alternative'));
    parseSrcset(img.srcset, 'IMG srcset', 'responsive');
    parseSrcset(img.getAttribute('data-srcset'), 'IMG data-srcset', 'responsive');
  });

  document.querySelectorAll('picture source, source[srcset]').forEach(el => {
    parseSrcset(el.srcset || el.getAttribute('srcset'), 'SOURCE srcset', 'responsive');
    parseSrcset(el.getAttribute('data-srcset'), 'SOURCE data-srcset', 'responsive');
  });

  document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]').forEach(el => add(el.content, 'Metadado social', 0, 0, 'alternative'));
  document.querySelectorAll('link[rel="preload"][as="image"], link[rel="image_src"]').forEach(el => add(el.href, 'Preload/link', 0, 0, 'alternative'));

  document.querySelectorAll('a[href]').forEach(a => {
    if (/\.(jpe?g|png|gif|webp|avif|bmp|svg)(?:[?#].*)?$/i.test(a.href)) add(a.href, 'Link direto', 0, 0, 'alternative');
    const img = a.querySelector('img');
    if (img && a.href && /\.(jpe?g|png|gif|webp|avif|bmp)(?:[?#].*)?$/i.test(a.href)) {
      add(a.href, 'Link da imagem', 0, 0, 'alternative');
    }
  });

  const elements = document.querySelectorAll('*');
  const limit = Math.min(elements.length, 12000);
  for (let i = 0; i < limit; i++) {
    const el = elements[i];
    let bg = '';
    try { bg = getComputedStyle(el).backgroundImage || ''; } catch {}
    if (!bg || bg === 'none') continue;
    for (const match of bg.matchAll(/url\((?:"|')?(.*?)(?:"|')?\)/g)) {
      add(match[1], 'Fundo CSS', el.clientWidth || 0, el.clientHeight || 0, 'shown');
    }
  }

  const all = Array.from(out.values());
  return {
    title: document.title,
    pageUrl: location.href,
    images: all.map(item => {
      const key = normalizeKey(item.url);
      const best = candidates.get(key);
      return {
        ...item,
        bestUrl: best?.url || item.url,
        bestSource: best?.source || item.source,
        bestWidth: best?.width || item.width,
        bestHeight: best?.height || item.height,
        hasBetter: Boolean(best && best.url !== item.url && best.score > item.score)
      };
    })
  };
}

function normalizeResults(results) {
  const merged = new Map();
  for (const frame of results || []) {
    const value = frame?.result;
    if (!value?.images) continue;
    for (const img of value.images) {
      const existing = merged.get(img.url);
      const score = Number(img.score) || ((img.width || 0) * (img.height || 0));
      const existingScore = Number(existing?.score) || ((existing?.width || 0) * (existing?.height || 0));
      if (!existing || score > existingScore) merged.set(img.url, img);
    }
  }
  return [...merged.values()].sort((a,b) => {
    if (a.hasBetter !== b.hasBetter) return a.hasBetter ? -1 : 1;
    return ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0));
  });
}

function visibleImages() {
  const q = searchInput.value.trim().toLowerCase();
  const min = Number(sizeFilter.value || 0);
  return images.filter(img => {
    const haystack = `${img.url} ${img.source} ${img.bestUrl || ''} ${img.bestSource || ''}`.toLowerCase();
    const maxSide = Math.max(img.width || 0, img.height || 0, img.bestWidth || 0, img.bestHeight || 0);
    return (!q || haystack.includes(q)) && (!min || maxSide >= min || maxSide === 0);
  });
}

function chosenUrl(img) {
  return qualityMode.value === 'best' && img.bestUrl ? img.bestUrl : img.url;
}

function updateSelectionUI() {
  selectionCount.textContent = `${selected.size} selecionada(s)`;
  downloadBtn.disabled = selected.size === 0;
  downloadAllBtn.disabled = images.length === 0;
}

function render() {
  const visible = visibleImages();
  list.innerHTML = '';
  if (!visible.length) {
    list.innerHTML = '<div class="empty">Nenhuma imagem corresponde ao filtro atual.</div>';
    updateSelectionUI();
    return;
  }

  for (const img of visible) {
    const idx = images.indexOf(img);
    const card = document.createElement('div');
    card.className = 'card' + (selected.has(idx) ? ' selected' : '');
    card.dataset.index = idx;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'check';
    cb.checked = selected.has(idx);

    const wrap = document.createElement('div');
    wrap.className = 'preview-wrap';
    const preview = document.createElement('img');
    preview.className = 'preview';
    preview.loading = 'lazy';
    preview.src = chosenUrl(img);
    preview.alt = 'Prévia';
    preview.addEventListener('load', () => {
      if ((!img.width || !img.height) && preview.naturalWidth) {
        if (chosenUrl(img) === img.url) {
          img.width = preview.naturalWidth;
          img.height = preview.naturalHeight;
        } else {
          img.bestWidth = preview.naturalWidth;
          img.bestHeight = preview.naturalHeight;
        }
        const dim = card.querySelector('.dimensions');
        if (dim) dim.textContent = dimensionText(img);
      }
    });
    preview.addEventListener('error', () => { wrap.textContent = 'Prévia indisponível'; });
    wrap.appendChild(preview);

    if (img.hasBetter) {
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = 'Alternativa encontrada';
      wrap.appendChild(badge);
    }

    const info = document.createElement('div');
    info.className = 'info';
    const dim = document.createElement('div');
    dim.className = 'dimensions';
    dim.textContent = dimensionText(img);
    const src = document.createElement('div');
    src.className = 'source';
    src.textContent = qualityMode.value === 'best' && img.bestSource ? img.bestSource : (img.source || 'Imagem');
    info.append(dim, src);

    if (img.hasBetter) {
      const candidate = document.createElement('div');
      candidate.className = 'candidate';
      candidate.textContent = 'O site disponibiliza outra versão potencialmente melhor.';
      info.appendChild(candidate);
    }

    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = chosenUrl(img);
    url.title = chosenUrl(img);
    info.appendChild(url);

    const toggle = () => {
      if (selected.has(idx)) selected.delete(idx); else selected.add(idx);
      render();
    };
    cb.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    card.addEventListener('click', toggle);

    card.append(cb, wrap, info);
    list.appendChild(card);
  }
  updateSelectionUI();
}

function dimensionText(img) {
  const w = qualityMode.value === 'best' ? (img.bestWidth || img.width) : img.width;
  const h = qualityMode.value === 'best' ? (img.bestHeight || img.height) : img.height;
  return w && h ? `${w} × ${h} px` : 'Resolução não identificada';
}

async function scan() {
  selected.clear();
  images = [];
  scanBtn.disabled = true;
  status.textContent = 'Analisando imagens e versões alternativas disponibilizadas pela página...';
  list.innerHTML = '<div class="empty">Analisando a página...</div>';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(tab.url || '')) throw new Error('Página não suportada');
    let results;
    try {
      results = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: pageScanner });
    } catch {
      results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageScanner });
    }
    images = normalizeResults(results);
    const better = images.filter(x => x.hasBetter).length;
    status.textContent = `${images.length} imagem(ns) encontrada(s). ${better} com alternativa potencialmente melhor disponibilizada pelo site.`;
    render();
  } catch (err) {
    console.error(err);
    status.textContent = 'Não foi possível analisar esta página. Use uma página http ou https e tente novamente.';
    list.innerHTML = '<div class="empty">A análise não pôde ser executada nesta página.</div>';
  } finally {
    scanBtn.disabled = false;
  }
}

function safeName(input) {
  return (input || 'imagem').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 130);
}

function getExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (m) return '.' + m[1].toLowerCase();
  } catch {}
  return '.jpg';
}

function filenameFor(img, order) {
  const url = chosenUrl(img);
  let base = 'imagem' + getExtension(url);
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || 'imagem');
    base = last.includes('.') ? last : last + getExtension(url);
  } catch {}
  return `${String(order + 1).padStart(3, '0')}_${safeName(base)}`;
}

async function downloadIndexes(indexes, label) {
  const chosen = [...indexes].sort((a,b) => a-b);
  if (!chosen.length) return;
  downloadBtn.disabled = true;
  downloadAllBtn.disabled = true;
  let ok = 0;
  let failed = 0;
  status.textContent = `Preparando ${chosen.length} download(s) de ${label}...`;
  for (let order = 0; order < chosen.length; order++) {
    const img = images[chosen[order]];
    const url = chosenUrl(img);
    try {
      await chrome.downloads.download({
        url,
        filename: `imagens_site/${filenameFor(img, order)}`,
        saveAs: false,
        conflictAction: 'uniquify'
      });
      ok++;
    } catch (e) {
      console.error('Falha no download', url, e);
      failed++;
    }
  }
  status.textContent = failed ? `${ok} download(s) iniciado(s) e ${failed} falha(s).` : `${ok} download(s) iniciado(s) com sucesso.`;
  updateSelectionUI();
}

selectAllBtn.addEventListener('click', () => {
  for (const img of visibleImages()) selected.add(images.indexOf(img));
  render();
});

clearBtn.addEventListener('click', () => { selected.clear(); render(); });
searchInput.addEventListener('input', render);
sizeFilter.addEventListener('change', render);
qualityMode.addEventListener('change', render);
scanBtn.addEventListener('click', scan);

downloadBtn.addEventListener('click', () => downloadIndexes(selected, 'imagens selecionadas'));

downloadAllBtn.addEventListener('click', () => {
  const allIndexes = images.map((_, i) => i);
  downloadIndexes(allIndexes, 'todas as imagens encontradas');
});

scan();
