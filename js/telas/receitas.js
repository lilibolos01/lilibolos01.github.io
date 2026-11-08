import { todos, buscar, salvar, apagar, lerConfig } from '../db.js';
import { $, $$, esc, brl, fmt, num, campoNum, toast, icone, vazio, comprimirImagem } from '../ui.js';
import { UNIDADES_RECEITA, TIPOS_RECEITA, tipoDe, unidadesPermitidas, custoReceita } from '../calc.js';
import { voltar } from '../nav.js';

const textoRende = r => {
  const t = tipoDe(r);
  if (t === 'recheio') return `1 camada para ${r.fatias} fatias`;
  if (t === 'cobertura') return `cobre ${r.fatias} fatias`;
  return `rende ${r.fatias} fatias`;
};

export async function listaReceitas(tipoInicial = 'massa') {
  const [receitas, insumos, cfg] = await Promise.all([todos('receitas'), todos('insumos'), lerConfig()]);
  receitas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const mapa = new Map(insumos.map(i => [i.id, i]));
  let tipo = TIPOS_RECEITA[tipoInicial] ? tipoInicial : 'massa';
  const qtd = t => receitas.filter(r => tipoDe(r) === t).length;

  return {
    titulo: 'Receitas',
    html: `
      <div class="filtros">${Object.entries(TIPOS_RECEITA).map(([k, v]) => `<button class="filtro" data-t="${k}">${v.plural} (${qtd(k)})</button>`).join('')}</div>
      ${!insumos.length ? `<div class="card aviso">${icone('alerta')}<div>Antes, cadastre os insumos com os preços em <a href="#/insumos">Insumos e estoque</a>.</div></div>` : ''}
      <div id="lista"></div>
      <a class="fab" id="fab" href="#/receita/nova" aria-label="Nova receita">${icone('mais')}</a>
    `,
    montar(el) {
      const desenhar = () => {
        $$('.filtro', el).forEach(b => b.classList.toggle('ativo', b.dataset.t === tipo));
        $('#fab', el).href = `#/receita/nova/${tipo}`;
        const lista = receitas.filter(r => tipoDe(r) === tipo);
        $('#lista', el).innerHTML = lista.length ? `<div class="lista">${lista.map(r => {
          const c = custoReceita(r, mapa, r.fatias, cfg);
          return `<a class="item" href="#/receita/${r.id}">
            ${r.foto ? `<img class="miniatura" src="${r.foto}" alt="">` : `<span class="miniatura">${icone('bolo')}</span>`}
            <div class="meio"><div class="nome">${esc(r.nome)}</div>
              <div class="sub">${r.itens?.length ? `${textoRende(r)} · ${r.itens.length} ingredientes` : '<span class="etiqueta st-orc">aguardando receita</span>'}</div></div>
            ${r.itens?.length ? `<div class="dir">${brl(c.total)}<div class="sub" style="font-weight:400">${brl(c.total / (r.fatias || 1))}/fatia</div></div>` : ''}
          </a>`;
        }).join('')}</div>` : vazio(`Nenhum${tipo === 'massa' ? 'a massa' : tipo === 'cobertura' ? 'a cobertura' : ' recheio'} cadastrad${tipo === 'recheio' ? 'o' : 'a'}`,
          tipo === 'massa' ? 'Ex.: Massa branca e Massa de chocolate.'
            : tipo === 'recheio' ? 'Ex.: Prestígio, Ninho com morango, Brigadeiro. Cadastre a quantidade para 1 camada.'
              : 'Ex.: Chantilly, Ganache, Merengue suíço, Nata.',
          `<a class="bt cheio" href="#/receita/nova/${tipo}">${icone('mais')} Cadastrar ${TIPOS_RECEITA[tipo].nome.toLowerCase()}</a>`);
      };
      $$('.filtro', el).forEach(b => b.onclick = () => { tipo = b.dataset.t; desenhar(); });
      desenhar();
    },
  };
}

