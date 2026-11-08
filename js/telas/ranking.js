import { todos } from '../db.js';
import { $, $$, esc, brl, fmt, vazio, hojeISO, addDias } from '../ui.js';
import { nomeBolo, textoVem } from '../calc.js';

const montagemDe = o => o.montagem || { massa: o.receitaNome, recheios: [], cobertura: '' };

// Agrupa os pedidos pelo bolo completo (massa + recheios + cobertura)
function rankingBolos(lista) {
  const mapa = new Map();
  for (const o of [...lista].sort((a, b) => (b.numero || 0) - (a.numero || 0))) {
    const m = montagemDe(o);
    const chave = [m.massa, [...(m.recheios || [])].sort().join('+'), m.cobertura || ''].join('|');
    let g = mapa.get(chave);
    if (!g) {
      // Guarda o pedido mais recente para o botão "Orçar igual"
      g = { m, o, qtd: 0, fatias: 0, total: 0 };
      mapa.set(chave, g);
    }
    g.qtd++; g.fatias += o.fatias || 0; g.total += o.preco || 0;
  }
  return [...mapa.values()].sort((a, b) => b.qtd - a.qtd || b.total - a.total);
}

function linkOrcar({ o }) {
  if (!o.massaId) return '';
  const p = [`m=${o.massaId}`, `f=${o.fatias}`];
  if (o.recheioIds?.length) p.push(`rs=${o.recheioIds.join(',')}`);
  if (o.coberturaId) p.push(`c=${o.coberturaId}`);
  return `#/orcamento/novo/${p.join('&')}`;
}

const PERIODOS = { 0: 'Sempre', 30: 'Últimos 30 dias', 90: '3 meses', 365: '12 meses' };

export async function ranking() {
  const orcs = await todos('orcamentos');
  const pedidos = orcs.filter(o => o.status === 'aprovado' || o.status === 'entregue');
  let periodo = '0';

  // Conta em quantos pedidos cada massa, recheio e cobertura apareceu
  const contar = (lista, pegar) => {
    const mapa = new Map();
    for (const o of lista) {
      for (const nome of new Set(pegar(o).filter(Boolean))) {
        const g = mapa.get(nome) || { nome, qtd: 0, fatias: 0, total: 0 };
        g.qtd++; g.fatias += o.fatias || 0; g.total += o.preco || 0;
        mapa.set(nome, g);
      }
    }
    return [...mapa.values()].sort((a, b) => b.qtd - a.qtd || b.total - a.total);
  };

  const bloco = (titulo, itens) => {
    if (!itens.length) return '';
    const max = itens[0].qtd;
    return `<div class="secao-titulo">${titulo}</div><div class="lista">${itens.map((g, n) => `
      <div class="item">
        <span class="miniatura" style="font-weight:700">${n + 1}º</span>
        <div class="meio">
          <div class="nome">${esc(g.nome)}</div>
          <div class="sub">${g.qtd} pedido(s) · ${fmt(g.fatias, 0)} fatias</div>
          <div class="barra"><i style="width:${Math.round(g.qtd / max * 100)}%"></i></div>
        </div>
        <div class="dir">${brl(g.total)}</div>
      </div>`).join('')}</div>`;
  };

  return {
    titulo: 'Mais pedidos',
    html: pedidos.length ? `
      <div class="filtros">${Object.entries(PERIODOS).map(([k, v]) => `<button class="filtro" data-p="${k}">${v}</button>`).join('')}</div>
      <div id="conteudo"></div>
    ` : vazio('Ainda sem pedidos', 'Quando os orçamentos forem aprovados, aqui aparecem as massas, os recheios e as coberturas que mais saem.'),
    montar(el) {
      if (!pedidos.length) return;
      const desenhar = () => {
        $$('.filtro', el).forEach(b => b.classList.toggle('ativo', b.dataset.p === periodo));
        const desde = periodo === '0' ? '' : addDias(hojeISO(), -Number(periodo));
        const lista = pedidos.filter(o => !desde || (o.dataEntrega || o.aprovadoEm || o.dataEmissao || '') >= desde);
        const bolos = rankingBolos(lista);
        const maxBolo = bolos[0]?.qtd || 1;
        const html = (bolos.length ? `
          <div class="secao-titulo">Bolos que mais saem</div>
          <div class="lista">${bolos.map((g, n) => `
            <div class="item" style="align-items:flex-start">
              <span class="miniatura" style="font-weight:700;${n === 0 ? 'background:var(--bordo);color:#fff' : ''}">${n + 1}º</span>
              <div class="meio">
                <div class="nome">${esc(nomeBolo(g.m))}</div>
                <div class="sub">Vem: ${esc(textoVem(g.m))}</div>
                <div class="sub"><b>${g.qtd} pedido(s)</b> · ${fmt(g.fatias, 0)} fatias · ${brl(g.total)}</div>
                <div class="barra"><i style="width:${Math.round(g.qtd / maxBolo * 100)}%"></i></div>
              </div>
              ${linkOrcar(g) ? `<a class="bt peq rosa" href="${linkOrcar(g)}">Orçar igual</a>` : ''}
            </div>`).join('')}</div>` : '') +
          bloco('Recheios mais pedidos', contar(lista, o => o.montagem?.recheios || [])) +
          bloco('Massas', contar(lista, o => [o.montagem?.massa || o.receitaNome])) +
          bloco('Coberturas', contar(lista, o => [o.montagem?.cobertura]));
        $('#conteudo', el).innerHTML = html || '<div class="card" style="color:var(--cinza)">Nenhum pedido neste período.</div>';
      };
      $$('.filtro', el).forEach(b => b.onclick = () => { periodo = b.dataset.p; desenhar(); });
      desenhar();
    },
  };
}
