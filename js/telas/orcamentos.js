import { todos, buscar, salvar, salvarVarios, apagar, lerConfig, proximoNumero } from '../db.js';
import {
  $, $$, esc, brl, fmt, num, campoNum, toast, icone, vazio, comprimirImagem, hojeISO, dataBR, diaSemana,
  etiquetaStatus, numeroOrc, compartilharArquivo, baixarArquivo, linkWhats, addDias,
} from '../ui.js';
import { custoBolo, calcularPreco, consumoDe, tipoDe, precoPorBase, SIGLA_BASE, UNIDADES_RECEITA } from '../calc.js';
import { voltar, recarregar, substituir } from '../nav.js';
import { desenharOrcamento, jpegParaPdf, canvasParaJpeg } from '../pdf.js';

const MAX_CAMADAS = 5;

/* ---------- Estoque ---------- */

// sinal = -1 tira do estoque, +1 devolve
export async function movimentarEstoque(consumo, sinal) {
  const insumos = await todos('insumos');
  const mapa = new Map(insumos.map(i => [i.id, i]));
  const alterados = [];
  for (const c of consumo || []) {
    const i = mapa.get(c.insumoId);
    if (!i) continue;
    i.estoque = Math.round(((Number(i.estoque) || 0) + sinal * c.qtdBase) * 1000) / 1000;
    alterados.push(i);
  }
  if (alterados.length) await salvarVarios('insumos', alterados);
}

async function faltasNoEstoque(consumo) {
  const mapa = new Map((await todos('insumos')).map(i => [i.id, i]));
  return (consumo || []).map(c => {
    const i = mapa.get(c.insumoId);
    const falta = i ? c.qtdBase - (Number(i.estoque) || 0) : 0;
    return falta > 0.0001 ? `• ${i.nome}: faltam ${fmt(falta, 1)} ${SIGLA_BASE[i.unidade]}` : null;
  }).filter(Boolean);
}

const nomeArquivo = (o, ext) =>
  `Orcamento-${numeroOrc(o.numero)}-${(o.clienteNome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-')}.${ext}`;

// Texto curto do bolo para listas: "Massa de chocolate · Prestígio + Ninho · Chantilly"
export function resumoBolo(m) {
  if (!m) return '';
  const partes = [m.massa];
  if (m.recheios?.length) partes.push(m.recheios.join(' + '));
  if (m.cobertura) partes.push(m.cobertura);
  return partes.filter(Boolean).join(' · ');
}

/* ---------- Lista ---------- */

const FILTROS = { todos: 'Todos', abertos: 'Em aberto', aprovado: 'Aprovados', entregue: 'Entregues', cancelado: 'Cancelados' };

export async function listaOrcamentos(filtroInicial = 'todos') {
  const orcs = (await todos('orcamentos')).sort((a, b) => (b.numero || 0) - (a.numero || 0));
  let filtro = filtroInicial;
  const passa = o => filtro === 'todos' || (filtro === 'abertos' ? o.status === 'orcamento' : o.status === filtro);

  return {
    titulo: 'Orçamentos',
    html: orcs.length ? `
      <div class="busca">${icone('busca')}<input id="busca" type="search" placeholder="Buscar por cliente ou bolo"></div>
      <div class="filtros">${Object.entries(FILTROS).map(([k, v]) => `<button class="filtro" data-f="${k}">${v}</button>`).join('')}</div>
      <div class="lista" id="lista"></div>
      <a class="fab" href="#/orcamento/novo" aria-label="Novo orçamento">${icone('mais')}</a>
    ` : vazio('Nenhum orçamento ainda', 'Monte o bolo (massa, recheios e cobertura), coloque o lucro e gere o PDF para mandar no WhatsApp.',
      `<a class="bt cheio" href="#/orcamento/novo">${icone('mais')} Novo orçamento</a>`),
    montar(el) {
      if (!orcs.length) return;
      const desenhar = () => {
        const t = $('#busca', el).value.trim().toLowerCase();
        $$('.filtro', el).forEach(b => b.classList.toggle('ativo', b.dataset.f === filtro));
        const lista = orcs.filter(o => passa(o) && (!t || `${o.clienteNome} ${o.receitaNome}`.toLowerCase().includes(t)));
        $('#lista', el).innerHTML = lista.length ? lista.map(o => `
          <a class="item" href="#/ver/${o.id}">
            ${o.foto ? `<img class="miniatura" src="${o.foto}" alt="">` : `<span class="miniatura">${icone('bolo')}</span>`}
            <div class="meio">
              <div class="nome">${esc(o.clienteNome)}</div>
              <div class="sub">nº ${numeroOrc(o.numero)} · ${o.fatias} fatias · ${esc(o.receitaNome)}</div>
              <div class="sub">${o.dataEntrega ? 'Entrega ' + dataBR(o.dataEntrega) : 'Sem data'} ${etiquetaStatus(o.status)}</div>
            </div>
            <div class="dir">${brl(o.preco)}</div>
          </a>`).join('') : '<div class="item sub">Nada por aqui.</div>';
      };
      $('#busca', el).oninput = desenhar;
      $$('.filtro', el).forEach(b => b.onclick = () => { filtro = b.dataset.f; desenhar(); });
      desenhar();
    },
  };
}

