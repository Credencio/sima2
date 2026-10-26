"use strict";
/* Catálogo de referência (do XLSForm SIMA): categorias, produtos, tipos de vendedor */
const CATS = {
  "Cereais":["Cereais","Cereals"],"Leguminosas":["Leguminosas","Pulses"],"Oliogenosas":["Oleaginosas","Oilseeds"],
  "Tuberculos":["Tubérculos","Roots & tubers"],"Outras Culturas":["Outras culturas","Other crops"],"Amendoas":["Amêndoas","Nuts"],
  "Horticolas":["Hortícolas","Vegetables"],"Frutas":["Frutas","Fruits"],"Pecuaria":["Pecuária","Livestock"],
  "Outros Produtos Processados":["Processados","Processed"]
};
// code, PT, EN, category, ticker
const PRODS = [
["Milho_Branco","Milho Branco","White maize","Cereais","MLBR"],["Milho_Amarelo","Milho Amarelo","Yellow maize","Cereais","MLAM"],
["Arroz_com_casca","Arroz com casca","Paddy rice","Cereais","ARCC"],["Arroz_sem_casca","Arroz sem casca","Milled rice","Cereais","ARSC"],
["Trigo","Trigo","Wheat","Cereais","TRGO"],["Mapira","Mapira","Sorghum","Cereais","MAPR"],["Mexoeira","Mexoeira","Pearl millet","Cereais","MEXO"],
["Feijao_Nhemba","Feijão Nhemba","Cowpea","Leguminosas","FJNH"],["Feijao_Manteiga","Feijão Manteiga","Butter bean","Leguminosas","FJMT"],
["Feijao_Boer","Feijão Bóer","Pigeon pea","Leguminosas","FJBO"],["Feijao_Holoco","Feijão Holoco","Mung bean","Leguminosas","FJHL"],
["Feijão_Verde","Feijão Verde","Green bean","Leguminosas","FJVD"],
["Gergelim_(Branco)","Gergelim (Branco)","Sesame (white)","Oliogenosas","GRGB"],["Gergelim_(Preto)","Gergelim (Preto)","Sesame (black)","Oliogenosas","GRGP"],
["Soja","Soja","Soybean","Oliogenosas","SOJA"],["Amendoim_Pequeno","Amendoim Pequeno","Groundnut (small)","Oliogenosas","AMDP"],
["Amendoim_Grande","Amendoim Grande","Groundnut (large)","Oliogenosas","AMDG"],["Girassol","Girassol","Sunflower","Oliogenosas","GIRS"],
["Algodão","Algodão","Cotton","Oliogenosas","ALGD"],
["Mandioca_Seca","Mandioca Seca","Dried cassava","Tuberculos","MDSC"],["Mandioca_Fresca","Mandioca Fresca","Fresh cassava","Tuberculos","MDFR"],
["Batata_Doce","Batata Doce","Sweet potato","Tuberculos","BTDC"],["Batata_Reno","Batata Reno","Irish potato","Tuberculos","BTRN"],
["Cenoura","Cenoura","Carrot","Tuberculos","CENR"],["Cebola","Cebola","Onion","Tuberculos","CEBL"],
["Alho_Fino","Alho Fino","Garlic (fine)","Tuberculos","ALHF"],["Alho_Grosso","Alho Grosso","Garlic (large)","Tuberculos","ALHG"],
["Sisal","Sisal","Sisal","Outras Culturas","SISL"],["Cha","Chá","Tea","Outras Culturas","CHA"],["Café","Café","Coffee","Outras Culturas","CAFE"],
["Tabaco","Tabaco","Tobacco","Outras Culturas","TABC"],["Canda_de_Açucar","Cana-de-açúcar","Sugarcane","Outras Culturas","CANA"],
["Piri_Piri","Piri-piri","Chilli","Outras Culturas","PIRI"],
["Castanha_de_Caju","Castanha de Caju","Cashew nut","Amendoas","CAJU"],["Macadamia","Macadâmia","Macadamia","Amendoas","MCDM"],
["Tomate","Tomate","Tomato","Horticolas","TOMT"],["Pimenta_Verde","Pimento Verde","Green pepper","Horticolas","PMVD"],
["Repolho","Repolho","Cabbage","Horticolas","RPLH"],["Pepino","Pepino","Cucumber","Horticolas","PEPN"],
["Banana","Banana","Banana","Frutas","BANA"],["Manga","Manga","Mango","Frutas","MANG"],["Ananas","Ananás","Pineapple","Frutas","ANAN"],
["Laranja","Laranja","Orange","Frutas","LARJ"],["Limão","Limão","Lemon","Frutas","LIMA"],["Tangerina","Tangerina","Tangerine","Frutas","TANG"],
["Coco","Coco","Coconut","Frutas","COCO"],["Abacate","Abacate","Avocado","Frutas","ABAC"],["Litchi","Litchi","Lychee","Frutas","LTCH"],
["Morango","Morango","Strawberry","Frutas","MRNG"],["Papaia","Papaia","Papaya","Frutas","PAPA"],
["Ovo","Ovo","Egg","Pecuaria","OVO"],["Frango_Vivo","Frango Vivo","Live broiler","Pecuaria","FRGV"],["Frango_Congelado","Frango Congelado","Frozen chicken","Pecuaria","FRGC"],
["Galinha","Galinha","Village hen","Pecuaria","GALN"],["Cabrito","Cabrito","Goat","Pecuaria","CABR"],["Ovelha","Ovelha","Sheep","Pecuaria","OVLH"],
["Porco","Porco","Pig","Pecuaria","PORC"],["Boi","Boi","Cattle","Pecuaria","BOI"],["Carne_de_Cabrito","Carne de Cabrito","Goat meat","Pecuaria","CCAB"],
["Carne_de_Porco","Carne de Porco","Pork","Pecuaria","CPOR"],["Carne_de_Vaca_1a","Carne de Vaca 1.ª","Beef (1st grade)","Pecuaria","CVA1"],
["Carne_de_Vaca_2a","Carne de Vaca 2.ª","Beef (2nd grade)","Pecuaria","CVA2"],
["Farinha_de_Milho_Branca","Farinha de Milho Branca","White maize meal","Outros Produtos Processados","FMBR"],
["Oleo","Óleo Alimentar","Cooking oil","Outros Produtos Processados","OLEO"],["Açúcar_Castanho","Açúcar Castanho","Brown sugar","Outros Produtos Processados","ACUC"]
];
const PROD = {}; const norm = s => String(s??"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
const PROD_BY_NORM = {};
PRODS.forEach(p=>{PROD[p[0]]={code:p[0],pt:p[1],en:p[2],cat:p[3],tk:p[4]}; PROD_BY_NORM[norm(p[0])]=p[0]; PROD_BY_NORM[norm(p[1])]=p[0];});
const SELLERS = {"Produtor":["Produtor","Producer"],"Retalhista":["Retalhista","Retailer"],"Grossista":["Grossista","Wholesaler"]};
