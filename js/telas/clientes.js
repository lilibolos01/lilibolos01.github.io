import { todos, buscar, salvar, apagar } from '../db.js';
import { $, $$, esc, brl, toast, icone, vazio, dataBR, etiquetaStatus, numeroOrc, linkWhats, MESES } from '../ui.js';
import { voltar } from '../nav.js';
import { nomeBolo, textoVem } from '../calc.js';
import { rankingBolos, linkOrcar, montagemDe } from './ranking.js';

const ehPedido = o => o.status === 'aprovado' || o.status === 'entregue';

// Aniversário guardado como "MM-DD" (sem ano). Aceita também datas antigas "AAAA-MM-DD".
function lerAniversario(a) {
  const m = String(a || '').match(/(\d{2})-(\d{2})$/);
  return m ? { mes: Number(m[1]), dia: Number(m[2]) } : { mes: 0, dia: 0 };
}
export function textoAniversario(a) {
  const { mes, dia } = lerAniversario(a);
  return mes && dia ? `${dia} de ${MESES[mes - 1]}` : '';
}
const diasNoMes = mes => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];

export async function listaClientes() {
  const [clientes, orcs] = await Promise.all([todos('clientes'), todos('orcamentos')]);
  clientes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const pedidosDe = id => orcs.filter(o => o.clienteId === id && ehPedido(o)).length;
  const ultimoBolo = id => {
    const o = orcs.filter(x => x.clienteId === id && ehPedido(x)).sort((a, b) => (b.numero || 0) - (a.numero || 0))[0];
    return o ? nomeBolo(montagemDe(o)) : '';
  };

  return {
    titulo: 'Clientes',
    html: clientes.length ? `
      <div class="busca">${icone('busca')}<input id="busca" type="search" placeholder="Buscar cliente"></div>
      <div class="lista" id="lista">${clientes.map(c => `
        <a class="item" href="#/cliente/${c.id}" data-t="${esc((c.nome + ' ' + (c.telefone || '')).toLowerCase())}">
          ${icone('clientes')}
          <div class="meio"><div class="nome">${esc(c.nome)}</div>
            <div class="sub">${esc(c.telefone || 'sem telefone')}${textoAniversario(c.aniversario) ? ` · aniversário ${textoAniversario(c.aniversario)}` : ''}</div>
            ${ultimoBolo(c.id) ? `<div class="sub">Último: ${esc(ultimoBolo(c.id))}</div>` : ''}</div>
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
  const pedidos = historico.filter(ehPedido);
  const totalGasto = pedidos.reduce((s, o) => s + (o.preco || 0), 0);
  const ani = lerAniversario(c.aniversario);

  // Bolo preferido (o que mais pediu) e o último bolo pedido
  const preferido = rankingBolos(pedidos)[0];
  const ultimo = pedidos[0];
  const cartaoBolo = (titulo, m, detalhe, o) => `
    <div class="item" style="align-items:flex-start">
      <span class="miniatura">${icone(titulo.startsWith('Mais') ? 'ranking' : 'bolo')}</span>
      <div class="meio">
        <div class="sub" style="font-weight:600;color:var(--rosa-forte)">${titulo}</div>
        <div class="nome">${esc(nomeBolo(m))}</div>
        <div class="sub">Vem: ${esc(textoVem(m))}</div>
        <div class="sub">${detalhe}</div>
      </div>
      ${linkOrcar({ o }, c.id) ? `<a class="bt peq rosa" href="${linkOrcar({ o }, c.id)}">Orçar igual</a>` : ''}
    </div>`;

  return {
    titulo: novo ? 'Novo cliente' : c.nome,
    voltar: '#/clientes',
    html: `
      <form id="form" class="card">
        <label class="campo"><span>Nome</span><input id="nome" required value="${esc(c.nome)}"></label>
        <label class="campo"><span>WhatsApp</span><input id="telefone" inputmode="tel" value="${esc(c.telefone || '')}" placeholder="(51) 99999-9999"></label>
        <label class="campo"><span>Endereço</span><input id="endereco" value="${esc(c.endereco || '')}"></label>
        <div class="campo"><span>Aniversário (dia e mês)</span>
          <div class="linha2">
            <select id="aniDia" aria-label="Dia do aniversário"><option value="">Dia</option>
              ${Array.from({ length: 31 }, (_, i) => i + 1).map(d => `<option value="${d}" ${d === ani.dia ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            <select id="aniMes" aria-label="Mês do aniversário"><option value="">Mês</option>
              ${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === ani.mes ? 'selected' : ''}>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <label class="campo"><span>Anotações</span><textarea id="obs" placeholder="Prefere menos doce, alergia a amendoim…">${esc(c.obs || '')}</textarea></label>
        <div class="botoes">
          <button class="bt cheio" type="submit">${icone('ok')} Salvar</button>
          ${c.telefone ? `<a class="bt" href="${linkWhats(c.telefone)}" target="_blank" rel="noopener">${icone('whats')} WhatsApp</a>` : ''}
        </div>
      </form>
      ${novo ? '' : `
        ${pedidos.length ? `
          <div class="secao-titulo">Bolos de ${esc(c.nome.split(' ')[0])}</div>
          <div class="lista">
            ${cartaoBolo('Mais pedido', preferido.m, `${preferido.qtd} pedido(s) · ${brl(preferido.total)}`, preferido.o)}
            ${cartaoBolo('Último pedido', montagemDe(ultimo), `${ultimo.dataEntrega ? 'Entrega ' + dataBR(ultimo.dataEntrega) + ' · ' : ''}${ultimo.fatias} fatias · ${brl(ultimo.preco)}`, ultimo)}
          </div>` : ''}
        <div class="secao-titulo">Histórico · ${brl(totalGasto)} em pedidos</div>
        ${historico.length ? `<div class="lista">${historico.map(o => `
          <a class="item" href="#/ver/${o.id}">
            <div class="meio"><div class="nome">${esc(o.receitaNome)}</div>
              <div class="sub">nº ${numeroOrc(o.numero)} · ${o.dataEntrega ? dataBR(o.dataEntrega) : 'sem data'} ${etiquetaStatus(o.status)}</div></div>
            <div class="dir">${brl(o.preco)}</div>
          </a>`).join('')}</div>` : '<div class="card" style="color:var(--cinza)">Nenhum orçamento.</div>'}
        <div class="botoes">
          <a class="bt rosa" href="#/orcamento/novo/cli=${c.id}">${icone('orcamento')} Novo orçamento</a>
          <button class="bt perigo" id="btApagar">${icone('lixo')} Excluir cliente</button>
        </div>`}
    `,
    montar(el) {
      $('#form', el).onsubmit = async e => {
        e.preventDefault();
        const v = id => $('#' + id, el).value.trim();
        if (!v('nome')) return toast('Coloque o nome');
        const dia = Number(v('aniDia')), mes = Number(v('aniMes'));
        if ((dia && !mes) || (!dia && mes)) return toast('Escolha o dia e o mês do aniversário');
        if (dia && dia > diasNoMes(mes)) return toast(`${MESES[mes - 1].charAt(0).toUpperCase() + MESES[mes - 1].slice(1)} não tem dia ${dia}`);
        const aniversario = dia ? `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` : '';
        Object.assign(c, { nome: v('nome'), telefone: v('telefone'), endereco: v('endereco'), aniversario, obs: v('obs') });
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
