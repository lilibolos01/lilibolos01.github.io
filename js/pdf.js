// Gera a folha do orçamento (A4) desenhando em um canvas e transforma em PDF ou imagem.
// Não depende de nenhuma biblioteca externa: funciona offline.
import { brl, dataBR, diaSemana, numeroOrc, addDias } from './ui.js';

const L = 1240, A = 1754;          // A4 a 150 dpi (medidas do desenho)
const ESCALA = 1.5;                // resolução final: 1860 x 2631
const COR = {
  bordo: '#5A1831', rosa: '#E98AAE', rosaForte: '#C94F7C', rosaClaro: '#FBE4EC',
  creme: '#F6EBD6', dourado: '#E9D3A6', texto: '#3A1422', cinza: '#7D6870',
};
const SANS = 'Roboto, "Segoe UI", system-ui, sans-serif';
const SERIF = 'Georgia, "Noto Serif", "Times New Roman", serif';

function carregarImagem(src) {
  return new Promise(ok => {
    if (!src) return ok(null);
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

function quebrarTexto(ctx, texto, largura) {
  const linhas = [];
  for (const par of String(texto || '').split('\n')) {
    let linha = '';
    for (const palavra of par.split(/\s+/)) {
      const teste = linha ? linha + ' ' + palavra : palavra;
      if (ctx.measureText(teste).width > largura && linha) { linhas.push(linha); linha = palavra; }
      else linha = teste;
    }
    linhas.push(linha);
  }
  return linhas;
}

function escrever(ctx, texto, x, y, { tam = 26, peso = 400, cor = COR.texto, fonte = SANS, largura = 0, entre = 1.35, alinhar = 'left', max = 99, estilo = '' } = {}) {
  ctx.font = `${estilo} ${peso} ${tam}px ${fonte}`;
  ctx.fillStyle = cor;
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'top';
  let linhas = largura ? quebrarTexto(ctx, texto, largura) : [String(texto)];
  if (linhas.length > max) { linhas = linhas.slice(0, max); linhas[max - 1] += '…'; }
  linhas.forEach((l, n) => ctx.fillText(l, x, y + n * tam * entre));
  return y + linhas.length * tam * entre;
}

function rotulo(ctx, texto, x, y) {
  ctx.save();
  ctx.font = `700 21px ${SANS}`;
  ctx.fillStyle = COR.rosaForte;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.fillText(texto.toUpperCase(), x, y);
  ctx.restore();
  return y + 32;
}

function caixa(ctx, x, y, w, h, r, cor) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = cor;
  ctx.fill();
}

function fotoCobrindo(ctx, img, x, y, w, h, r) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  const esc = Math.max(w / img.width, h / img.height);
  const sw = w / esc, sh = h / esc;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
}

export async function desenharOrcamento(o, cfg) {
  const [logo, foto] = await Promise.all([carregarImagem('img/logo.webp'), carregarImagem(o.foto)]);
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = L * ESCALA;
  canvas.height = A * ESCALA;
  const ctx = canvas.getContext('2d');
  ctx.scale(ESCALA, ESCALA);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, L, A);

  // Faixa bordô com o logo
  const faixa = 360;
  ctx.fillStyle = COR.bordo;
  ctx.fillRect(0, 0, L, faixa);
  if (logo) {
    // Recorta as margens do logo (mesma cor da faixa) para ele aparecer maior
    const sx = logo.width * 0.05, sy = logo.height * 0.12, sw = logo.width * 0.9, sh = logo.height * 0.82;
    const h = faixa - 40, w = h * sw / sh;
    ctx.drawImage(logo, sx, sy, sw, sh, (L - w) / 2, 20, w, h);
  } else {
    escrever(ctx, cfg.empresa, L / 2, 130, { tam: 90, fonte: SERIF, estilo: 'italic', cor: COR.rosa, alinhar: 'center' });
  }
  ctx.fillStyle = COR.rosa;
  ctx.fillRect(0, faixa, L, 8);

  // Título
  const M = 70;
  let y = faixa + 50;
  escrever(ctx, 'Orçamento', M, y, { tam: 58, fonte: SERIF, estilo: 'italic', peso: 700, cor: COR.bordo });
  const larguraTitulo = ctx.measureText('Orçamento').width;
  escrever(ctx, `nº ${numeroOrc(o.numero)}`, M + larguraTitulo + 22, y + 20, { tam: 32, peso: 600, cor: COR.rosaForte });
  const emissao = (o.dataEmissao || '').slice(0, 10);
  escrever(ctx, `Emitido em ${dataBR(emissao)}`, L - M, y + 4, { tam: 24, cor: COR.cinza, alinhar: 'right' });
  escrever(ctx, `Válido até ${dataBR(addDias(emissao, Number(cfg.validadeDias) || 7))}`, L - M, y + 36, { tam: 24, peso: 600, cor: COR.bordo, alinhar: 'right' });
  y += 110;

  // Foto + dados
  const fotoW = 500, colX = M + fotoW + 50, colW = L - M - colX;
  if (foto) fotoCobrindo(ctx, foto, M, y, fotoW, fotoW, 26);
  else {
    caixa(ctx, M, y, fotoW, fotoW, 26, COR.rosaClaro);
    escrever(ctx, 'LiLi Bolos', M + fotoW / 2, y + fotoW / 2 - 30, { tam: 48, fonte: SERIF, estilo: 'italic', cor: COR.rosa, alinhar: 'center' });
  }

  let yc = rotulo(ctx, 'Cliente', colX, y + 4);
  yc = escrever(ctx, o.clienteNome || '—', colX, yc, { tam: 34, peso: 700, largura: colW, max: 2 });
  if (o.clienteTel) yc = escrever(ctx, o.clienteTel, colX, yc + 2, { tam: 27, cor: COR.cinza });
  yc += 28;

  yc = rotulo(ctx, 'Bolo', colX, yc);
  const m = o.montagem;
  if (m) {
    yc = escrever(ctx, m.massa, colX, yc, { tam: 31, peso: 700, largura: colW, max: 2 });
    m.recheios.forEach((r, n) => {
      yc = escrever(ctx, `${n + 1}ª camada: ${r}`, colX, yc + 2, { tam: 25, largura: colW, max: 2 });
    });
    if (m.cobertura) yc = escrever(ctx, `Cobertura: ${m.cobertura}`, colX, yc + 2, { tam: 25, largura: colW, max: 2 });
  } else {
    yc = escrever(ctx, o.receitaNome || '', colX, yc, { tam: 31, peso: 700, largura: colW, max: 2 });
  }
  if (o.descricao) yc = escrever(ctx, o.descricao, colX, yc + 6, { tam: 24, largura: colW, max: 4, cor: COR.cinza });
  if (m?.extras?.length) yc = escrever(ctx, `Inclui: ${m.extras.map(x => x.qtd > 1 ? `${x.nome} (${x.qtd})` : x.nome).join(', ')}`, colX, yc + 4, { tam: 23, largura: colW, max: 2, cor: COR.cinza });
  yc = escrever(ctx, `Aproximadamente ${o.fatias} fatias`, colX, yc + 8, { tam: 27, peso: 600, cor: COR.rosaForte });
  yc += 28;

  yc = rotulo(ctx, o.entrega === 'uber' ? 'Entrega' : 'Retirada', colX, yc);
  if (o.dataEntrega) {
    const dia = diaSemana(o.dataEntrega);
    yc = escrever(ctx, `${dia.charAt(0).toUpperCase() + dia.slice(1)}, ${dataBR(o.dataEntrega)}${o.hora ? ' às ' + o.hora : ''}`, colX, yc, { tam: 28, peso: 600, largura: colW });
  }
  yc = escrever(ctx, o.entrega === 'uber' ? 'Entrega via Uber' : 'Retirada no local', colX, yc + 2, { tam: 26, cor: COR.cinza });

  y = Math.max(y + fotoW, yc) + 40;

  // Texto da entrega
  const textoEntrega = o.entrega === 'uber' ? cfg.textoUber : cfg.textoRetirada;
  if (textoEntrega) {
    ctx.font = `400 25px ${SANS}`;
    const linhas = quebrarTexto(ctx, textoEntrega, L - 2 * M - 60).length;
    const h = linhas * 25 * 1.35 + 40;
    caixa(ctx, M, y, L - 2 * M, h, 18, COR.creme);
    escrever(ctx, textoEntrega, M + 30, y + 20, { tam: 25, largura: L - 2 * M - 60, cor: COR.texto });
    y += h + 30;
  }

  // Valor total
  const hv = 190;
  caixa(ctx, M, y, L - 2 * M, hv, 22, COR.bordo);
  escrever(ctx, 'VALOR TOTAL', M + 40, y + 42, { tam: 26, peso: 700, cor: COR.dourado });
  escrever(ctx, `${o.fatias} fatias`, M + 40, y + 80, { tam: 24, cor: COR.rosa });
  escrever(ctx, brl(o.preco), L - M - 40, y + 30, { tam: 76, peso: 700, cor: '#fff', alinhar: 'right' });
  escrever(ctx, `Sinal de ${String(o.sinalPct).replace('.', ',')}% para reservar a data: ${brl(o.sinal)}   ·   Restante na entrega: ${brl(o.restante)}`,
    L / 2, y + hv - 46, { tam: 23, cor: COR.rosaClaro, alinhar: 'center' });
  y += hv + 30;

  if (cfg.pix) {
    y = escrever(ctx, `Pix: ${cfg.pix}`, L / 2, y, { tam: 30, peso: 700, cor: COR.bordo, alinhar: 'center' }) + 14;
  }
  if (o.obs) {
    y = escrever(ctx, o.obs, L / 2, y + 4, { tam: 23, cor: COR.cinza, alinhar: 'center', largura: L - 2 * M, max: 4 }) + 10;
  }

  // Rodapé bordô
  const rod = 130;
  if (y + 70 < A - rod - 20) {
    escrever(ctx, 'Obrigada pela preferência!', L / 2, Math.max(y + 20, A - rod - 110), { tam: 40, fonte: SERIF, estilo: 'italic', cor: COR.rosaForte, alinhar: 'center' });
  }
  ctx.fillStyle = COR.rosa;
  ctx.fillRect(0, A - rod - 6, L, 6);
  ctx.fillStyle = COR.bordo;
  ctx.fillRect(0, A - rod, L, rod);
  const contato = [cfg.empresa, cfg.telefone && `WhatsApp ${cfg.telefone}`, cfg.instagram].filter(Boolean).join('   ·   ');
  escrever(ctx, contato, L / 2, A - rod + 28, { tam: 27, peso: 700, cor: COR.dourado, alinhar: 'center' });
  const endereco = [cfg.endereco, cfg.bairro, cfg.cidade].filter(Boolean).join(' – ') + (cfg.cnpj ? `   ·   CNPJ ${cfg.cnpj}` : '');
  escrever(ctx, endereco, L / 2, A - rod + 72, { tam: 22, cor: COR.rosa, alinhar: 'center' });

  return canvas;
}

