// Cálculos de custo, preço e estoque.

export const UNIDADES_BASE = { g: 'gramas (g)', ml: 'mililitros (ml)', un: 'unidades' };
export const SIGLA_BASE = { g: 'g', ml: 'ml', un: 'un' };

export const UNIDADES_RECEITA = {
  g: 'g',
  ml: 'ml',
  sopa: 'colher de sopa',
  cha: 'colher de chá',
  un: 'unidade',
};

export function unidadesPermitidas(insumo) {
  if (!insumo) return ['g', 'ml', 'sopa', 'cha', 'un'];
  if (insumo.unidade === 'un') return ['un'];
  return ['g', 'ml', 'sopa', 'cha'];
}

// Converte a quantidade da receita para a unidade base do insumo (g, ml ou un)
export function paraBase(qtd, unidade, insumo) {
  const q = Number(qtd) || 0;
  if (unidade === 'sopa') return q * (Number(insumo?.gSopa) || 15);
  if (unidade === 'cha') return q * (Number(insumo?.gCha) || 5);
  return q;
}

// Preço de 1 g / 1 ml / 1 unidade
export function precoPorBase(insumo) {
  const qtd = Number(insumo?.pacoteQtd) || 0;
  return qtd > 0 ? (Number(insumo.pacotePreco) || 0) / qtd : 0;
}

/**
 * Custo de uma receita para um número de fatias.
 * Retorna linhas com quantidade escalada, custo e falta de estoque.
 */
export function custoReceita(receita, mapaInsumos, fatias, cfg) {
  const base = Number(receita?.fatias) || 1;
  const escala = fatias ? Number(fatias) / base : 1;
  const linhas = (receita?.itens || []).map(item => {
    const ins = mapaInsumos.get(item.insumoId);
    const qtdReceita = (Number(item.qtd) || 0) * escala;
    const qtdBase = ins ? paraBase(qtdReceita, item.unidade, ins) : 0;
    const custo = ins ? qtdBase * precoPorBase(ins) : 0;
    const estoque = Number(ins?.estoque) || 0;
    return {
      item, ins, qtdReceita, qtdBase, custo,
      semPreco: ins ? precoPorBase(ins) === 0 : true,
      falta: ins ? Math.max(0, qtdBase - estoque) : 0,
    };
  });
  const direto = linhas.reduce((s, l) => s + l.custo, 0);
  const indiretoPct = Number(cfg?.indiretoPct ?? 5);
  const indireto = direto * indiretoPct / 100;
  return { escala, linhas, direto, indiretoPct, indireto, total: direto + indireto };
}

// Lucro em R$: metade vira pró-labore e metade fica para a empresa (já está dentro do preço)
export function calcularPreco(custoTotal, lucro, fatias, cfg) {
  const l = Number(lucro) || 0;
  const preco = custoTotal + l;
  const prolabore = arred(l / 2);
  const sinalPct = Number(cfg?.sinalPct ?? 30);
  const sinal = arred(preco * sinalPct / 100);
  return {
    lucro: l,
    prolabore,
    lucroEmpresa: arred(l - prolabore),
    preco,
    porFatia: fatias ? preco / fatias : 0,
    sinalPct,
    sinal,
    restante: arred(preco) - sinal,
  };
}

export function arred(v) { return Math.round((Number(v) || 0) * 100) / 100; }

// Estoque negativo (usou mais do que tinha) ou abaixo do mínimo
export const estoqueBaixo = i => (Number(i.estoque) || 0) < 0 || (Number(i.estoqueMin) > 0 && (Number(i.estoque) || 0) <= Number(i.estoqueMin));

/* ---------- Bolo montado: massa + camadas de recheio + cobertura + extras ---------- */

export const TIPOS_RECEITA = {
  massa: { nome: 'Massa', plural: 'Massas', rende: 'Esta massa rende um bolo de quantas fatias?' },
  recheio: { nome: 'Recheio', plural: 'Recheios', rende: '1 receita recheia 1 camada de um bolo de quantas fatias?' },
  cobertura: { nome: 'Cobertura', plural: 'Coberturas', rende: '1 receita cobre um bolo de quantas fatias?' },
};
export const tipoDe = r => (r && TIPOS_RECEITA[r.tipo] ? r.tipo : 'massa');

