// Lógica del Cuadro de Mando de Elecciones - Rivas Vaciamadrid
// Integración con ArcGIS Maps SDK y Visualización de Métricas de Datos

require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/Graphic",
  "esri/layers/GraphicsLayer",
  "esri/symbols/PictureMarkerSymbol",
  "esri/symbols/TextSymbol",
  "esri/widgets/Home",
  "esri/Basemap",
  "esri/layers/TileLayer"
], function(Map, MapView, FeatureLayer, Graphic, GraphicsLayer, PictureMarkerSymbol, TextSymbol, Home, Basemap, TileLayer) {

  // Mapeo de diccionarios de censo histórico para resolución dinámica
  const CENSUS_MAPS = {
    CENSUS_2023: typeof CENSUS_2023 !== 'undefined' ? CENSUS_2023 : {},
    CENSUS_2019_NOV: typeof CENSUS_2019_NOV !== 'undefined' ? CENSUS_2019_NOV : {},
    CENSUS_2019_ABR: typeof CENSUS_2019_ABR !== 'undefined' ? CENSUS_2019_ABR : {},
    CENSUS_2019_MUNI: typeof CENSUS_2019_MUNI !== 'undefined' ? CENSUS_2019_MUNI : {},
    CENSUS_2015_MUNI: typeof CENSUS_2015_MUNI !== 'undefined' ? CENSUS_2015_MUNI : {}
  };

  // ==========================================================================
  // ESTADO GLOBAL DE LA APLICACIÓN
  // ==========================================================================
  let currentScope = "generales";
  let currentYearA = "2023";
  let currentYearB = "2019_nov";
  let isComparisonMode = false;
  let activeTab = "general-stats";
  
  // Caché local de features para mejorar rendimiento y evitar re-consultas
  const featuresCache = {};
  
  // Elementos del Mapa de ArcGIS
  let mapA, mapB;
  let viewA, viewB;
  let layerA, layerB;
  let labelsLayerA, labelsLayerB;
  
  // Guardamos las referencias a los watchers de sincronización para poder activarlos/desactivarlos
  let syncWatchers = [];

  // Estado del Configurador Dinámico de Bloques
  let currentLeftBlock = [];
  let currentRightBlock = [];
  let currentAggregatedData = null;
  let currentAggregatedDataOlder = null;
  let currentConfigActive = null;
  let currentConfigOlder = null;
  let isComparisonModeActive = false;

  // Elementos del DOM
  const scopeSelect = document.getElementById("scopeSelect");
  const yearSelect = document.getElementById("yearSelect");
  const compareYearSelect = document.getElementById("compareYearSelect");
  const compareYearSelectorGroup = document.getElementById("compareYearSelectorGroup");
  const compareToggleBtn = document.getElementById("compareToggleBtn");
  
  const singleMapContainer = document.getElementById("singleMapContainer");
  const compareMapContainer = document.getElementById("compareMapContainer");
  const mapLoader = document.getElementById("mapLoader");
  
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");
  
  const modal = document.getElementById("colegioDetailModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  
  const colegioSearchInput = document.getElementById("colegioSearchInput");

  // ==========================================================================
  // INICIALIZACIÓN DE LA APLICACIÓN
  // ==========================================================================
  function init() {
    // 1. Inicializar los Mapas de ArcGIS
    initMaps();
    
    // 2. Poblar los selectores de año según el ámbito por defecto
    updateYearSelectors();
    
    // 3. Vincular eventos de la interfaz
    setupEventListeners();
    
    // 4. Cargar datos iniciales
    loadElectionData();
  }

  // Inicializa los mapas y vistas principales
  function initMaps() {
    // Definimos el mapa base personalizado usando el MapServer de Rivas
    const customBasemapA = new Basemap({
      baseLayers: [
        new TileLayer({
          url: "https://sit.rivasciudad.es/server/rest/services/Hosted/MAPAPROYECTO_GRIS/MapServer"
        })
      ],
      title: "Rivas Gris",
      id: "rivas_gris_a"
    });

    const customBasemapB = new Basemap({
      baseLayers: [
        new TileLayer({
          url: "https://sit.rivasciudad.es/server/rest/services/Hosted/MAPAPROYECTO_GRIS/MapServer"
        })
      ],
      title: "Rivas Gris B",
      id: "rivas_gris_b"
    });

    // Mapa Principal (A)
    mapA = new Map({
      basemap: customBasemapA
    });
    
    labelsLayerA = new GraphicsLayer({ id: "labelsLayerA" });
    mapA.add(labelsLayerA);

    // Creamos la vista en el contenedor de un solo mapa por defecto
    viewA = new MapView({
      container: "mapViewDiv",
      map: mapA,
      center: [-3.532, 40.347], // Centrado en Rivas Vaciamadrid (desplazado un poco al norte)
      zoom: 12.8,
      constraints: {
        snapToZoom: false
      },
      popup: {
        defaultPopupTemplateEnabled: false,
        dockEnabled: true,
        dockOptions: {
          buttonEnabled: false,
          breakpoint: false,
          position: "top-right"
        }
      }
    });

    const homeA = new Home({
      view: viewA
    });
    viewA.ui.add(homeA, "top-left");

    // Vista B (Para modo Comparación)
    mapB = new Map({
      basemap: customBasemapB
    });
    
    labelsLayerB = new GraphicsLayer({ id: "labelsLayerB" });
    mapB.add(labelsLayerB);

    viewB = new MapView({
      map: mapB,
      center: [-3.532, 40.347], // Desplazado un poco al norte
      zoom: 12.8,
      constraints: {
        snapToZoom: false
      },
      popup: {
        defaultPopupTemplateEnabled: false,
        dockEnabled: true,
        dockOptions: {
          buttonEnabled: false,
          breakpoint: false,
          position: "top-right"
        }
      }
    });

    const homeB = new Home({
      view: viewB
    });
    viewB.ui.add(homeB, "top-left");
  }

  // ==========================================================================
  // GESTIÓN DE EVENTOS
  // ==========================================================================
  function setupEventListeners() {
    // Cambio de Ámbito Electoral (Generales, Municipales, etc.)
    scopeSelect.addEventListener("change", function(e) {
      currentScope = e.target.value;
      updateYearSelectors();
      loadElectionData();
    });

    // Cambio de Año Principal
    yearSelect.addEventListener("change", function(e) {
      currentYearA = e.target.value;
      if (isComparisonMode) {
        // Re-poblar compareYearSelect para mostrar solo años anteriores al nuevo año seleccionado
        const filtered = ELECTIONS_CONFIG.filter(cfg => cfg.scope === currentScope);
        const idxA = filtered.findIndex(cfg => cfg.year === currentYearA);
        const olderYears = filtered.slice(idxA + 1);
        
        compareYearSelect.innerHTML = "";
        olderYears.forEach((item, idx) => {
          const opt = document.createElement("option");
          opt.value = item.year;
          opt.textContent = item.label;
          if (idx === 0) {
            opt.selected = true;
            currentYearB = item.year;
          }
          compareYearSelect.appendChild(opt);
        });
      }
      loadElectionData();
    });

    // Cambio de Año Comparativo
    compareYearSelect.addEventListener("change", function(e) {
      currentYearB = e.target.value;
      loadElectionData();
    });

    // Activar/Desactivar Modo Comparación
    compareToggleBtn.addEventListener("click", toggleComparisonMode);

    // Navegación de Pestañas de la Barra Lateral
    tabBtns.forEach(btn => {
      btn.addEventListener("click", function() {
        const targetTab = this.getAttribute("data-tab");
        switchTab(targetTab);
      });
    });

    // Búsqueda de Colegios Electorales
    colegioSearchInput.addEventListener("input", function(e) {
      filterColegiosList(e.target.value);
    });

    // Cerrar Modal
    closeModalBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
    
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });

    // Toggle de la interfaz de la calculadora de pactos / configuración de bloques
    const toggleBlocksConfigBtn = document.getElementById("toggleBlocksConfigBtn");
    const blocksConfigurator = document.getElementById("blocksConfigurator");
    if (toggleBlocksConfigBtn && blocksConfigurator) {
      toggleBlocksConfigBtn.addEventListener("click", function() {
        this.classList.toggle("active");
        blocksConfigurator.classList.toggle("hidden");
      });
    }
  }

  // Cambia el selector de años dinámicamente según el ámbito y el modo comparación
  function updateYearSelectors() {
    // Filtrar elecciones del ámbito actual
    const filtered = ELECTIONS_CONFIG.filter(e => e.scope === currentScope);
    
    // Vaciar selectores
    yearSelect.innerHTML = "";
    compareYearSelect.innerHTML = "";
    
    if (isComparisonMode) {
      // En modo comparación, el selector principal (Año Posterior) no incluye el más antiguo
      const mainYears = filtered.slice(0, -1);
      
      // Si currentYearA no es válido o es el más antiguo, lo forzamos al más reciente
      if (!mainYears.some(e => e.year === currentYearA)) {
        currentYearA = mainYears[0]?.year || "";
      }
      
      mainYears.forEach((e) => {
        const opt = document.createElement("option");
        opt.value = e.year;
        opt.textContent = e.label;
        if (e.year === currentYearA) {
          opt.selected = true;
        }
        yearSelect.appendChild(opt);
      });
      
      // El selector comparativo (Año Anterior) solo muestra años estrictamente anteriores
      const idxA = filtered.findIndex(e => e.year === currentYearA);
      const olderYears = filtered.slice(idxA + 1);
      
      // Si currentYearB no es válido para este nuevo conjunto de años anteriores, seleccionamos el primero
      if (!olderYears.some(e => e.year === currentYearB)) {
        currentYearB = olderYears[0]?.year || "";
      }
      
      olderYears.forEach((e) => {
        const opt = document.createElement("option");
        opt.value = e.year;
        opt.textContent = e.label;
        if (e.year === currentYearB) {
          opt.selected = true;
        }
        compareYearSelect.appendChild(opt);
      });
    } else {
      // Si currentYearA no es válido para este nuevo ámbito, lo forzamos al más reciente (el primero de la lista)
      if (!filtered.some(e => e.year === currentYearA)) {
        currentYearA = filtered[0]?.year || "";
      }
      
      // Modo normal: todos los años disponibles en yearSelect
      filtered.forEach((e, idx) => {
        const opt = document.createElement("option");
        opt.value = e.year;
        opt.textContent = e.label;
        if (e.year === currentYearA) {
          opt.selected = true;
        }
        yearSelect.appendChild(opt);
      });
    }
  }

  // Alterna entre Vista Única y Modo Comparativo
  function toggleComparisonMode() {
    isComparisonMode = !isComparisonMode;
    
    const yearLabel = document.getElementById("yearLabel");
    const compareYearLabel = document.getElementById("compareYearLabel");

    if (isComparisonMode) {
      // Activar interfaz
      compareToggleBtn.classList.add("active");
      compareToggleBtn.querySelector("span").textContent = "Ver Un Solo Año";
      compareYearSelectorGroup.classList.remove("hidden");
      
      if (yearLabel) yearLabel.innerHTML = `<i class="fa-solid fa-calendar-days"></i> Año Posterior`;
      if (compareYearLabel) compareYearLabel.innerHTML = `<i class="fa-solid fa-code-compare"></i> Año Anterior`;

      // Mover viewA a su contenedor split
      viewA.container = "mapViewDivA";
      viewB.container = "mapViewDivB";
      
      singleMapContainer.classList.remove("active");
      compareMapContainer.classList.add("active");
      
      // Sincronizar navegación entre mapas
      syncMapViews();
      
      // Mostrar métricas de comparación en Tab 3
      document.querySelector('[data-tab="advanced-metrics"]').classList.remove("hidden");
    } else {
      // Desactivar interfaz
      compareToggleBtn.classList.remove("active");
      compareToggleBtn.querySelector("span").textContent = "Comparar Años";
      compareYearSelectorGroup.classList.add("hidden");
      
      if (yearLabel) yearLabel.innerHTML = `<i class="fa-solid fa-calendar-days"></i> Año`;

      // Retornar viewA a su contenedor único
      viewA.container = "mapViewDiv";
      
      singleMapContainer.classList.add("active");
      compareMapContainer.classList.remove("active");
      
      // Detener sincronización
      unsyncMapViews();
    }
    
    // Actualizar selectores para filtrar según el modo
    updateYearSelectors();
    
    // Recargar datos
    loadElectionData();
  }

  // Sincroniza el punto de vista (extensión y zoom) de ambos mapas
  function syncMapViews() {
    unsyncMapViews(); // Limpia previos

    let isSyncing = false;

    const sync = (source, target) => {
      const watcher = source.watch("viewpoint", function(value) {
        if (isSyncing) return;
        if (!value) return;
        isSyncing = true;
        target.viewpoint = value.clone();
        // Rompemos bucles asíncronos encolando la liberación de la bandera
        setTimeout(() => {
          isSyncing = false;
        }, 0);
      });
      syncWatchers.push(watcher);
    };

    sync(viewA, viewB);
    sync(viewB, viewA);
  }

  function unsyncMapViews() {
    syncWatchers.forEach(w => w.remove());
    syncWatchers = [];
  }

  // Cambia de pestaña activa en el panel lateral
  function switchTab(tabId) {
    activeTab = tabId;
    tabBtns.forEach(btn => {
      if (btn.getAttribute("data-tab") === tabId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === tabId) {
        pane.classList.add("active");
      } else {
        pane.classList.remove("active");
      }
    });
  }

  // ==========================================================================
  // CARGA Y RENDERIZADO DE CAPAS Y DATOS
  // ==========================================================================
  function loadElectionData() {
    mapLoader.classList.remove("hidden");

    // Buscar configuración de la elección principal (A)
    const configA = ELECTIONS_CONFIG.find(e => e.scope === currentScope && e.year === currentYearA);
    
    if (isComparisonMode) {
      const configB = ELECTIONS_CONFIG.find(e => e.scope === currentScope && e.year === currentYearB);
      
      // Actualizar títulos de mapas: izquierda anterior, derecha posterior
      document.getElementById("mapTitleA").textContent = `${configB.label} (Año Anterior)`;
      document.getElementById("mapTitleB").textContent = `${configA.label} (Año Posterior)`;
      
      // Cargar capas: configB (antigua) en mapA (izq), configA (reciente) en mapB (der)
      Promise.all([
        loadLayerAndFeatures(configB, mapA, viewA, labelsLayerA, "A"),
        loadLayerAndFeatures(configA, mapB, viewB, labelsLayerB, "B")
      ]).then(([featuresOlder, featuresNewer]) => {
        // Calcular agregados de comparación (featuresNewer es A, featuresOlder es B)
        updateComparisonDashboard(featuresNewer, featuresOlder, configA, configB);
        mapLoader.classList.add("hidden");
      }).catch(err => {
        console.error("Error cargando mapas comparativos:", err);
        mapLoader.classList.add("hidden");
      });
    } else {
      // Modo Mapa Único
      loadLayerAndFeatures(configA, mapA, viewA, labelsLayerA, "A").then(featuresA => {
        // Calcular agregados individuales
        updateSingleDashboard(featuresA, configA);
        mapLoader.classList.add("hidden");
      }).catch(err => {
        console.error("Error cargando mapa único:", err);
        mapLoader.classList.add("hidden");
      });
    }
  }

  // Carga una capa FeatureLayer, define su estilo, y recupera sus features para análisis
  function loadLayerAndFeatures(config, map, view, labelsLayer, labelId) {
    return new Promise((resolve, reject) => {
      // 1. Quitar capa anterior si existe
      const oldLayer = map.findLayerById("electionsLayer");
      if (oldLayer) {
        map.remove(oldLayer);
      }
      
      labelsLayer.removeAll();

      // 2. Diseñar Renderer dinámico basado en Arcade para integridad de colores
      const uniqueValueInfos = config.parties.map(p => ({
        value: p.id,
        symbol: {
          type: "simple-fill",
          color: p.color,
          outline: {
            color: [255, 255, 255, 0.9],
            width: 1.2
          },
          style: "solid"
        },
        label: `Gana ${p.name}`
      }));
      
      // Caso de empate / sin datos
      uniqueValueInfos.push({
        value: "OTROS",
        symbol: {
          type: "simple-fill",
          color: [180, 180, 180, 0.55],
          outline: {
            color: [255, 255, 255, 0.9],
            width: 1.2
          },
          style: "solid"
        },
        label: "Otros / Empate"
      });

      // Arcade para hallar qué columna de partido tiene el máximo valor
      const valueExpression = `
        var fields = [${config.parties.map(p => `$feature.${p.field}`).join(",")}];
        var names = [${config.parties.map(p => `'${p.id}'`).join(",")}];
        var max_val = -1;
        var max_idx = -1;
        for (var i = 0; i < Count(fields); i++) {
          var val = Number(fields[i]);
          if (val > max_val) {
            max_val = val;
            max_idx = i;
          }
        }
        if (max_val <= 0) return 'OTROS';
        return names[max_idx];
      `;

      const renderer = {
        type: "unique-value",
        valueExpression: valueExpression,
        uniqueValueInfos: uniqueValueInfos
      };

      // 3. Crear Popup dinámico personalizado en el cliente
      const popupTemplate = {
        title: function(featureInfo) {
          const graphic = featureInfo.graphic || featureInfo;
          const attrs = graphic.attributes;
          const seccionFieldVal = attrs[config.seccionField || "SECCION"];
          const seccionCode = normalizeSeccion(seccionFieldVal);
          const colName = config.colegioField && attrs[config.colegioField] ? attrs[config.colegioField] : (SECTION_COLEGIO_MAPPING[seccionCode] || "Colegio Electoral");
          return `${colName} (Sección ${seccionCode})`;
        },
        content: function(featureInfo) {
          const attrs = featureInfo.graphic.attributes;
          const seccionFieldVal = attrs[config.seccionField || "SECCION"];
          const seccionCode = normalizeSeccion(seccionFieldVal);
          
          const colName = config.colegioField && attrs[config.colegioField] ? attrs[config.colegioField] : (SECTION_COLEGIO_MAPPING[seccionCode] || "Colegio Electoral");
          
          const details = COLEGIO_DETAILS[colName];
          const localImg = details?.image;
          const onlineUrl = details?.webUrl;
          const address = details?.address || "Rivas-Vaciamadrid, Madrid";
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(colName + ", " + address)}`;

          let imageHtml = "";
          if (localImg || onlineUrl) {
            imageHtml = `
              <div style="width:100%; height:110px; border-radius:6px; overflow:hidden; margin-bottom:10px; position:relative; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                <img src="${localImg || onlineUrl}" style="width:100%; height:100%; object-fit:cover; filter:brightness(1.2) contrast(1.05);" />
              </div>
            `;
          }

          let totalV = 0;
          if (config.votosField && attrs[config.votosField]) {
            totalV = attrs[config.votosField];
          } else {
            config.parties.forEach(p => { totalV += Number(attrs[p.field] || 0); });
            if (config.blancoField && attrs[config.blancoField]) totalV += Number(attrs[config.blancoField] || 0);
          }
          
          let electores = 0;
          if (config.electoresField && attrs[config.electoresField]) {
            electores = attrs[config.electoresField];
          } else {
            const censusObj = config.censusProxy ? CENSUS_MAPS[config.censusProxy] : CENSUS_MAPS.CENSUS_2023;
            electores = (censusObj && censusObj[seccionCode]) || 0;
          }
          
          const partPct = electores > 0 ? ((totalV / electores) * 100).toFixed(2) : "0.00";
          
          let html = `
            <div class="popup-custom" style="font-family:'Outfit',sans-serif; color:#0f172a; font-size:12px; line-height:1.5; width:100%; min-width:280px; box-sizing:border-box;">
              ${imageHtml}
              <div style="font-size:11px; color:#475569; margin-bottom:10px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; border-bottom:1px solid rgba(0,0,0,0.06); padding-bottom:8px;">
                <i class="fa-solid fa-location-dot" style="color:#e30613; font-size:12px;"></i>
                <span style="flex:1; min-width:150px; line-height:1.4;">${address}</span>
                <a href="${mapsUrl}" target="_blank" style="margin-left:auto; color:#e30613; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600;">
                  <i class="fa-solid fa-route"></i> Llegar
                </a>
              </div>
              <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:11px;">
                <tr style="border-bottom:1px solid rgba(0,0,0,0.08); font-weight:600; color:#475569;">
                  <td style="padding:3px 0;">Indicador</td>
                  <td style="text-align:right; padding:3px 0;">Valor</td>
                </tr>
                <tr>
                  <td style="padding:3px 0; color:#475569;">Censo Sección</td>
                  <td style="text-align:right; padding:3px 0; font-weight:600; color:#0f172a;">${electores.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0; color:#475569;">Votos Totales</td>
                  <td style="text-align:right; padding:3px 0; font-weight:600; color:#0f172a;">${totalV.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding:3px 0; color:#475569;">Participación</td>
                  <td style="text-align:right; padding:3px 0; font-weight:600; color:#f59e0b;">${partPct}%</td>
                </tr>
              </table>
              <div style="font-weight:600; margin-bottom:6px; font-size:10px; text-transform:uppercase; color:#475569; letter-spacing:0.5px; border-bottom:1px dashed rgba(0,0,0,0.08); padding-bottom:3px;">Desglose de Partidos</div>
              <div style="display:flex; flex-direction:column; gap:5px;">
          `;

          // Ordenar partidos por votos obtenidos en esta sección
          const sorted = [...config.parties].sort((x, y) => {
            const vx = Number(attrs[x.field] || 0);
            const vy = Number(attrs[y.field] || 0);
            return vy - vx;
          });

          sorted.forEach(p => {
            const v = Number(attrs[p.field] || 0);
            const pPct = totalV > 0 ? ((v / totalV) * 100).toFixed(2) : "0.00";
            html += `
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:10px; height:10px; border-radius:50%; background-color:${p.color}; flex-shrink:0;"></div>
                <div style="font-weight:500;">${p.name}</div>
                <div style="margin-left:auto; text-align:right; font-weight:600; color:#0f172a;">
                  ${v.toLocaleString()} <span style="font-size:10px; font-weight:400; color:#475569;">(${pPct}%)</span>
                </div>
              </div>
            `;
          });

          // Agregar voto en blanco si aplica
          if (config.blancoField && attrs[config.blancoField] !== undefined) {
            const vb = Number(attrs[config.blancoField] || 0);
            const pbPct = totalV > 0 ? ((vb / totalV) * 100).toFixed(2) : "0.00";
            html += `
              <div style="display:flex; align-items:center; gap:8px; border-top:1px solid rgba(0,0,0,0.04); padding-top:4px; margin-top:2px;">
                <div style="width:10px; height:10px; border-radius:50%; background-color:#7f8c8d; flex-shrink:0;"></div>
                <div style="color:#475569;">En Blanco</div>
                <div style="margin-left:auto; text-align:right; font-weight:500; color:#475569;">
                  ${vb.toLocaleString()} <span style="font-size:10px; font-weight:400; color:#64748b;">(${pbPct}%)</span>
                </div>
              </div>
            `;
          }

          html += `</div></div>`;
          const cDiv = document.createElement("div");
          cDiv.innerHTML = html;
          return cDiv;
        }
      };

      // 4. Crear la capa de ArcGIS
      const newLayer = new FeatureLayer({
        id: "electionsLayer",
        url: config.url,
        renderer: renderer,
        outFields: ["*"],
        popupTemplate: popupTemplate,
        opacity: 0.72
      });

      map.add(newLayer);
      // Reordenar la capa de etiquetas para que quede siempre arriba de la capa de parcelas
      map.reorder(labelsLayer, map.layers.length - 1);

      // 5. Cargar las geometrías y atributos en cliente para agregación e iconos
      // Comprobar si ya están en caché local
      if (featuresCache[config.id]) {
        renderWinnerLabels(featuresCache[config.id], config, labelsLayer);
        resolve(featuresCache[config.id]);
      } else {
        const query = newLayer.createQuery();
        query.where = "1=1";
        query.outFields = ["*"];
        query.returnGeometry = true;
        
        newLayer.queryFeatures(query).then(results => {
          featuresCache[config.id] = results.features;
          renderWinnerLabels(results.features, config, labelsLayer);
          resolve(results.features);
        }).catch(err => {
          reject(err);
        });
      }
    });
  }

  // Agrega los iconos del partido ganador en el centro de cada polígono
  function renderWinnerLabels(features, config, labelsLayer) {
    labelsLayer.removeAll();
    
    features.forEach(feature => {
      const geom = feature.geometry;
      const attrs = feature.attributes;
      if (!geom) return;

      // Calcular centroide del polígono
      let centroid = geom.centroid;
      if (!centroid) {
        centroid = getFallbackCentroid(geom);
      }
      if (!centroid) return;

      // Calcular ganador en esta sección
      let maxVotes = -1;
      let winnerParty = null;

      config.parties.forEach(p => {
        const v = Number(attrs[p.field] || 0);
        if (v > maxVotes) {
          maxVotes = v;
          winnerParty = p;
        }
      });

      if (maxVotes <= 0 || !winnerParty) return;

      let symbol;
      if (winnerParty.logo) {
        // PictureMarkerSymbol para logotipos de partidos
        symbol = new PictureMarkerSymbol({
          url: winnerParty.logo,
          width: "20px",
          height: "20px"
        });
      } else {
        // Fallback: TextSymbol elegante con la inicial en un fondo de color
        symbol = new TextSymbol({
          text: winnerParty.name.substring(0, 2),
          color: "#ffffff",
          haloColor: winnerParty.color,
          haloSize: "2.5px",
          font: {
            size: 9.5,
            family: "Outfit",
            weight: "bold"
          }
        });
      }

      const graphic = new Graphic({
        geometry: centroid,
        symbol: symbol,
        attributes: attrs // conserva atributos por si se hace clic en la etiqueta
      });

      labelsLayer.add(graphic);
    });
  }

  // Fallback simple para centroide si no viene precalculado
  function getFallbackCentroid(geometry) {
    let x = 0, y = 0, count = 0;
    if (geometry.rings) {
      geometry.rings.forEach(ring => {
        ring.forEach(pt => {
          x += pt[0];
          y += pt[1];
          count++;
        });
      });
    }
    if (count > 0) {
      return {
        type: "point",
        x: x / count,
        y: y / count,
        spatialReference: geometry.spatialReference
      };
    }
    return null;
  }

  // Normaliza el código de sección a formato de 3 dígitos (ej: "001")
  function normalizeSeccion(seccionVal) {
    if (seccionVal === undefined || seccionVal === null) return null;
    let sStr = String(seccionVal).trim();
    // Si es un código largo (nacional de 10 dígitos o local de 5), extraemos los últimos 3 dígitos de la sección
    if (sStr.length >= 3) {
      sStr = sStr.slice(-3);
    }
    let sInt = parseInt(sStr, 10);
    if (isNaN(sInt)) return sStr;
    return String(sInt).padStart(3, '0');
  }

  // ==========================================================================
  // CÁLCULOS Y AGREGACIONES DE DATOS (MÉTODOS ELECTORALES)
  // ==========================================================================
  
  // Actualiza el Dashboard para Vista de Un Solo Año
  function updateSingleDashboard(features, config) {
    // 1. Título General
    document.getElementById("electionTitle").innerHTML = `${config.label} — <span style="white-space: nowrap;">Rivas Vaciamadrid</span>`;
    
    // 2. Calcular agregaciones en cliente
    const aggregated = aggregateElectionData(features, config);
    
    // 3. Renderizar valores globales en UI
    document.getElementById("totalVotesBadge").textContent = `${aggregated.totalVotos.toLocaleString()} votos`;
    document.getElementById("censusTotal").textContent = aggregated.census.toLocaleString();
    document.getElementById("participationRate").textContent = `${aggregated.participationRate.toFixed(2)}%`;
    document.getElementById("participationBar").style.width = `${aggregated.participationRate}%`;
    document.getElementById("participationDiff").textContent = ""; // Vacío en modo único
    
    const pctBlanco = aggregated.totalVotos > 0 ? ((aggregated.votosBlanco / aggregated.totalVotos) * 100).toFixed(2) : "0.00";
    const pctNulo = aggregated.totalVotos > 0 ? ((aggregated.votosNulo / aggregated.totalVotos) * 100).toFixed(2) : "0.00";
    document.getElementById("blancoTotal").textContent = `${aggregated.votosBlanco.toLocaleString()} (${pctBlanco}%)`;
    document.getElementById("nuloTotal").textContent = `${aggregated.votosNulo.toLocaleString()} (${pctNulo}%)`;

    // 4. Bloques Ideológicos (Configuración interactiva dinámica)
    currentLeftBlock = [...config.leftBlock];
    currentRightBlock = [...config.rightBlock];
    currentAggregatedData = aggregated;
    currentConfigActive = config;
    isComparisonModeActive = false;

    setupBlocksConfigurator(config);
    updateBlocksUIVisualization();

    // 5. Tabla de Resultados de Partidos
    renderPartiesResults(aggregated.partyVotes, config, null);

    // 6. Leyenda del Mapa
    renderMapLegend("legendItems", config);

    // 7. Rellenar listado de Colegios (Tab 2) y rankings (Tab 3)
    renderColegiosList(aggregated.colegiosData, config);
    renderAdvancedPanel(aggregated, config, null, null);
  }

  // Actualiza el Dashboard en Modo Comparación (Año A vs Año B)
  function updateComparisonDashboard(featuresA, featuresB, configA, configB) {
    // 1. Determinar cuál es más reciente cronológicamente (menor índice en ELECTIONS_CONFIG)
    const idxA = ELECTIONS_CONFIG.indexOf(configA);
    const idxB = ELECTIONS_CONFIG.indexOf(configB);
    
    let configOlder, configNewer;
    let aggOlder, aggNewer;
    
    if (idxA <= idxB) {
      // A es más reciente o igual que B
      configNewer = configA;
      configOlder = configB;
      aggNewer = aggregateElectionData(featuresA, configA);
      aggOlder = aggregateElectionData(featuresB, configB);
    } else {
      // B es más reciente que A
      configNewer = configB;
      configOlder = configA;
      aggNewer = aggregateElectionData(featuresB, configB);
      aggOlder = aggregateElectionData(featuresA, configA);
    }

    // El título ahora muestra la dirección del tiempo: de anterior a posterior
    document.getElementById("electionTitle").innerHTML = `Comparación: ${configOlder.label} <i class="fa-solid fa-arrow-right" style="font-size:12px; margin:0 4px; color:var(--accent);"></i> ${configNewer.label}`;

    // 2. Mostrar valores de Año Posterior (Newer) en las tarjetas con deltas respecto a Anterior (Older)
    document.getElementById("totalVotesBadge").textContent = `${aggNewer.totalVotos.toLocaleString()} vs ${aggOlder.totalVotos.toLocaleString()} votos`;
    document.getElementById("censusTotal").textContent = `${aggNewer.census.toLocaleString()} (anterior: ${aggOlder.census.toLocaleString()})`;
    
    document.getElementById("participationRate").textContent = `${aggNewer.participationRate.toFixed(2)}%`;
    document.getElementById("participationBar").style.width = `${aggNewer.participationRate}%`;
    
    // Diferencia de participación (Newer - Older)
    const partDiffVal = aggNewer.participationRate - aggOlder.participationRate;
    const partDiffSpan = document.getElementById("participationDiff");
    if (partDiffVal >= 0) {
      partDiffSpan.className = "stat-diff up";
      partDiffSpan.innerHTML = `<i class="fa-solid fa-caret-up"></i> +${partDiffVal.toFixed(2)}%`;
    } else {
      partDiffSpan.className = "stat-diff down";
      partDiffSpan.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${partDiffVal.toFixed(2)}%`;
    }
    
    // Blancos y Nulos
    const pctBlancoNewer = aggNewer.totalVotos > 0 ? ((aggNewer.votosBlanco / aggNewer.totalVotos) * 100).toFixed(2) : "0.00";
    const pctBlancoOlder = aggOlder.totalVotos > 0 ? ((aggOlder.votosBlanco / aggOlder.totalVotos) * 100).toFixed(2) : "0.00";
    document.getElementById("blancoTotal").textContent = `${aggNewer.votosBlanco.toLocaleString()} (${pctBlancoNewer}%) | ant: ${pctBlancoOlder}%`;

    const pctNuloNewer = aggNewer.totalVotos > 0 ? ((aggNewer.votosNulo / aggNewer.totalVotos) * 100).toFixed(2) : "0.00";
    const pctNuloOlder = aggOlder.totalVotos > 0 ? ((aggOlder.votosNulo / aggOlder.totalVotos) * 100).toFixed(2) : "0.00";
    document.getElementById("nuloTotal").textContent = `${aggNewer.votosNulo.toLocaleString()} (${pctNuloNewer}%) | ant: ${pctNuloOlder}%`;

    // Bloques (Configuración interactiva dinámica en modo comparación)
    currentLeftBlock = [...configNewer.leftBlock];
    currentRightBlock = [...configNewer.rightBlock];
    currentAggregatedData = aggNewer;
    currentAggregatedDataOlder = aggOlder;
    currentConfigActive = configNewer;
    currentConfigOlder = configOlder;
    isComparisonModeActive = true;

    setupBlocksConfigurator(configNewer);
    updateBlocksUIVisualization();

    // 3. Resultados Partidos (con cálculos de deltas: Newer vs Older)
    renderPartiesResults(aggNewer.partyVotes, configNewer, aggOlder.partyVotes);

    // 4. Leyendas del mapa (usando el más reciente como base cromática)
    renderMapLegend("legendItems", configNewer);
    renderMapLegend("legendItemsCompare", configNewer);

    // 5. Lista de colegios y análisis avanzado (Swing y trasvase de Older a Newer)
    renderColegiosList(aggNewer.colegiosData, configNewer);
    renderAdvancedPanel(aggNewer, configNewer, aggOlder, configOlder);
  }

  // Agrega los votos de todas las features a nivel municipal y a nivel de colegio electoral
  function aggregateElectionData(features, config) {
    let totalVotos = 0;
    let votesByParty = {};
    let votosBlanco = 0;
    let votosNulo = 0;
    let census = 0;
    
    let leftBlockVotes = 0;
    let rightBlockVotes = 0;

    // Colegios electorales agrupados
    let colegiosData = {};

    // Inicializar votos de partido
    config.parties.forEach(p => {
      votesByParty[p.id] = 0;
    });

    features.forEach(feature => {
      const attrs = feature.attributes;
      const seccionFieldVal = attrs[config.seccionField || "SECCION"];
      const seccionCode = normalizeSeccion(seccionFieldVal);
      
      // Resolver colegio
      const colName = config.colegioField && attrs[config.colegioField] ? attrs[config.colegioField] : (SECTION_COLEGIO_MAPPING[seccionCode] || "Colegio Desconocido");
      
      if (!colegiosData[colName]) {
        colegiosData[colName] = {
          name: colName,
          sections: [],
          census: 0,
          votos: 0,
          blanco: 0,
          nulo: 0,
          partyVotes: {},
          foto: COLEGIO_DETAILS[colName]?.image || null
        };
        config.parties.forEach(p => {
          colegiosData[colName].partyVotes[p.id] = 0;
        });
      }
      
      colegiosData[colName].sections.push(seccionCode);

      // Electorado (Censo)
      let secElectoralCount = 0;
      if (config.electoresField && attrs[config.electoresField] !== undefined) {
        secElectoralCount = Number(attrs[config.electoresField] || 0);
      } else {
        const censusObj = config.censusProxy ? CENSUS_MAPS[config.censusProxy] : CENSUS_MAPS.CENSUS_2023;
        secElectoralCount = (censusObj && censusObj[seccionCode]) || 0;
      }
      census += secElectoralCount;
      colegiosData[colName].census += secElectoralCount;

      // Voto en blanco y nulo
      let secBlanco = 0;
      if (config.blancoField && attrs[config.blancoField] !== undefined) {
        secBlanco = Number(attrs[config.blancoField] || 0);
      }
      votosBlanco += secBlanco;
      colegiosData[colName].blanco += secBlanco;

      let secNulo = 0;
      if (config.nuloField && attrs[config.nuloField] !== undefined) {
        secNulo = Number(attrs[config.nuloField] || 0);
      }
      votosNulo += secNulo;
      colegiosData[colName].nulo += secNulo;

      // Votos de Partidos
      let secTotalVotosPartidos = 0;
      config.parties.forEach(p => {
        const v = Number(attrs[p.field] || 0);
        votesByParty[p.id] += v;
        colegiosData[colName].partyVotes[p.id] += v;
        secTotalVotosPartidos += v;

        // Clasificar bloques ideológicos
        if (config.leftBlock.includes(p.id)) {
          leftBlockVotes += v;
        } else if (config.rightBlock.includes(p.id)) {
          rightBlockVotes += v;
        }
      });

      // Votos totales de la sección
      let secTotalVotes = 0;
      if (config.votosField && attrs[config.votosField] !== undefined) {
        secTotalVotes = Number(attrs[config.votosField] || 0);
      } else {
        secTotalVotes = secTotalVotosPartidos + secBlanco;
      }
      totalVotos += secTotalVotes;
      colegiosData[colName].votos += secTotalVotes;
    });

    const participationRate = census > 0 ? Math.min(100, (totalVotos / census) * 100) : 0;

    return {
      totalVotos,
      partyVotes: votesByParty,
      votosBlanco,
      votosNulo,
      census,
      participationRate,
      leftBlockVotes,
      rightBlockVotes,
      colegiosData,
      rawFeatures: features
    };
  }

  // Renderiza la lista de partidos con barras de porcentaje y diferencias
  function renderPartiesResults(votes, config, prevVotes) {
    const container = document.getElementById("partiesResultsContainer");
    container.innerHTML = "";

    let totalV = 0;
    config.parties.forEach(p => {
      totalV += votes[p.id];
    });

    // Calcular el total de votos previo si se compara
    let prevTotalV = 0;
    if (prevVotes) {
      config.parties.forEach(p => {
        prevTotalV += (prevVotes[p.id] || 0);
      });
    }

    // Ordenar partidos por votos descendente
    const sorted = [...config.parties].sort((x, y) => votes[y.id] - votes[x.id]);

    sorted.forEach(p => {
      const v = votes[p.id];
      const pct = totalV > 0 ? ((v / totalV) * 100) : 0;
      
      let pctDiffHtml = "";
      
      if (prevVotes && prevVotes[p.id] !== undefined) {
        const pv = prevVotes[p.id];
        const ppct = prevTotalV > 0 ? ((pv / prevTotalV) * 100) : 0;
        const diff = pct - ppct;
        
        if (diff >= 0) {
          pctDiffHtml = `<span class="party-pct-diff" style="color:var(--success);"><i class="fa-solid fa-caret-up"></i> +${diff.toFixed(2)}%</span>`;
        } else {
          pctDiffHtml = `<span class="party-pct-diff" style="color:var(--danger);"><i class="fa-solid fa-caret-down"></i> ${diff.toFixed(2)}%</span>`;
        }
      }

      const item = document.createElement("div");
      item.className = "party-result-item";
      
      const logoHtml = p.logo 
        ? `<img class="party-logo-mini" src="${p.logo}" alt="${p.name}">`
        : `<div class="party-logo-fallback" style="background-color:${p.color}">${p.name.substring(0,2)}</div>`;

      item.innerHTML = `
        <div class="party-logo-wrapper">
          ${logoHtml}
        </div>
        <div class="party-data-row">
          <div class="party-meta-info">
            <span class="party-name">${p.name}</span>
            <div class="party-pct-info">
              <span class="party-pct" style="color:${p.color}">${pct.toFixed(2)}%</span>
              ${pctDiffHtml}
            </div>
          </div>
          <div class="party-progress-bar-container">
            <div class="party-progress-bar" style="width: ${pct}%; background-color: ${p.color};"></div>
          </div>
          <span class="party-votes">${v.toLocaleString()} votos</span>
        </div>
      `;
      container.appendChild(item);
    });
  }

  // Renderiza la lista de colegios electorales (Tab 2)
  function renderColegiosList(colegiosMap, config) {
    const container = document.getElementById("colegiosListContainer");
    container.innerHTML = "";

    const colegios = Object.values(colegiosMap).sort((a,b) => a.name.localeCompare(b.name));

    colegios.forEach(c => {
      // Calcular ganador en este colegio
      let maxVotes = -1;
      let winner = null;
      config.parties.forEach(p => {
        const v = c.partyVotes[p.id] || 0;
        if (v > maxVotes) {
          maxVotes = v;
          winner = p;
        }
      });

      const partPct = c.census > 0 ? Math.min(100, (c.votos / c.census) * 100).toFixed(1) : "0.0";

      const card = document.createElement("div");
      card.className = "colegio-card";
      card.dataset.name = c.name;
      
      card.innerHTML = `
        <div class="colegio-card-header">
          <h4>${c.name}</h4>
          ${winner ? `
            <div class="colegio-winner-badge" style="color:${winner.color}; border-color:${winner.color}33;">
              <span class="colegio-winner-dot" style="background-color:${winner.color};"></span>
              ${winner.name}
            </div>
          ` : ''}
        </div>
        <div class="colegio-card-meta">
          <span><i class="fa-solid fa-circle-nodes"></i> ${c.sections.length} secc.</span>
          <span><i class="fa-solid fa-user-check"></i> ${partPct}% part.</span>
          <span>${c.votos.toLocaleString()} votos</span>
        </div>
      `;

      card.addEventListener("click", () => {
        showColegioModal(c, config);
        highlightColegioOnMap(c.sections);
      });

      container.appendChild(card);
    });
  }

  // Filtra la lista de colegios en la barra lateral
  function filterColegiosList(query) {
    const q = query.toLowerCase().trim();
    const cards = document.querySelectorAll(".colegio-card");
    cards.forEach(card => {
      const name = card.dataset.name.toLowerCase();
      if (name.includes(q)) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    });
  }

  // Resalta y hace zoom sobre las secciones de un colegio en el mapa
  function highlightColegioOnMap(sections) {
    // Buscar la capa eleccionesLayer en viewA
    const layer = mapA.findLayerById("electionsLayer");
    if (!layer) return;

    // Normalizar lista de secciones
    const normalized = sections.map(s => String(parseInt(s, 10)));
    
    // Crear query espacial para centrar el mapa
    const query = layer.createQuery();
    // Soporta campos string y numéricos
    const orCondition = normalized.map(s => `SECCION = '${s}' OR SECCION = '${s.padStart(3,'0')}' OR SECCION = ${s}`).join(" OR ");
    query.where = orCondition;
    query.returnGeometry = true;

    layer.queryFeatures(query).then(results => {
      if (results.features && results.features.length > 0) {
        // Enfocar la extensión de estas secciones
        const geometries = results.features.map(f => f.geometry);
        viewA.goTo(geometries).catch(err => console.log(err));
        if (isComparisonMode && viewB) {
          viewB.goTo(geometries).catch(err => console.log(err));
        }
      }
    });
  }

  // Abre el Modal con detalles e imágenes del Colegio Electoral
  function showColegioModal(colegio, config) {
    document.getElementById("modalSchoolName").textContent = colegio.name;
    
    const details = COLEGIO_DETAILS[colegio.name];
    const address = details?.address || "Rivas-Vaciamadrid, Madrid";
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(colegio.name + ", " + address)}`;
    
    document.getElementById("modalSchoolAddress").innerHTML = `
      <div class="modal-address-text">
        <i class="fa-solid fa-location-dot"></i>
        <span>${address}</span>
      </div>
      <a href="${mapsUrl}" target="_blank" class="btn-map-link">
        <i class="fa-solid fa-route"></i> Cómo llegar
      </a>
    `;

    document.getElementById("modalSchoolSections").innerHTML = `<i class="fa-solid fa-circle-nodes"></i> Secciones: <strong>${colegio.sections.join(", ")}</strong>`;
    document.getElementById("modalSchoolCensus").innerHTML = `<i class="fa-solid fa-users"></i> Censo: <strong>${colegio.census.toLocaleString()}</strong>`;
    
    const partPct = colegio.census > 0 ? Math.min(100, (colegio.votos / colegio.census) * 100).toFixed(2) : "0.00";
    document.getElementById("modalSchoolTurnout").innerHTML = `<i class="fa-solid fa-user-check"></i> Participación: <strong>${partPct}% (${colegio.votos.toLocaleString()} votos)</strong>`;
    
    // Imagen local o fallback
    const imgArea = document.getElementById("modalSchoolImage");
    imgArea.innerHTML = "";
    
    const localImg = COLEGIO_DETAILS[colegio.name]?.image;
    const onlineUrl = COLEGIO_DETAILS[colegio.name]?.webUrl;
    
    // Cargamos imagen
    const img = document.createElement("img");
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.src = localImg || onlineUrl || "Iconos/Hispanidad.jpg"; // Fallback por defecto
    img.alt = colegio.name;
    imgArea.appendChild(img);
    
    // Añadimos etiqueta decorativa
    const badge = document.createElement("div");
    badge.className = "modal-school-badge";
    badge.textContent = "COLEGIO ELECTORAL";
    imgArea.appendChild(badge);

    // Listar resultados específicos
    const resultsContainer = document.getElementById("modalSchoolResults");
    resultsContainer.innerHTML = "";

    const totalV = colegio.votos;
    const sorted = [...config.parties].sort((x, y) => (colegio.partyVotes[y.id] || 0) - (colegio.partyVotes[x.id] || 0));

    sorted.forEach(p => {
      const v = colegio.partyVotes[p.id] || 0;
      const pct = totalV > 0 ? ((v / totalV) * 100) : 0;

      const item = document.createElement("div");
      item.className = "party-result-item";
      
      const logoHtml = p.logo 
        ? `<img class="party-logo-mini" src="${p.logo}" alt="${p.name}">`
        : `<div class="party-logo-fallback" style="background-color:${p.color}">${p.name.substring(0,2)}</div>`;

      item.innerHTML = `
        <div class="party-logo-wrapper">
          ${logoHtml}
        </div>
        <div class="party-data-row">
          <div class="party-meta-info">
            <span class="party-name">${p.name}</span>
            <span class="party-pct" style="color:${p.color}">${pct.toFixed(2)}%</span>
          </div>
          <div class="party-progress-bar-container">
            <div class="party-progress-bar" style="width: ${pct}%; background-color: ${p.color};"></div>
          </div>
          <span class="party-votes">${v.toLocaleString()} votos</span>
        </div>
      `;
      resultsContainer.appendChild(item);
    });

    modal.classList.remove("hidden");
  }

  // Genera las leyendas flotantes en el mapa
  function renderMapLegend(containerId, config) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    const legendList = document.createElement("div");
    legendList.className = "legend-list";

    config.parties.forEach(p => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="legend-color-dot" style="background-color:${p.color};"></span>
        <span>${p.name}</span>
      `;
      legendList.appendChild(item);
    });
    
    // Empates
    const otherItem = document.createElement("div");
    otherItem.className = "legend-item";
    otherItem.innerHTML = `
      <span class="legend-color-dot" style="background-color:rgba(80,80,80,0.65);"></span>
      <span>Otros / Empates</span>
    `;
    legendList.appendChild(otherItem);

    container.appendChild(legendList);
  }

  // TAB 3: Análisis Político Avanzado (Rankings, Swings, Hegemonías)
  function renderAdvancedPanel(aggA, configA, aggB, configB) {
    // 1. Ranking de Participación por Colegio
    const rankList = document.getElementById("participationRankingList");
    rankList.innerHTML = "";

    const rankedColegios = Object.values(aggA.colegiosData)
      .map(c => ({
        name: c.name,
        pct: c.census > 0 ? Math.min(100, (c.votos / c.census * 100)) : 0
      }))
      .sort((x, y) => y.pct - x.pct);

    rankedColegios.slice(0, 5).forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = `${c.name} <span>${c.pct.toFixed(2)}%</span>`;
      rankList.appendChild(li);
    });

    // 2. Hegemonía por Partido (Feudos Electorales)
    const hegemonyList = document.getElementById("hegemonyList");
    hegemonyList.innerHTML = "";

    configA.parties.forEach(p => {
      let maxPct = -1;
      let targetColegio = null;
      let targetVotes = 0;

      Object.values(aggA.colegiosData).forEach(c => {
        const votes = c.partyVotes[p.id] || 0;
        const pct = c.votos > 0 ? (votes / c.votos * 100) : 0;
        if (pct > maxPct) {
          maxPct = pct;
          targetColegio = c.name;
          targetVotes = votes;
        }
      });

      if (maxPct > 0 && targetColegio) {
        const item = document.createElement("div");
        item.className = "hegemony-item";
        item.style.borderLeftColor = p.color;
        item.innerHTML = `
          <div class="hegemony-party" style="color:${p.color}">${p.name}</div>
          <div class="hegemony-details">
            <strong>${maxPct.toFixed(1)}%</strong> (${targetVotes.toLocaleString()} v)<br>
            <span style="font-size:10px; color:var(--text-secondary);">${targetColegio}</span>
          </div>
        `;
        hegemonyList.appendChild(item);
      }
    });

    // 3. Volatilidad / Swing (Secciones que cambian de manos)
    const swingResult = document.getElementById("swingMetricResult");
    
    if (isComparisonMode && aggB) {
      let swingCount = 0;
      let detailsHtml = "";

      // Comparamos el ganador de cada sección censal
      // Agrupamos por sección censal de Rivas
      const mapWinnersA = getWinnersBySection(aggA.rawFeatures, configA);
      const mapWinnersB = getWinnersBySection(aggB.rawFeatures, configB);

      let changedSections = [];

      for (let sec in mapWinnersA) {
        const winA = mapWinnersA[sec];
        const winB = mapWinnersB[sec];
        
        if (winA && winB && winA.id !== winB.id) {
          swingCount++;
          changedSections.push({
            sec,
            prevWinner: winB,
            newWinner: winA
          });
        }
      }

      const totalSecs = Object.keys(mapWinnersA).length;
      const swingPct = totalSecs > 0 ? (swingCount / totalSecs * 100) : 0;

      detailsHtml = `
        <div class="comparison-stats-box" style="margin-top:8px;">
          <div class="comp-stat-row">
            <span>Secciones analizadas:</span>
            <span class="comp-stat-val">${totalSecs}</span>
          </div>
          <div class="comp-stat-row">
            <span>Secciones con cambio de ganador:</span>
            <span class="comp-stat-val" style="color:var(--warning); font-weight:700;">${swingCount} (${swingPct.toFixed(1)}%)</span>
          </div>
          <div style="font-size:11px; margin-top:8px; font-weight:600; color:var(--text-secondary);">Detalle de Secciones Clave:</div>
          <div class="swing-details-list" style="max-height:140px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; margin-top:6px;">
      `;

      if (changedSections.length > 0) {
        changedSections.slice(0, 10).forEach(item => {
          const colName = SECTION_COLEGIO_MAPPING[item.sec] || "Rivas";
          detailsHtml += `
            <div style="font-size:11px; display:flex; justify-content:space-between; background:rgba(255,255,255,0.02); padding:4px 8px; border-radius:4px;">
              <span>Sección ${item.sec} (${colName.substring(9)})</span>
              <span>
                <strong style="color:${item.prevWinner.color}">${item.prevWinner.name}</strong> 
                <i class="fa-solid fa-arrow-right" style="margin: 0 4px; font-size:9px;"></i> 
                <strong style="color:${item.newWinner.color}">${item.newWinner.name}</strong>
              </span>
            </div>
          `;
        });
        if (changedSections.length > 10) {
          detailsHtml += `<div style="font-size:10px; color:var(--text-muted); text-align:center;">... y ${changedSections.length - 10} secciones más.</div>`;
        }
      } else {
        detailsHtml += `<div style="font-size:11px; color:var(--text-muted); text-align:center;">Ninguna sección cambió de ganador. Estabilidad absoluta.</div>`;
      }

      detailsHtml += `</div></div>`;
      swingResult.innerHTML = detailsHtml;

    } else {
      swingResult.innerHTML = `
        <div class="metric-placeholder-text">
          <i class="fa-solid fa-circle-info"></i> Activa el modo <strong>Comparar Años</strong> en la barra superior. Este panel comparará de forma automática el <strong>Año en Vista</strong> (Mapa Principal) con el <strong>Año en Comparación</strong> (Mapa Comparativo) para calcular el trasvase y volatilidad geográfica de las secciones censales.
        </div>
      `;
    }
  }

  // Helper para hallar el ganador por sección
  function getWinnersBySection(features, config) {
    const winners = {};
    features.forEach(f => {
      const attrs = f.attributes;
      const seccionFieldVal = attrs[config.seccionField || "SECCION"];
      const seccionCode = normalizeSeccion(seccionFieldVal);
      if (!seccionCode) return;

      let maxVotes = -1;
      let winnerParty = null;

      config.parties.forEach(p => {
        const v = Number(attrs[p.field] || 0);
        if (v > maxVotes) {
          maxVotes = v;
          winnerParty = p;
        }
      });

      if (maxVotes > 0 && winnerParty) {
        winners[seccionCode] = winnerParty;
      }
    });
    return winners;
  }

  // ==========================================================================
  // CONFIGURADOR INTERACTIVO DE BLOQUES (CALCULADORA DE PACTOS)
  // ==========================================================================

  // Inicializa el panel visual con los partidos y sus selectores
  function setupBlocksConfigurator(config) {
    const configurator = document.getElementById("blocksConfigurator");
    if (!configurator) return;
    configurator.innerHTML = "";

    config.parties.forEach(p => {
      const item = document.createElement("div");
      item.className = "block-config-item";

      const logoHtml = p.logo 
        ? `<img class="block-config-party-logo" src="${p.logo}" alt="${p.name}">`
        : `<div class="party-logo-fallback" style="background-color:${p.color}; width:20px; height:20px; font-size:8px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:700; color:#fff;">${p.name.substring(0,2)}</div>`;

      // Determinar cuál es el bloque activo actual
      let activeOpt = "none";
      if (currentLeftBlock.includes(p.id)) {
        activeOpt = "left";
      } else if (currentRightBlock.includes(p.id)) {
        activeOpt = "right";
      }

      item.innerHTML = `
        <div class="block-config-party-info">
          ${logoHtml}
          <span>${p.name}</span>
        </div>
        <div class="block-config-options">
          <button class="block-config-btn opt-left ${activeOpt === 'left' ? 'active' : ''}" data-party="${p.id}" data-opt="left" title="Sumar a Izquierda">I</button>
          <button class="block-config-btn opt-none ${activeOpt === 'none' ? 'active' : ''}" data-party="${p.id}" data-opt="none" title="No sumar al bloque">N</button>
          <button class="block-config-btn opt-right ${activeOpt === 'right' ? 'active' : ''}" data-party="${p.id}" data-opt="right" title="Sumar a Derecha">D</button>
        </div>
      `;

      // Vincular eventos de clic para los botones del partido
      const btns = item.querySelectorAll(".block-config-btn");
      btns.forEach(btn => {
        btn.addEventListener("click", function() {
          const partyId = this.getAttribute("data-party");
          const selectedOpt = this.getAttribute("data-opt");

          // Quitar clases activas en este grupo de botones
          btns.forEach(b => b.classList.remove("active"));
          this.classList.add("active");

          // Actualizar los arrays del estado
          currentLeftBlock = currentLeftBlock.filter(id => id !== partyId);
          currentRightBlock = currentRightBlock.filter(id => id !== partyId);

          if (selectedOpt === "left") {
            currentLeftBlock.push(partyId);
          } else if (selectedOpt === "right") {
            currentRightBlock.push(partyId);
          }

          // Recalcular y actualizar la balanza visual
          updateBlocksUIVisualization();
        });
      });

      configurator.appendChild(item);
    });
  }

  // Calcula y actualiza la balanza visual
  function updateBlocksUIVisualization() {
    if (!currentAggregatedData || !currentConfigActive) return;

    // 1. Calcular votos para el bloque principal (Newer o Único)
    let leftVotesNewer = 0;
    let rightVotesNewer = 0;

    currentConfigActive.parties.forEach(p => {
      const v = currentAggregatedData.partyVotes[p.id] || 0;
      if (currentLeftBlock.includes(p.id)) {
        leftVotesNewer += v;
      } else if (currentRightBlock.includes(p.id)) {
        rightVotesNewer += v;
      }
    });

    let leftVotesOlder = 0;
    let rightVotesOlder = 0;

    if (isComparisonModeActive && currentAggregatedDataOlder && currentConfigOlder) {
      // Mapear de forma inteligente sobre el año anterior (Older)
      const olderLeftList = currentConfigOlder.leftBlock.filter(id => 
        !currentRightBlock.includes(id) && (currentLeftBlock.includes(id) || !currentConfigActive.parties.some(p => p.id === id))
      );
      const olderRightList = currentConfigOlder.rightBlock.filter(id => 
        !currentLeftBlock.includes(id) && (currentRightBlock.includes(id) || !currentConfigActive.parties.some(p => p.id === id))
      );

      currentConfigOlder.parties.forEach(p => {
        const v = currentAggregatedDataOlder.partyVotes[p.id] || 0;
        if (olderLeftList.includes(p.id)) {
          leftVotesOlder += v;
        } else if (olderRightList.includes(p.id)) {
          rightVotesOlder += v;
        }
      });
    }

    // 2. Renderizar porcentajes y anchos de barra
    const totalNewer = leftVotesNewer + rightVotesNewer;
    const leftPct = totalNewer > 0 ? (leftVotesNewer / totalNewer * 100) : 50;
    const rightPct = totalNewer > 0 ? (rightVotesNewer / totalNewer * 100) : 50;

    const leftBar = document.getElementById("leftBlockBar");
    const rightBar = document.getElementById("rightBlockBar");
    
    if (leftBar && rightBar) {
      leftBar.style.width = `${leftPct}%`;
      leftBar.textContent = `${leftPct.toFixed(1)}%`;
      rightBar.style.width = `${rightPct}%`;
      rightBar.textContent = `${rightPct.toFixed(1)}%`;
    }

    // 3. Renderizar votos absolutos
    const leftVotesSpan = document.getElementById("leftBlockVotes");
    const rightVotesSpan = document.getElementById("rightBlockVotes");

    if (leftVotesSpan && rightVotesSpan) {
      if (isComparisonModeActive) {
        leftVotesSpan.textContent = `${leftVotesNewer.toLocaleString()} (anterior: ${leftVotesOlder.toLocaleString()})`;
        rightVotesSpan.textContent = `${rightVotesNewer.toLocaleString()} (anterior: ${rightVotesOlder.toLocaleString()})`;
      } else {
        leftVotesSpan.textContent = `${leftVotesNewer.toLocaleString()} votos`;
        rightVotesSpan.textContent = `${rightVotesNewer.toLocaleString()} votos`;
      }
    }
  }

  // ==========================================================================
  // EJECUCIÓN AL CARGAR LA PÁGINA
  // ==========================================================================
  init();

});
