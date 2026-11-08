import { todos, buscar, salvar, apagar, salvarVarios, novoId } from '../db.js';
import { $, $$, esc, brl, fmt, num, campoNum, toast, icone, vazio } from '../ui.js';
import { SIGLA_BASE, precoPorBase, INSUMOS_COMUNS, estoqueBaixo } from '../calc.js';
import { voltar, recarregar } from '../nav.js';

const semPreco = i => precoPorBase(i) === 0;

export function textoPreco(i) {
  const p = precoPorBase(i);
  if (!p) return 'sem preço';
  if (i.unidade === 'un') return `${brl(p)} a unidade`;
  return `${brl(p * 100)} a cada 100 ${SIGLA_BASE[i.unidade]}`;
}
export const textoQtd = (q, unidade) => `${fmt(q, unidade === 'un' ? 1 : 0)} ${SIGLA_BASE[unidade] || ''}`;

export async function listaInsumos(filtroInicial = 'todos') {
  const insumos = (await todos('insumos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  let filtro = filtroInicial;

  return {
    titulo: 'Insumos e estoque',
    html: insumos.length ? `
      <div class="busca">${icone('busca')}<input id="busca" type="search" placeholder="Buscar insumo"></div>
      <div class="filtros">
        <button class="filtro" data-f="todos">Todos (${insumos.length})</button>
        <button class="filtro" data-f="baixo">Estoque baixo (${insumos.filter(estoqueBaixo).length})</button>
        <button class="filtro" data-f="preco">Sem preço (${insumos.filter(semPreco).length})</button>
      </div>
      <div class="lista" id="lista"></div>
      <a class="fab" href="#/insumo/novo" aria-label="Novo insumo">${icone('mais')}</a>
    ` : vazio('Cadastre seus insumos', 'Ingredientes, embalagens e decorações com o preço que você pagou. O app calcula o custo de cada receita.',
      `<div class="botoes" style="flex-direction:column"><a class="bt cheio" href="#/insumo/novo">${icone('mais')} Novo insumo</a>
       <button class="bt" id="btComuns">Adicionar ${INSUMOS_COMUNS.length} insumos comuns</button></div>
       <small class="dica">Os insumos comuns já vêm com o peso aproximado das colheres. Depois é só colocar o preço de cada um.</small>`),
    montar(el) {
      const btComuns = $('#btComuns', el);
      if (btComuns) {
        btComuns.onclick = async () => {
          await salvarVarios('insumos', INSUMOS_COMUNS.map(i => ({ ...i, id: novoId(), pacotePreco: 0, estoque: 0, estoqueMin: 0, criado: Date.now() })));
          toast('Insumos adicionados. Agora coloque os preços.');
          recarregar();
        };
        return;
      }
      const desenhar = () => {
        const termo = $('#busca', el).value.trim().toLowerCase();
        $$('.filtro', el).forEach(b => b.classList.toggle('ativo', b.dataset.f === filtro));
        const lista = insumos.filter(i =>
          (!termo || i.nome.toLowerCase().includes(termo)) &&
          (filtro === 'todos' || (filtro === 'baixo' && estoqueBaixo(i)) || (filtro === 'preco' && semPreco(i))));
        $('#lista', el).innerHTML = lista.length ? lista.map(i => `
          <a class="item" href="#/insumo/${i.id}">
            <div class="meio">
              <div class="nome">${esc(i.nome)}</div>
              <div class="sub">${textoPreco(i)}${i.extra ? ' · <span class="etiqueta st-apr">extra</span>' : ''}</div>
            </div>
            <div class="dir">
              <div>${textoQtd(i.estoque, i.unidade)}</div>
              ${estoqueBaixo(i) ? '<span class="etiqueta et-alerta">baixo</span>' : ''}
              ${semPreco(i) ? '<span class="etiqueta st-orc">sem preço</span>' : ''}
            </div>
          </a>`).join('') : '<div class="item sub">Nada encontrado.</div>';
      };
      $('#busca', el).oninput = desenhar;
      $$('.filtro', el).forEach(b => b.onclick = () => { filtro = b.dataset.f; desenhar(); });
      desenhar();
    },
  };
}

export async function formInsumo(id) {
  const novo = !id || id === 'novo';
  const i = novo ? { unidade: 'g', gSopa: 15, gCha: 5, estoque: 0, estoqueMin: 0 } : await buscar('insumos', id);
  if (!i) throw new Error('Insumo não encontrado.');

  const opcaoUn = (v, t) => `<label class="opcao"><input type="radio" name="unidade" value="${v}" ${i.unidade === v ? 'checked' : ''}><span>${t}</span></label>`;

  return {
    titulo: novo ? 'Novo insumo' : i.nome,
    voltar: '#/insumos',
    html: `
      <form id="form" class="card">
        <label class="campo"><span>Nome</span><input id="nome" required value="${esc(i.nome || '')}" placeholder="Leite condensado"></label>
        <div class="campo"><span>Medido em</span>
          <div class="opcoes">${opcaoUn('g', 'gramas')}${opcaoUn('ml', 'ml')}${opcaoUn('un', 'unidades')}</div>
        </div>
        <div class="linha2">
          <label class="campo"><span>Tamanho da embalagem (<b class="sig"></b>)</span><input id="pacoteQtd" inputmode="decimal" value="${campoNum(i.pacoteQtd)}" placeholder="395"></label>
          <label class="campo"><span>Preço pago (R$)</span><input id="pacotePreco" inputmode="decimal" value="${campoNum(i.pacotePreco)}" placeholder="7,90"></label>
        </div>
        <p class="dica" id="precoCalc"></p>
        <div class="linha2">
          <label class="campo"><span>Estoque atual (<b class="sig"></b>)</span><input id="estoque" inputmode="decimal" value="${campoNum(i.estoque)}"></label>
          <label class="campo"><span>Avisar abaixo de (<b class="sig"></b>)</span><input id="estoqueMin" inputmode="decimal" value="${campoNum(i.estoqueMin)}" placeholder="0"></label>
        </div>
        <div id="colheres">
          <div class="linha2">
            <label class="campo"><span>1 colher de sopa = (<b class="sig"></b>)</span><input id="gSopa" inputmode="decimal" value="${campoNum(i.gSopa ?? 15)}"></label>
            <label class="campo"><span>1 colher de chá = (<b class="sig"></b>)</span><input id="gCha" inputmode="decimal" value="${campoNum(i.gCha ?? 5)}"></label>
          </div>
          <small class="dica">O padrão é 15 e 5. Ajuste para ingredientes leves (farinha ≈ 7,5 g, cacau ≈ 6 g) ou pesados (açúcar ≈ 12 g).</small>
        </div>
        <label class="marcar"><input type="checkbox" id="extra" ${i.extra ? 'checked' : ''}> Aparece como extra no orçamento (caixa, base, topper, vela…)</label>
        <div class="botoes">
          <button class="bt cheio" type="submit">${icone('ok')} Salvar</button>
          ${novo ? '' : `<button class="bt perigo" type="button" id="btApagar">${icone('lixo')} Excluir</button>`}
        </div>
      </form>

      ${novo ? '' : `
      <div class="card destaque">
        <h3>${icone('compra')} Registrar compra</h3>
        <p class="dica">Soma ao estoque e atualiza o preço pago.</p>
        <div class="linha2">
          <label class="campo"><span>Quantas embalagens</span><input id="compraQtd" inputmode="decimal" value="1"></label>
          <label class="campo"><span>Preço de cada (R$)</span><input id="compraPreco" inputmode="decimal" value="${campoNum(i.pacotePreco)}"></label>
        </div>
        <button class="bt rosa largo" id="btCompra">${icone('mais')} Adicionar ao estoque</button>
      </div>`}
    `,
    montar(el) {
      const v = id => $('#' + id, el).value;
      const unidade = () => $('input[name=unidade]:checked', el).value;
      const atualizar = () => {
        const u = unidade();
        $$('.sig', el).forEach(s => s.textContent = SIGLA_BASE[u]);
        $('#colheres', el).style.display = u === 'un' ? 'none' : '';
        $('#precoCalc', el).textContent = num(v('pacoteQtd')) > 0 && num(v('pacotePreco')) > 0
          ? '= ' + textoPreco({ unidade: u, pacoteQtd: num(v('pacoteQtd')), pacotePreco: num(v('pacotePreco')) }) : '';
      };
      $$('input[name=unidade]', el).forEach(r => r.onchange = atualizar);
      $('#pacoteQtd', el).oninput = $('#pacotePreco', el).oninput = atualizar;
      atualizar();

      $('#form', el).onsubmit = async e => {
        e.preventDefault();
        const nome = v('nome').trim();
        if (!nome) return toast('Coloque o nome do insumo');
        if (num(v('pacoteQtd')) <= 0) return toast('Coloque o tamanho da embalagem');
        Object.assign(i, {
          nome, unidade: unidade(),
          pacoteQtd: num(v('pacoteQtd')), pacotePreco: num(v('pacotePreco')),
          estoque: num(v('estoque')), estoqueMin: num(v('estoqueMin')),
          gSopa: num(v('gSopa')) || 15, gCha: num(v('gCha')) || 5,
          extra: $('#extra', el).checked,
        });
        await salvar('insumos', i);
        toast('Insumo salvo');
        voltar('#/insumos');
      };

      const btApagar = $('#btApagar', el);
      if (btApagar) btApagar.onclick = async () => {
        const usadas = (await todos('receitas')).filter(r => r.itens?.some(it => it.insumoId === i.id));
        const aviso = usadas.length ? `\n\nAtenção: ele é usado em ${usadas.length} receita(s): ${usadas.map(r => r.nome).join(', ')}.` : '';
        if (!confirm(`Excluir "${i.nome}"?${aviso}`)) return;
        await apagar('insumos', i.id);
        toast('Insumo excluído');
        voltar('#/insumos');
      };

      const btCompra = $('#btCompra', el);
      if (btCompra) btCompra.onclick = async () => {
        const qtd = num(v('compraQtd'));
        const preco = num(v('compraPreco'));
        if (qtd <= 0) return toast('Coloque quantas embalagens');
        i.estoque = (Number(i.estoque) || 0) + qtd * (Number(i.pacoteQtd) || 0);
        if (preco > 0) i.pacotePreco = preco;
        await salvar('insumos', i);
        toast(`Estoque: ${textoQtd(i.estoque, i.unidade)}`);
        recarregar();
      };
    },
  };
}
