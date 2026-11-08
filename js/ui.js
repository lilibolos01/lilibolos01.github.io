// Utilidades de interface.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmt = (v, casas = 2) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });

// Aceita "1,5", "1.5" e "1.234,56"
export function num(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s|R\$/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
// Valor para colocar em um <input> (com vírgula)
export const campoNum = v => (v === undefined || v === null || v === '' ? '' : String(Math.round(Number(v) * 1000) / 1000).replace('.', ','));

export const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export function addDias(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export const dataBR = iso => (iso ? iso.split('-').reverse().join('/') : '');
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const diaSemana = iso => (iso ? DIAS[new Date(iso + 'T12:00:00').getDay()] : '');
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visivel');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('visivel'), 2600);
}

// Reduz a foto para não ocupar muito espaço no celular
export function comprimirImagem(arquivo, max = 1100, qualidade = 0.82) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * esc);
      c.height = Math.round(img.height * esc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('Não consegui abrir esta foto.')); };
    img.src = url;
  });
}

export function baixarArquivo(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

// Abre a tela de compartilhar do Android (WhatsApp, Drive…); se não der, baixa o arquivo
export async function compartilharArquivo(blob, nome, titulo) {
  const arquivo = new File([blob], nome, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: titulo });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }
  baixarArquivo(blob, nome);
  toast('Arquivo salvo em Downloads');
  return true;
}

export const soDigitos = s => String(s || '').replace(/\D/g, '');
export function linkWhats(tel, texto = '') {
  let d = soDigitos(tel);
  if (d && !d.startsWith('55')) d = '55' + d;
  return `https://wa.me/${d}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}

const P = {
  mais: 'M12 5v14M5 12h14',
  voltar: 'M5 12h14M5 12l6 6M5 12l6-6',
  lixo: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3',
  editar: 'M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4M13.5 6.5l4 4',
  agenda: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 3v4M8 3v4M4 11h16M8 15h2v2H8z',
  pedidos: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM9 12h6M9 16h6',
  orcamento: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM14 11h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3H10M12 17v1m0-8v1',
  receitas: 'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13',
  estoque: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3M12 12l8-4.5M12 12v9M12 12L4 7.5',
  clientes: 'M19.5 12.572L12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572',
  financeiro: 'M3 13a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM15 9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z',
  ranking: 'M8 21h8M12 17v4M7 4h10M17 4v8a5 5 0 0 1-10 0V4M5 9a2 2 0 1 1 0-4h2M19 9a2 2 0 1 0 0-4h-2',
  ofertas: 'M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592-5.592a2.41 2.41 0 0 0 0-3.408l-7.71-7.71A2 2 0 0 0 11.172 3H6a3 3 0 0 0-3 3',
  config: 'M4 10a2 2 0 1 0 4 0a2 2 0 0 0-4 0M6 4v4M6 12v8M10 16a2 2 0 1 0 4 0a2 2 0 0 0-4 0M12 4v10M12 18v2M16 7a2 2 0 1 0 4 0a2 2 0 0 0-4 0M18 4v1M18 9v11',
  compartilhar: 'M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4',
  baixar: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5l5-5M12 4v12',
  subir: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5l5 5M12 4v12',
  camera: 'M5 7h1a2 2 0 0 0 2-2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2M9 13a3 3 0 1 0 6 0a3 3 0 0 0-6 0',
  alerta: 'M12 9v4M10.363 3.591L2.257 17.125a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0zM12 16h.01',
  instagram: 'M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0M16.5 7.5v.01',
  whats: 'M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1',
  busca: 'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M21 21l-6-6',
  ok: 'M5 12l5 5L20 7',
  x: 'M18 6L6 18M6 6l12 12',
  compra: 'M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17 17H6V3H4M6 5l14 1l-1 7H6',
  backup: 'M12 6m-8 0a8 3 0 1 0 16 0a8 3 0 1 0-16 0M4 6v6a8 3 0 0 0 16 0V6M4 12v6a8 3 0 0 0 16 0v-6',
  bolo: 'M3 20h18v-8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3zM3 14.8A2.4 2.4 0 0 0 4 15a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2-1a2.4 2.4 0 0 1 2-1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1c.35 0 .69-.06 1-.2M12 4l1.465 1.638a2 2 0 1 1-3.015.099z',
  seta: 'M9 6l6 6l-6 6',
};
export const icone = (nome, extra = '') =>
  `<svg class="ic ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[nome] || ''}"/></svg>`;

export const STATUS = {
  orcamento: { nome: 'Orçamento', cls: 'st-orc' },
  aprovado: { nome: 'Aprovado', cls: 'st-apr' },
  entregue: { nome: 'Entregue', cls: 'st-ent' },
  cancelado: { nome: 'Cancelado', cls: 'st-can' },
};
export const etiquetaStatus = s => `<span class="etiqueta ${STATUS[s]?.cls || ''}">${STATUS[s]?.nome || s}</span>`;

export const vazio = (titulo, texto, botao = '') =>
  `<div class="vazio">${icone('bolo', 'ic-grande')}<h3>${titulo}</h3><p>${texto}</p>${botao}</div>`;

export const numeroOrc = n => String(n || 0).padStart(4, '0');
