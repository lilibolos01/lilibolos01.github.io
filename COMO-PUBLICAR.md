# Como colocar o app LiLi Bolos no celular (grátis)

O app está publicado de graça no **GitHub Pages**, sem mensalidade:

**https://lilibolos01.github.io/**

Ele fica na organização `lilibolos01`, separada dos outros projetos da conta. Os dados (insumos, receitas, orçamentos) ficam **somente no seu celular** e não vão para a internet.

## 1. Instalar no Android

1. Abra **https://lilibolos01.github.io/** no **Chrome** do celular.
2. Toque no menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).
3. Pronto: o ícone da LiLi Bolos aparece na tela inicial e o app abre sem a barra do navegador, **mesmo sem internet**.

## 2. Primeiros passos no app

1. **Configurações** (ícone no topo da tela inicial): confira os dados da empresa e **digite a chave Pix**. Ela não fica no código publicado, só no seu celular.
2. **Insumos e estoque**: toque em *Adicionar insumos comuns* e coloque o preço de cada um (ou cadastre os seus).
3. **Receitas**: os sabores do Instagram já estão lá, marcados como *aguardando receita*. Abra cada um e coloque os ingredientes. Massa: quantas fatias rende. Recheio: quantidade para 1 camada. Cobertura: quantas fatias cobre.
4. **Novo orçamento**: massa e fatias → camadas → recheio de cada camada → cobertura → extras → lucro → *Salvar e gerar PDF* → *Enviar PDF* (abre o WhatsApp).

## 3. Backup (muito importante)

Os dados ficam guardados no Chrome do celular. Se você limpar os dados do Chrome, desinstalar o app ou trocar de celular, eles se perdem.

**Toda semana:** Configurações → **Fazer backup** → salve no Google Drive ou envie para você mesma no WhatsApp.

Para recuperar: instale o app no celular novo → Configurações → **Restaurar** → escolha o arquivo de backup.

## Atualizar o app no futuro

O código está em **github.com/lilibolos01/lilibolos01.github.io**. Para publicar uma versão nova:

1. No arquivo `sw.js`, aumente o número da linha `const VERSAO = 'lili-bolos-v1'` (v2, v3…).
2. Envie os arquivos alterados para o repositório (pelo site do GitHub: *Add file → Upload files*, ou pedindo ao Claude).
3. O celular atualiza sozinho na próxima vez que abrir o app com internet. Os dados guardados no celular não são apagados.