export const canvasParaJpeg = (canvas, q = 0.9) => new Promise(ok => canvas.toBlob(ok, 'image/jpeg', q));

// Monta um PDF de uma página com a imagem JPEG ocupando a folha A4 inteira
export async function canvasParaPdf(canvas, titulo = 'Orçamento') {
  const jpeg = new Uint8Array(await (await canvasParaJpeg(canvas)).arrayBuffer());
  const W = 595.28, H = 841.89;
  const enc = new TextEncoder();
  const partes = [];
  let tam = 0;
  const offs = [];
  const add = x => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); tam += b.length; };
  const obj = (n, s) => { offs[n] = tam; add(`${n} 0 obj\n${s}\nendobj\n`); };
  const tituloPdf = titulo.replace(/[^\x20-\x7E]/g, c => ({ 'º': 'o', 'ç': 'c', 'ã': 'a', 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ê': 'e', 'ô': 'o' }[c] || '')).replace(/[()\\]/g, '');

  add(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offs[4] = tam;
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg);
  add('\nendstream\nendobj\n');
  const conteudo = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`);
  obj(6, `<< /Title (${tituloPdf}) /Producer (LiLi Bolos) >>`);
  const xref = tam;
  let x = 'xref\n0 7\n0000000000 65535 f \n';
  for (let i = 1; i <= 6; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  add(x + `trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes, { type: 'application/pdf' });
}
