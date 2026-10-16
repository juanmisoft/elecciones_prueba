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
  const yearKey = (y) => (y && (y.id || String(y.year))) || "";
  const yearsSorted = [...ambito.years].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return String(a.label).localeCompare(String(b.label), "es");
  });

  yearsSorted.forEach((y) => {
    const key = yearKey(y);
    yearASelect.add(new Option(y.label, key));
    yearBSelect.add(new Option(y.label, key));
  });

  if (yearsSorted.length > 1) {
    yearBSelect.value = yearKey(yearsSorted[1]);
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

  function getYearConfig(key) {
    return ambito.years.find((y) => yearKey(y) === String(key) || String(y.year) === String(key));
  }

  function buildOutFields(yearCfg) {
    const fields = new Set([yearCfg.sectionField]);
    if (yearCfg.blankField) fields.add(yearCfg.blankField);
    if (yearCfg.nullField) fields.add(yearCfg.nullField);
    if (yearCfg.totalVotesField) fields.add(yearCfg.totalVotesField);
    if (yearCfg.electorsField) fields.add(yearCfg.electorsField);
    if (yearCfg.colegioField) fields.add(yearCfg.colegioField);
    (yearCfg.parties || []).forEach((p) => fields.add(p.field));
    return [...fields].filter(Boolean);
  }

  function aggregateFeaturesBySection(features, yearCfg) {
    const bySec = {};
    features.forEach((f) => {
      const attrs = f.attributes || {};
      const key = normalizeSectionKey(attrs[yearCfg.sectionField]);
      if (!key) return;
      if (!bySec[key]) {
        bySec[key] = { attributes: { [yearCfg.sectionField]: key }, geometry: f.geometry || null };
        (yearCfg.parties || []).forEach((p) => { bySec[key].attributes[p.field] = 0; });
        if (yearCfg.blankField) bySec[key].attributes[yearCfg.blankField] = 0;
        if (yearCfg.nullField) bySec[key].attributes[yearCfg.nullField] = 0;
        if (yearCfg.totalVotesField) bySec[key].attributes[yearCfg.totalVotesField] = 0;
        if (yearCfg.electorsField) bySec[key].attributes[yearCfg.electorsField] = 0;
      }
      const dest = bySec[key].attributes;
      (yearCfg.parties || []).forEach((p) => { dest[p.field] += num(attrs[p.field]); });
      if (yearCfg.blankField) dest[yearCfg.blankField] += num(attrs[yearCfg.blankField]);
      if (yearCfg.nullField) dest[yearCfg.nullField] += num(attrs[yearCfg.nullField]);
      if (yearCfg.totalVotesField) dest[yearCfg.totalVotesField] += num(attrs[yearCfg.totalVotesField]);
      if (yearCfg.electorsField) dest[yearCfg.electorsField] += num(attrs[yearCfg.electorsField]);
      if (!bySec[key].geometry && f.geometry) bySec[key].geometry = f.geometry;
    });
    return Object.values(bySec);
  }

  async function queryLayerFeatures(url, outFields, returnGeometry, usePost, whereClause) {
    const where = whereClause || "1=1";
    if (usePost) {
      const body = new URLSearchParams({
        where,
        outFields: outFields.join(","),
        returnGeometry: returnGeometry ? "true" : "false",
        f: "json"
      });
      const resp = await fetch(`${url}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      const data = await resp.json();
      if (data.error) {
        throw new Error(data.error.message || "Error consultando la tabla histórica");
      }
      return (data.features || []).map((f) => ({
        attributes: f.attributes || {},
        geometry: f.geometry || null
      }));
    }

    const layer = new FeatureLayer({ url, outFields });
    await layer.load();
    const query = layer.createQuery();
    query.where = where;
    query.outFields = outFields;
    query.returnGeometry = !!returnGeometry;
    const res = await layer.queryFeatures(query);
    return (res.features || []).map((f) => ({
      attributes: f.attributes || {},
      geometry: f.geometry || null
    }));
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

    // Censo municipal fijo (cuando no hay electores por sección en la capa)
    let censusFixed = false;
    if (!hasElectors && yearCfg.censusTotal != null && Number(yearCfg.censusTotal) > 0) {
      electors = Number(yearCfg.censusTotal);
      hasElectors = true;
      censusFixed = true;
    }

    // Votos válidos = candidaturas + blancos (criterio Interior / medios). Los nulos no entran en % de partido.
    const validBallots = Math.max(0, ballots - nulls);

    const participation = hasElectors && electors > 0 ? (ballots / electors) * 100 : null;
    const blankPct = ballots > 0 ? (blanks / ballots) * 100 : null;
    const nullPct = ballots > 0 ? (nulls / ballots) * 100 : null;

    const ranking = [...yearCfg.parties]
      .map((p) => ({ ...p, votes: totals[p.id] || 0 }))
      .sort((a, b) => b.votes - a.votes);

    return {
      totals, blanks, nulls, electors, ballots, validBallots, hasElectors, participation, blankPct, nullPct, ranking,
      censusFromJoin,
      censusFixed,
      censusLabel: censusJoin && censusJoin.source ? censusJoin.source.label : null,
      matchedSections
    };
  }

  function renderMetrics(targetPrefix, stats, yearCfg) {
    const yearLabel = yearCfg && yearCfg.label;
    const partEl = document.getElementById(`${targetPrefix}Participation`);
    const blankEl = document.getElementById(`${targetPrefix}Blank`);
    const nullEl = document.getElementById(`${targetPrefix}Null`);
    const yearEl = document.getElementById(`${targetPrefix}YearLabel`);
    if (yearEl) yearEl.textContent = yearLabel || "";

    const card = document.getElementById(`metrics${targetPrefix.toUpperCase()}`);
    const caption = card && card.querySelector(".summary-caption");
    if (caption) {
      if (yearCfg && yearCfg.attributesOverride) {
        caption.textContent = "Escrutinio oficial MIR (mesas)";
      } else {
        caption.textContent = targetPrefix === "b"
          ? "Resumen del año a comparar"
          : "Resumen del año seleccionado";
      }
    }

    partEl.textContent = stats.participation == null ? "n/d" : `${stats.participation.toFixed(1)}%`;
    blankEl.textContent = stats.blankPct == null
      ? "n/d"
      : `${Number(stats.blanks || 0).toLocaleString("es-ES")} (${stats.blankPct.toFixed(2)}%)`;
    nullEl.textContent = stats.nullPct == null
      ? "n/d"
      : `${Number(stats.nulls || 0).toLocaleString("es-ES")} (${stats.nullPct.toFixed(2)}%)`;

    const hint = document.getElementById(`${targetPrefix}PartHint`);
    if (hint) {
      if (stats.hasElectors) {
        const joinNote = stats.censusFromJoin && stats.censusLabel
          ? ` · vía ${stats.censusLabel}`
          : (stats.censusFixed ? " · censo municipal" : "");
        const mirNote = yearCfg && yearCfg.attributesOverride ? " · MIR oficial" : "";
        hint.textContent = `${stats.ballots.toLocaleString("es-ES")} votos / ${stats.electors.toLocaleString("es-ES")} electores${joinNote}${mirNote}`;
      } else {
        hint.textContent = yearCfg && yearCfg.attributesOverride
          ? "Escrutinio oficial MIR (sin censo en capa)"
          : "Sin censo publicado para esta convocatoria";
      }
    }

    const legend = document.getElementById(`${targetPrefix}Legend`);
    legend.innerHTML = "";
    const pctBase = stats.validBallots > 0 ? stats.validBallots : stats.ballots;
    stats.ranking.slice(0, 5).forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "legend-row";
      const pct = pctBase > 0 ? ((p.votes / pctBase) * 100).toFixed(2) : "0.00";
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

  const attributesOverrideCache = {};

  async function loadAttributesOverride(yearCfg) {
    const path = yearCfg && yearCfg.attributesOverride;
    if (!path) return null;
    if (attributesOverrideCache[path]) return attributesOverrideCache[path];
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`No se pudo cargar override ${path}: ${resp.status}`);
    const data = await resp.json();
    const bySection = data.bySection || data;
    attributesOverrideCache[path] = bySection;
    return bySection;
  }

  function applyAttributesOverride(features, yearCfg, bySection) {
    if (!bySection) return features;
    return features.map((f) => {
      const key = normalizeSectionKey(f.attributes[yearCfg.sectionField]);
      const ov = key ? bySection[key] : null;
      if (!ov) return f;
      return {
        attributes: { ...f.attributes, ...ov },
        geometry: f.geometry
      };
    });
  }

  async function queryYearFeatures(yearCfg) {
    const outFields = buildOutFields(yearCfg);
    const needsGeomJoin = !!(yearCfg.geometrySource && yearCfg.geometrySource.url);
    let features = await queryLayerFeatures(
      yearCfg.url,
      outFields,
      !needsGeomJoin,
      !!yearCfg.queryViaPost,
      yearCfg.where || "1=1"
    );

    features = features.filter((f) => {
      const raw = f.attributes[yearCfg.sectionField];
      // OBJECTID u otros identificadores numéricos de polígono (p.ej. municipales 2007)
      if (yearCfg.sectionField === "OBJECTID") return raw != null && raw !== "";
      return isValidSection(raw);
    });

    if (yearCfg.aggregateBySection) {
      features = aggregateFeaturesBySection(features, yearCfg);
    }

    if (needsGeomJoin) {
      const geomSectionField = yearCfg.geometrySource.sectionField || "SECCION";
      const geomFeats = await queryLayerFeatures(
        yearCfg.geometrySource.url,
        [geomSectionField],
        true,
        false
      );
      const geomBySec = {};
      geomFeats.forEach((g) => {
        const key = normalizeSectionKey(g.attributes[geomSectionField]);
        if (key && g.geometry && !geomBySec[key]) geomBySec[key] = g.geometry;
      });
      features = features
        .map((f) => {
          const key = normalizeSectionKey(f.attributes[yearCfg.sectionField]);
          return {
            attributes: f.attributes,
            geometry: geomBySec[key] || null
          };
        })
        .filter((f) => !!f.geometry);
    }

    if (yearCfg.attributesOverride) {
      const bySection = await loadAttributesOverride(yearCfg);
      const before = features.length;
      features = applyAttributesOverride(features, yearCfg, bySection);
      let matched = 0;
      features.forEach((f) => {
        const key = normalizeSectionKey(f.attributes[yearCfg.sectionField]);
        if (key && bySection[key]) matched += 1;
      });
      console.info(`[Hub] Override ${yearCfg.attributesOverride}: ${matched}/${before} secciones corregidas`);
    }

    return features.filter((f) => !!f.geometry);
  }

  function sectionRankForFeature(attrs, yearCfg) {
    let partySum = 0;
    const ranked = yearCfg.parties.map((p) => {
      const votes = num(attrs[p.field]);
      partySum += votes;
      return { ...p, votes };
    }).sort((a, b) => b.votes - a.votes);

    const blanks = yearCfg.blankField ? num(attrs[yearCfg.blankField]) : 0;
    const nulls = yearCfg.nullField ? num(attrs[yearCfg.nullField]) : 0;
    let ballots = partySum + blanks + nulls;
    if (yearCfg.totalVotesField && attrs[yearCfg.totalVotesField] != null) {
      ballots = num(attrs[yearCfg.totalVotesField]);
    }
    const validBallots = Math.max(0, ballots - nulls);
    return { ranked, ballots, validBallots, blanks, nulls };
  }

  function buildPopupHtml(attrs, yearCfg) {
    const sectionKey = normalizeSectionKey(attrs[yearCfg.sectionField]);
    const colegioFromAttr = yearCfg.colegioField ? (attrs[yearCfg.colegioField] || "") : "";
    const colegio = colegioFromAttr
      || (window.HUB_CONFIG.colegioForSection && window.HUB_CONFIG.colegioForSection(sectionKey))
      || "No disponible";
    const { ranked, validBallots, ballots } = sectionRankForFeature(attrs, yearCfg);
    const top5 = ranked.filter((p) => p.votes > 0).slice(0, 5);
    const win = top5[0] || null;
    const pctBase = validBallots > 0 ? validBallots : ballots;

    const partyLabel = (p) => p.fullName || p.name;

    const rows = top5.length
      ? top5.map((p, idx) => {
          const pct = pctBase > 0 ? ((p.votes / pctBase) * 100).toFixed(2) : "0.00";
          return `<li>
            <span class="left">
              <span>${idx + 1}.</span>
              <span class="swatch" style="background:${p.color}"></span>
              <span class="party-name" title="${partyLabel(p)}">${partyLabel(p)}</span>
            </span>
            <span class="pct">${p.votes.toLocaleString("es-ES")} · ${pct}%</span>
          </li>`;
        }).join("")
      : "<li>Sin votos contabilizados</li>";

    const winLine = win
      ? `<p class="hist-popup-meta">Ganador: <strong>${partyLabel(win)}</strong> (${win.votes.toLocaleString("es-ES")} votos)</p>`
      : `<p class="hist-popup-meta">Sin datos de ganador</p>`;

    const sectionLine = yearCfg.colegioField
      ? ""
      : `<p class="hist-popup-meta"><strong>Sección:</strong> ${sectionKey || "—"}</p>`;

    return `
      <div class="hist-popup">
        <p class="hist-popup-meta"><strong>Colegio:</strong> ${colegio}</p>
        ${sectionLine}
        <p class="hist-popup-meta"><strong>Convocatoria:</strong> ${yearCfg.label}</p>
        ${winLine}
        <h5>5 fuerzas más votadas</h5>
        <ul class="hist-popup-list">${rows}</ul>
      </div>
    `;
  }

  function buildGraphics(features, yearCfg) {
    const polys = [];
    const labels = [];
    features.forEach((feature) => {
      const win = winnerForFeature(feature.attributes, yearCfg);
      const sectionKey = normalizeSectionKey(feature.attributes[yearCfg.sectionField]);
      let fill = [203, 213, 225, 0.5];
      if (win) {
        const hex = win.party.color.replace("#", "");
        fill = [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
          0.92
        ];
      }
      polys.push(new Graphic({
        geometry: feature.geometry,
        attributes: {
          ...feature.attributes,
          __hubYear: yearCfg.year,
          __hubLabel: yearCfg.label,
          __sectionKey: sectionKey
        },
        symbol: {
          type: "simple-fill",
          color: fill,
          outline: { type: "simple-line", color: [60, 70, 85, 0.55], width: 0.7 }
        },
        popupTemplate: {
          title: `Sección ${sectionKey || feature.attributes[yearCfg.sectionField]}`,
          content: buildPopupHtml(feature.attributes, yearCfg)
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

  function updateSwipeCartels(labelA, labelB, compareOn) {
    const cartelA = document.getElementById("swipeCartelA");
    const cartelB = document.getElementById("swipeCartelB");
    const titleA = document.getElementById("swipeCartelATitle");
    const titleB = document.getElementById("swipeCartelBTitle");
    if (!cartelA || !cartelB) return;
    if (titleA) titleA.textContent = labelA || "—";
    if (titleB) titleB.textContent = labelB || "—";
    cartelA.classList.toggle("hidden", !compareOn);
    cartelB.classList.toggle("hidden", !compareOn);
    cartelA.setAttribute("aria-hidden", compareOn ? "false" : "true");
    cartelB.setAttribute("aria-hidden", compareOn ? "false" : "true");
  }

  function isLeadingSwipeSide(event) {
    if (!swipeWidget) return true;
    const splitX = (Number(swipeWidget.position) / 100) * view.width;
    return event.x <= splitX;
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
      if (yearA.attributesOverride) {
        console.info(`[Hub] Municipales override MIR aplicado (${featsA.length} secciones). Blancos/nulos oficiales.`);
      }
      renderMetrics("a", partyVotesTotal(featsA, yearA, censusA), yearA);

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
        renderMetrics("b", partyVotesTotal(featsB, yearB, censusB), yearB);

        clearSwipe();
        swipeWidget = new Swipe({
          view,
          leadingLayers: [colorLayerA, labelsLayerA],
          trailingLayers: [colorLayerB, labelsLayerB],
          direction: "horizontal",
          position: 50
        });
        view.ui.add(swipeWidget);
        updateSwipeCartels(yearA.label, yearB.label, true);
      } else {
        colorLayerB.visible = false;
        labelsLayerB.visible = false;
        colorLayerB.removeAll();
        labelsLayerB.removeAll();
        clearSwipe();
        updateSwipeCartels(yearA.label, "", false);
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

  // Popups: en modo swipe solo consultar la capa del lado clicado
  view.popup.autoOpenEnabled = false;
  view.on("click", async (event) => {
    try {
      const includeLayers = (mode === "compare" && swipeWidget)
        ? (isLeadingSwipeSide(event) ? [colorLayerA] : [colorLayerB])
        : [colorLayerA];

      const response = await view.hitTest(event, { include: includeLayers });
      const hit = (response.results || []).find((r) => {
        const g = r.graphic;
        return g && g.geometry && g.geometry.type === "polygon";
      });

      if (!hit || !hit.graphic) {
        view.popup.close();
        return;
      }

      const graphic = hit.graphic;
      view.popup.open({
        location: event.mapPoint,
        features: [graphic],
        fetchFeatures: false
      });
    } catch (err) {
      console.warn("[histórico] Error abriendo popup:", err);
    }
  });

  view.when(() => refresh());
});
