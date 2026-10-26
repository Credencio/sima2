# SIMA - Sistema de Monitoria de Preços de Produtos Agrícolas

Plataforma web, no estilo de uma bolsa de valores, para acompanhar a evolução dos preços de produtos agrícolas recolhidos com o inquérito Survey123 **Monitoria de Preços de Produtos Agrícolas (SIMA)**. Os dados são lidos em tempo real do Feature Service do ArcGIS Online.

## Funcionalidades

- **Cotações** de todos os produtos: último preço (MZN/kg), variação face ao intervalo anterior e mini-gráfico de tendência.
- **Gráfico de cada produto** em velas, linha ou área, com média móvel de 4 intervalos e barras com o número de registos.
- **Faixa de cotações** a correr no topo da página, como numa bolsa.
- **Preço por mercado**, **maiores subidas e descidas**, **mapa do mercado** por categoria e **últimos registos de preço**.
- **Índice SIMA de preços** (base 100 no início do período).
- **Filtros**: província, mercado, tipo de vendedor, categoria, período (1M, 3M, 6M, 1A, tudo) e intervalo (dia, semana, mês).
- **Boletim semanal** (separador "Boletim semanal" e botão de PDF), no formato do boletim do SIMA:
  - manchete e introdução escritas automaticamente a partir dos dados da semana;
  - "Dinâmica de Preços": para cada produto principal, preço médio da semana contra a semana anterior, máximos e mínimos com os mercados, e um quadro com as variações por mercado;
  - quadro de preços semanais por mercado (mínimo a vermelho, máximo a verde);
  - "Fluxos": proveniência dos produtos por zona (Sul, Centro, Norte);
  - quadros de preço e mudança percentual a nível grossista, produtor e retalhista;
  - quantidades disponíveis no mercado grossista;
  - preços de produtos pecuários em médias mensais por província;
  - vendedores inquiridos por sexo;
  - anexo com gráficos de evolução das últimas 26 semanas e ficha técnica.
  O boletim usa a última semana completa por defeito. Pode escolher a semana, a província, o mercado e o nível de mercado:
  - **um nível** (retalhista, grossista ou produtor): boletim só desse nível;
  - **um mercado**: boletim só desse mercado (com um nível ou com todos);
  - **todos os níveis**: um único PDF com uma parte por nível (Parte I, II, III), cada uma com separador próprio, seguida da informação comum (quantidades, pecuária, anexo e ficha técnica).
- **Sobre o SIMA**: o que é o sistema, como os dados são recolhidos, cobertura actual, metodologia e lista de produtos.
- **Sobre o SIMA**: separador com a descrição do sistema, a recolha de dados, a cobertura actual, a metodologia e a lista de produtos monitorados.
- **Português / Inglês**: o botão PT | EN traduz a interface, os produtos, as categorias e o relatório PDF.

## Estrutura

```
index.html              Página principal
config.js               Configuração (URL do serviço, camadas, idioma, etc.)
assets/css/style.css    Estilos (tema claro e escuro automático)
assets/js/catalog.js    Catálogo de produtos, categorias e códigos (do XLSForm)
assets/js/i18n.js       Textos em português e inglês
assets/js/app.js        Leitura do ArcGIS, cálculos, gráficos e PDF
assets/favicon.svg      Ícone
iniciar-windows.bat     Abre o sistema no computador (Windows)
iniciar-mac-linux.command  Abre o sistema no computador (macOS / Linux)
.nojekyll               Diz ao GitHub Pages para servir os ficheiros tal como estão
.github/workflows/      Publicação automática (opcional)
```

Não há nenhum passo de compilação: são ficheiros estáticos.

## Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (por exemplo `bolsa-precos-sima`).
2. Carregue **todo o conteúdo desta pasta** para a raiz do repositório (botão *Add file → Upload files*, ou `git push`). Inclua a pasta `.github` e o ficheiro `.nojekyll`.
3. Vá a **Settings → Pages** e escolha uma das opções:
   - **Deploy from a branch** → ramo `main`, pasta `/ (root)` → *Save*; ou
   - **GitHub Actions** → o ficheiro `.github/workflows/pages.yml` publica automaticamente a cada alteração.
4. Passados 1 a 2 minutos o site fica disponível em `https://<seu-utilizador>.github.io/<nome-do-repositório>/`.

Com `git`:

