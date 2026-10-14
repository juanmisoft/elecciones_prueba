// Mapeo unificado de Secciones Censales a Colegios Electorales en Rivas Vaciamadrid
const CENSUS_2023 = {
  "001": 1983, "002": 979, "003": 894, "004": 1536, "005": 1197,
  "006": 1527, "007": 1202, "008": 915, "009": 1321, "010": 980,
  "011": 794, "012": 1131, "013": 1403, "014": 1403, "015": 1367,
  "016": 1715, "017": 1930, "018": 756, "019": 1079, "020": 1193,
  "021": 2007, "022": 1137, "023": 1542, "024": 1276, "025": 1420,
  "026": 1123, "027": 733, "028": 691, "029": 1376, "030": 1768,
  "031": 1047, "032": 1597, "033": 1715, "034": 1429, "035": 1351,
  "036": 2318, "037": 1304, "038": 1090, "039": 2188, "040": 880,
  "041": 1477, "042": 1011, "043": 1063, "044": 1165, "045": 1063,
  "046": 1376, "047": 1398, "048": 900, "049": 1071, "050": 702,
  "051": 1615, "052": 1165, "053": 966, "054": 1083, "055": 1370,
  "056": 1200, "057": 1300, "058": 1400
};

const SECTION_COLEGIO_MAPPING = {
  "001": "C.E.I.P. LAS CIGUEÑAS",
  "002": "C.E.I.P. LA ESCUELA",
  "003": "C.E.I.P. EL OLIVAR",
  "004": "I.E.S. LAS LAGUNAS",
  "005": "C.E.I.P. VICTORIA KENT",
  "006": "C.E.I.P. JARAMA",
  "007": "C.E.I.P. EL OLIVAR",
  "008": "C.E.I.P. LOS ALMENDROS",
  "009": "I.E.S. LAS LAGUNAS",
  "010": "C.E.I.P. LA ESCUELA",
  "011": "I.E.S. LAS LAGUNAS",
  "012": "C.E.I.P. VICTORIA KENT",
  "013": "C.E.I.P. RAFAEL ALBERTI",
  "014": "C.E.I.P. LOS ALMENDROS",
  "015": "I.E.S. LAS LAGUNAS",
  "016": "C.E.I.P. LAS CIGUEÑAS",
  "017": "C.E.I.P. JOSE SARAMAGO",
  "018": "C.E.I.P. JARAMA",
  "019": "C.E.I.P. JOSE SARAMAGO",
  "020": "C.E.I.P. DULCE CHACON",
  "021": "C.E.I.P. RAFAEL ALBERTI",
  "022": "C.E.I.P. JOSE HIERRO",
  "023": "C.E.I.P. HANS CHRISTIAN ANDERSEN",
  "024": "C.E.I.P. LAS CIGUEÑAS",
  "025": "C.E.I.P. DULCE CHACON",
  "026": "C.E.I.P. EL OLIVAR",
  "027": "C.E.I.P. EL OLIVAR",
  "028": "C.E.I.P. VICTORIA KENT",
  "029": "C.E.I.P. JOSE HIERRO",
  "030": "C.E.I.P. JOSE ITURZAETA",
  "031": "C.E.I.P. LAS CIGUEÑAS",
  "032": "C.E.I.P. JOSE SARAMAGO",
  "033": "C.E.I.P. HANS CHRISTIAN ANDERSEN",
  "034": "C.E.I.P. JOSE ITURZAETA",
  "035": "C.E.I.P. HANS CHRISTIAN ANDERSEN",
  "036": "C.E.I.P. JOSE ITURZAETA",
  "037": "C.E.I.P.S.O LA LUNA",
  "038": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA",
  "039": "C.E.I.P. DULCE CHACON",
  "040": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA",
  "041": "C.E.I.P. DULCE CHACON",
  "042": "C.E.I.P. LOS ALMENDROS",
  "043": "C.E.I.P. JOSE SARAMAGO",
  "044": "C.E.I.P. JOSE HIERRO",
  "045": "C.E.I.P.S.O LA LUNA",
  "046": "C.E.I.P. JOSE HIERRO",
  "047": "C.E.I.P. HANS CHRISTIAN ANDERSEN",
  "048": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA",
  "049": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA",
  "050": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA",
  "051": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA",
  "052": "C.E.I.P.S.O LA LUNA",
  "053": "C.E.I.P.S.O LA LUNA",
  "054": "C.E.I.P. JOSE ITURZAETA",
  "055": "C.E.I.P. HANS CHRISTIAN ANDERSEN",
  "056": "C.E.I.P. RAFAEL ALBERTI",
  "057": "C.E.I.P. JOSE ITURZAETA",
  "058": "C.E.I.P. DULCE CHACON"
};

