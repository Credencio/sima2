/*
 * Configuração da Bolsa de Preços SIMA
 * Edite este ficheiro para apontar para outro Feature Service ou mudar o comportamento.
 */
window.SIMA_CONFIG = {
  // URL do Feature Service do Survey123 (serviço original do inquérito) — sem "/0" ou "/1" no fim
  serviceUrl: "https://services8.arcgis.com/Yb7xytb4Ff2eEN6Y/arcgis/rest/services/survey123_0d443ec186c543a49c921fe2becbbdfb_results/FeatureServer",

  // Camada com os registos de monitoria (província, mercado, data…) — liga por "globalid"
  recordsLayer: 0,

  // (Opcional) Serviço de onde ler a camada de registos, se for diferente do serviceUrl. Deixe "" para usar o mesmo.
  recordsServiceUrl: "",

  // Se a camada de registos vier vazia, o sistema tenta estes serviços (vistas do mesmo inquérito, com os mesmos globalid)
  recordsFallbackUrls: [
    "https://services8.arcgis.com/Yb7xytb4Ff2eEN6Y/arcgis/rest/services/Monitoria_de_Pre%C3%A7os_de_Produtos_Agr%C3%ADcolas_(SIMA)_2_ViewLayer/FeatureServer",
    "https://services8.arcgis.com/Yb7xytb4Ff2eEN6Y/arcgis/rest/services/Monitoria_de_Pre%C3%A7os_de_Produtos_Agr%C3%ADcolas_(SIMA)_2_2_view/FeatureServer"
  ],

  // Tabela repetida "produtos" (preços) — liga por "parentglobalid"
  productsTable: 1,

  // Idioma inicial: "pt" ou "en" (o utilizador pode mudar no botão PT | EN)
  defaultLang: "pt",

  // Se o serviço não responder, mostrar dados de demonstração (true) ou só uma mensagem de erro (false)
  demoFallback: false,


  // Tempo máximo de espera pelo ArcGIS (milissegundos)
  timeoutMs: 30000,

  /* ---------------- Separador "Sobre o SIMA" ---------------- */
  about: {
    // Contactos mostrados no separador "Sobre" (deixe [] para não mostrar). Ex.: [{ label: "Email", value: "sima@exemplo.gov.mz" }]
    contacts: [],
    // Endereço de uma página web institucional (opcional)
    website: ""
  },

  // Desenvolvedor (rodapé do site e última página do boletim)
  developer: { name: "MRV - Unidade de Monitoria, Relatório e Verificação do REDD+", logo: "assets/logos/mrv.png" },

  /* ---------------- Boletim semanal (ecrã e PDF) ---------------- */
  bulletin: {
    // Título do boletim (aparece no topo da 1.ª página do PDF)
    title: "Boletim Semanal de Preços",
    titleEn: "Weekly Price Bulletin",

    // Linhas da instituição por baixo do título (deixe [] para não mostrar). Exemplo:
    // institution: ["Ministério da Agricultura - Departamento de Estatística", "Tel: 8x xxx xxxx · Email: sima@exemplo.gov.mz"],
    institution: [],

    // Logótipos no topo do PDF (ficheiros PNG ou JPG dentro da pasta do site), da esquerda para a direita. Ex.: ["assets/logos/governo.png"]
    logos: ["assets/logos/emblema.png"],

    // Produtos principais analisados no texto e no quadro de preços semanais (códigos do XLSForm, até 6).
    // Os que não tiverem registos na semana são substituídos pelos produtos com mais registos.
    mainProducts: ["Milho_Branco", "Arroz_sem_casca", "Feijao_Nhemba", "Feijao_Manteiga", "Amendoim_Pequeno", "Amendoim_Grande"],

    // Nível de mercado usado no texto e no quadro de preços semanais: "Retalhista", "Grossista" ou "Produtor"
    level: "Retalhista",

    // Variação (%) abaixo da qual o preço é considerado estável
    stableThreshold: 2,

    // Número do boletim = número da semana do ano + este valor (ex.: 1229 para continuar a numeração antiga)
    numberOffset: 0,

    // Ficha técnica no fim do PDF (só aparecem as funções com nomes)
    fichaTecnica: [
      { role: "Edição", names: ["SIMA - Sistema de Monitoria de Preços de Produtos Agrícolas"] },
      { role: "Direcção", names: [] },
      { role: "Coordenação", names: [] },
      { role: "Gestão de conteúdos e Base de Dados", names: [] },
      { role: "Recolha e Entrada dos Dados", names: [] },
      { role: "Maquetização", names: [] }
    ]
  }
};