```bash
git init
git add .
git commit -m "Bolsa de Preços SIMA"
git branch -M main
git remote add origin https://github.com/<seu-utilizador>/bolsa-precos-sima.git
git push -u origin main
```

## Requisitos do Feature Service

- O serviço configurado em `config.js` tem de estar **partilhado publicamente** (Everyone) e permitir que quem não tem sessão iniciada veja todos os registos.
- Recomenda-se usar uma **vista só de leitura** (sem edição) para o público, em vez da camada original do inquérito.
- Camada `0`: registos de monitoria, com os campos `globalid`, `Provincia`, `Distrito`, `mercado`, `tipo_vendedor` e `data_monitoria`.
- Tabela `1` (`produtos`): `parentglobalid`, `produto`, `categoria`, `disponibilidade`, `preco_medio` (e, em alternativa, `preco_kg1-3`, `preco1-3`, `peso1-3`, `unidade`).
- Os nomes dos campos são lidos sem distinguir maiúsculas e minúsculas.

Para usar outro serviço ou outras camadas, edite `config.js` (`serviceUrl`, `recordsLayer`, `productsTable`).

## Personalizar o boletim

Em `config.js`, na secção `bulletin`:

- `title`, `institution` e `logos`: título, linhas da instituição e logótipos do topo do PDF. Coloque os logótipos (PNG ou JPG) numa pasta do site, por exemplo `assets/logos/`, e indique os caminhos.
- `mainProducts`: os produtos principais analisados no texto (códigos do XLSForm, até 6).
- `level`: nível usado no texto e no quadro semanal (`Retalhista`, `Grossista` ou `Produtor`).
- `stableThreshold`: variação (%) abaixo da qual o preço é considerado estável.
- `numberOffset`: para continuar a numeração dos boletins anteriores.
- `fichaTecnica`: nomes da ficha técnica.

Os preços internacionais (SAFEX, CBOT) e as taxas de câmbio não fazem parte do inquérito, por isso não aparecem no boletim.

## Como os preços são calculados

- **Preço de um registo** (MZN/kg) = média dos campos `preco_kg1`, `preco_kg2` e `preco_kg3` que estiverem preenchidos. Se nenhum estiver preenchido, usa `preco_medio`. Se também não houver, usa a média de `Preço-1`, `Preço-2` e `Preço-3` (`preco1-3`) e o produto aparece em MZN/unidade. Produtos marcados como inexistentes (`disponibilidade = Não`) são ignorados.
- **Velas**: abertura e fecho são as médias do primeiro e do último dia com registos no intervalo; máximo e mínimo são as amostras extremas; o volume é o número de registos.
- **Variação**: fecho do último intervalo face ao fecho do intervalo anterior.
- **Índice SIMA**: em cada intervalo, média de (fecho do produto ÷ primeiro fecho do produto no período) × 100.
- As datas usam a hora de Maputo (UTC+2).

## Testar no computador (antes de publicar)

1. Descompacte o zip numa pasta do seu computador.
2. Inicie o servidor local:
   - **Windows**: duplo clique em `iniciar-windows.bat`.
   - **macOS / Linux**: duplo clique em `iniciar-mac-linux.command` (ou `sh iniciar-mac-linux.command` no terminal).
3. O navegador abre em `http://localhost:8000` com os dados reais do ArcGIS. Para parar, feche a janela do servidor.

Os ficheiros de arranque precisam do Python (no Windows, instale-o em python.org e marque "Add python.exe to PATH"). Sem Python, também pode abrir o `index.html` com duplo clique; na maioria dos navegadores funciona da mesma forma.

### Sem internet

Os dados reais vêm do ArcGIS Online, por isso precisam de internet. Para ver o sistema a funcionar sem ligação, abra-o em modo de demonstração (dados fictícios, assinalados no topo da página):

- `http://localhost:8000/?demo=1`

Sem internet, o relatório PDF e os tipos de letra não carregam, porque vêm de um CDN e do Google Fonts. O resto da página funciona com os tipos de letra do sistema.

## Bibliotecas externas

- [jsPDF 2.5.1](https://github.com/parallax/jsPDF) (via cdnjs) para gerar o PDF.
- Tipos de letra IBM Plex Sans Condensed e IBM Plex Mono (Google Fonts).

Os gráficos são desenhados em canvas, sem bibliotecas adicionais.