const COLEGIO_DETAILS = {
  "C.E.I.P. LAS CIGUEÑAS": {
    image: "../Imagenes/las-ciguenas.png",
    address: "Calle Noruega, 1, 28521 Rivas Vaciamadrid"
  },
  "C.E.I.P. LA ESCUELA": {
    image: "../Imagenes/la-escuela.png",
    address: "Avenida de Miguel Hernández, 1, 28523 Rivas Vaciamadrid"
  },
  "C.E.I.P. EL OLIVAR": {
    image: "../Imagenes/el-olivar.png",
    address: "Avenida de Covibar, 3, 28523 Rivas Vaciamadrid"
  },
  "I.E.S. LAS LAGUNAS": {
    image: "../Imagenes/LAS_LAGUNAS.png",
    address: "Avenida de Gabriel García Márquez, s/n, 28523 Rivas Vaciamadrid"
  },
  "C.E.I.P. VICTORIA KENT": {
    image: "../Imagenes/victroria-kent.png",
    address: "Paseo de la Chopera, 7, 28523 Rivas Vaciamadrid"
  },
  "C.E.I.P. JARAMA": {
    image: "../Imagenes/ceip_jarama.png",
    address: "Calle del Olivo, s/n, 28522 Rivas Vaciamadrid"
  },
  "C.E.I.P. LOS ALMENDROS": {
    image: "../Imagenes/los-almendros.png",
    address: "Avenida de los Almendros, 198, 28522 Rivas Vaciamadrid"
  },
  "C.E.I.P. RAFAEL ALBERTI": {
    image: "../Imagenes/rafael-alberti.png",
    address: "Paseo de las Provincias, s/n, 28523 Rivas Vaciamadrid"
  },
  "C.E.I.P. JOSE SARAMAGO": {
    image: "../Imagenes/jose-saramago.png",
    address: "Calle de José Saramago, 1, 28522 Rivas Vaciamadrid"
  },
  "C.E.I.P. DULCE CHACON": {
    image: "../Imagenes/dulce-chacon.png",
    address: "Calle Federica Montseny, 3, 28521 Rivas Vaciamadrid"
  },
  "C.E.I.P. JOSE HIERRO": {
    image: "../Imagenes/JoseHierro.jpg",
    address: "Avenida de José Hierro, 86, 28521 Rivas Vaciamadrid"
  },
  "C.E.I.P. HANS CHRISTIAN ANDERSEN": {
    image: "../Imagenes/hans-christian-andersen.png",
    address: "Calle de Fernando Trueba, 8, 28521 Rivas Vaciamadrid"
  },
  "C.E.I.P. JOSE ITURZAETA": {
    image: "../Imagenes/jose-iturzaeta.png",
    address: "Calle Bernardo Atxaga, 13, 28521 Rivas Vaciamadrid"
  },
  "C.E.I.P.S.O LA LUNA": {
    image: "../Imagenes/ceipso-la-luna.jpg",
    address: "Avenida de la Tierra, 6, 28523 Rivas Vaciamadrid"
  },
  "CIUDAD EDUCATIVA MUNICIPAL HIPATIA": {
    image: "../Imagenes/planeta-rivashipatia_JML934.jpg",
    address: "Avenida del Ocho de Marzo, 1, 28523 Rivas Vaciamadrid"
  }
};

