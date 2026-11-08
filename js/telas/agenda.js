import { todos } from '../db.js';
import { $, $$, esc, brl, icone, hojeISO, dataBR, diaSemana, MESES, numeroOrc, etiquetaStatus } from '../ui.js';

const itemPedido = o => `
  <a class="item" href="#/ver/${o.id}">
    ${o.foto ? `<img class="miniatura" src="${o.foto}" alt="">` : `<span class="miniatura">${icone('bolo')}</span>`}
    <div class="meio">
      <div class="nome">${esc(o.clienteNome)}</div>
      <div class="sub">${esc(o.receitaNome)} · ${o.fatias} fatias · ${o.entrega === 'uber' ? 'Uber' : 'Retirada'}</div>
      <div class="sub">${o.hora ? esc(o.hora) + ' · ' : ''}nº ${numeroOrc(o.numero)} ${o.status === 'entregue' ? etiquetaStatus('entregue') : ''}
        ${o.status === 'aprovado' && !o.sinalPago ? '<span class="etiqueta et-alerta">sem sinal</span>' : ''}</div>
    </div>
    <div class="dir">${brl(o.preco)}</div>
  </a>`;

export async function agenda(mesParam) {
  const pedidos = (await todos('orcamentos'))
    .filter(o => (o.status === 'aprovado' || o.status === 'entregue') && o.dataEntrega)
    .sort((a, b) => (a.dataEntrega + (a.hora || '')).localeCompare(b.dataEntrega + (b.hora || '')));
  const hoje = hojeISO();
  let [ano, mes] = (mesParam || hoje.slice(0, 7)).split('-').map(Number);
  let selecionado = null;
  const semData = (await todos('orcamentos')).filter(o => o.status === 'aprovado' && !o.dataEntrega);

  return {
    titulo: 'Pedidos e agenda',
    html: `
      <div class="mes-nav">
        <button class="bt-icone" id="ant" aria-label="Mês anterior">${icone('voltar')}</button>
        <h2 id="mesNome"></h2>
        <button class="bt-icone" id="prox" aria-label="Próximo mês" style="transform:scaleX(-1)">${icone('voltar')}</button>
      </div>
      <div class="calendario" id="cal"></div>
      <div id="listaDia"></div>
      ${semData.length ? `<div class="secao-titulo">Aprovados sem data de entrega</div><div class="lista">${semData.map(itemPedido).join('')}</div>` : ''}
    `,
    montar(el) {
      const desenhar = () => {
        const chave = `${ano}-${String(mes).padStart(2, '0')}`;
        $('#mesNome', el).textContent = `${MESES[mes - 1]} ${ano}`;
        const doMes = pedidos.filter(o => o.dataEntrega.startsWith(chave));
        const porDia = {};
        doMes.forEach(o => (porDia[o.dataEntrega] ||= []).push(o));
        const primeiro = new Date(ano, mes - 1, 1).getDay();
        const dias = new Date(ano, mes, 0).getDate();
        let html = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<div class="dsem">${d}</div>`).join('');
        html += '<div></div>'.repeat(primeiro);
        for (let d = 1; d <= dias; d++) {
          const iso = `${chave}-${String(d).padStart(2, '0')}`;
          const cls = ['dia', porDia[iso] ? 'tem' : '', iso === hoje ? 'hoje' : '', iso === selecionado ? 'sel' : ''].join(' ');
          html += `<button class="${cls}" data-d="${iso}">${d}${porDia[iso] ? '<span class="qtd"></span>' : ''}</button>`;
        }
        $('#cal', el).innerHTML = html;
        $$('.dia', el).forEach(b => b.onclick = () => { selecionado = selecionado === b.dataset.d ? null : b.dataset.d; desenhar(); });

        let titulo, lista;
        if (selecionado) {
          titulo = `${diaSemana(selecionado)}, ${dataBR(selecionado)}`;
          lista = porDia[selecionado] || [];
        } else {
          titulo = `Entregas de ${MESES[mes - 1]}`;
          lista = doMes;
        }
        $('#listaDia', el).innerHTML = `<div class="secao-titulo">${titulo} (${lista.length})</div>` + (lista.length
          ? `<div class="lista">${lista.map(o => (selecionado ? '' : `<div class="sub" style="padding:8px 14px 0;color:var(--rosa-forte);font-weight:600">${diaSemana(o.dataEntrega)}, ${dataBR(o.dataEntrega)}</div>`) + itemPedido(o)).join('')}</div>`
          : '<div class="card" style="color:var(--cinza)">Nenhuma entrega.</div>');
      };
      $('#ant', el).onclick = () => { mes--; if (mes < 1) { mes = 12; ano--; } selecionado = null; desenhar(); };
      $('#prox', el).onclick = () => { mes++; if (mes > 12) { mes = 1; ano++; } selecionado = null; desenhar(); };
      desenhar();
    },
  };
}