export async function formReceita(id, tipoNovo = 'massa') {
  const nova = !id || id === 'nova';
  const [insumos, cfg] = await Promise.all([todos('insumos'), lerConfig()]);
  insumos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const mapa = new Map(insumos.map(i => [i.id, i]));
  const r = nova
    ? { tipo: TIPOS_RECEITA[tipoNovo] ? tipoNovo : 'massa', nome: '', fatias: 20, itens: [], foto: '', preparo: '' }
    : await buscar('receitas', id);
  if (!r) throw new Error('Receita não encontrada.');
  r.tipo = tipoDe(r);
  r.itens = (r.itens || []).map(it => ({ ...it }));

  const opcoesInsumo = sel => `<option value="">Escolha o insumo…</option>` +
    insumos.map(i => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.nome)}</option>`).join('');
  const opcoesUnidade = (ins, sel) => unidadesPermitidas(ins)
    .map(u => `<option value="${u}" ${u === sel ? 'selected' : ''}>${UNIDADES_RECEITA[u]}</option>`).join('');
  const linkOrcar = { massa: 'm', recheio: 'r', cobertura: 'c' };

  return {
    titulo: nova ? 'Nova receita' : r.nome,
    voltar: '#/receitas/' + r.tipo,
    html: `
      <form id="form">
        <div class="card">
          <div class="campo"><span>Tipo</span>
            <div class="opcoes">${Object.entries(TIPOS_RECEITA).map(([k, v]) =>
              `<label class="opcao" style="min-width:90px"><input type="radio" name="tipo" value="${k}" ${r.tipo === k ? 'checked' : ''}><span>${v.nome}</span></label>`).join('')}</div>
          </div>
          <label class="campo"><span>Nome</span><input id="nome" required value="${esc(r.nome)}" placeholder="Massa de chocolate"></label>
          <label class="campo"><span id="rotFatias"></span><input id="fatias" inputmode="numeric" value="${r.fatias || ''}"></label>
          <div class="campo"><span>Foto (opcional)</span>
            <label class="foto-campo">
              <span id="fotoBox">${r.foto ? `<img src="${r.foto}" alt="">` : `<span class="sem-foto">${icone('camera', 'ic-grande')}</span>`}</span>
              <span class="bt peq">${icone('camera')} Escolher foto</span>
              <input type="file" id="foto" accept="image/*">
            </label>
          </div>
        </div>

        <div class="card">
          <h2>Ingredientes</h2>
          <div id="itens"></div>
          <button class="bt largo" type="button" id="btAdd" style="margin-top:10px">${icone('mais')} Adicionar ingrediente</button>
        </div>

        <div class="resumo" id="resumo"></div>

        <div class="card">
          <label class="campo"><span>Modo de preparo / anotações (opcional)</span><textarea id="preparo">${esc(r.preparo || '')}</textarea></label>
        </div>

        <div class="botoes">
          <button class="bt cheio" type="submit">${icone('ok')} Salvar receita</button>
          ${nova ? '' : `<a class="bt rosa" href="#/orcamento/novo/${linkOrcar[r.tipo]}=${r.id}">${icone('orcamento')} Fazer orçamento</a>`}
        </div>
        ${nova ? '' : `<button class="bt perigo largo" type="button" id="btApagar">${icone('lixo')} Excluir receita</button>`}
      </form>
    `,
    montar(el) {
      const caixa = $('#itens', el);
      const tipoAtual = () => $('input[name=tipo]:checked', el).value;

      const desenharItens = () => {
        caixa.innerHTML = r.itens.map((it, n) => {
          const ins = mapa.get(it.insumoId);
          return `<div class="ingrediente" data-n="${n}">
            <div>
              <select class="selIns">${opcoesInsumo(it.insumoId)}</select>
              <div class="qtds">
                <input class="qtd" inputmode="decimal" placeholder="Qtd" value="${campoNum(it.qtd)}">
                <select class="uni">${opcoesUnidade(ins, it.unidade)}</select>
              </div>
            </div>
            <button type="button" class="bt-icone btRem" aria-label="Remover">${icone('x')}</button>
            <div class="custo-linha"></div>
          </div>`;
        }).join('') || '<p class="dica">Nenhum ingrediente ainda.</p>';

        $$('.ingrediente', caixa).forEach(div => {
          const it = r.itens[div.dataset.n];
          $('.selIns', div).onchange = e => {
            it.insumoId = e.target.value;
            const ins = mapa.get(it.insumoId);
            if (!unidadesPermitidas(ins).includes(it.unidade)) it.unidade = ins?.unidade || 'g';
            desenharItens();
          };
          $('.qtd', div).oninput = e => { it.qtd = num(e.target.value); resumir(); };
          $('.uni', div).onchange = e => { it.unidade = e.target.value; resumir(); };
          $('.btRem', div).onclick = () => { r.itens.splice(div.dataset.n, 1); desenharItens(); };
        });
        resumir();
      };

      const resumir = () => {
        $('#rotFatias', el).textContent = TIPOS_RECEITA[tipoAtual()].rende;
        const fatias = num($('#fatias', el).value) || 1;
        const c = custoReceita({ ...r, fatias }, mapa, fatias, cfg);
        c.linhas.forEach((l, n) => {
          const div = caixa.querySelector(`[data-n="${n}"] .custo-linha`);
          if (!div) return;
          div.innerHTML = !l.ins ? '' : l.semPreco
            ? `<span class="etiqueta st-orc">insumo sem preço</span>`
            : `${l.item.unidade === 'sopa' || l.item.unidade === 'cha' ? `≈ ${fmt(l.qtdBase, 1)} ${l.ins.unidade} · ` : ''}${brl(l.custo)}`;
        });
        $('#resumo', el).innerHTML = `
          <div class="l"><span>Insumos diretos</span><span>${brl(c.direto)}</span></div>
          <div class="l"><span>Indireto (energia) ${fmt(c.indiretoPct)}%</span><span>${brl(c.indireto)}</span></div>
          <div class="l total"><span>Custo da receita</span><span>${brl(c.total)}</span></div>
          <div class="l sub"><span>Custo por fatia (${fmt(fatias, 0)} fatias)</span><span>${brl(c.total / fatias)}</span></div>`;
      };

      $$('input[name=tipo]', el).forEach(x => x.onchange = resumir);
      $('#fatias', el).oninput = resumir;
      $('#btAdd', el).onclick = () => { r.itens.push({ insumoId: '', qtd: 0, unidade: 'g' }); desenharItens(); };
      desenharItens();

      $('#foto', el).onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        r.foto = await comprimirImagem(f, 900);
        $('#fotoBox', el).innerHTML = `<img src="${r.foto}" alt="">`;
      };

      $('#form', el).onsubmit = async e => {
        e.preventDefault();
        r.tipo = tipoAtual();
        r.nome = $('#nome', el).value.trim();
        r.fatias = Math.max(1, Math.round(num($('#fatias', el).value)));
        r.preparo = $('#preparo', el).value.trim();
        r.itens = r.itens.filter(it => it.insumoId && it.qtd > 0);
        if (!r.nome) return toast('Coloque o nome');
        await salvar('receitas', r);
        toast(r.itens.length ? 'Receita salva' : 'Salva como "aguardando receita"');
        voltar('#/receitas/' + r.tipo);
      };

      const btApagar = $('#btApagar', el);
      if (btApagar) btApagar.onclick = async () => {
        if (!confirm(`Excluir a receita "${r.nome}"? Os orçamentos já feitos continuam salvos.`)) return;
        await apagar('receitas', r.id);
        toast('Receita excluída');
        voltar('#/receitas/' + r.tipo);
      };
    },
  };
}
