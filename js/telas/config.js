import { lerConfig, salvarConfig, exportarTudo, importarTudo } from '../db.js';
import { $, esc, num, campoNum, toast, icone, compartilharArquivo, hojeISO } from '../ui.js';
import { voltar } from '../nav.js';

export async function config() {
  const c = await lerConfig();
  const campo = (id, rot, val, extra = '') =>
    `<label class="campo"><span>${rot}</span><input id="${id}" value="${esc(val)}" ${extra}></label>`;

  return {
    titulo: 'Configurações',
    html: `
      <form id="form">
        <div class="card">
          <h2>Dados da empresa (vão no PDF)</h2>
          ${campo('empresa', 'Nome', c.empresa)}
          ${campo('telefone', 'WhatsApp', c.telefone, 'inputmode="tel"')}
          ${campo('instagram', 'Instagram', c.instagram)}
          ${campo('endereco', 'Endereço', c.endereco)}
          <div class="linha2">
            ${campo('bairro', 'Bairro', c.bairro)}
            ${campo('cidade', 'Cidade', c.cidade)}
          </div>
          ${campo('pix', 'Chave Pix', c.pix, 'placeholder="CPF, celular, e-mail ou chave aleatória"')}
          ${campo('cnpj', 'CNPJ (opcional)', c.cnpj, 'inputmode="numeric"')}
        </div>

        <div class="card">
          <h2>Valores e prazos</h2>
          <div class="linha3">
            ${campo('sinalPct', 'Sinal (%)', campoNum(c.sinalPct), 'inputmode="decimal"')}
            ${campo('validadeDias', 'Validade (dias)', c.validadeDias, 'inputmode="numeric"')}
            ${campo('indiretoPct', 'Energia (%)', campoNum(c.indiretoPct), 'inputmode="decimal"')}
          </div>
          <small class="dica">O custo indireto (energia elétrica) é somado em cima do custo dos insumos.</small>
        </div>

        <div class="card">
          <h2>Textos do orçamento</h2>
          <label class="campo"><span>Retirada no local</span><textarea id="textoRetirada">${esc(c.textoRetirada)}</textarea></label>
          <label class="campo"><span>Entrega por Uber</span><textarea id="textoUber">${esc(c.textoUber)}</textarea></label>
          <label class="campo"><span>Observação padrão</span><textarea id="obsPadrao">${esc(c.obsPadrao)}</textarea></label>
        </div>

        <button class="bt cheio largo" type="submit">${icone('ok')} Salvar configurações</button>
      </form>

      <div class="card" style="margin-top:14px">
        <h2>${icone('backup')} Cópia de segurança</h2>
        <p class="dica">Faça um backup toda semana. Salve o arquivo no Google Drive ou mande para você mesma no WhatsApp. Se trocar ou perder o celular, é só restaurar.</p>
        <div class="botoes">
          <button class="bt rosa" id="btBackup">${icone('baixar')} Fazer backup</button>
          <button class="bt" id="btRestaurar">${icone('subir')} Restaurar</button>
        </div>
        <input type="file" id="arqRestaurar" accept=".json,application/json" hidden>
        ${c.ultimoBackup ? `<small class="dica">Último backup: ${new Date(c.ultimoBackup).toLocaleString('pt-BR')}</small>` : ''}
      </div>
      <p class="dica" style="text-align:center">LiLi Bolos · versão 1.0</p>
    `,
    montar(el) {
      $('#form', el).onsubmit = async e => {
        e.preventDefault();
        const v = id => $('#' + id, el).value.trim();
        await salvarConfig({
          empresa: v('empresa'), telefone: v('telefone'), instagram: v('instagram'),
          endereco: v('endereco'), bairro: v('bairro'), cidade: v('cidade'),
          pix: v('pix'), cnpj: v('cnpj'),
          sinalPct: num(v('sinalPct')), validadeDias: Math.max(1, Math.round(num(v('validadeDias')))),
          indiretoPct: num(v('indiretoPct')),
          textoRetirada: v('textoRetirada'), textoUber: v('textoUber'), obsPadrao: v('obsPadrao'),
        });
        toast('Configurações salvas');
        voltar('#/');
      };

      $('#btBackup', el).onclick = async () => {
        const dados = await exportarTudo();
        const blob = new Blob([JSON.stringify(dados)], { type: 'application/json' });
        const ok = await compartilharArquivo(blob, `lili-bolos-backup-${hojeISO()}.json`, 'Backup LiLi Bolos');
        if (ok) await salvarConfig({ ultimoBackup: Date.now() });
      };

      const arq = $('#arqRestaurar', el);
      $('#btRestaurar', el).onclick = () => arq.click();
      arq.onchange = async () => {
        const f = arq.files[0];
        if (!f) return;
        try {
          const dados = JSON.parse(await f.text());
          const qtd = (dados.receitas?.length || 0) + ' receitas, ' + (dados.orcamentos?.length || 0) + ' orçamentos';
          if (!confirm(`Restaurar o backup de ${new Date(dados.data).toLocaleString('pt-BR')} (${qtd})?\n\nOs dados atuais deste celular serão substituídos.`)) return;
          await importarTudo(dados);
          toast('Backup restaurado');
          location.hash = '#/';
        } catch (e) {
          alert(e.message || 'Arquivo inválido.');
        }
        arq.value = '';
      };
    },
  };
}
