// Ponto de entrada do app LiLi Bolos
import { registrar, iniciarNavegacao } from './nav.js';
import { pedirArmazenamentoPersistente, semearReceitasIniciais } from './db.js';
import { inicio } from './telas/inicio.js';
import { config } from './telas/config.js';
import { listaInsumos, formInsumo } from './telas/insumos.js';
import { listaReceitas, formReceita } from './telas/receitas.js';
import { listaOrcamentos, formOrcamento, verOrcamento } from './telas/orcamentos.js';
import { agenda } from './telas/agenda.js';
import { listaClientes, formCliente } from './telas/clientes.js';
import { financeiro } from './telas/financeiro.js';
import { ranking } from './telas/ranking.js';
import { ofertas } from './telas/ofertas.js';

registrar({
  '': inicio,
  config,
  insumos: listaInsumos,
  insumo: formInsumo,
  receitas: listaReceitas,
  receita: formReceita,
  orcamentos: listaOrcamentos,
  orcamento: formOrcamento,
  ver: verOrcamento,
  agenda,
  clientes: listaClientes,
  cliente: formCliente,
  financeiro,
  ranking,
  ofertas,
});

pedirArmazenamentoPersistente();
semearReceitasIniciais().catch(() => {}).finally(iniciarNavegacao);

// Funciona sem internet depois da primeira abertura
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