// Catálogo inicial Congreso (ampliable desde administración; se sincroniza a GDB como __PARTIES_GEN__)
const DEFAULT_PARTIES_CONFIG = [
  {
    id: "PP",
    name: "PP",
    color: "#1d84ce",
    logo: "../Imagenes/logos/generales/PP.png",
    field: "votos_pp"
  },
  {
    id: "PSOE",
    name: "PSOE",
    color: "#ef1c27",
    logo: "../Imagenes/logos/generales/PSOE.png",
    field: "votos_psoe"
  },
  {
    id: "VOX",
    name: "VOX",
    color: "#63be21",
    logo: "../Imagenes/logos/generales/VOX.png",
    field: "votos_vox"
  },
  {
    id: "SUMAR",
    name: "Sumar",
    color: "#e11d48",
    logo: "../Imagenes/logos/generales/sumar-logo-png_seeklogo-487418.png",
    field: "votos_sumar"
  },
  {
    id: "PODEMOS",
    name: "Podemos",
    color: "#6b21a8",
    logo: "../Imagenes/logos/generales/UnidasPodemos.png",
    field: "votos_podemos"
  },
  {
    id: "CS",
    name: "Ciudadanos",
    color: "#fa5000",
    logo: "../Imagenes/logos/generales/Ciudadanos.png",
    field: "votos_cs"
  },
  {
    id: "PACMA",
    name: "PACMA",
    color: "#16a085",
    logo: "../Imagenes/logos/generales/PACMA.png",
    field: "votos_pacma"
  },
  {
    id: "SAF",
    name: "Se Acabó La Fiesta",
    color: "#0f172a",
    logo: "../Imagenes/logos/generales/Seacabolafiesta.png",
    field: "votos_saf"
  },
  {
    id: "FO",
    name: "Frente Obrero",
    color: "#991b1b",
    logo: "../Imagenes/logos/generales/FO.png",
    field: "votos_fo"
  },
  {
    id: "PCTE",
    name: "PCTE",
    color: "#b91c1c",
    logo: "../Imagenes/logos/generales/PCTE.png",
    field: "votos_pcte"
  },
  {
    id: "PUMMJ",
    name: "PUM+J",
    color: "#64748b",
    logo: "../Imagenes/logos/generales/Logo_OITR.png",
    field: "votos_pummj"
  },
  {
    id: "RECORTES_CERO",
    name: "Recortes Cero",
    color: "#475569",
    logo: "../Imagenes/logos/generales/Logo_OITR.png",
    field: "votos_recortes_cero"
  },
  {
    id: "FJONS",
    name: "FE-JONS",
    color: "#1e293b",
    logo: "../Imagenes/logos/generales/Logo_OITR.png",
    field: "votos_fjons"
  },
  {
    id: "PH",
    name: "Partido Humanista",
    color: "#a8a29e",
    logo: "../Imagenes/logos/generales/Logo_OITR.png",
    field: "votos_ph"
  },
  {
    id: "PCPE",
    name: "PCPE",
    color: "#7f1d1d",
    logo: "../Imagenes/logos/generales/Logo_OITR.png",
    field: "votos_pcpe"
  },
  {
    id: "VOLT",
    name: "Volt",
    color: "#502379",
    logo: "../Imagenes/logos/generales/VOLT.svg",
    field: "votos_volt"
  },
  {
    id: "IZQESP",
    name: "Izquierda Española",
    color: "#be123c",
    logo: "../Imagenes/logos/generales/IZQESP2.png",
    field: "votos_izqesp"
  }
];

// Vacío hasta leer/escribir el Feature __PARTIES_GEN__. DEFAULT_PARTIES_CONFIG es solo plantilla.
let PARTIES_CONFIG = [];