/* ---------- Formulário: monta o bolo em etapas ---------- */

export async function formOrcamento(id = 'novo', extra = '') {
  const [receitas, insumos, clientes, cfg] = await Promise.all([todos('receitas'), todos('insumos'), todos('clientes'), lerConfig()]);
  receitas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  clientes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const mapa = new Map(insumos.map(i => [i.id, i]));
  const porId = new Map(receitas.map(r => [r.id, r]));
  const massas = receitas.filter(r => tipoDe(r) === 'massa');
  const recheios = receitas.filter(r => tipoDe(r) === 'recheio');
  const coberturas = receitas.filter(r => tipoDe(r) === 'cobertura');
  const extrasDisp = insumos.filter(i => i.extra).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  let o, novo = true;
  if (id === 'copiar') {
    const orig = await buscar('orcamentos', extra);
    if (!orig) throw new Error('Orçamento não encontrado.');
    o = {
      clienteNome: orig.clienteNome, clienteTel: orig.clienteTel, clienteId: orig.clienteId,
      massaId: orig.massaId || orig.receitaId, camadas: orig.camadas, recheioIds: [...(orig.recheioIds || [])],
      coberturaId: orig.coberturaId || '', extras: (orig.extras || []).map(e => ({ ...e })),
      fatias: orig.fatias, nomeBolo: orig.nomeBolo || '', descricao: orig.descricao, foto: orig.foto,
      entrega: orig.entrega, lucro: orig.lucro, obs: orig.obs, status: 'orcamento',
    };
  } else if (id === 'novo') {
    // Pré-seleção vinda de uma receita ou de "Bolos em oferta": m=massa&r=recheio&c=cobertura
    const p = new URLSearchParams(extra.includes('=') ? extra : (extra ? 'm=' + extra : ''));
    const massa = porId.get(p.get('m')) || massas[0];
    // rs = recheio de cada camada (id1,id2…); r = mesmo recheio em n camadas
    const rs = p.get('rs') ? p.get('rs').split(',').filter(id => porId.has(id)) : null;
    const camadas = rs?.length || Number(p.get('n')) || 2;
    const cliente = clientes.find(c => c.id === p.get('cli'));
    o = {
      clienteNome: cliente?.nome || '', clienteTel: cliente?.telefone || '',
      status: 'orcamento', entrega: 'retirada', obs: cfg.obsPadrao, lucro: 0,
      massaId: massa?.id || '', fatias: Number(p.get('f')) || massa?.fatias || '', foto: massa?.foto || '',
      camadas, recheioIds: rs?.length ? rs : p.get('r') ? Array(camadas).fill(p.get('r')) : [],
      coberturaId: porId.has(p.get('c')) ? p.get('c') : '',
      extras: extrasDisp.filter(i => /caixa|base|disco/i.test(i.nome)).map(i => ({ insumoId: i.id, qtd: 1 })),
    };
  } else {
    o = await buscar('orcamentos', id);
    if (!o) throw new Error('Orçamento não encontrado.');
    novo = false;
    if (!o.massaId && o.receitaId) o.massaId = o.receitaId; // orçamentos da versão anterior
  }
  o.camadas = o.camadas ?? 2;
  o.recheioIds = o.recheioIds || [];
  o.extras = o.extras || [];

  if (!massas.length) {
    return {
      titulo: 'Novo orçamento',
      html: vazio('Cadastre uma massa primeiro', 'O orçamento começa pela massa (branca ou de chocolate). Depois cadastre os recheios e as coberturas.',
        `<a class="bt cheio" href="#/receita/nova/massa">${icone('mais')} Cadastrar massa</a>`),
    };
  }
  let fotoDaReceita = !o.foto || receitas.some(r => r.foto && r.foto === o.foto);
  const qtdExtra = insId => o.extras.find(e => e.insumoId === insId)?.qtd || 0;

  return {
    titulo: novo ? 'Novo orçamento' : `Editar orçamento nº ${numeroOrc(o.numero)}`,
    voltar: '#/orcamentos',
    html: `
      <form id="form">
        <div class="card">
          <h2>${icone('clientes')} Cliente</h2>
          <label class="campo"><span>Nome</span><input id="clienteNome" list="dlClientes" autocomplete="off" value="${esc(o.clienteNome || '')}" placeholder="Nome do cliente"></label>
          <datalist id="dlClientes">${clientes.map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist>
          <label class="campo"><span>WhatsApp</span><input id="clienteTel" inputmode="tel" value="${esc(o.clienteTel || '')}" placeholder="(51) 99999-9999"></label>
        </div>

        <div class="card">
          <h2>${icone('bolo')} Nome do bolo</h2>
          <label class="campo"><span>Como vai aparecer no orçamento</span><input id="nomeBolo" value="${esc(o.nomeBolo || '')}" placeholder="Ex.: Bolo Floresta Negra"></label>
          <small class="dica">Logo abaixo do nome, o orçamento mostra a massa e os recheios escolhidos.</small>
        </div>

        <div class="card">
          <h2><span class="passo">1</span> Massa e tamanho</h2>
          <div class="opcoes" style="margin-bottom:12px">${massas.map(m =>
            `<label class="opcao"><input type="radio" name="massa" value="${m.id}" ${m.id === o.massaId ? 'checked' : ''}><span>${esc(m.nome)}</span></label>`).join('')}</div>
          <label class="campo"><span>Quantas fatias?</span><input id="fatias" inputmode="numeric" value="${o.fatias || ''}"></label>
        </div>

        <div class="card">
          <h2><span class="passo">2</span> Camadas de recheio</h2>
          <div class="opcoes">${Array.from({ length: MAX_CAMADAS }, (_, n) => n + 1).map(n =>
            `<label class="opcao" style="min-width:48px"><input type="radio" name="camadas" value="${n}" ${n === o.camadas ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
        </div>

        <div class="card">
          <h2><span class="passo">3</span> Recheio de cada camada</h2>
          ${recheios.length ? '<div id="recheios"></div>' : `<p class="dica">Nenhum recheio cadastrado. <a href="#/receita/nova/recheio">Cadastrar recheio</a></p>`}
        </div>

        <div class="card">
          <h2><span class="passo">4</span> Cobertura</h2>
          <select id="coberturaId"><option value="">Sem cobertura</option>
            ${coberturas.map(c => `<option value="${c.id}" ${c.id === o.coberturaId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
          </select>
          ${coberturas.length ? '' : `<small class="dica"><a href="#/receita/nova/cobertura">Cadastrar cobertura</a></small>`}
        </div>

        <div class="card">
          <h2><span class="passo">5</span> Extras</h2>
          ${extrasDisp.length ? extrasDisp.map(i => `
            <div class="extra-linha" data-id="${i.id}">
              <div class="meio"><div>${esc(i.nome)}</div><div class="dica" style="margin:0">${precoPorBase(i) ? brl(precoPorBase(i)) + (i.unidade === 'un' ? ' cada' : ' / ' + SIGLA_BASE[i.unidade]) : 'sem preço'}</div></div>
              <div class="stepper">
                <button type="button" class="menos" aria-label="Menos">−</button>
                <span class="q">${fmt(qtdExtra(i.id))}</span>
                <button type="button" class="mais" aria-label="Mais">+</button>
              </div>
            </div>`).join('')
          : `<p class="dica">Em <a href="#/insumos">Insumos</a>, marque caixa, base, topper e vela como "extra" para aparecerem aqui.</p>`}
        </div>

        <div class="card">
          <label class="campo"><span>Detalhes para o cliente (decoração, tema…)</span><textarea id="descricao" placeholder="Decoração com flores naturais, 2 andares, tema jardim">${esc(o.descricao || '')}</textarea></label>
          <div class="campo"><span>Foto do bolo (vai no PDF)</span>
            <label class="foto-campo">
              <span id="fotoBox"></span>
              <span class="bt peq">${icone('camera')} Trocar foto</span>
              <input type="file" id="foto" accept="image/*">
            </label>
          </div>
        </div>

        <div class="card">
          <h2>${icone('agenda')} Entrega</h2>
          <div class="linha2">
            <label class="campo"><span>Data</span><input type="date" id="dataEntrega" value="${o.dataEntrega || ''}"></label>
            <label class="campo"><span>Horário</span><input type="time" id="hora" value="${o.hora || ''}"></label>
          </div>
          <div class="opcoes">
            <label class="opcao"><input type="radio" name="entrega" value="retirada" ${o.entrega !== 'uber' ? 'checked' : ''}><span>Retirada no local</span></label>
            <label class="opcao"><input type="radio" name="entrega" value="uber" ${o.entrega === 'uber' ? 'checked' : ''}><span>Uber (cliente paga)</span></label>
          </div>
        </div>

        <div class="secao-titulo">Custos (só você vê)</div>
        <div class="resumo" id="custos"></div>

        <div class="card">
          <h2>${icone('financeiro')} Lucro</h2>
          <label class="campo"><span>Quanto você quer de lucro neste bolo? (R$)</span><input id="lucro" inputmode="decimal" value="${campoNum(o.lucro)}" placeholder="0,00"></label>
          <small class="dica">Metade vai para o seu pró-labore e metade fica de lucro para a empresa.</small>
          <button type="button" class="bt peq" id="btArred" style="margin-top:10px">Arredondar preço (múltiplo de R$ 5)</button>
        </div>
        <div class="resumo" id="preco"></div>

        <div class="card">
          <label class="campo"><span>Observação no orçamento</span><textarea id="obs">${esc(o.obs || '')}</textarea></label>
        </div>

        <button class="bt cheio largo" type="submit">${icone('ok')} ${novo ? 'Salvar e gerar PDF' : 'Salvar alterações'}</button>
      </form>
    `,
    montar(el) {
      const v = id => $('#' + id, el).value;
      const camadas = () => Number($('input[name=camadas]:checked', el)?.value || 0);
      const massaAtual = () => porId.get($('input[name=massa]:checked', el)?.value);
      const mostrarFoto = () => {
        $('#fotoBox', el).innerHTML = o.foto ? `<img src="${o.foto}" alt="">` : `<span class="sem-foto">${icone('camera', 'ic-grande')}</span>`;
      };
      mostrarFoto();

      // Etapa 3: um seletor de recheio para cada camada
      const desenharRecheios = () => {
        const caixa = $('#recheios', el);
        if (!caixa) return;
        const n = camadas();
        caixa.innerHTML = Array.from({ length: n }, (_, i) => `
          <label class="campo"><span>${i + 1}ª camada${n > 1 && i === 0 ? ' (de baixo)' : ''}</span>
            <select data-camada="${i}"><option value="">Escolha o recheio…</option>
              ${recheios.map(r => `<option value="${r.id}" ${r.id === o.recheioIds[i] ? 'selected' : ''}>${esc(r.nome)}${r.itens?.length ? '' : ' (aguardando receita)'}</option>`).join('')}
            </select></label>`).join('') +
          (n > 1 ? `<button type="button" class="bt peq" id="btIgual">Usar o recheio da 1ª camada em todas</button>` : '');
        $$('select[data-camada]', caixa).forEach(s => s.onchange = () => { o.recheioIds[s.dataset.camada] = s.value; atualizar(); });
        const bi = $('#btIgual', caixa);
        if (bi) bi.onclick = () => {
          if (!o.recheioIds[0]) return toast('Escolha o recheio da 1ª camada');
          for (let i = 1; i < n; i++) o.recheioIds[i] = o.recheioIds[0];
          desenharRecheios();
        };
        atualizar();
      };

      let ultimo = {};
      const montagem = () => ({
        massa: massaAtual(),
        recheios: o.recheioIds.slice(0, camadas()).map(rid => porId.get(rid)).filter(Boolean),
        cobertura: porId.get(v('coberturaId')),
        extras: o.extras,
      });

      const atualizar = () => {
        const m = montagem();
        if (!m.massa) {
          $('#custos', el).innerHTML = '<p class="dica" style="margin:0">Escolha a massa para ver os custos.</p>';
          $('#preco', el).innerHTML = '';
          ultimo = {};
          return;
        }
        const fatias = num(v('fatias')) || m.massa.fatias;
        const c = custoBolo(m, mapa, fatias, cfg);
        const p = calcularPreco(c.total, num(v('lucro')), fatias, cfg);
        ultimo = { m, fatias, c, p };
        const semPreco = c.linhas.filter(l => l.ins && l.semPreco).length;
        const faltandoRecheio = camadas() - m.recheios.length;
        const semItens = [m.massa, ...m.recheios, m.cobertura].filter((r, i, a) => r && !r.itens?.length && a.indexOf(r) === i);
        $('#custos', el).innerHTML = `
          ${c.grupos.map(g => `
            <details>
              <summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px;padding:4px 0">
                <span><b>${g.titulo}</b>${g.receita ? ': ' + esc(g.receita.nome) : ''}</span><span>${brl(g.calc.direto)}</span></summary>
              <table class="tabela-ing">${g.calc.linhas.map(l => `<tr>
                <td>${esc(l.ins?.nome || 'insumo removido')} <span class="dica" style="display:inline">${fmt(l.qtdReceita, 2)} ${UNIDADES_RECEITA[l.item.unidade] || ''}</span></td>
                <td>${l.semPreco ? '<span class="etiqueta st-orc">sem preço</span>' : brl(l.custo)}</td></tr>`).join('')}
              </table>
            </details>`).join('')}
          ${faltandoRecheio > 0 ? `<p style="color:var(--laranja);margin:8px 0 0">${icone('alerta')} Falta escolher o recheio de ${faltandoRecheio} camada(s).</p>` : ''}
          ${semItens.length ? `<p style="color:var(--laranja);margin:8px 0 0">${icone('alerta')} Aguardando receita (custo zerado): ${semItens.map(r => esc(r.nome)).join(', ')}. Cadastre os ingredientes em Receitas.</p>` : ''}
          ${c.faltas.length ? `<p style="color:var(--laranja);margin:8px 0 0">${icone('alerta')} Estoque insuficiente: ${c.faltas.map(f => `${esc(f.ins.nome)} (faltam ${fmt(f.falta, 0)} ${SIGLA_BASE[f.ins.unidade]})`).join(', ')}</p>` : ''}
          ${semPreco ? `<p style="color:var(--laranja);margin:8px 0 0">${icone('alerta')} ${semPreco} insumo(s) sem preço.</p>` : ''}
          <div class="l" style="margin-top:8px;border-top:1px solid var(--rosa);padding-top:8px"><span>Insumos diretos</span><span>${brl(c.direto)}</span></div>
          <div class="l"><span>Indireto (energia) ${fmt(c.indiretoPct)}%</span><span>${brl(c.indireto)}</span></div>
          <div class="l forte"><span>Custo total</span><span>${brl(c.total)}</span></div>`;
        $('#preco', el).innerHTML = `
          <div class="l"><span>Custo total</span><span>${brl(c.total)}</span></div>
          <div class="l"><span>Lucro</span><span>${brl(p.lucro)}</span></div>
          <div class="l sub"><span>• Pró-labore (50%)</span><span>${brl(p.prolabore)}</span></div>
          <div class="l sub"><span>• Lucro da empresa (50%)</span><span>${brl(p.lucroEmpresa)}</span></div>
          <div class="l total"><span>Preço do bolo</span><span>${brl(p.preco)}</span></div>
          <div class="l sub"><span>Valor por fatia</span><span>${brl(p.porFatia)}</span></div>
          <div class="l sub"><span>Sinal ${fmt(p.sinalPct)}% / restante</span><span>${brl(p.sinal)} / ${brl(p.restante)}</span></div>`;
      };

      $$('input[name=massa]', el).forEach(r => r.onchange = () => {
        const m = massaAtual();
        if (m) {
          $('#fatias', el).value = m.fatias;
          if (fotoDaReceita && m.foto) { o.foto = m.foto; mostrarFoto(); }
        }
        atualizar();
      });
      $$('input[name=camadas]', el).forEach(r => r.onchange = desenharRecheios);
      $('#coberturaId', el).onchange = atualizar;
      $('#fatias', el).oninput = $('#lucro', el).oninput = atualizar;

      $$('.extra-linha', el).forEach(linha => {
        const insId = linha.dataset.id;
        const mudar = d => {
          let e = o.extras.find(x => x.insumoId === insId);
          if (!e) o.extras.push(e = { insumoId: insId, qtd: 0 });
          e.qtd = Math.max(0, (e.qtd || 0) + d);
          $('.q', linha).textContent = fmt(e.qtd);
          atualizar();
        };
        $('.menos', linha).onclick = () => mudar(-1);
        $('.mais', linha).onclick = () => mudar(+1);
      });

      $('#btArred', el).onclick = () => {
        if (!ultimo.c) return toast('Escolha a massa primeiro');
        const preco = ultimo.c.total + num(v('lucro'));
        const alvo = Math.ceil((preco - 0.005) / 5) * 5;
        $('#lucro', el).value = campoNum(Math.round((alvo - ultimo.c.total) * 100) / 100);
        atualizar();
      };

      $('#clienteNome', el).onchange = () => {
        const c = clientes.find(x => x.nome.toLowerCase() === v('clienteNome').trim().toLowerCase());
        if (c && !v('clienteTel')) $('#clienteTel', el).value = c.telefone || '';
      };

      $('#foto', el).onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        o.foto = await comprimirImagem(f, 1100);
        fotoDaReceita = false;
        mostrarFoto();
      };

      desenharRecheios();

      $('#form', el).onsubmit = async e => {
        e.preventDefault();
        atualizar();
        const { m, fatias, c, p } = ultimo;
        const nome = v('clienteNome').trim();
        if (!nome) return toast('Coloque o nome do cliente');
        if (!m) return toast('Escolha a massa');
        if (!(fatias > 0)) return toast('Coloque a quantidade de fatias');
        if (recheios.length && m.recheios.length < camadas()) return toast('Escolha o recheio de todas as camadas');

        // Cliente: usa o cadastro existente ou cria um novo
        const tel = v('clienteTel').trim();
        let cli = clientes.find(x => x.nome.toLowerCase() === nome.toLowerCase());
        if (!cli) cli = await salvar('clientes', { nome, telefone: tel });
        else if (tel && cli.telefone !== tel) { cli.telefone = tel; await salvar('clientes', cli); }

        const consumoNovo = consumoDe(c);
        if (!novo && o.estoqueBaixado) {
          await movimentarEstoque(o.consumo, +1);
          await movimentarEstoque(consumoNovo, -1);
        }

        const extrasUsados = o.extras.filter(x => x.qtd > 0 && mapa.get(x.insumoId));
        const desc = {
          massa: m.massa.nome,
          recheios: m.recheios.map(r => r.nome),
          cobertura: m.cobertura?.nome || '',
          extras: extrasUsados.map(x => ({ nome: mapa.get(x.insumoId).nome, qtd: x.qtd })),
        };
        Object.assign(o, {
          clienteId: cli.id, clienteNome: nome, clienteTel: tel,
          massaId: m.massa.id, camadas: camadas(), recheioIds: o.recheioIds.slice(0, camadas()),
          coberturaId: m.cobertura?.id || '', extras: extrasUsados,
          nomeBolo: v('nomeBolo').trim(), montagem: desc, fatias: Math.round(fatias),
          receitaNome: [v('nomeBolo').trim(), resumoBolo(desc)].filter(Boolean).join(' · '),
          descricao: v('descricao').trim(), dataEntrega: v('dataEntrega'), hora: v('hora'),
          entrega: $('input[name=entrega]:checked', el).value, obs: v('obs').trim(),
          custoDireto: c.direto, indiretoPct: c.indiretoPct, indireto: c.indireto, custoTotal: c.total,
          lucro: p.lucro, prolabore: p.prolabore, lucroEmpresa: p.lucroEmpresa,
          preco: p.preco, porFatia: p.porFatia, sinalPct: p.sinalPct, sinal: p.sinal, restante: p.restante,
          consumo: consumoNovo,
          grupos: c.grupos.map(g => ({
            titulo: g.titulo, nome: g.receita?.nome || '', custo: g.calc.direto,
            linhas: g.calc.linhas.filter(l => l.ins).map(l => ({ nome: l.ins.nome, qtd: l.qtdReceita, unidade: l.item.unidade, custo: l.custo })),
          })),
        });
        delete o.receitaId;
        delete o.linhas;
        if (novo) {
          o.numero = await proximoNumero();
          o.dataEmissao = hojeISO();
          o.status = 'orcamento';
        }
        await salvar('orcamentos', o);
        toast(novo ? `Orçamento nº ${numeroOrc(o.numero)} criado` : 'Orçamento atualizado');
        if (novo) substituir('#/ver/' + o.id);
        else voltar('#/ver/' + o.id);
      };
    },
  };
}

/* ---------- Detalhe + PDF ---------- */

export async function verOrcamento(id) {
  const [o, cfg] = await Promise.all([buscar('orcamentos', id), lerConfig()]);
  if (!o) throw new Error('Orçamento não encontrado.');
  const pedido = o.status === 'aprovado' || o.status === 'entregue';
  const validade = addDias(o.dataEmissao || hojeISO(), Number(cfg.validadeDias) || 7);
  const vencido = o.status === 'orcamento' && validade < hojeISO();
  const m = o.montagem;
  const msgWhats = `Olá, ${o.clienteNome}! Aqui é da ${cfg.empresa}. Segue o orçamento do seu bolo de ${o.fatias} fatias: ${brl(o.preco)}.`;
  // Orçamentos da versão anterior tinham uma lista única de insumos
  const grupos = o.grupos || [{ titulo: 'Insumos', nome: '', custo: o.custoDireto, linhas: o.linhas || [] }];

  return {
    titulo: `Orçamento nº ${numeroOrc(o.numero)}`,
    voltar: '#/orcamentos',
    acoes: `<a class="bt-icone" href="#/orcamento/${o.id}" aria-label="Editar">${icone('editar')}</a>`,
    html: `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <h2 style="margin:0">${esc(o.clienteNome)}</h2>${etiquetaStatus(o.status)}
        </div>
        ${m ? `<p style="margin:8px 0 4px"><b>${esc(m.massa)}</b> · ${o.fatias} fatias</p>
          <p class="dica" style="margin:0">${m.recheios.map((r, n) => `${n + 1}ª camada: ${esc(r)}`).join('<br>')}${m.cobertura ? `<br>Cobertura: ${esc(m.cobertura)}` : ''}${m.extras?.length ? `<br>Extras: ${m.extras.map(x => `${esc(x.nome)} (${fmt(x.qtd)})`).join(', ')}` : ''}</p>`
          : `<p class="dica">${esc(o.receitaNome)} · ${o.fatias} fatias</p>`}
        <p class="dica">${o.dataEntrega ? `${diaSemana(o.dataEntrega)}, ${dataBR(o.dataEntrega)}${o.hora ? ' às ' + esc(o.hora) : ''} · ` : ''}${o.entrega === 'uber' ? 'Uber' : 'Retirada'}</p>
        <div style="font-size:26px;font-weight:700;color:var(--bordo)">${brl(o.preco)}</div>
        ${vencido ? `<p style="color:var(--laranja);margin:6px 0 0">${icone('alerta')} Validade vencida em ${dataBR(validade)}</p>` : ''}
        ${o.clienteTel ? `<a class="bt peq" style="margin-top:10px" href="${linkWhats(o.clienteTel, msgWhats)}" target="_blank" rel="noopener">${icone('whats')} Abrir conversa no WhatsApp</a>` : ''}
      </div>

      <div class="secao-titulo">Orçamento para o cliente</div>
      <img id="previa" class="previa" alt="Prévia do orçamento em PDF" style="aspect-ratio:1240/1754">
      <div class="botoes">
        <button class="bt rosa" id="btPdf">${icone('compartilhar')} Enviar PDF</button>
        <button class="bt" id="btImg">${icone('compartilhar')} Enviar como imagem</button>
      </div>
      <button class="bt largo" id="btBaixar" style="margin-bottom:14px">${icone('baixar')} Baixar PDF</button>

      <div class="secao-titulo">Situação</div>
      <div class="card">
        ${o.status === 'orcamento' ? `
          <p class="dica">Quando o cliente fechar, aprove. Os insumos saem do estoque e o bolo entra na agenda.</p>
          <button class="bt verde largo" id="btAprovar">${icone('ok')} Cliente aprovou</button>` : ''}
        ${o.status === 'aprovado' ? `<button class="bt verde largo" id="btEntregue">${icone('ok')} Marcar como entregue</button>` : ''}
        ${o.status === 'entregue' ? `<p style="margin:0;color:var(--verde)">${icone('ok')} Bolo entregue.</p>` : ''}
        ${o.status === 'cancelado' ? `<button class="bt largo" id="btReabrir">Reabrir orçamento</button>` : ''}
        ${pedido ? `
          <div style="margin-top:12px;border-top:1px solid var(--linha);padding-top:8px">
            <label class="marcar"><input type="checkbox" id="sinalPago" ${o.sinalPago ? 'checked' : ''}> Sinal recebido (${brl(o.sinal)})</label>
            <label class="marcar"><input type="checkbox" id="restantePago" ${o.restantePago ? 'checked' : ''}> Restante recebido (${brl(o.restante)})</label>
          </div>` : ''}
      </div>

      <div class="secao-titulo">Custos e lucro (só você vê)</div>
      <div class="resumo">
        ${grupos.map(g => `
          <details>
            <summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px;padding:4px 0">
              <span><b>${esc(g.titulo)}</b>${g.nome ? ': ' + esc(g.nome) : ''}</span><span>${brl(g.custo)}</span></summary>
            <table class="tabela-ing">${g.linhas.map(l => `<tr><td>${esc(l.nome)} <span class="dica" style="display:inline">${fmt(l.qtd, 2)} ${UNIDADES_RECEITA[l.unidade] || ''}</span></td><td>${brl(l.custo)}</td></tr>`).join('')}</table>
          </details>`).join('')}
        <div class="l" style="margin-top:8px;border-top:1px solid var(--rosa);padding-top:8px"><span>Insumos diretos</span><span>${brl(o.custoDireto)}</span></div>
        <div class="l"><span>Indireto (energia) ${fmt(o.indiretoPct)}%</span><span>${brl(o.indireto)}</span></div>
        <div class="l forte"><span>Custo total</span><span>${brl(o.custoTotal)}</span></div>
        <div class="l"><span>Lucro</span><span>${brl(o.lucro)}</span></div>
        <div class="l sub"><span>• Pró-labore</span><span>${brl(o.prolabore)}</span></div>
        <div class="l sub"><span>• Lucro da empresa</span><span>${brl(o.lucroEmpresa)}</span></div>
        <div class="l total"><span>Preço</span><span>${brl(o.preco)}</span></div>
        <div class="l sub"><span>Valor por fatia</span><span>${brl(o.porFatia)}</span></div>
      </div>

      <div class="botoes">
        <a class="bt" href="#/orcamento/${o.id}">${icone('editar')} Editar</a>
        <a class="bt" href="#/orcamento/copiar/${o.id}">${icone('mais')} Duplicar</a>
      </div>
      <div class="botoes">
        ${o.status !== 'cancelado' ? `<button class="bt perigo" id="btCancelar">${icone('x')} Cancelar</button>` : ''}
        <button class="bt perigo" id="btExcluir">${icone('lixo')} Excluir</button>
      </div>
    `,
    async montar(el) {
      const salvarO = async msg => { await salvar('orcamentos', o); if (msg) toast(msg); };

      const bt = (sel, fn) => { const b = $(sel, el); if (b) b.onclick = fn; };
      bt('#btAprovar', async () => {
        const faltas = await faltasNoEstoque(o.consumo);
        const aviso = faltas.length ? `\n\nAtenção, o estoque não é suficiente:\n${faltas.join('\n')}\n\nO estoque ficará negativo até você registrar a compra.` : '';
        if (!confirm(`Aprovar o pedido de ${o.clienteNome}?\nOs insumos serão retirados do estoque.${aviso}`)) return;
        await movimentarEstoque(o.consumo, -1);
        Object.assign(o, { status: 'aprovado', estoqueBaixado: true, aprovadoEm: hojeISO() });
        await salvarO('Pedido aprovado e estoque atualizado');
        recarregar();
      });
      bt('#btEntregue', async () => { o.status = 'entregue'; o.entregueEm = hojeISO(); await salvarO('Marcado como entregue'); recarregar(); });
      bt('#btReabrir', async () => { o.status = 'orcamento'; await salvarO('Orçamento reaberto'); recarregar(); });
      bt('#btCancelar', async () => {
        if (!confirm('Cancelar este ' + (o.status === 'orcamento' ? 'orçamento?' : 'pedido?'))) return;
        if (o.estoqueBaixado && confirm('Devolver os insumos ao estoque? (Escolha OK se o bolo ainda não foi feito.)')) {
          await movimentarEstoque(o.consumo, +1);
          o.estoqueBaixado = false;
        }
        o.status = 'cancelado';
        await salvarO('Cancelado');
        recarregar();
      });
      bt('#btExcluir', async () => {
        if (!confirm(`Excluir o orçamento nº ${numeroOrc(o.numero)}? Isso não pode ser desfeito.`)) return;
        if (o.estoqueBaixado && o.status === 'aprovado' && confirm('Devolver os insumos ao estoque?')) await movimentarEstoque(o.consumo, +1);
        await apagar('orcamentos', o.id);
        toast('Orçamento excluído');
        voltar('#/orcamentos');
      });
      ['sinalPago', 'restantePago'].forEach(k => {
        const c = $('#' + k, el);
        if (c) c.onchange = () => { o[k] = c.checked; salvarO(c.checked ? 'Pagamento registrado' : 'Pagamento desmarcado'); };
      });

      // A imagem é gerada uma única vez, logo ao abrir, e reaproveitada na prévia, no envio como
      // imagem e no PDF. Ler o desenho de novo depois de abrir o WhatsApp podia dar imagem preta.
      const canvas = await desenharOrcamento(o, cfg);
      const { width, height } = canvas;
      const jpeg = await canvasParaJpeg(canvas);
      canvas.width = canvas.height = 0; // libera a memória do desenho
      $('#previa', el).src = URL.createObjectURL(jpeg);
      let pdf;
      const obterPdf = async () => (pdf ||= await jpegParaPdf(jpeg, width, height, `Orçamento ${numeroOrc(o.numero)} - ${o.clienteNome}`));
      $('#btPdf', el).onclick = async () => compartilharArquivo(await obterPdf(), nomeArquivo(o, 'pdf'), 'Orçamento LiLi Bolos');
      $('#btImg', el).onclick = async () => compartilharArquivo(jpeg, nomeArquivo(o, 'jpg'), 'Orçamento LiLi Bolos');
      $('#btBaixar', el).onclick = async () => { baixarArquivo(await obterPdf(), nomeArquivo(o, 'pdf')); toast('PDF salvo em Downloads'); };
    },
  };
}
