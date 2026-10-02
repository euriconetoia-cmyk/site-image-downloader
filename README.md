# Seletor e Baixador de Imagens

Extensão para Chrome e Edge que analisa a página atual, localiza imagens carregadas pelo site, monta uma galeria visual para seleção e permite baixar imagens individualmente, em lote ou todas de uma vez.

## Recursos

- Detecta imagens em `img`, `srcset`, `picture/source`, lazy loading, fundos CSS, metadados sociais e links diretos.
- Procura versões alternativas que o próprio site disponibiliza, incluindo atributos como `data-original`, `data-full`, `data-large-file` e `data-zoom-image`.
- Exibe as imagens encontradas em uma galeria para seleção visual.
- Permite selecionar ou desmarcar imagens individualmente.
- Permite baixar apenas as imagens selecionadas.
- Permite baixar todas as imagens encontradas de uma única vez.
- Pode priorizar a melhor versão encontrada quando o site expõe uma alternativa potencialmente superior.

## Instalação para desenvolvimento

1. Clone ou baixe este repositório.
2. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
3. Ative o Modo do desenvolvedor.
4. Clique em `Carregar sem compactação`.
5. Selecione a pasta raiz deste projeto.
6. Abra uma página e clique no ícone da extensão.

## Como usar

Abra a página que contém as imagens e clique no ícone da extensão. A extensão fará a análise da aba atual e mostrará as imagens encontradas. Selecione as desejadas e use o botão de download das selecionadas ou escolha baixar todas.

## Observação

A extensão apenas identifica e baixa recursos que a própria página disponibiliza ao navegador. A indicação de versão alternativa significa apenas que outra URL ou resolução foi exposta pelo site.

## Versão

Versão atual: 3.0.0
