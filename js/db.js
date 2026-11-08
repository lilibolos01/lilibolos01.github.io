// Banco de dados local (IndexedDB) — tudo fica guardado no próprio celular.
const NOME = 'lilibolos';
const VERSAO = 1;
export const TABELAS = ['insumos', 'receitas', 'clientes', 'orcamentos', 'config'];

export const CONFIG_PADRAO = {
  id: 'geral',
  empresa: 'LiLi Bolos',
  slogan: 'feito com amor, para você',
  telefone: '(51) 98551-2756',
  instagram: '@lili.bolos01',
  endereco: 'Rua Pedro José Mauricio, 1278',
  bairro: 'Vila Elza',
  cidade: 'Viamão - RS',
  pix: '', // preenchido no celular, em Configurações (não fica no código público)
  cnpj: '',
  sinalPct: 30,
  validadeDias: 7,
  indiretoPct: 5,
  textoRetirada: 'Retirada no local, no endereço da LiLi Bolos, no dia e horário combinados.',
  textoUber: 'A coleta/entrega é por conta do cliente. Se preferir, podemos chamar um Uber para levar o bolo até você, e a corrida é paga pelo cliente.',
  obsPadrao: '',
  ultimoNumero: 0,
};

let conexao;
function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((ok, erro) => {
    const r = indexedDB.open(NOME, VERSAO);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const t of TABELAS) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
  return conexao;
}

function pedido(tabela, modo, acao) {
  return abrir().then(db => new Promise((ok, erro) => {
    const t = db.transaction(tabela, modo);
    const req = acao(t.objectStore(tabela));
    t.oncomplete = () => ok(req && 'result' in req ? req.result : undefined);
    t.onerror = () => erro(t.error);
    t.onabort = () => erro(t.error);
  }));
}

export const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const todos = tabela => pedido(tabela, 'readonly', s => s.getAll());
export const buscar = (tabela, id) => pedido(tabela, 'readonly', s => s.get(id));
export const apagar = (tabela, id) => pedido(tabela, 'readwrite', s => s.delete(id));

export async function salvar(tabela, obj) {
  if (!obj.id) { obj.id = novoId(); obj.criado = Date.now(); }
  obj.atualizado = Date.now();
  await pedido(tabela, 'readwrite', s => s.put(obj));
  return obj;
}

export async function salvarVarios(tabela, lista) {
  await pedido(tabela, 'readwrite', s => { for (const o of lista) s.put(o); });
}

export const OBS_ANTIGA = 'A data só fica reservada após o pagamento do sinal.';

export async function lerConfig() {
  const c = await buscar('config', 'geral');
  const cfg = { ...CONFIG_PADRAO, ...(c || {}) };
  // A frase antiga do sinal saiu do orçamento
  if (cfg.obsPadrao === OBS_ANTIGA) cfg.obsPadrao = '';
  return cfg;
}

export async function salvarConfig(c) {
  return salvar('config', { ...(await lerConfig()), ...c, id: 'geral' });
}

export async function proximoNumero() {
  const c = await lerConfig();
  const n = (c.ultimoNumero || 0) + 1;
  await salvarConfig({ ultimoNumero: n });
  return n;
}

// Backup: exporta tudo (inclusive fotos) em um único objeto
export async function exportarTudo() {
  const dados = { app: 'lili-bolos', versao: 1, data: new Date().toISOString() };
  for (const t of TABELAS) dados[t] = await todos(t);
  return dados;
}

export async function importarTudo(dados) {
  if (!dados || dados.app !== 'lili-bolos') throw new Error('Este arquivo não é um backup do app LiLi Bolos.');
  for (const t of TABELAS) {
    await pedido(t, 'readwrite', s => s.clear());
    if (Array.isArray(dados[t])) await salvarVarios(t, dados[t]);
  }
}

// Receitas iniciais (sabores do Instagram), só com o nome, aguardando os ingredientes
const RECEITAS_INICIAIS = [
  ['massa', 'Massa branca'],
  ['massa', 'Massa de chocolate'],
  ['recheio', 'Prestígio'],
  ['recheio', 'Morango com nata'],
  ['recheio', 'Creme belga com abacaxi'],
  ['recheio', 'Morango com mousse de nata'],
  ['recheio', 'Nata com morango'],
  ['recheio', 'Brigadeiro, nozes e Ovomaltine crocante'],
  ['recheio', 'Brigadeiro branco com Ovomaltine crocante'],
  ['recheio', 'Mousse de dois brigadeiros com Ovomaltine'],
  ['recheio', 'Morango, nata e mousse de chocolate'],
  ['recheio', 'Paçoca'],
  ['cobertura', 'Merengue suíço'],
];

export async function semearReceitasIniciais() {
  const c = await lerConfig();
  if (c.receitasIniciais) return;
  if (!(await todos('receitas')).length) {
    await salvarVarios('receitas', RECEITAS_INICIAIS.map(([tipo, nome]) => ({
      id: novoId(), tipo, nome, fatias: 20, itens: [], foto: '', preparo: '', criado: Date.now(),
    })));
  }
  await salvarConfig({ receitasIniciais: true });
}

// Pede ao Android para não apagar os dados do app quando faltar espaço
export function pedirArmazenamentoPersistente() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
