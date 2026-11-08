# Como colocar o app LiLi Bolos no celular (grátis)

O app fica hospedado de graça no **GitHub Pages**. Não tem mensalidade. Os dados (insumos, receitas, orçamentos) ficam **somente no seu celular**, não vão para a internet.

## 1. Criar a conta e o repositório (uma vez só)

1. Acesse **github.com** e crie uma conta gratuita (botão *Sign up*).
2. Clique em **+** (canto de cima) → **New repository**.
3. Nome do repositório: `lili-bolos` · marque **Public** · clique em **Create repository**.

## 2. Enviar os arquivos do app

1. Na página do repositório, clique em **uploading an existing file**.
2. Arraste **somente** estes itens da pasta `D:\LILI bolos`:
   - `index.html`
   - `manifest.webmanifest`
   - `sw.js`
   - as pastas `css`, `js` e `img`
3. Clique em **Commit changes**.

> Não envie as capturas de tela, os logos soltos nem o `PLANO.md`; eles não fazem parte do app.

## 3. Ligar o GitHub Pages

1. No repositório: **Settings** → **Pages** (menu da esquerda).
2. Em *Branch*, escolha **main** e a pasta **/ (root)** → **Save**.
3. Espere uns 2 minutos. O endereço do app vai ser:
   `https://SEU-USUARIO.github.io/lili-bolos/`

## 4. Instalar no Android

1. Abra o endereço no **Chrome** do celular.
2. Toque no menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).
3. Pronto: o ícone da LiLi Bolos aparece na tela inicial e o app abre sem a barra do navegador, **mesmo sem internet**.

## 5. Primeiros passos no app

1. **Configurações** (ícone no topo da tela inicial): confira os dados da empresa e a chave Pix.
2. **Insumos e estoque**: toque em *Adicionar insumos comuns* e coloque o preço de cada um (ou cadastre os seus).
3. **Receitas**: os sabores do Instagram já estão lá, marcados como *aguardando receita*. Abra cada um e coloque os ingredientes. Massa: quantas fatias rende. Recheio: quantidade para 1 camada. Cobertura: quantas fatias cobre.
4. **Novo orçamento**: massa e fatias → camadas → recheio de cada camada → cobertura → extras → lucro → *Salvar e gerar PDF* → *Enviar PDF* (abre o WhatsApp).

## 6. Backup (muito importante)

Os dados ficam guardados no Chrome do celular. Se você limpar os dados do Chrome, desinstalar o app ou trocar de celular, eles se perdem.

**Toda semana:** Configurações → **Fazer backup** → salve no Google Drive ou envie para você mesma no WhatsApp.

Para recuperar: instale o app no celular novo → Configurações → **Restaurar** → escolha o arquivo de backup.

## Atualizar o app no futuro

Quando houver uma versão nova: envie os arquivos alterados para o mesmo repositório (passo 2) e, no arquivo `sw.js`, aumente o número da linha `const VERSAO = 'lili-bolos-v1'` (v2, v3…). O celular atualiza sozinho na próxima vez que abrir o app com internet.
