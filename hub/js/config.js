/* Catálogo de ámbitos y convocatorias históricas (FeatureServices públicos) */
(function (global) {
  const IMG = "../Imagenes";

  const BRAND = {
    PP: { name: "PP", color: "#1d84ce", logo: `${IMG}/PP.png` },
    PSOE: { name: "PSOE", color: "#ef1c27", logo: `${IMG}/PSOE.png` },
    VOX: { name: "VOX", color: "#63be21", logo: `${IMG}/VOX.png` },
    SUMAR: { name: "Sumar", color: "#e11d48", logo: `${IMG}/sumar-logo-png_seeklogo-487418.png` },
    PODEMOS: { name: "Podemos", color: "#6b21a8", logo: `${IMG}/UnidasPodemos.png` },
    UNIDAS_PODEMOS: { name: "Unidas Podemos", color: "#6b21a8", logo: `${IMG}/UnidasPodemos.png` },
    PODEMOSIU: { name: "Podemos-IU", color: "#6b21a8", logo: `${IMG}/UnidasPodemos.png` },
    PODEMOS_IU: { name: "Podemos-IU", color: "#6b21a8", logo: `${IMG}/UnidasPodemos.png` },
    IU: { name: "IU", color: "#7b1fa2", logo: `${IMG}/IU.png` },
    IU_EQUO_MASMADRID: { name: "IU-Equo-Más Madrid", color: "#00a896", logo: `${IMG}/IU.png` },
    MASMADRID: { name: "Más Madrid", color: "#00c39a", logo: `${IMG}/Logo_OITR.png` },
    MAS_PAIS: { name: "Más País", color: "#0d9488", logo: `${IMG}/Logo_OITR.png` },
    CS: { name: "Ciudadanos", color: "#fa5000", logo: `${IMG}/Ciudadanos.png` },
    CIUDADANOS: { name: "Ciudadanos", color: "#fa5000", logo: `${IMG}/Ciudadanos.png` },
    PACMA: { name: "PACMA", color: "#16a085", logo: `${IMG}/PACMA.png` },
    SAF: { name: "Se Acabó La Fiesta", color: "#0f172a", logo: `${IMG}/Seacabolafiesta.png` },
    VXR: { name: "Vecinos por Rivas", color: "#0891b2", logo: `${IMG}/Logo_OITR.png` },
    RIVAS_PUEDE: { name: "Rivas Puede", color: "#7c3aed", logo: `${IMG}/Logo_OITR.png` },
    CONTIGO: { name: "Contigo", color: "#db2777", logo: `${IMG}/Logo_OITR.png` },
    PUMMJ: { name: "PUM+J", color: "#64748b", logo: `${IMG}/Logo_OITR.png` },
    PCTE: { name: "PCTE", color: "#b91c1c", logo: `${IMG}/Logo_OITR.png` },
    FO: { name: "Frente Obrero", color: "#991b1b", logo: `${IMG}/Logo_OITR.png` },
    RECORTES_CERO: { name: "Recortes Cero", color: "#475569", logo: `${IMG}/Logo_OITR.png` },
    FJONS: { name: "Falange / FE-JONS", color: "#1e293b", logo: `${IMG}/Logo_OITR.png` },
    FEJONS: { name: "FE-JONS", color: "#1e293b", logo: `${IMG}/Logo_OITR.png` },
    PFE: { name: "PFE", color: "#334155", logo: `${IMG}/Logo_OITR.png` },
    ULEG: { name: "ULEG", color: "#57534e", logo: `${IMG}/Logo_OITR.png` },
    PARTIDO_HUMANISTA: { name: "Partido Humanista", color: "#a8a29e", logo: `${IMG}/Logo_OITR.png` },
    ASPARTIDO_HUMANISTA: { name: "Partido Humanista", color: "#a8a29e", logo: `${IMG}/Logo_OITR.png` },
    PH: { name: "Partido Humanista", color: "#a8a29e", logo: `${IMG}/Logo_OITR.png` },
    P_LIB: { name: "P-LIB", color: "#f59e0b", logo: `${IMG}/Logo_OITR.png` },
    PCPE: { name: "PCPE", color: "#7f1d1d", logo: `${IMG}/Logo_OITR.png` },
    PCPE_PCPC: { name: "PCPE", color: "#7f1d1d", logo: `${IMG}/Logo_OITR.png` },
    PACT: { name: "PACT", color: "#78716c", logo: `${IMG}/Logo_OITR.png` },
    UPYD: { name: "UPyD", color: "#ec4899", logo: `${IMG}/Logo_OITR.png` },
    VOLT: { name: "Volt", color: "#502379", logo: `${IMG}/Logo_OITR.png` },
    IZQESP: { name: "Izquierda Española", color: "#be123c", logo: `${IMG}/Logo_OITR.png` },
    JUNTS: { name: "Junts", color: "#00b2e3", logo: `${IMG}/Logo_OITR.png` },
    AR: { name: "Ahora Repúblicas", color: "#fbbf24", logo: `${IMG}/Logo_OITR.png` },
    CEUS: { name: "CEUS", color: "#0080c9", logo: `${IMG}/Logo_OITR.png` },
    C_EUROPA: { name: "Coalición por una Europa Solidaria", color: "#2563eb", logo: `${IMG}/Logo_OITR.png` },
    EXISTE: { name: "Existe", color: "#0ea5e9", logo: `${IMG}/Logo_OITR.png` },
    PIRATES: { name: "Piratas", color: "#000000", logo: `${IMG}/Logo_OITR.png` }
  };

  function parties(fields) {
    return fields.map((field) => {
      const brand = BRAND[field] || {
        name: field.replace(/_/g, " "),
        color: "#64748b",
        logo: `${IMG}/Logo_OITR.png`
      };
      return { field, id: field, name: brand.name, color: brand.color, logo: brand.logo };
    });
  }

  const TERMINO_URL =
    "https://sit.rivasciudad.es/server/rest/services/Termino_municipal_actual/FeatureServer/0";

  // Censos reutilizables por cruce de sección (cuando la capa de resultados no trae electores)
  const CENSUS_SOURCES = {
    generales_2023: {
      id: "generales_2023",
      label: "censo Generales 2023",
      url: "https://sit.rivasciudad.es/server/rest/services/V_ELECCIONES_GENERALES2023/FeatureServer/0",
      sectionField: "SECCION",
      electorsField: "N_ELECTORES"
    },
    europeas_2024: {
      id: "europeas_2024",
      label: "censo Europeas 2024",
      url: "https://sit.rivasciudad.es/server/rest/services/V_ELECCIONES_EUROPEAS2024/FeatureServer/0",
      sectionField: "SECCION",
      electorsField: "N_ELECTORES"
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
          year: 2023,
          label: "Generales 2023",
          url: "https://sit.rivasciudad.es/server/rest/services/V_ELECCIONES_GENERALES2023/FeatureServer/0",
          sectionField: "SECCION",
          electorsField: "N_ELECTORES",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: "TOTAL_VOTOS",
          parties: parties([
            "PP", "PSOE", "VOX", "SUMAR", "PACMA", "FO", "PUMMJ", "PCTE",
            "FJONS", "RECORTES_CERO", "ASPARTIDO_HUMANISTA"
          ])
        },
        {
          year: 2019,
          label: "Generales nov. 2019",
          url: "https://sit.rivasciudad.es/server/rest/services/Elecciones_Generales_Noviembre2019/FeatureServer/0",
          sectionField: "SECCION",
          electorsField: null,
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          parties: parties([
            "PSOE", "PP", "CIUDADANOS", "UNIDAS_PODEMOS", "VOX", "MAS_PAIS",
            "PACMA", "PCTE", "PUMMJ", "PCPE", "RECORTES_CERO", "PARTIDO_HUMANISTA", "P_LIB"
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
      blurb: "Elecciones al Ayuntamiento de Rivas-Vaciamadrid.",
      nextEvent: {
        title: "Próximas elecciones municipales",
        dateLabel: "23 de mayo de 2027",
        ctaLabel: "Abrir visor en vivo",
        ctaHref: "../municipales/index.html",
        note: "Participación y escrutinio municipal en tiempo real (visor y portal de administración)."
      },
      years: [
        {
          year: 2023,
          label: "Municipales 2023",
          url: "https://sit.rivasciudad.es/server/rest/services/Elecciones_Municipales_2023/FeatureServer/1",
          sectionField: "SECCION",
          electorsField: null,
          censusSource: "generales_2023",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          parties: parties([
            "IU_EQUO_MASMADRID", "PSOE", "PP", "PODEMOS", "VOX", "VXR", "CIUDADANOS", "CONTIGO"
          ])
        },
        {
          year: 2019,
          label: "Municipales 2019",
          url: "https://sit.rivasciudad.es/server/rest/services/MAPA_VOTOSMUNI_AYTO19/FeatureServer/0",
          sectionField: "SECCION",
          electorsField: null,
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          parties: parties([
            "IU_EQUO_MASMADRID", "PSOE", "PP", "CIUDADANOS", "PODEMOS", "VOX",
            "RIVAS_PUEDE", "VXR", "PACT", "CONTIGO"
          ])
        },
        {
          year: 2011,
          label: "Municipales 2011",
          url: "https://services5.arcgis.com/OvtDsNt9TdkMlaCZ/arcgis/rest/services/Elecciones_Municipales_2011/FeatureServer/0",
          sectionField: "Contenido",
          electorsField: "ELEC_POTEN",
          blankField: "BLANCOS",
          nullField: null,
          totalVotesField: "VOTOS",
          parties: [] // se rellena tras definir aliases de marca
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
          year: 2023,
          label: "Asamblea 2023",
          url: "https://sit.rivasciudad.es/server/rest/services/Elecciones_Municipales_2023/FeatureServer/0",
          sectionField: "SECCION",
          electorsField: null,
          censusSource: "generales_2023",
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          parties: parties([
            "MASMADRID", "PSOE", "PODEMOSIU", "PP", "VOX", "CIUDADANOS",
            "PACMA", "PCTE", "PUMMJ", "PFE", "ULEG", "PARTIDO_HUMANISTA", "FJONS"
          ])
        },
        {
          year: 2019,
          label: "Asamblea 2019",
          url: "https://sit.rivasciudad.es/server/rest/services/MAPA_VOTOSMUNI_ASAMB19/FeatureServer/0",
          sectionField: "SECCION",
          electorsField: null,
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          parties: parties([
            "MASMADRID", "PSOE", "PODEMOSIU", "PP", "CIUDADANOS", "VOX",
            "PACMA", "PCTE", "PUMMJ", "UPYD", "PARTIDO_HUMANISTA", "P_LIB", "FJONS"
          ])
        },
        {
          year: 2021,
          label: "Asamblea 2021",
          url: "https://services5.arcgis.com/OvtDsNt9TdkMlaCZ/arcgis/rest/services/ELECCIONES_ASAMBLEA_MADRID2021/FeatureServer/0",
          sectionField: "SECCION",
          electorsField: null,
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          parties: parties([
            "MAS_MADRID", "PSOE", "PP", "VOX", "UNIDAS_POD", "CIUDADANOS",
            "PACMA", "PCTE", "PUMJ", "VOLT", "RECORTES_C", "PH", "FE_DE_LA_J"
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
          year: 2024,
          label: "Europeas 2024",
          url: "https://sit.rivasciudad.es/server/rest/services/V_ELECCIONES_EUROPEAS2024/FeatureServer/0",
          sectionField: "SECCION",
          electorsField: "N_ELECTORES",
          blankField: "BLANCOS",
          nullField: "NULOS",
          totalVotesField: "TOTAL_VOTOS",
          parties: parties([
            "PSOE", "PP", "SUMAR", "PODEMOS", "VOX", "SAF", "CS", "PACMA",
            "IZQESP", "FO", "AR", "JUNTS", "PCTE", "VOLT", "RECORTES_CERO", "FEJONS", "PH", "PIRATES"
          ])
        },
        {
          year: 2019,
          label: "Europeas 2019",
          url: "https://sit.rivasciudad.es/server/rest/services/MAPA_VOTOSMUNI_EUROPEAS19/FeatureServer/0",
          sectionField: "SECCION",
          electorsField: null,
          blankField: "BLANCO",
          nullField: "NULO",
          totalVotesField: null,
          parties: parties(["PSOE", "PODEMOS_IU", "CIUDADANOS", "VOX", "PP"])
        },
        {
          year: 2014,
          label: "Europeas 2014",
          url: "https://services5.arcgis.com/OvtDsNt9TdkMlaCZ/arcgis/rest/services/elecciones_europeas_2014/FeatureServer/0",
          sectionField: "SECCIONES",
          electorsField: "N_ELECTORES",
          blankField: null,
          nullField: null,
          totalVotesField: "TOTAL_VOTOS",
          parties: parties([
            "PP", "PSOE", "PODEMOS", "IU", "UPYD", "CIUDADANOS", "VOX", "PACMA",
            "PCPE", "PH", "FJONS", "PARTIDOX", "RECORTES0"
          ])
        }
      ]
    }
  };

  // Fix municipales 2011 parties cleanly
  AMBITOS.municipales.years.find((y) => y.year === 2011).parties = parties([
    "IU", "PP", "PSOE", "CDR", "AIRV", "UPyD"
  ]);

  // Asamblea 2021 brand aliases not in BRAND
  BRAND.MAS_MADRID = BRAND.MASMADRID;
  BRAND.UNIDAS_POD = BRAND.UNIDAS_PODEMOS;
  BRAND.PUMJ = BRAND.PUMMJ;
  BRAND.RECORTES_C = BRAND.RECORTES_CERO;
  BRAND.FE_DE_LA_J = BRAND.FJONS;
  BRAND.CDR = { name: "CDR", color: "#64748b", logo: `${IMG}/Logo_OITR.png` };
  BRAND.AIRV = { name: "AIRV", color: "#0ea5e9", logo: `${IMG}/Logo_OITR.png` };
  BRAND.UPyD = BRAND.UPYD;
  BRAND.RECORTES0 = BRAND.RECORTES_CERO;
  BRAND.PARTIDOX = { name: "Partido X", color: "#334155", logo: `${IMG}/Logo_OITR.png` };

  // Rebuild asamblea 2021 and muni 2011 parties after alias fixes
  AMBITOS.asamblea.years.find((y) => y.year === 2021).parties = parties([
    "MAS_MADRID", "PSOE", "PP", "VOX", "UNIDAS_POD", "CIUDADANOS",
    "PACMA", "PCTE", "PUMJ", "VOLT", "RECORTES_C", "PH", "FE_DE_LA_J"
  ]);
  AMBITOS.municipales.years.find((y) => y.year === 2011).parties = parties([
    "IU", "PP", "PSOE", "CDR", "AIRV", "UPyD"
  ]);

  global.HUB_CONFIG = {
    TERMINO_URL,
    CENSUS_SOURCES,
    AMBITOS,
    getAmbito(id) {
      return AMBITOS[id] || null;
    },
    getCensusSource(id) {
      return CENSUS_SOURCES[id] || null;
    }
  };
})(window);
