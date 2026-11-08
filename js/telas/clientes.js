import { todos, buscar, salvar, apagar } from '../db.js';
import { $, $$, esc, brl, toast, icone, vazio, dataBR, etiquetaStatus, numeroOrc, linkWhats } from '../ui.js';
import { voltar } from '../nav.js';

export async function listaClientes() {
  const [clientes, orcs] = await Promise.all([todos('clientes'), todos('orcamentos')]);
  clientes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const pedidosDe = id => orcs.filter(o => o.clienteId === id && (o.status === 'aprovado' || o.status === 'entregue')).length;

  return {
    titulo: 'Clientes',
    html: clientes.length ? `
      <div class="busca">${icone('busca')}<input id="busca" type="search" placeholder="Buscar cliente"></div>
      <div class="lista" id="lista">${clientes.map(c => `
        <a class="item" href="#/cliente/${c.id}" data-t="${esc((c.nome + ' ' + (c.telefone || '')).toLowerCase())}">
          ${icone('clientes')}
          <div class="meio"><div class="nome">${esc(c.nome)}</div><div class="sub">${esc(c.telefone || 'sem telefone')}</div></div>
          <div class="dir sub">${pedidosDe(c.id)} pedido(s)</div>
        </a>`).join('')}</div>
      <a class="fab" href="#/cliente/novo" aria-label="Novo cliente">${icone('mais')}</a>
    ` : vazio('Nenhum cliente ainda', 'Os clientes são cadastrados automaticamente quando você faz um orçamento.',
      `<a class="bt cheio" href="#/cliente/novo">${icone('mais')} Novo cliente</a>`),
    montar(el) {
      const b = $('#busca', el);
      if (b) b.oninput = () => {
        const t = b.value.trim().toLowerCase();
        $$('#lista .item', el).forEach(a => a.style.display = a.dataset.t.includes(t) ? '' : 'none');
      };
    },
  };
}

export async function formCliente(id) {
  const novo = !id || id === 'novo';
  const c = novo ? { nome: '' } : await buscar('clientes', id);
  if (!c) throw new Error('Cliente não encontrado.');
  const historico = novo ? [] : (await todos('orcamentos')).filter(o => o.clienteId === c.id).sort((a, b) => (b.numero || 0) - (a.numero || 0));
  const totalGasto = historico.filter(o => o.status === 'aprovado' || o.status === 'entregue').reduce((s, o) => s + (o.preco || 0), 0);

  return {
    titulo: novo ? 'Novo cliente' : c.nome,
    voltar: '#/clientes',
    html: `
      <form id="form" class="card">
        <label class="campo"><span>Nome</span><input id="nome" required value="${esc(c.nome)}"></label>
        <label class="campo"><span>WhatsApp</span><input id="telefone" inputmode="tel" value="${esc(c.telefone || '')}" placeholder="(51) 99999-9999"></label>
        <label class="campo"><span>Endereço</span><input id="endereco" value="${esc(c.endereco || '')}"></label>
        <label class="campo"><span>Aniversário</span><input id="aniversario" type="date" value="${esc(c.aniversario || '')}"></label>
        <label class="campo"><span>Anotações</span><textarea id="obs" placeholder="Prefere menos doce, alergia a amendoim…">${esc(c.obs || '')}</textarea></label>
        <div class="botoes">
          <button class="bt cheio" type="submit">${icone('ok')} Salvar</button>
          ${c.telefone ? `<a class="bt" href="${linkWhats(c.telefone)}" target="_blank" rel="noopener">${icone('whats')} WhatsApp</a>` : ''}
        </div>
      </form>
      ${novo ? '' : `
        <div class="secao-titulo">Histórico · ${brl(totalGasto)} em pedidos</div>
        ${historico.length ? `<div class="lista">${historico.map(o => `
          <a class="item" href="#/ver/${o.id}">
            <div class="meio"><div class="nome">${esc(o.receitaNome)}</div>
              <div class="sub">nº ${numeroOrc(o.numero)} · ${o.dataEntrega ? dataBR(o.dataEntrega) : 'sem data'} ${etiquetaStatus(o.status)}</div></div>
            <div class="dir">${brl(o.preco)}</div>
          </a>`).join('')}</div>` : '<div class="card" style="color:var(--cinza)">Nenhum orçamento.</div>'}
        <div class="botoes">
          <a class="bt rosa" href="#/orcamento/novo">${icone('orcamento')} Novo orçamento</a>
          <button class="bt perigo" id="btApagar">${icone('lixo')} Excluir cliente</button>
        </div>`}
    `,
    montar(el) {
      $('#form', el).onsubmit = async e => {
        e.preventDefault();
        const v = id => $('#' + id, el).value.trim();
        if (!v('nome')) return toast('Coloque o nome');
        Object.assign(c, { nome: v('nome'), telefone: v('telefone'), endereco: v('endereco'), aniversario: v('aniversario'), obs: v('obs') });
        await salvar('clientes', c);
        toast('Cliente salvo');
        voltar('#/clientes');
      };
      const b = $('#btApagar', el);
      if (b) b.onclick = async () => {
        if (!confirm(`Excluir ${c.nome}? Os orçamentos dele continuam salvos.`)) return;
        await apagar('clientes', c.id);
        toast('Cliente excluído');
        voltar('#/clientes');
      };
    },
  };
}
