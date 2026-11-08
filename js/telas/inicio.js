import { todos } from '../db.js';
import { estoqueBaixo } from '../calc.js';
import { icone, esc, brl, dataBR, diaSemana, hojeISO, numeroOrc } from '../ui.js';

export async function inicio() {
  const [insumos, orcs] = await Promise.all([todos('insumos'), todos('orcamentos')]);
  const hoje = hojeISO();
  const baixos = insumos.filter(estoqueBaixo);
  const abertos = orcs.filter(o => o.status === 'orcamento').length;
  const proximas = orcs
    .filter(o => o.status === 'aprovado' && o.dataEntrega && o.dataEntrega >= hoje)
    .sort((a, b) => (a.dataEntrega + (a.hora || '')).localeCompare(b.dataEntrega + (b.hora || '')))
    .slice(0, 3);

  const bloco = (href, ic, nome, cor, extra = '') =>
    `<a class="bloco ${cor}" href="${href}">${extra}${icone(ic)}<span>${nome}</span></a>`;

  return {
    html: `
      <div class="banner">
        <img src="img/logo.webp" alt="LiLi Bolos — feito com amor, para você">
        <a class="bt-icone" href="#/config" aria-label="Configurações">${icone('config')}</a>
      </div>

      <a class="bt-principal" href="#/orcamento/novo">${icone('orcamento')} Novo orçamento</a>

      <div class="grade">
        ${bloco('#/orcamentos', 'orcamento', 'Orçamentos', 'cor-rosa', abertos ? `<span class="bolinha">${abertos}</span>` : '')}
        ${bloco('#/agenda', 'agenda', 'Pedidos e agenda', 'cor-lilas')}
        ${bloco('#/receitas', 'receitas', 'Receitas', 'cor-pessego')}
        ${bloco('#/insumos', 'estoque', 'Insumos e estoque', 'cor-menta', baixos.length ? `<span class="bolinha">${baixos.length}</span>` : '')}
        ${bloco('#/clientes', 'clientes', 'Clientes', 'cor-magenta')}
        ${bloco('#/financeiro', 'financeiro', 'Financeiro', 'cor-dourado')}
        ${bloco('#/ranking', 'ranking', 'Mais pedidos', 'cor-azul')}
        ${bloco('#/ofertas', 'ofertas', 'Bolos em oferta', 'cor-vermelho')}
      </div>

      ${baixos.length ? `
        <a class="card aviso" href="#/insumos/baixo" style="text-decoration:none">
          ${icone('alerta')}
          <div><b>Estoque baixo:</b> ${baixos.slice(0, 4).map(i => esc(i.nome)).join(', ')}${baixos.length > 4 ? ` e mais ${baixos.length - 4}` : ''}</div>
        </a>` : ''}

      <div class="secao-titulo">Próximas entregas</div>
      ${proximas.length ? `<div class="lista">${proximas.map(o => `
        <a class="item" href="#/ver/${o.id}">
          ${icone('bolo')}
          <div class="meio">
            <div class="nome">${esc(o.clienteNome || 'Cliente')} · ${esc(o.receitaNome || '')}</div>
            <div class="sub">${o.dataEntrega === hoje ? '<b>Hoje</b>' : `${diaSemana(o.dataEntrega)}, ${dataBR(o.dataEntrega)}`}${o.hora ? ' às ' + esc(o.hora) : ''} · nº ${numeroOrc(o.numero)}</div>
          </div>
          <div class="dir">${brl(o.preco)}</div>
        </a>`).join('')}</div>`
        : `<div class="card" style="color:var(--cinza)">Nenhuma entrega marcada. Quando um orçamento for aprovado, ele aparece aqui.</div>`}

      <a class="rodape-insta" href="https://www.instagram.com/lili.bolos01/" target="_blank" rel="noopener">${icone('instagram')} @lili.bolos01</a>
    `,
  };
}