// Linha de custo para um extra (caixa, base, topper…) escolhido no orçamento
function linhaExtra(ins, qtd) {
  const q = Number(qtd) || 0;
  return {
    item: { insumoId: ins.id, qtd: q, unidade: ins.unidade === 'un' ? 'un' : ins.unidade },
    ins, qtdReceita: q, qtdBase: q, custo: q * precoPorBase(ins),
    semPreco: precoPorBase(ins) === 0, falta: Math.max(0, q - (Number(ins.estoque) || 0)),
  };
}

/**
 * Custo do bolo montado.
 * montagem = { massa, recheios: [receita por camada], cobertura, extras: [{insumoId, qtd}] }
 */
export function custoBolo(montagem, mapaInsumos, fatias, cfg) {
  const grupos = [];
  if (montagem.massa) grupos.push({ titulo: 'Massa', receita: montagem.massa });
  (montagem.recheios || []).forEach((r, n) => r && grupos.push({ titulo: `Recheio da ${n + 1}ª camada`, receita: r }));
  if (montagem.cobertura) grupos.push({ titulo: 'Cobertura', receita: montagem.cobertura });
  for (const g of grupos) g.calc = custoReceita(g.receita, mapaInsumos, fatias, { indiretoPct: 0 });

  const extras = (montagem.extras || [])
    .filter(e => e.qtd > 0 && mapaInsumos.get(e.insumoId))
    .map(e => linhaExtra(mapaInsumos.get(e.insumoId), e.qtd));
  if (extras.length) grupos.push({ titulo: 'Extras', calc: { linhas: extras, direto: extras.reduce((s, l) => s + l.custo, 0) } });

  // Falta de estoque considerando o bolo inteiro (o mesmo insumo pode estar na massa e no recheio)
  const linhas = grupos.flatMap(g => g.calc.linhas);
  const usoTotal = new Map();
  for (const l of linhas) if (l.ins) usoTotal.set(l.ins.id, (usoTotal.get(l.ins.id) || 0) + l.qtdBase);
  const faltas = [...usoTotal].map(([id, uso]) => {
    const ins = mapaInsumos.get(id);
    return { ins, falta: uso - (Number(ins.estoque) || 0) };
  }).filter(f => f.falta > 0.0001);

  const direto = grupos.reduce((s, g) => s + g.calc.direto, 0);
  const indiretoPct = Number(cfg?.indiretoPct ?? 5);
  const indireto = direto * indiretoPct / 100;
  return { grupos, linhas, faltas, direto, indiretoPct, indireto, total: direto + indireto };
}

// Nome do bolo pelos recheios: "Prestígio", "Prestígio e Morango com nata"
const juntar = l => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]);
export function nomeBolo(m) {
  const recheios = [...new Set(m?.recheios || [])];
  return recheios.length ? juntar(recheios) : (m?.massa || 'Bolo');
}

// O que vem no bolo: "Massa de chocolate · 2 camadas: Prestígio e Morango com nata · Cobertura: Merengue suíço"
export function textoVem(m) {
  if (!m) return '';
  const r = m.recheios || [];
  const unicos = [...new Set(r)];
  const partes = [m.massa];
  if (r.length) partes.push(`${r.length} camada${r.length > 1 ? 's' : ''} de ${unicos.length === 1 ? unicos[0] : r.join(' / ')}`);
  partes.push(m.cobertura ? `Cobertura: ${m.cobertura}` : 'Sem cobertura');
  return partes.filter(Boolean).join(' · ');
}

// Quantas fatias dá para fazer de uma combinação, somando o uso de cada insumo
export function maxFatiasCombo(componentes, mapaInsumos) {
  const porFatia = new Map();
  for (const { receita, vezes = 1 } of componentes) {
    const base = Number(receita?.fatias) || 0;
    if (!base) return 0;
    for (const item of receita.itens || []) {
      const ins = mapaInsumos.get(item.insumoId);
      if (!ins) return 0;
      const q = paraBase(item.qtd, item.unidade, ins) / base * vezes;
      porFatia.set(ins.id, (porFatia.get(ins.id) || 0) + q);
    }
  }
  let max = Infinity;
  for (const [id, q] of porFatia) {
    if (q <= 0) continue;
    max = Math.min(max, Math.max(0, Number(mapaInsumos.get(id).estoque) || 0) / q);
  }
  return max === Infinity ? 0 : Math.floor(max);
}

