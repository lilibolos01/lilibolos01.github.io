import { todos } from '../db.js';
import { $, esc, brl, icone, hojeISO, dataBR, MESES, numeroOrc } from '../ui.js';

export async function financeiro() {
  const orcs = await todos('orcamentos');
  const pedidos = orcs.filter(o => o.status === 'aprovado' || o.status === 'entregue');
  const mesDe = o => (o.dataEntrega || o.aprovadoEm || o.dataEmissao || '').slice(0, 7);
  const hoje = hojeISO();
  let [ano, mes] = hoje.slice(0, 7).split('-').map(Number);

  return {
    titulo: 'Financeiro',
    html: `
      <div class="mes-nav">
        <button class="bt-icone" id="ant" aria-label="Mês anterior">${icone('voltar')}</button>
        <h2 id="mesNome"></h2>
        <button class="bt-icone" id="prox" aria-label="Próximo mês" style="transform:scaleX(-1)">${icone('voltar')}</button>
      </div>
      <div id="conteudo"></div>
    `,
    montar(el) {
      const desenhar = () => {
        const chave = `${ano}-${String(mes).padStart(2, '0')}`;
        $('#mesNome', el).textContent = `${MESES[mes - 1]} ${ano}`;
        const doMes = pedidos.filter(o => mesDe(o) === chave);
        const soma = k => doMes.reduce((s, o) => s + (Number(o[k]) || 0), 0);
        const recebido = doMes.reduce((s, o) => s + (o.sinalPago ? o.sinal : 0) + (o.restantePago ? o.restante : 0), 0);
        const faturamento = soma('preco');
        const pendentes = pedidos
          .filter(o => !(o.sinalPago && o.restantePago))
          .sort((a, b) => (a.dataEntrega || '9').localeCompare(b.dataEntrega || '9'));
        const totalPendente = pendentes.reduce((s, o) => s + (o.sinalPago ? 0 : o.sinal) + (o.restantePago ? 0 : o.restante), 0);
        const pct = (v, t) => (t > 0 ? Math.round(v / t * 100) : 0);

        $('#conteudo', el).innerHTML = `
          <div class="metricas">
            <div class="metrica rosa"><div class="rot">Faturamento</div><div class="val">${brl(faturamento)}</div><div class="rot">${doMes.length} pedido(s)</div></div>
            <div class="metrica verde"><div class="rot">Recebido</div><div class="val">${brl(recebido)}</div><div class="barra"><i style="width:${pct(recebido, faturamento)}%"></i></div></div>
            <div class="metrica"><div class="rot">Insumos</div><div class="val">${brl(soma('custoDireto'))}</div></div>
            <div class="metrica"><div class="rot">Energia (indireto)</div><div class="val">${brl(soma('indireto'))}</div></div>
            <div class="metrica rosa"><div class="rot">Seu pró-labore</div><div class="val">${brl(soma('prolabore'))}</div></div>
            <div class="metrica rosa"><div class="rot">Lucro da empresa</div><div class="val">${brl(soma('lucroEmpresa'))}</div></div>
          </div>
          <p class="dica">Pedidos aprovados e entregues, pelo mês da entrega. O valor da energia é o que você deve reservar para a conta de luz.</p>

          <div class="secao-titulo">A receber · ${brl(totalPendente)}</div>
          ${pendentes.length ? `<div class="lista">${pendentes.map(o => `
            <a class="item" href="#/ver/${o.id}">
              <div class="meio">
                <div class="nome">${esc(o.clienteNome)}</div>
                <div class="sub">nº ${numeroOrc(o.numero)} · ${o.dataEntrega ? 'entrega ' + dataBR(o.dataEntrega) : 'sem data'}${o.dataEntrega && o.dataEntrega < hoje ? ' <span class="etiqueta et-alerta">atrasado</span>' : ''}</div>
                <div class="sub">${o.sinalPago ? '<span class="etiqueta et-ok">sinal ok</span>' : `<span class="etiqueta et-alerta">sinal ${brl(o.sinal)}</span>`}
                  ${o.restantePago ? '<span class="etiqueta et-ok">restante ok</span>' : `<span class="etiqueta st-orc">restante ${brl(o.restante)}</span>`}</div>
              </div>
              <div class="dir">${brl((o.sinalPago ? 0 : o.sinal) + (o.restantePago ? 0 : o.restante))}</div>
            </a>`).join('')}</div>` : '<div class="card ok">Tudo recebido.</div>'}
        `;
      };
      $('#ant', el).onclick = () => { mes--; if (mes < 1) { mes = 12; ano--; } desenhar(); };
      $('#prox', el).onclick = () => { mes++; if (mes > 12) { mes = 1; ano++; } desenhar(); };
      desenhar();
    },
  };
}
