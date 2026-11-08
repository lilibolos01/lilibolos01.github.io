// "Bolos em oferta": combina massa + 2 camadas de recheio (iguais ou diferentes) + cobertura
// com o estoque atual e mostra quais bolos completos dá para fazer sem comprar nada.
import { todos } from '../db.js';
import { $, $$, esc, icone, vazio } from '../ui.js';
import { maxFatiasCombo, tipoDe, TIPOS_RECEITA, nomeBolo, textoVem } from '../calc.js';

const CAMADAS = 2;
const LIMITE = 40;

export async function ofertas() {
  const [receitas, insumos] = await Promise.all([todos('receitas'), todos('insumos')]);
  const mapa = new Map(insumos.map(i => [i.id, i]));
  const prontas = receitas.filter(r => r.itens?.length);
  const aguardando = receitas.filter(r => !r.itens?.length);
  const doTipo = t => prontas.filter(r => tipoDe(r) === t).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const massas = doTipo('massa'), recheios = doTipo('recheio'), coberturas = doTipo('cobertura');

  if (!receitas.length) {
    return {
      titulo: 'Bolos em oferta',
      html: vazio('Cadastre suas receitas', 'O app combina massa, recheios e cobertura com o estoque e mostra quais bolos você consegue fazer sem comprar nada.',
        `<a class="bt cheio" href="#/receitas">${icone('receitas')} Ir para receitas</a>`),
    };
  }

  // Todas as combinações: massa + recheio da 1ª camada + recheio da 2ª camada (iguais ou diferentes)
  // + a cobertura que mais rende (ou sem cobertura). O estoque é conferido para o bolo completo,
  // somando o uso de insumos que aparecem em mais de uma parte.
  const combos = [];
  for (const m of massas) {
    for (let i = 0; i < recheios.length; i++) {
      for (let j = i; j < recheios.length; j++) {
        const r1 = recheios[i], r2 = recheios[j];
        const partes = [{ receita: m }, { receita: r1 }, { receita: r2 }];
        const semCob = maxFatiasCombo(partes, mapa);
        if (semCob <= 0) continue;
        let melhor = { c: null, max: 0 };
        for (const c of coberturas) {
          const max = maxFatiasCombo([...partes, { receita: c }], mapa);
          if (max > melhor.max) melhor = { c, max };
        }
        combos.push({ m, r1, r2, c: melhor.c, max: melhor.c ? melhor.max : semCob, iguais: r1 === r2 });
      }
    }
  }
  combos.sort((a, b) => b.max - a.max || a.r1.nome.localeCompare(b.r1.nome, 'pt-BR'));

  const componentes = Object.keys(TIPOS_RECEITA).map(t => ({
    t, itens: doTipo(t).map(r => ({ r, max: maxFatiasCombo([{ receita: r }], mapa) })).sort((a, b) => b.max - a.max),
  })).filter(g => g.itens.length);

  let filtroMassa = 'todas';
  let filtroCamadas = 'todas';

  return {
    titulo: 'Bolos em oferta',
    html: `
      <p class="dica">Bolos completos (massa, ${CAMADAS} camadas de recheio e cobertura) que dá para fazer só com o que você já tem no estoque. Bons para divulgar como oferta da semana.</p>
      ${combos.length ? `
        <div class="filtros" id="fMassa">
          <button class="filtro" data-v="todas">Todas as massas</button>
          ${massas.map(m => `<button class="filtro" data-v="${m.id}">${esc(m.nome)}</button>`).join('')}
        </div>
        <div class="filtros" id="fCamadas">
          <button class="filtro" data-v="todas">Todas</button>
          <button class="filtro" data-v="iguais">Camadas iguais</button>
          <button class="filtro" data-v="diferentes">Camadas diferentes</button>
        </div>` : ''}
      <div id="combos"></div>

      ${componentes.map(g => `
        <div class="secao-titulo">${TIPOS_RECEITA[g.t].plural} no estoque</div>
        <div class="lista">${g.itens.map(({ r, max }) => `
          <a class="item" href="#/receita/${r.id}">
            <div class="meio"><div class="nome">${esc(r.nome)}</div></div>
            <div class="dir">${max > 0 ? `<span class="etiqueta et-ok">até ${max} fatias${g.t === 'recheio' ? ' (1 camada)' : ''}</span>` : '<span class="etiqueta et-alerta">falta insumo</span>'}</div>
          </a>`).join('')}</div>`).join('')}

      ${aguardando.length ? `
        <div class="secao-titulo">Aguardando receita (${aguardando.length})</div>
        <div class="card" style="color:var(--cinza)">${aguardando.map(r => `<a href="#/receita/${r.id}">${esc(r.nome)}</a>`).join(' · ')}
          <br><small class="dica">Cadastre os ingredientes para elas entrarem nas ofertas.</small></div>` : ''}
    `,
    montar(el) {
      const desenhar = () => {
        $$('#fMassa .filtro', el).forEach(b => b.classList.toggle('ativo', b.dataset.v === filtroMassa));
        $$('#fCamadas .filtro', el).forEach(b => b.classList.toggle('ativo', b.dataset.v === filtroCamadas));
        const lista = combos.filter(x =>
          (filtroMassa === 'todas' || x.m.id === filtroMassa) &&
          (filtroCamadas === 'todas' || (filtroCamadas === 'iguais') === x.iguais));
        $('#combos', el).innerHTML = `
          <div class="secao-titulo">${icone('ok')} Dá para fazer agora (${lista.length})</div>
          ${lista.length ? `<div class="lista">${lista.slice(0, LIMITE).map(x => {
            const nomes = { massa: x.m.nome, recheios: [x.r1.nome, x.r2.nome], cobertura: x.c?.nome };
            const link = `#/orcamento/novo/m=${x.m.id}&rs=${x.r1.id},${x.r2.id}${x.c ? '&c=' + x.c.id : ''}`;
            return `<div class="item" style="align-items:flex-start">
              <span class="miniatura">${icone('bolo')}</span>
              <div class="meio">
                <div class="nome">${esc(nomeBolo(nomes))}</div>
                <div class="sub">Vem: ${esc(textoVem(nomes))}</div>
                <div class="sub">Dá para fazer até <b>${x.max} fatias</b></div>
              </div>
              <a class="bt peq rosa" href="${link}">Orçar</a>
            </div>`;
          }).join('')}</div>
          ${lista.length > LIMITE ? `<p class="dica">Mostrando os ${LIMITE} que rendem mais fatias. Use os filtros para ver outros.</p>` : ''}`
          : `<div class="card" style="color:var(--cinza)">Nenhum bolo completo dá para fazer com o estoque atual${combos.length ? ' com estes filtros' : ''}. Registre as compras em Insumos e estoque.</div>`}`;
      };
      $$('#fMassa .filtro', el).forEach(b => b.onclick = () => { filtroMassa = b.dataset.v; desenhar(); });
      $$('#fCamadas .filtro', el).forEach(b => b.onclick = () => { filtroCamadas = b.dataset.v; desenhar(); });
      desenhar();
    },
  };
}
