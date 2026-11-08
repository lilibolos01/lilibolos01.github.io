// Navegação simples por endereço (#/tela/parametro)
import { $, esc, icone } from './ui.js';

const rotas = {};
const pilha = [];

export function registrar(mapa) { Object.assign(rotas, mapa); }

export function ir(destino) { location.hash = destino; }

// Troca a tela atual por outra sem deixar a atual no histórico (ex.: depois de salvar um formulário novo)
export function substituir(destino) {
  pilha.pop();
  location.replace(destino);
}

// Volta para a tela anterior do app (ou para a indicada, se o app acabou de abrir)
export function voltar(padrao = '#/') {
  if (pilha.length > 1) history.back();
  else location.replace(padrao);
}

export async function recarregar() { await desenhar(location.hash || '#/'); }

async function aoMudar() {
  const h = location.hash || '#/';
  if (pilha.length > 1 && pilha[pilha.length - 2] === h) pilha.pop();
  else if (pilha[pilha.length - 1] !== h) pilha.push(h);
  await desenhar(h);
}

async function desenhar(h) {
  const [rota, ...params] = h.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const tela = rotas[rota] || rotas[''];
  const app = $('#app');
  try {
    const r = await tela(...params);
    const inicio = !rota;
    document.body.classList.toggle('na-inicio', inicio);
    $('#titulo').textContent = r.titulo || 'LiLi Bolos';
    document.title = r.titulo ? `${r.titulo} · LiLi Bolos` : 'LiLi Bolos';
    $('#acoes').innerHTML = r.acoes || '';
    $('#btVoltar').onclick = () => voltar(r.voltar || '#/');
    app.innerHTML = r.html;
    if (r.montar) await r.montar(app);
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card aviso">${icone('alerta')} Algo deu errado: ${esc(e.message)}</div>`;
  }
}

export function iniciarNavegacao() {
  window.addEventListener('hashchange', aoMudar);
  aoMudar();
}
