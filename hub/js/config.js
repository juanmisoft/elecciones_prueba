/* Catálogo de ámbitos y convocatorias históricas (FeatureServices públicos) */
(function (global) {
  const IMG = "../Imagenes";

  const BRAND = {
    PP: { name: "PP", fullName: "Partido Popular", color: "#1d84ce", logo: `${IMG}/PP.png` },
    PSOE: { name: "PSOE", fullName: "Partido Socialista Obrero Español", color: "#ef1c27", logo: `${IMG}/PSOE.png` },
    VOX: { name: "VOX", fullName: "VOX", color: "#63be21", logo: `${IMG}/VOX.png` },
    SUMAR: { name: "Sumar", fullName: "Sumar", color: "#e11d48", logo: `${IMG}/sumar-logo-png_seeklogo-487418.png` },
    PODEMOS: { name: "Podemos", fullName: "Podemos", color: "#6b21a8", logo: `${IMG}/UnidasPodemos.png` },
    UNIDAS_PODEMOS: { name: "Unidas Podemos", fullName: "Unidas Podemos", color: "#6b21a8", logo: `${IMG}/UnidasPodemos.png` },
    PODEMOSIU: { name: "Podemos-IU", fullName: "Podemos-Izquierda Unida", color: "#6b21a8", logo: `${IMG}/UnidasPodemos.png` },
    PODEMOS_IU: { name: "Podemos-IU", fullName: "Podemos-Izquierda Unida", color: "#6b21a8", logo: `${IMG}/UnidasPodemos.png` },
    IU: { name: "IU", fullName: "Izquierda Unida", color: "#7b1fa2", logo: `${IMG}/IU.png` },
    IU_EQUO_MASMADRID: { name: "IU-Equo-Más Madrid", fullName: "Izquierda Unida Rivas-Más Madrid-Verdes Equo", color: "#00a896", logo: `${IMG}/IU.png` },
    MASMADRID: { name: "Más Madrid", fullName: "Más Madrid", color: "#00c39a", logo: `${IMG}/Logo_OITR.png` },
    MAS_PAIS: { name: "Más País", fullName: "Más País", color: "#0d9488", logo: `${IMG}/Logo_OITR.png` },
    CS: { name: "Ciudadanos", fullName: "Ciudadanos-Partido de la Ciudadanía", color: "#fa5000", logo: `${IMG}/Ciudadanos.png` },
    CIUDADANOS: { name: "Ciudadanos", fullName: "Ciudadanos-Partido de la Ciudadanía", color: "#fa5000", logo: `${IMG}/Ciudadanos.png` },
    PACMA: { name: "PACMA", fullName: "Partido Animalista Contra el Maltrato Animal", color: "#16a085", logo: `${IMG}/PACMA.png` },
    SAF: { name: "Se Acabó La Fiesta", fullName: "Se Acabó La Fiesta", color: "#0f172a", logo: `${IMG}/Seacabolafiesta.png` },
    VXR: { name: "Vecinos por Rivas", fullName: "Vecinos por Rivas-Vaciamadrid", color: "#0891b2", logo: `${IMG}/Logo_OITR.png` },
    RIVAS_PUEDE: { name: "Rivas Puede", fullName: "Rivas Puede", color: "#7c3aed", logo: `${IMG}/Logo_OITR.png` },
    CONTIGO: { name: "Contigo", fullName: "Contigo Somos Democracia", color: "#db2777", logo: `${IMG}/Logo_OITR.png` },
    PUMMJ: { name: "PUM+J", fullName: "Por un Mundo Más Justo", color: "#64748b", logo: `${IMG}/Logo_OITR.png` },
    PCTE: { name: "PCTE", fullName: "Partido Comunista de los Trabajadores de España", color: "#b91c1c", logo: `${IMG}/Logo_OITR.png` },
    FO: { name: "Frente Obrero", fullName: "Frente Obrero", color: "#991b1b", logo: `${IMG}/Logo_OITR.png` },
    RECORTES_CERO: { name: "Recortes Cero", fullName: "Recortes Cero", color: "#475569", logo: `${IMG}/Logo_OITR.png` },
    FJONS: { name: "Falange / FE-JONS", fullName: "Falange Española de las JONS", color: "#1e293b", logo: `${IMG}/Logo_OITR.png` },
    FEJONS: { name: "FE-JONS", fullName: "Falange Española de las JONS", color: "#1e293b", logo: `${IMG}/Logo_OITR.png` },
    PFE: { name: "PFE", fullName: "Partido Feminista de España", color: "#334155", logo: `${IMG}/Logo_OITR.png` },
    ULEG: { name: "ULEG", fullName: "Unión por Leganés", color: "#57534e", logo: `${IMG}/Logo_OITR.png` },
    PARTIDO_HUMANISTA: { name: "Partido Humanista", fullName: "Partido Humanista", color: "#a8a29e", logo: `${IMG}/Logo_OITR.png` },
    ASPARTIDO_HUMANISTA: { name: "Partido Humanista", fullName: "Partido Humanista", color: "#a8a29e", logo: `${IMG}/Logo_OITR.png` },
    PH: { name: "Partido Humanista", fullName: "Partido Humanista", color: "#a8a29e", logo: `${IMG}/Logo_OITR.png` },
    P_LIB: { name: "P-LIB", fullName: "Partido Libertario", color: "#f59e0b", logo: `${IMG}/Logo_OITR.png` },
    PCPE: { name: "PCPE", fullName: "Partido Comunista de los Pueblos de España", color: "#7f1d1d", logo: `${IMG}/Logo_OITR.png` },
    PCPE_PCPC: { name: "PCPE", fullName: "Partido Comunista de los Pueblos de España", color: "#7f1d1d", logo: `${IMG}/Logo_OITR.png` },
    PACT: { name: "PACT", fullName: "PACT", color: "#78716c", logo: `${IMG}/Logo_OITR.png` },
    UPYD: { name: "UPyD", fullName: "Unión Progreso y Democracia", color: "#ec4899", logo: `${IMG}/Logo_OITR.png` },
    VOLT: { name: "Volt", fullName: "Volt España", color: "#502379", logo: `${IMG}/Logo_OITR.png` },
    IZQESP: { name: "Izquierda Española", fullName: "Izquierda Española", color: "#be123c", logo: `${IMG}/Logo_OITR.png` },
    JUNTS: { name: "Junts", fullName: "Junts per Catalunya", color: "#00b2e3", logo: `${IMG}/Logo_OITR.png` },
    AR: { name: "Ahora Repúblicas", fullName: "Ahora Repúblicas", color: "#fbbf24", logo: `${IMG}/Logo_OITR.png` },
    CEUS: { name: "CEUS", fullName: "Coalición por una Europa Solidaria", color: "#0080c9", logo: `${IMG}/Logo_OITR.png` },
    C_EUROPA: { name: "Coalición por una Europa Solidaria", fullName: "Coalición por una Europa Solidaria", color: "#2563eb", logo: `${IMG}/Logo_OITR.png` },
    EXISTE: { name: "Existe", fullName: "Existe", color: "#0ea5e9", logo: `${IMG}/Logo_OITR.png` },
    PIRATES: { name: "Piratas", fullName: "Partido Pirata", color: "#000000", logo: `${IMG}/Logo_OITR.png` }
  };

  // fields: "CAMPO_GIS" o ["CAMPO_GIS", "CLAVE_MARCA"]
  function parties(fields) {
    return fields.map((entry) => {
      const field = Array.isArray(entry) ? entry[0] : entry;
      const brandKey = Array.isArray(entry) ? (entry[1] || entry[0]) : entry;
      const brand = BRAND[brandKey] || BRAND[field] || {
        name: String(brandKey).replace(/_/g, " "),
        color: "#64748b",
        logo: `${IMG}/Logo_OITR.png`
      };
      const shortName = brand.name;
      const fullName = brand.fullName || brand.name;
      return {
        field,
        id: brandKey,
        name: shortName,
        fullName,
        color: brand.color,
        logo: brand.logo
      };
    });
  }

  const MUNI_OFICIAL =
    "https://sit.rivasciudad.es/server/rest/services/Municipales_DATOSINTERIOR/FeatureServer";
  const GEN_OFICIAL =
    "https://sit.rivasciudad.es/server/rest/services/Generales_DATOSINTERIOR/FeatureServer";
  const ASA_OFICIAL =
    "https://sit.rivasciudad.es/server/rest/services/Asamble_DATOSINTERIOR/FeatureServer";
  const EUR_OFICIAL =
    "https://sit.rivasciudad.es/server/rest/services/Europeas_DATOSINTERIOR/FeatureServer";

  const TERMINO_URL =
    "https://sit.rivasciudad.es/server/rest/services/Termino_municipal_actual/FeatureServer/0";

  // Censos reutilizables por cruce de sección (cuando la capa de resultados no trae electores)
  const CENSUS_SOURCES = {
    generales_2023: {
      id: "generales_2023",
      label: "censo Generales 2023",
      url: "https://sit.rivasciudad.es/server/rest/services/Generales_DATOSINTERIOR/FeatureServer/0",
      sectionField: "SECCION",
      electorsField: "CENSO"
    },
    europeas_2024: {
      id: "europeas_2024",
      label: "censo Europeas 2024",
      url: `${EUR_OFICIAL}/0`,
      sectionField: "SECCION",
      electorsField: "CENSO"
    }
  };

  const AMBITOS = {
    generales: {
      id: "generales",
      name: "Generales",
      short: "Congreso",
      accent: "#1e3a5f",
      accentSoft: "#dbe7f5",
      blurb: "Resultados en Rivas de las elecciones al Congreso.",
      nextEvent: {
        title: "Próximas elecciones generales",
        dateLabel: "29 de noviembre de 2026",
        ctaLabel: "Abrir visor en vivo",
        ctaHref: "../generales/index.html",
        note: "Participación y escrutinio del Congreso en tiempo real (visor y portal de administración)."
      },
      years: [
        {
          id: "generales-2023",
          year: 2023,
          label: "Generales 2023",
          url: `${GEN_OFICIAL}/0`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PP", "PSOE", "SUMAR", "VOX", "PACMA", "FO",
            ["PUM_J", "PUMMJ"],
            "PCTE",
            ["PH", "PARTIDO_HUMANISTA"],
            "RECORTES_CERO",
            ["FE_DE_LAS_JONS", "FJONS"]
          ])
        },
        {
          id: "generales-2019-nov",
          year: 2019,
          label: "Generales nov. 2019",
          url: `${GEN_OFICIAL}/3`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PSOE",
            ["PODEMOS_IU", "UNIDAS_PODEMOS"],
            "VOX", "PP",
            ["CS", "CIUDADANOS"],
            ["MÁS_PAÍS_EQ", "MAS_PAIS"],
            "PACMA",
            ["RECORTES_CERO_GV_PCAS_TC", "RECORTES_CERO"],
            ["PUM_J", "PUMMJ"],
            "PCPE",
            ["PH", "PARTIDO_HUMANISTA"],
            "PCTE"
          ])
        },
        {
          id: "generales-2019-abril",
          year: 2019,
          label: "Generales abr. 2019",
          url: `${GEN_OFICIAL}/5`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PSOE",
            ["PODEMOS_IU_", "UNIDAS_PODEMOS"],
            ["CS", "CIUDADANOS"],
            "VOX", "PP", "PACMA", "PACT",
            ["RECORTES_CE", "RECORTES_CERO"],
            ["PUM_J", "PUMMJ"],
            ["PH", "PARTIDO_HUMANISTA"],
            "PCPE", "PCTE"
          ])
        },
        {
          id: "generales-2016",
          year: 2016,
          label: "Generales 2016",
          url: `${GEN_OFICIAL}/7`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            ["PODEMOS_IU_EQUO_CLIAS", "UNIDOS_PODEMOS"],
            "PP",
            ["C_S", "CIUDADANOS"],
            "PSOE", "PACMA", "UPYD", "VOX",
            ["RECORTES_CERO_GRUPO_VERDE", "RECORTES_CERO"],
            "PCPE",
            ["FE_DE_LAS_J", "FJONS"],
            ["PH", "PARTIDO_HUMANISTA"],
            "P_LIB", "SAIN"
          ])
        },
        {
          id: "generales-2015",
          year: 2015,
          label: "Generales 2015",
          url: `${GEN_OFICIAL}/9`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PODEMOS",
            ["C_S", "CIUDADANOS"],
            "PP", "PSOE", "IU_UPEC", "UPYD", "PACMA", "VOX",
            ["X_LA_IZQUIE", "X_LA_IZQUIERDA_LV"],
            ["RECORTES_CE", "RECORTES_CERO"],
            ["FE_DE_LAS_J", "FJONS"],
            ["PUM_J", "PUMMJ"],
            "PCPE", "SAIN",
            ["PH", "PARTIDO_HUMANISTA"],
            "P_LIB"
          ])
        }
      ]
    },
    municipales: {
      id: "municipales",
      name: "Municipales",
      short: "Ayuntamiento",
      accent: "#0f5c4c",
      accentSoft: "#d8f3ec",
      blurb: "Elecciones al Ayuntamiento de Rivas Vaciamadrid.",
      nextEvent: {
        title: "Próximas elecciones municipales",
        dateLabel: "23 de mayo de 2027",
        ctaLabel: "Abrir visor en vivo",
        ctaHref: "../municipales/index.html",
        note: "Participación y escrutinio municipal en tiempo real (visor y portal de administración)."
      },
      years: [
        {
          id: "municipales-2023",
          year: 2023,
          label: "Municipales 2023",
          url: `${MUNI_OFICIAL}/0`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          // Filtrar secciones 2024 sin escrutinio 2023
          where: "CENSO IS NOT NULL",
          parties: parties([
            ["IU_MÁSMADRID_EQUO", "IU_EQUO_MASMADRID"],
            "PSOE", "PP",
            ["PODEMOS_AV", "PODEMOS"],
            "VOX", "VXR",
            ["CS", "CIUDADANOS"],
            "CONTIGO"
          ])
        },
        {
          id: "municipales-2019",
          year: 2019,
          label: "Municipales 2019",
          url: `${MUNI_OFICIAL}/1`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            ["IU_RIVAS_EQUO_MAS_MADRID", "IU_EQUO_MASMADRID"],
            "PSOE",
            ["CS", "CIUDADANOS"],
            "PP", "PODEMOS", "VOX", "RIVAS_PUEDE", "PACT", "VXR", "CONTIGO"
          ])
        },
        {
          id: "municipales-2015",
          year: 2015,
          label: "Municipales 2015",
          url: `${MUNI_OFICIAL}/2`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            ["IZQUIERDA_U", "IU_EQUO_SOMOS_RIVAS"],
            ["P_S_O_E", "PSOE"],
            ["P_P", "PP"],
            "RIVAS_PUEDE",
            ["C_S", "CIUDADANOS"],
            "CDR", "AVIVA", "UPYD",
            ["MOVIMIENTO", "MOVIMIENTO_RED"]
          ])
        },
        {
          id: "municipales-2011",
          year: 2011,
          label: "Municipales 2011",
          url: `${MUNI_OFICIAL}/3`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            ["IU_LV", "IU"],
            ["P_P", "PP"],
            ["P_S_O_E", "PSOE"],
            "CDR",
            ["A_I_R_V", "AIRV"],
            ["UPYD", "UPYD"]
          ])
        },
        {
          id: "municipales-2007",
          year: 2007,
          label: "Municipales 2007",
          url: `${MUNI_OFICIAL}/4`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            ["IUCM", "IU"],
            "PP", "PSOE",
            ["CR", "CDR"],
            ["LV_GV", "LV"],
            "UCL"
          ])
        }
      ]
    },
    asamblea: {
      id: "asamblea",
      name: "Asamblea de Madrid",
      short: "Autonómicas",
      accent: "#7a1f2b",
      accentSoft: "#f8e4e7",
      blurb: "Resultados en Rivas de las elecciones a la Asamblea de Madrid.",
      nextEvent: {
        title: "Próximas elecciones autonómicas",
        dateLabel: "Próximamente",
        ctaLabel: null,
        ctaHref: null,
        note: "El histórico ya está disponible abajo."
      },
      years: [
        {
          id: "asamblea-2023",
          year: 2023,
          label: "Asamblea 2023",
          url: `${ASA_OFICIAL}/0`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PP",
            ["MM_VQ", "MASMADRID"],
            "PSOE",
            ["PODEMOS_IU_AV", "PODEMOSIU"],
            "VOX",
            ["CS", "CIUDADANOS"],
            "PACMA",
            ["PUM_J", "PUMMJ"],
            "PFE", "PCTE",
            ["PH", "PARTIDO_HUMANISTA"],
            ["FE_DE_LAS_JONS", "FJONS"],
            "ULEG"
          ])
        },
        {
          id: "asamblea-2021",
          year: 2021,
          label: "Asamblea 2021",
          url: `${ASA_OFICIAL}/3`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PP",
            ["MÁS_MADRID", "MASMADRID"],
            ["P_S_O_E", "PSOE"],
            ["PODEMOS_IU", "UNIDAS_POD"],
            "VOX",
            ["CS", "CIUDADANOS"],
            "PACMA", "PCTE",
            ["PUM_J", "PUMMJ"],
            "VOLT",
            ["RECORTES_CERO_PCAS_TC_GV_M", "RECORTES_CERO"],
            ["PH", "PARTIDO_HUMANISTA"],
            ["FE_DE_LAS_JONS", "FJONS"],
            "P_LIB"
          ])
        },
        {
          id: "asamblea-2019",
          year: 2019,
          label: "Asamblea 2019",
          url: `${ASA_OFICIAL}/5`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PSOE",
            ["MÁS_MADRID", "MASMADRID"],
            ["CS", "CIUDADANOS"],
            ["PODEMOS_IU", "PODEMOSIU"],
            "PP", "VOX", "PACMA", "UPYD", "PCTE",
            ["PUM_J", "PUMMJ"],
            ["PH", "PARTIDO_HUMANISTA"],
            ["FE_DE_LAS_JONS", "FJONS"],
            "P_LIB", "ULEG"
          ])
        }
      ]
    },
    europeas: {
      id: "europeas",
      name: "Europeas",
      short: "Parlamento Europeo",
      accent: "#1d4ed8",
      accentSoft: "#dbeafe",
      blurb: "Resultados en Rivas de las elecciones al Parlamento Europeo.",
      nextEvent: {
        title: "Próximas elecciones europeas",
        dateLabel: "Próximamente",
        ctaLabel: null,
        ctaHref: null,
        note: "Consulta el histórico de participación y resultados en Rivas."
      },
      years: [
        {
          id: "europeas-2024",
          year: 2024,
          label: "Europeas 2024",
          url: `${EUR_OFICIAL}/0`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PSOE", "PP", "SUMAR", "VOX", "PODEMOS",
            ["AGRUPACIÓN_DE_ELECTORES_SE_ACABÓ_LA_FIES", "SAF"],
            ["CS", "CIUDADANOS"],
            "PACMA", "FO", "IZQESP",
            ["AHORA_REPÚBLICAS_ERC_EH_BILDU_BNG_ARA_MÉ", "AR"],
            "PCTE", "VOLT", "RECORTES_CERO",
            ["FE_DE_LAS_JONS", "FEJONS"],
            ["PH", "PARTIDO_HUMANISTA"],
            ["PIRATAS_REBELDES", "PIRATES"],
            ["JUNTS_UE", "JUNTS"],
            ["PCPE_PCPC", "PCPE"],
            "CEUS", "EXISTE"
          ])
        },
        {
          id: "europeas-2019",
          year: 2019,
          label: "Europeas 2019",
          url: `${EUR_OFICIAL}/3`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PSOE",
            ["PODEMOS_IU", "PODEMOS_IU"],
            ["CS", "CIUDADANOS"],
            "PP", "VOX", "PACMA", "PACT",
            ["RECORTES_CERO_LV_GVE", "RECORTES_CERO"],
            ["AHORA_REPÚB", "AR"],
            ["PUM_J", "PUMMJ"],
            "VOLT", "PCTE", "JUNTS",
            ["PIRATES_CAT_EP", "PIRATES"],
            "CEUS",
            ["PH", "PARTIDO_HUMANISTA"],
            "CONTIGO", "SAIN"
          ])
        },
        {
          id: "europeas-2014",
          year: 2014,
          label: "Europeas 2014",
          url: `${EUR_OFICIAL}/5`,
          sectionField: "SECCION",
          electorsField: "CENSO",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          colegioField: "COLEGIO",
          where: "CENSO IS NOT NULL",
          parties: parties([
            "PODEMOS",
            ["IU_LV", "IU"],
            "PSOE",
            ["P_P", "PP"],
            "UPYD",
            ["C_S", "CIUDADANOS"],
            "VOX", "PACMA", "MOVIMIENTO_RED",
            ["PARTIDO_X", "PARTIDOX"],
            ["PIRATAS", "PIRATES"],
            ["P_C_P_E", "PCPE"],
            ["FE_DE_LAS_JONS", "FJONS"],
            "RECORTES_CERO",
            ["PH", "PARTIDO_HUMANISTA"],
            "P_LIB", "SAIN"
          ])
        }
      ]
    }
  };

  // Alias de marca adicionales (campos históricos)
  BRAND.MAS_MADRID = BRAND.MASMADRID;
  BRAND.UNIDAS_POD = BRAND.UNIDAS_PODEMOS;
  BRAND.UNIDOS_PODEMOS = BRAND.UNIDAS_PODEMOS;
  BRAND.PUMJ = BRAND.PUMMJ;
  BRAND.PUM_J = BRAND.PUMMJ;
  BRAND.RECORTES_C = BRAND.RECORTES_CERO;
  BRAND.FE_DE_LA_J = BRAND.FJONS;
  BRAND.CDR = { name: "CDR", fullName: "Centro Democrático y Social / CDR", color: "#64748b", logo: `${IMG}/Logo_OITR.png` };
  BRAND.AIRV = { name: "AIRV", fullName: "Agrupación Independiente de Rivas Vaciamadrid", color: "#0ea5e9", logo: `${IMG}/Logo_OITR.png` };
  BRAND.UPyD = BRAND.UPYD;
  BRAND.RECORTES0 = BRAND.RECORTES_CERO;
  BRAND.PARTIDOX = { name: "Partido X", fullName: "Partido X", color: "#334155", logo: `${IMG}/Logo_OITR.png` };
  BRAND.LV = { name: "Los Verdes", fullName: "Los Verdes", color: "#65a30d", logo: `${IMG}/Logo_OITR.png` };
  BRAND.UCL = { name: "UCL", fullName: "Unión Centrista Liberal", color: "#0369a1", logo: `${IMG}/Logo_OITR.png` };
  BRAND.IU_EQUO_SOMOS_RIVAS = { name: "IU-Equo Somos Rivas", fullName: "IU-Equo Somos Rivas", color: "#00a896", logo: `${IMG}/IU.png` };
  BRAND.AVIVA = { name: "AVIVA", fullName: "AVIVA", color: "#ea580c", logo: `${IMG}/Logo_OITR.png` };
  BRAND.MOVIMIENTO_RED = { name: "Movimiento RED", fullName: "Movimiento RED", color: "#be123c", logo: `${IMG}/Logo_OITR.png` };
  BRAND.IU_UPEC = { name: "IU-UPeC", color: "#7b1fa2", logo: `${IMG}/IU.png` };
  BRAND.X_LA_IZQUIERDA_LV = { name: "Unidad Popular", color: "#9f1239", logo: `${IMG}/Logo_OITR.png` };
  BRAND.SAIN = { name: "SAIn", color: "#57534e", logo: `${IMG}/Logo_OITR.png` };

  // Mapeo sección → colegio (mismo criterio que el escrutinio en vivo)
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

  function normalizeSectionKey(raw) {
    if (raw === undefined || raw === null) return "";
    const text = String(raw).trim();
    if (/^\d+$/.test(text)) return String(parseInt(text, 10)).padStart(3, "0");
    return text.toUpperCase();
  }

  global.HUB_CONFIG = {
    TERMINO_URL,
    CENSUS_SOURCES,
    AMBITOS,
    SECTION_COLEGIO_MAPPING,
    getAmbito(id) {
      return AMBITOS[id] || null;
    },
    getCensusSource(id) {
      return CENSUS_SOURCES[id] || null;
    },
    colegioForSection(sectionRaw) {
      const key = normalizeSectionKey(sectionRaw);
      return SECTION_COLEGIO_MAPPING[key] || null;
    }
  };
})(window);
