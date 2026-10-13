require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/widgets/Home",
  "esri/widgets/Swipe",
  "esri/symbols/PictureMarkerSymbol"
], function (Map, MapView, FeatureLayer, GraphicsLayer, Graphic, Home, Swipe, PictureMarkerSymbol) {
  const params = new URLSearchParams(window.location.search);
  const ambitoId = params.get("ambito") || "generales";
  const ambito = window.HUB_CONFIG.getAmbito(ambitoId);

  if (!ambito) {
    document.body.innerHTML = "<p style='padding:2rem'>Ámbito no encontrado. <a href='index.html'>Volver al HUB</a></p>";
    return;
  }

  document.documentElement.style.setProperty("--accent", ambito.accent);
  document.documentElement.style.setProperty("--accent-soft", ambito.accentSoft);
  document.title = `${ambito.name} · Histórico electoral · Rivas`;
  document.getElementById("ambitoTitle").textContent = ambito.name;
  document.getElementById("ambitoSub").textContent = ambito.blurb;

  const notice = document.getElementById("nextNotice");
  if (ambito.nextEvent) {
    notice.classList.remove("hidden");
    document.getElementById("nextTitle").textContent = ambito.nextEvent.title;
    document.getElementById("nextDate").textContent = ambito.nextEvent.dateLabel;
    document.getElementById("nextNote").textContent = ambito.nextEvent.note || "";
    const cta = document.getElementById("nextCta");
    if (ambito.nextEvent.ctaHref && ambito.nextEvent.ctaLabel) {
      cta.href = ambito.nextEvent.ctaHref;
      cta.textContent = ambito.nextEvent.ctaLabel.length > 22
        ? "En vivo"
        : ambito.nextEvent.ctaLabel;
      cta.title = ambito.nextEvent.ctaLabel;
      cta.classList.remove("hidden");
    } else {
      cta.classList.add("hidden");
    }
  } else {
    notice.classList.add("hidden");
  }

  const yearASelect = document.getElementById("yearA");
  const yearBSelect = document.getElementById("yearB");
  const yearsSorted = [...ambito.years].sort((a, b) => b.year - a.year);

  yearsSorted.forEach((y) => {
    const optA = new Option(y.label, String(y.year));
    const optB = new Option(y.label, String(y.year));
    yearASelect.add(optA);
    yearBSelect.add(optB);
  });

  if (yearsSorted.length > 1) {
    yearBSelect.value = String(yearsSorted[1].year);
  }

  let mode = "single"; // single | compare
  let swipeWidget = null;
  let colorLayerA = null;
  let colorLayerB = null;
  let labelsLayerA = null;
  let labelsLayerB = null;
  let terminoLayer = null;

  const DEFAULT_CENTER = [-3.532, 40.347];
  const DEFAULT_ZOOM = 12.5;

  const map = new Map({ basemap: "gray-vector" });
  const view = new MapView({
    container: "mapViewDiv",
    map,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    ui: { components: ["zoom", "attribution"] }
  });
  const homeWidget = new Home({ view });
  view.ui.add(homeWidget, "top-left");
  view.when(() => {
    // Fija el "Home" a la vista inicial de carga (no al extent de las features)
    homeWidget.viewpoint = view.viewpoint.clone();
  });

  function resetDefaultView() {
    return view.goTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }, { animate: false }).catch(() => {});
  }

  terminoLayer = new FeatureLayer({
    url: window.HUB_CONFIG.TERMINO_URL,
    title: "Término municipal",
    legendEnabled: false,
    popupEnabled: false,
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0],
        outline: { type: "simple-line", color: [120, 20, 20, 0.95], width: 2 }
      }
    }
  });
  map.add(terminoLayer);

  function setLoader(on, text) {
    const el = document.getElementById("mapLoader");
    if (!el) return;
    el.classList.toggle("hidden", !on);
    if (text) el.textContent = text;
  }

  function isValidSection(raw) {
    if (raw === undefined || raw === null) return false;
    const text = String(raw).trim();
    if (!text || /EAL/i.test(text) || /\s/.test(text)) return false;
    return /^\d+$/.test(text);
  }

  function normalizeSectionKey(raw) {
    if (raw === undefined || raw === null) return "";
    const text = String(raw).trim();
    if (/^\d+$/.test(text)) return String(parseInt(text, 10)).padStart(3, "0");
    return text.toUpperCase();
  }

  function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  function getYearConfig(year) {
    return ambito.years.find((y) => String(y.year) === String(year));
  }

  const censusCache = {};

  async function loadCensusMap(sourceId) {
    if (!sourceId) return null;
    if (censusCache[sourceId]) return censusCache[sourceId];
    const src = window.HUB_CONFIG.getCensusSource(sourceId);
    if (!src) return null;

    const layer = new FeatureLayer({ url: src.url, outFields: [src.sectionField, src.electorsField] });
    await layer.load();
    const query = layer.createQuery();
    query.where = "1=1";
    query.outFields = [src.sectionField, src.electorsField];
    query.returnGeometry = false;
    const res = await layer.queryFeatures(query);
    const mapBySec = {};
    (res.features || []).forEach((f) => {
      const key = normalizeSectionKey(f.attributes[src.sectionField]);
      if (!key) return;
      mapBySec[key] = num(f.attributes[src.electorsField]);
    });
    censusCache[sourceId] = { source: src, mapBySec };
    return censusCache[sourceId];
  }

  function winnerForFeature(attrs, yearCfg) {
    let best = null;
    let bestVotes = -1;
    yearCfg.parties.forEach((p) => {
      const v = num(attrs[p.field]);
      if (v > bestVotes) {
        bestVotes = v;
        best = p;
      }
    });
    if (!best || bestVotes <= 0) return null;
    return { party: best, votes: bestVotes };
  }

  function partyVotesTotal(features, yearCfg, censusJoin) {
    const totals = {};
    yearCfg.parties.forEach((p) => { totals[p.id] = 0; });
    let blanks = 0;
    let nulls = 0;
    let electors = 0;
    let ballots = 0;
    let matchedSections = 0;
    let hasElectors = false;
    let censusFromJoin = false;

    features.forEach((f) => {
      const a = f.attributes || {};
      let partySum = 0;
      yearCfg.parties.forEach((p) => {
        const v = num(a[p.field]);
        totals[p.id] += v;
        partySum += v;
      });
      const b = yearCfg.blankField ? num(a[yearCfg.blankField]) : 0;
      const n = yearCfg.nullField ? num(a[yearCfg.nullField]) : 0;
      blanks += b;
      nulls += n;
      if (yearCfg.totalVotesField && a[yearCfg.totalVotesField] != null) {
        ballots += num(a[yearCfg.totalVotesField]);
      } else {
        ballots += partySum + b + n;
      }

      if (yearCfg.electorsField && a[yearCfg.electorsField] != null) {
        electors += num(a[yearCfg.electorsField]);
        hasElectors = true;
        matchedSections += 1;
      } else if (censusJoin) {
        const key = normalizeSectionKey(a[yearCfg.sectionField]);
        if (key && censusJoin.mapBySec[key] != null) {
          electors += num(censusJoin.mapBySec[key]);
          hasElectors = true;
          censusFromJoin = true;
          matchedSections += 1;
        }
      }
    });

    const participation = hasElectors && electors > 0 ? (ballots / electors) * 100 : null;
    const blankPct = ballots > 0 ? (blanks / ballots) * 100 : null;
    const nullPct = ballots > 0 ? (nulls / ballots) * 100 : null;

    const ranking = [...yearCfg.parties]
      .map((p) => ({ ...p, votes: totals[p.id] || 0 }))
      .sort((a, b) => b.votes - a.votes);

    return {
      totals, blanks, nulls, electors, ballots, hasElectors, participation, blankPct, nullPct, ranking,
      censusFromJoin,
      censusLabel: censusJoin && censusJoin.source ? censusJoin.source.label : null,
      matchedSections
    };
  }

  function renderMetrics(targetPrefix, stats, yearLabel) {
    const partEl = document.getElementById(`${targetPrefix}Participation`);
    const blankEl = document.getElementById(`${targetPrefix}Blank`);
    const nullEl = document.getElementById(`${targetPrefix}Null`);
    const yearEl = document.getElementById(`${targetPrefix}YearLabel`);
    if (yearEl) yearEl.textContent = yearLabel || "";

    partEl.textContent = stats.participation == null ? "n/d" : `${stats.participation.toFixed(1)}%`;
    blankEl.textContent = stats.blankPct == null ? "n/d" : `${stats.blankPct.toFixed(2)}%`;
    nullEl.textContent = stats.nullPct == null ? "n/d" : `${stats.nullPct.toFixed(2)}%`;

    const hint = document.getElementById(`${targetPrefix}PartHint`);
    if (hint) {
      if (stats.hasElectors) {
        const joinNote = stats.censusFromJoin && stats.censusLabel
          ? ` · vía ${stats.censusLabel}`
          : "";
        hint.textContent = `${stats.ballots.toLocaleString("es-ES")} votos / ${stats.electors.toLocaleString("es-ES")} electores${joinNote}`;
      } else {
        hint.textContent = "Sin censo publicado para esta convocatoria";
      }
    }

    const legend = document.getElementById(`${targetPrefix}Legend`);
    legend.innerHTML = "";
    stats.ranking.slice(0, 4).forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "legend-row";
      const pct = stats.ballots > 0 ? ((p.votes / stats.ballots) * 100).toFixed(1) : "0.0";
      row.innerHTML = `
        <div class="left">
          <span>${idx + 1}.</span>
          <span class="swatch" style="background:${p.color}"></span>
          <img src="${p.logo}" alt="" onerror="this.style.display='none'">
          <span>${p.name}</span>
        </div>
        <strong>${pct}%</strong>`;
      legend.appendChild(row);
    });
  }

  function centroidOf(geometry) {
    if (!geometry) return null;
    if (geometry.centroid) return geometry.centroid;
    let x = 0, y = 0, c = 0;
    (geometry.rings || []).forEach((ring) => {
      ring.forEach((pt) => { x += pt[0]; y += pt[1]; c++; });
    });
    if (!c) return null;
    return { type: "point", x: x / c, y: y / c, spatialReference: geometry.spatialReference };
  }

  async function queryYearFeatures(yearCfg) {
    const layer = new FeatureLayer({ url: yearCfg.url, outFields: ["*"] });
    await layer.load();
    const query = layer.createQuery();
    query.where = "1=1";
    query.outFields = ["*"];
    query.returnGeometry = true;
    const res = await layer.queryFeatures(query);
    return (res.features || []).filter((f) => isValidSection(f.attributes[yearCfg.sectionField]));
  }

  function buildGraphics(features, yearCfg) {
    const polys = [];
    const labels = [];
    features.forEach((feature) => {
      const win = winnerForFeature(feature.attributes, yearCfg);
      let fill = [203, 213, 225, 0.5];
      if (win) {
        const hex = win.party.color.replace("#", "");
        fill = [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
          0.72
        ];
      }
      polys.push(new Graphic({
        geometry: feature.geometry,
        attributes: feature.attributes,
        symbol: {
          type: "simple-fill",
          color: fill,
          outline: { type: "simple-line", color: [60, 70, 85, 0.55], width: 0.7 }
        },
        popupTemplate: {
          title: `Sección {${yearCfg.sectionField}}`,
          content: win
            ? `Ganador: <b>${win.party.name}</b> (${win.votes.toLocaleString("es-ES")} votos)`
            : "Sin datos de ganador"
        }
      }));

      if (win) {
        const c = centroidOf(feature.geometry);
        if (c) {
          labels.push(new Graphic({
            geometry: c,
            symbol: new PictureMarkerSymbol({
              url: win.party.logo,
              width: "18px",
              height: "18px"
            })
          }));
        }
      }
    });
    return { polys, labels };
  }

  function ensureLayers() {
    if (!colorLayerA) {
      colorLayerA = new GraphicsLayer({ id: "colorA", title: "Año A" });
      labelsLayerA = new GraphicsLayer({ id: "labelsA", title: "Iconos A" });
      colorLayerB = new GraphicsLayer({ id: "colorB", title: "Año B", visible: false });
      labelsLayerB = new GraphicsLayer({ id: "labelsB", title: "Iconos B", visible: false });
      map.addMany([colorLayerA, colorLayerB, labelsLayerA, labelsLayerB]);
    }
  }

  function clearSwipe() {
    if (swipeWidget) {
      view.ui.remove(swipeWidget);
      swipeWidget.destroy();
      swipeWidget = null;
    }
  }

  async function refresh() {
    ensureLayers();
    setLoader(true, "Cargando resultados...");
    try {
      const yearA = getYearConfig(yearASelect.value);
      const featsA = await queryYearFeatures(yearA);
      const censusA = await loadCensusMap(yearA.censusSource);
      const builtA = buildGraphics(featsA, yearA);
      colorLayerA.removeAll();
      labelsLayerA.removeAll();
      colorLayerA.addMany(builtA.polys);
      labelsLayerA.addMany(builtA.labels);
      renderMetrics("a", partyVotesTotal(featsA, yearA, censusA), yearA.label);

      if (mode === "compare") {
        const yearB = getYearConfig(yearBSelect.value);
        const featsB = await queryYearFeatures(yearB);
        const censusB = await loadCensusMap(yearB.censusSource);
        const builtB = buildGraphics(featsB, yearB);
        colorLayerB.removeAll();
        labelsLayerB.removeAll();
        colorLayerB.addMany(builtB.polys);
        labelsLayerB.addMany(builtB.labels);
        colorLayerB.visible = true;
        labelsLayerB.visible = true;
        renderMetrics("b", partyVotesTotal(featsB, yearB, censusB), yearB.label);

        clearSwipe();
        swipeWidget = new Swipe({
          view,
          leadingLayers: [colorLayerA, labelsLayerA],
          trailingLayers: [colorLayerB, labelsLayerB],
          direction: "horizontal",
          position: 50
        });
        view.ui.add(swipeWidget);
      } else {
        colorLayerB.visible = false;
        labelsLayerB.visible = false;
        colorLayerB.removeAll();
        labelsLayerB.removeAll();
        clearSwipe();
      }

      map.reorder(terminoLayer, map.layers.length - 1);
      map.reorder(labelsLayerA, map.layers.length - 1);
      if (mode === "compare") map.reorder(labelsLayerB, map.layers.length - 1);

      // Mantener siempre la misma vista predeterminada de carga
      await resetDefaultView();
    } catch (err) {
      console.error(err);
      alert("No se pudieron cargar los datos de esta convocatoria.\n" + (err.message || err));
    } finally {
      setLoader(false);
    }
  }

  function setMode(next) {
    mode = next;
    document.getElementById("workspace").classList.toggle("compare-hidden", mode !== "compare");
    document.getElementById("btnModeSingle").classList.toggle("active", mode === "single");
    document.getElementById("btnModeCompare").classList.toggle("active", mode === "compare");
    refresh();
  }

  document.getElementById("btnModeSingle").addEventListener("click", () => setMode("single"));
  document.getElementById("btnModeCompare").addEventListener("click", () => setMode("compare"));
  yearASelect.addEventListener("change", refresh);
  yearBSelect.addEventListener("change", refresh);

  document.getElementById("workspace").classList.add("compare-hidden");

  view.when(() => refresh());
});