// Quantas fatias dá para fazer com o estoque atual
export function maxFatias(receita, mapaInsumos) {
  const base = Number(receita?.fatias) || 0;
  if (!base || !receita.itens?.length) return { max: 0, faltando: [] };
  let max = Infinity;
  const faltando = [];
  for (const item of receita.itens) {
    const ins = mapaInsumos.get(item.insumoId);
    const precisa = ins ? paraBase(item.qtd, item.unidade, ins) : 0;
    if (!ins) { max = 0; faltando.push({ nome: 'insumo removido', falta: 0 }); continue; }
    if (precisa <= 0) continue;
    const porFatia = precisa / base;
    const estoque = Math.max(0, Number(ins.estoque) || 0);
    max = Math.min(max, estoque / porFatia);
    if (estoque < precisa) faltando.push({ nome: ins.nome, falta: precisa - estoque, unidade: ins.unidade });
  }
  return { max: max === Infinity ? 0 : Math.floor(max), faltando };
}

// Consumo de estoque (por insumo) de uma receita escalada
export function consumoDe(calc) {
  const mapa = new Map();
  for (const l of calc.linhas) {
    if (!l.ins) continue;
    mapa.set(l.ins.id, (mapa.get(l.ins.id) || 0) + l.qtdBase);
  }
  return [...mapa].map(([insumoId, qtdBase]) => ({ insumoId, qtdBase }));
}

// Insumos comuns com peso aproximado das colheres (ajustável depois)
export const INSUMOS_COMUNS = [
  { nome: 'Farinha de trigo', unidade: 'g', pacoteQtd: 1000, gSopa: 7.5, gCha: 2.5 },
  { nome: 'Açúcar refinado', unidade: 'g', pacoteQtd: 1000, gSopa: 12, gCha: 4 },
  { nome: 'Ovos', unidade: 'un', pacoteQtd: 12 },
  { nome: 'Leite integral', unidade: 'ml', pacoteQtd: 1000, gSopa: 15, gCha: 5 },
  { nome: 'Leite condensado', unidade: 'g', pacoteQtd: 395, gSopa: 20, gCha: 7 },
  { nome: 'Creme de leite', unidade: 'g', pacoteQtd: 200, gSopa: 15, gCha: 5 },
  { nome: 'Manteiga', unidade: 'g', pacoteQtd: 200, gSopa: 15, gCha: 5 },
  { nome: 'Óleo', unidade: 'ml', pacoteQtd: 900, gSopa: 15, gCha: 5 },
  { nome: 'Chocolate em pó 50%', unidade: 'g', pacoteQtd: 200, gSopa: 6, gCha: 2 },
  { nome: 'Cacau em pó 100%', unidade: 'g', pacoteQtd: 200, gSopa: 6, gCha: 2 },
  { nome: 'Fermento químico em pó', unidade: 'g', pacoteQtd: 100, gSopa: 10, gCha: 4 },
  { nome: 'Coco ralado', unidade: 'g', pacoteQtd: 100, gSopa: 5, gCha: 2 },
  { nome: 'Amido de milho', unidade: 'g', pacoteQtd: 500, gSopa: 8, gCha: 3 },
  { nome: 'Chocolate meio amargo', unidade: 'g', pacoteQtd: 1000, gSopa: 10, gCha: 3 },
  { nome: 'Essência de baunilha', unidade: 'ml', pacoteQtd: 30, gSopa: 15, gCha: 5 },
  { nome: 'Chantilly', unidade: 'ml', pacoteQtd: 1000, gSopa: 15, gCha: 5 },
  { nome: 'Caixa para bolo', unidade: 'un', pacoteQtd: 1, extra: true },
  { nome: 'Base/disco para bolo', unidade: 'un', pacoteQtd: 1, extra: true },
  { nome: 'Topper', unidade: 'un', pacoteQtd: 1, extra: true },
  { nome: 'Vela', unidade: 'un', pacoteQtd: 1, extra: true },
];
