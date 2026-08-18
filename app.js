// Portal Electoral de Escrutinio y Representación Geográfica - Rivas-Vaciamadrid
// Integración con ArcGIS Maps SDK para JavaScript (v4.29) y localStorage híbrido

require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/identity/IdentityManager",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/symbols/PictureMarkerSymbol",
    "esri/symbols/TextSymbol",
    "esri/widgets/Home"
], function(Map, MapView, FeatureLayer, IdentityManager, Graphic, GraphicsLayer, PictureMarkerSymbol, TextSymbol, Home) {

    // ==========================================================================
    // CONFIGURACIÓN DE URLS DE ARCGIS ENTERPRISE (SECURED FEATURE SERVER)
    // ==========================================================================
    // URLs para la vista pública (servicio de solo lectura)
    const PUBLIC_SERVICE_URL = "https://sit.rivasciudad.es/server/rest/services/Elecciones_Rivas_Gen_Prueba_VISTA/FeatureServer";
    const URL_COLEGIOS = `${PUBLIC_SERVICE_URL}/0`;
    const URL_SECCIONES = `${PUBLIC_SERVICE_URL}/1`;
    const URL_MESAS_TABLE = `${PUBLIC_SERVICE_URL}/6`;

    // URLs para la gestión de datos (servicio editable - requiere autenticación)
    const EDITABLE_SERVICE_URL = "https://sit.rivasciudad.es/server/rest/services/Elecciones_Rivas_Gen_Prueba/FeatureServer";
    const URL_MESAS_TABLE_EDIT = `${EDITABLE_SERVICE_URL}/6`;

    // ==========================================================================
    // ESTADO GLOBAL DE LA APLICACIÓN
    // ==========================================================================
    let state = {
        mesas: [],          // Base de datos de mesas (unificada de localStorage y/o ArcGIS)
        currentUser: null,  // Usuario actual logueado: { username, role: 'admin'|'colegio', colegioName }
        selectedMesa: null, // Mesa que está escrutando el usuario actual
        arcgisMode: false,  // True si está autenticado en ArcGIS y sincronizando
        syncInterval: null, // Intervalo para sincronización periódica en segundo plano
        map: null,
        view: null,
        seccionesLayer: null,
        labelsLayer: null,
        colegiosLayer: null
    };

    // Usuarios locales de respaldo (por si falla la red o para pruebas rápidas)
    const LOCAL_USERS = {
        "AdminEleccionesGenPrueba": { role: "admin", colegio: null },
        "JaramaEleccionesGenPrueba": { role: "colegio", colegio: "C.E.I.P. JARAMA" },
        "AlmendrosEleccionesGenPrueba": { role: "colegio", colegio: "C.E.I.P. LOS ALMENDROS" },
        "jmrojas": { role: "admin", colegio: null },
        "camartin": { role: "admin", colegio: null },
        "sbenito": { role: "colegio", colegio: "C.E.I.P. LOS ALMENDROS" },
        "tromero": { role: "colegio", colegio: "C.E.I.P. JARAMA" }
    };

    // Mesas iniciales por defecto (vacío, la única fuente es ArcGIS Server)
    const DEFAULT_MESAS = [];

    // ==========================================================================
    // INICIALIZACIÓN DE LA APLICACIÓN
    // ==========================================================================
    function init() {
        // 0. Restaurar credenciales y tokens de ArcGIS IdentityManager si existen
        restoreIdentityManagerSession();

        // 1. Inicializar base de datos local
        initLocalDatabase();
        
        // 2. Intentar recuperar sesión previa de usuario
        restoreSession();

        // 3. Inicializar el Mapa de ArcGIS
        initArcGISMap();

        // 4. Vincular eventos del DOM
        setupEventListeners();

        // 5. Vincular canvas de firma
        setupSignatureCanvas("canvas-signature-president");
        setupSignatureCanvas("canvas-signature-vocal1");
        setupSignatureCanvas("canvas-signature-vocal2");

        // 6. Generar Inputs de Votos en el Portal de forma dinámica
        generateVoteFields();

        // 6.5 Configurar alternadores de visibilidad de contraseña (Ojo)
        setupPasswordToggles();

        // 7. Cargar resultados de ArcGIS Server si están disponibles públicamente (o sincronizar si está logueado)
        loadResultsFromServer();
        startPeriodicSync();

        // 8. Renderizar vistas iniciales
        updateGlobalMetrics();

        // 9. Exponer estado globalmente para depuración en la consola del navegador
        window.appState = state;
        window.appConfig = { PARTIES_CONFIG, SECTION_COLEGIO_MAPPING, COLEGIO_DETAILS };

        // 10. Liberar la mesa si el usuario cierra la pestaña o el navegador sin salir formalmente.
        //     pagehide es más fiable que beforeunload en móviles y navegadores modernos.
        window.addEventListener("pagehide", () => {
            if (state.selectedMesa && (state.selectedMesa.estado === "Escrutando" || state.selectedMesa.estado === "Asignada")) {
                releaseMesaViaBeacon(state.selectedMesa);
            }
        });
        window.addEventListener("beforeunload", () => {
            if (state.selectedMesa && (state.selectedMesa.estado === "Escrutando" || state.selectedMesa.estado === "Asignada")) {
                releaseMesaViaBeacon(state.selectedMesa);
            }
        });
    }

    // Inicializa la base de datos local en localStorage
    function initLocalDatabase() {
        const saved = localStorage.getItem("elecciones_mesas");
        if (saved) {
            try {
                state.mesas = JSON.parse(saved);
            } catch (e) {
                state.mesas = [];
            }
        } else {
            state.mesas = [];
        }
        
        // Restablecer o cargar configuración de partidos de localStorage si existe
        loadPartiesFromStorage();

        if (!localStorage.getItem("elecciones_colegios_cerrados")) {
            localStorage.setItem("elecciones_colegios_cerrados", JSON.stringify([]));
        }
        rebuildDynamicMappings();
    }

    // Guarda el estado actual de las mesas en localStorage
    function saveLocalDatabase() {
        try {
            localStorage.setItem("elecciones_mesas", JSON.stringify(state.mesas));
            window.dispatchEvent(new Event("localDatabaseUpdated"));
        } catch (e) {
            console.error("Error al guardar en localStorage:", e);
        }
    }

    // Intenta restaurar sesión de usuario de localStorage
    function restoreSession() {
        const storedUser = localStorage.getItem("elecciones_user");
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                const allowedUsers = Object.keys(LOCAL_USERS).map(u => u.toLowerCase());
                if (parsed && parsed.username && (allowedUsers.includes(parsed.username.toLowerCase()) || parsed.role)) {
                    state.currentUser = parsed;
                    state.arcgisMode = localStorage.getItem("elecciones_arcgis_mode") === "true";
                    showLoggedInUserInterface();
                    
                    // Si estamos en modo ArcGIS, forzar sincronización de mesas tras restaurar sesión
                    if (state.arcgisMode) {
                        syncDataWithArcGISServer();
                        startPeriodicSync();
                    }
                } else {
                    localStorage.removeItem("elecciones_user");
                    localStorage.removeItem("elecciones_arcgis_mode");
                }
            } catch (e) {
                localStorage.removeItem("elecciones_user");
                localStorage.removeItem("elecciones_arcgis_mode");
            }
        }
    }

    // ==========================================================================
    // INTEGRACIÓN CON ARCGIS MAPS SDK
    // ==========================================================================
    function initArcGISMap() {
        // Creamos la capa de secciones censales (Polígonos). Cargará la del servicio de pruebas.
        // Nota: Si no hay token de ArcGIS o falla, la capa dará error de token, por lo que usaremos un mapa base público
        // y cargaremos el FeatureLayer de producción si es necesario, o manejaremos el popup de IdentityManager.
        
        state.seccionesLayer = new FeatureLayer({
            id: "seccionesLayer",
            url: URL_SECCIONES,
            outFields: ["*"],
            opacity: 0.7,
            popupTemplate: {
                title: "Sección Censal {SECCION}",
                content: function(featureInfo) {
                    return getPopupContent(featureInfo.graphic.attributes);
                }
            }
        });

        state.labelsLayer = new GraphicsLayer({ id: "labelsLayer" });

        // Capa de colegios electorales (Puntos)
        state.colegiosLayer = new FeatureLayer({
            id: "colegiosLayer",
            url: URL_COLEGIOS,
            outFields: ["*"],
            visible: true
        });

        // Mapa Base Gris de ArcGIS
        state.map = new Map({
            basemap: "gray-vector",
            layers: [state.seccionesLayer, state.labelsLayer]
        });

        state.view = new MapView({
            container: "mapViewDiv",
            map: state.map,
            center: [-3.532, 40.347], // Rivas Vaciamadrid
            zoom: 12.5,
            popup: {
                defaultPopupTemplateEnabled: false,
                dockEnabled: true,
                dockOptions: { buttonEnabled: false, breakpoint: false, position: "top-right" }
            }
        });

        const homeWidget = new Home({ view: state.view });
        state.view.ui.add(homeWidget, "top-left");

        // Al cargar la vista del mapa, consultamos las geometrías de las secciones para agregaciones y etiquetas
        state.view.when(() => {
            const mapLoader = document.getElementById("mapLoader");
            if (mapLoader) mapLoader.classList.add("hidden");
            // Si el servicio responde (con token o público), descargamos las features
            queryAllGeometries();
        }, (err) => {
            console.warn("Error cargando el mapa de ArcGIS:", err);
            const mapLoader = document.getElementById("mapLoader");
            if (mapLoader) mapLoader.classList.add("hidden");
        });
    }

    // Consulta todas las geometrías de las secciones censales y las guarda para renderizar los logotipos en cliente
    let geomsCache = [];
    function queryAllGeometries() {
        if (!state.seccionesLayer) return;
        
        state.seccionesLayer.when(() => {
            const query = state.seccionesLayer.createQuery();
            query.where = "1=1";
            query.outFields = ["*"];
            query.returnGeometry = true;

            state.seccionesLayer.queryFeatures(query).then(results => {
                geomsCache = results.features;
                // Dibujar colores e iconos iniciales
                renderMapTheme();
            }).catch(err => {
                console.warn("No se pudo obtener las geometrías de la capa segura:", err);
                fallbackToPublicGeometries();
            });
        }, (err) => {
            console.warn("La capa segura seccionesLayer falló al cargar (requiere login o token):", err);
            // Si la capa segura falla en cargarse, saltamos al fallback público
            fallbackToPublicGeometries();
        });
    }

    function fallbackToPublicGeometries() {
        console.log("Cargando capa geográfica pública alternativa...");
        const publicSecLayer = new FeatureLayer({
            url: "https://sit.rivasciudad.es/server/rest/services/V_ELECCIONES_GENERALES2023/FeatureServer/0",
            outFields: ["*"],
            popupTemplate: {
                title: "Sección Censal {SECCION}",
                content: function(featureInfo) {
                    return getPopupContent(featureInfo.graphic.attributes);
                }
            }
        });
        
        publicSecLayer.when(() => {
            const query = publicSecLayer.createQuery();
            query.where = "1=1";
            query.outFields = ["*"];
            query.returnGeometry = true;
            
            publicSecLayer.queryFeatures(query).then(results => {
                geomsCache = results.features;
                // Sustituir la capa protegida por la pública en el índice 0 (base)
                state.map.remove(state.seccionesLayer);
                state.seccionesLayer = publicSecLayer;
                state.map.add(state.seccionesLayer, 0);
                // labelsLayer queda en índice 1 hasta que renderMapTheme la reordene
                
                // Forzar actualización del mapa (renderMapTheme insertará colorPolygonsLayer en índice 1)
                renderMapTheme();
            }).catch(e => {
                console.error("Fallo consultando geometrías en la capa pública:", e);
            });
        }, (err) => {
            console.error("La capa pública publicSecLayer falló al iniciarse:", err);
        });
    }

    // ==========================================================================
    // MANEJO DE EVENTOS Y VINCULACIONES DOM
    // ==========================================================================
    function setupEventListeners() {
        // Botón Acceso Portal / Cerrar Sesión en Header
        const btnPortalAction = document.getElementById("btn-portal-action");
        btnPortalAction.addEventListener("click", () => {
            if (state.currentUser) {
                // Cerrar Sesión
                logoutUser();
            } else {
                // Ir a Login
                switchView("login-view");
            }
        });

        // Cancelar Login
        document.getElementById("btn-login-cancel").addEventListener("click", () => {
            switchView("public-dashboard-view");
        });

        // Iniciar Sesión Directa con Formulario (Usuario + Contraseña)
        const formLoginDirect = document.getElementById("form-login-direct");
        if (formLoginDirect) {
            formLoginDirect.addEventListener("submit", (e) => {
                e.preventDefault();
                const username = document.getElementById("login-username").value.trim();
                const password = document.getElementById("login-password").value;
                if (!username) return;

                const submitBtn = document.getElementById("btn-login-submit");
                const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "Iniciar Sesión";
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Conectando con ArcGIS...`;
                }

                const errBox = document.getElementById("login-error-msg");
                const errText = document.getElementById("login-error-text");
                if (errBox) {
                    errBox.classList.add("hidden");
                    errBox.style.display = "none";
                }

                // Generar y registrar token oficial de ArcGIS Enterprise
                generateAndRegisterArcGISToken(username, password).then(() => {
                    console.log("Token de ArcGIS obtenido y registrado con éxito para:", username);
                    const allowed = loginUserSuccess(username, true);
                    if (!allowed) {
                        if (errBox && errText) {
                            errText.textContent = `El usuario '${username}' no tiene rol configurado en la aplicación.`;
                            errBox.classList.remove("hidden");
                            errBox.style.display = "flex";
                        }
                    }
                }).catch(err => {
                    console.warn("Fallo de autenticación en ArcGIS Enterprise:", err);
                    if (errBox && errText) {
                        errText.textContent = err.message || "Usuario o contraseña incorrectos en el Portal ArcGIS Enterprise.";
                        errBox.classList.remove("hidden");
                        errBox.style.display = "flex";
                    }
                }).finally(() => {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnHtml;
                    }
                });
            });
        }

        // Iniciar Sesión con ArcGIS Portal (Diálogo Oficial)
        const btnLoginArcGIS = document.getElementById("btn-login-arcgis");
        if (btnLoginArcGIS) {
            btnLoginArcGIS.addEventListener("click", () => {
                handleArcGISLogin();
            });
        }



        // Buscador de Censo por DNI
        const btnDniSearch = document.getElementById("btn-dni-search-action");
        if (btnDniSearch) {
            btnDniSearch.addEventListener("click", handleDniSearch);
        }
        const inputDniSearch = document.getElementById("dni-search-input");
        if (inputDniSearch) {
            inputDniSearch.addEventListener("keypress", (e) => {
                if (e.key === "Enter") handleDniSearch();
            });
        }

        // Pestañas de la Barra Lateral (Global / Colegios / Mi Colegio)
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTabId = btn.getAttribute("data-tab");
                
                // Desactivar todos los botones de pestaña
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                // Activar este botón
                btn.classList.add("active");
                
                // Desactivar todos los paneles de pestaña
                document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
                // Activar el panel objetivo
                const targetPane = document.getElementById(targetTabId);
                if (targetPane) {
                    targetPane.classList.add("active");
                }
            });
        });

        // Buscador de Colegios
        document.getElementById("colegio-search").addEventListener("input", (e) => {
            filterColegiosList(e.target.value);
        });

        // Cerrar Modales
        const closeDetailBtns = document.querySelectorAll("#btn-close-colegio-modal, #btn-close-colegio-modal-footer");
        closeDetailBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                document.getElementById("modal-colegio-detail").classList.add("hidden");
            });
        });

        document.getElementById("btn-close-add-mesa-modal").addEventListener("click", () => {
            document.getElementById("modal-admin-add-mesa").classList.add("hidden");
        });
        document.getElementById("btn-cancel-add-mesa").addEventListener("click", () => {
            document.getElementById("modal-admin-add-mesa").classList.add("hidden");
        });

        document.getElementById("btn-close-acta-modal").addEventListener("click", () => {
            document.getElementById("modal-view-acta").classList.add("hidden");
        });
        document.getElementById("btn-close-acta-modal-footer").addEventListener("click", () => {
            document.getElementById("modal-view-acta").classList.add("hidden");
        });

        // Enviar Nueva Mesa (Admin)
        document.getElementById("form-admin-add-mesa").addEventListener("submit", (e) => {
            e.preventDefault();
            handleAdminAddMesa();
        });

        // Botones de Escrutinio en Colegio
        document.getElementById("btn-portal-logout").addEventListener("click", logoutUser);
        document.getElementById("btn-change-mesa").addEventListener("click", async () => {
            if (state.selectedMesa) {
                if (state.selectedMesa.estado === "Escrutando" || state.selectedMesa.estado === "Asignada") {
                    await releaseMesaOnExit(state.selectedMesa);
                }
                state.selectedMesa = null;
            }
            showSchoolPortalView();
        });

        // Cambiar Votos: Sumar en vivo en Escrutinio
        const votesContainer = document.getElementById("portal-votes-fields-container");
        if (votesContainer) {
            votesContainer.addEventListener("input", (e) => {
                if (e.target.classList.contains("vote-input-field")) {
                    recalculateVotesSum();
                }
            });
        }

        // Selector de las 3 Fases del Portal (1º Avance, 2º Avance, Escrutinio)
        document.querySelectorAll(".portal-phase-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const phaseKey = btn.getAttribute("data-phase");
                switchPortalPhase(phaseKey);
            });
        });

        // Eventos live en inputs de los avances 1 y 2
        const inputP1 = document.getElementById("input-part1-voters");
        if (inputP1) {
            inputP1.addEventListener("input", updateAdvance1LivePercent);
        }
        const inputP2 = document.getElementById("input-part2-voters");
        if (inputP2) {
            inputP2.addEventListener("input", updateAdvance2LivePercent);
        }

        // Enviar avances de participación y cierre de mesa
        const btnPart1 = document.getElementById("btn-submit-part1");
        if (btnPart1) btnPart1.addEventListener("click", handleParticipacion1Submit);

        const btnPart2 = document.getElementById("btn-submit-part2");
        if (btnPart2) btnPart2.addEventListener("click", handleParticipacion2Submit);

        const btnSubmitMesa = document.getElementById("btn-submit-mesa");
        if (btnSubmitMesa) btnSubmitMesa.addEventListener("click", handleMesaEscrutinioSubmit);

        // Modales de Administración (Edición de Votos y Miembros)
        const btnCloseAdminVotes = document.getElementById("btn-close-admin-edit-votes");
        if (btnCloseAdminVotes) btnCloseAdminVotes.addEventListener("click", () => document.getElementById("modal-admin-edit-votes").classList.add("hidden"));

        const btnCancelAdminVotes = document.getElementById("btn-cancel-admin-edit-votes");
        if (btnCancelAdminVotes) btnCancelAdminVotes.addEventListener("click", () => document.getElementById("modal-admin-edit-votes").classList.add("hidden"));

        const formAdminVotes = document.getElementById("form-admin-edit-votes");
        if (formAdminVotes) formAdminVotes.addEventListener("submit", saveAdminEditVotesSubmit);

        const btnCloseAdminMembers = document.getElementById("btn-close-admin-edit-members");
        if (btnCloseAdminMembers) btnCloseAdminMembers.addEventListener("click", () => document.getElementById("modal-admin-edit-members").classList.add("hidden"));

        const btnCancelAdminMembers = document.getElementById("btn-cancel-admin-edit-members");
        if (btnCancelAdminMembers) btnCancelAdminMembers.addEventListener("click", () => document.getElementById("modal-admin-edit-members").classList.add("hidden"));

        const formAdminMembers = document.getElementById("form-admin-edit-members");
        if (formAdminMembers) formAdminMembers.addEventListener("submit", saveAdminEditMembersSubmit);

        // Modal de Discrepancia
        const btnCloseDisc = document.getElementById("btn-close-discrepancy-modal");
        if (btnCloseDisc) btnCloseDisc.addEventListener("click", () => document.getElementById("modal-discrepancy-warning").classList.add("hidden"));

        const btnCancelDisc = document.getElementById("btn-cancel-discrepancy");
        if (btnCancelDisc) btnCancelDisc.addEventListener("click", () => document.getElementById("modal-discrepancy-warning").classList.add("hidden"));

        const btnConfirmDisc = document.getElementById("btn-confirm-discrepancy");
        if (btnConfirmDisc) btnConfirmDisc.addEventListener("click", () => {
            document.getElementById("modal-discrepancy-warning").classList.add("hidden");
            if (pendingParticipacionAction) {
                pendingParticipacionAction();
                pendingParticipacionAction = null;
            }
        });

        // Acciones de Administración
        document.getElementById("btn-admin-logout").addEventListener("click", logoutUser);
        
        const addMesaColSelect = document.getElementById("add-mesa-colegio");
        const addMesaSecSelect = document.getElementById("add-mesa-seccion");
        const addMesaLetSelect = document.getElementById("add-mesa-letra");

        if (addMesaColSelect) {
            addMesaColSelect.addEventListener("change", (e) => {
                updateMesaSeccionDropdown(e.target.value, addMesaSecSelect);
                updateAddMesaPreview();
            });
        }
        if (addMesaSecSelect) {
            addMesaSecSelect.addEventListener("change", updateAddMesaPreview);
        }
        if (addMesaLetSelect) {
            addMesaLetSelect.addEventListener("change", updateAddMesaPreview);
        }

        document.getElementById("btn-admin-add-mesa").addEventListener("click", () => {
            // Cargar selectores de colegios
            const select = document.getElementById("add-mesa-colegio");
            select.innerHTML = "";
            let firstColName = "";
            for (const colName in COLEGIO_DETAILS) {
                if (!firstColName) firstColName = colName;
                const opt = document.createElement("option");
                opt.value = colName;
                opt.textContent = colName;
                select.appendChild(opt);
            }
            updateMesaSeccionDropdown(firstColName, document.getElementById("add-mesa-seccion"));
            updateAddMesaPreview();
            
            document.getElementById("modal-admin-add-mesa").classList.remove("hidden");
        });

        document.getElementById("btn-admin-reset-db").addEventListener("click", handleAdminResetDB);
        document.getElementById("btn-admin-demo-fill").addEventListener("click", handleAdminDemoFill);
        document.getElementById("btn-admin-delete-demo-mesas").addEventListener("click", handleAdminDeleteAllMesas);

        // Gestión de Fuerzas Políticas (Partidos)
        const btnManageParties = document.getElementById("btn-admin-manage-parties");
        if (btnManageParties) {
            btnManageParties.addEventListener("click", () => {
                renderAdminPartiesModal();
                document.getElementById("modal-admin-parties").classList.remove("hidden");
            });
        }
        const btnCloseParties = document.getElementById("btn-close-parties-modal");
        if (btnCloseParties) {
            btnCloseParties.addEventListener("click", () => {
                document.getElementById("modal-admin-parties").classList.add("hidden");
            });
        }
        const colorInput = document.getElementById("party-color-input");
        if (colorInput) {
            colorInput.addEventListener("input", function() {
                const hexSpan = document.getElementById("party-color-hex");
                if (hexSpan) hexSpan.textContent = this.value;
            });
        }
        const formAddParty = document.getElementById("form-add-party");
        if (formAddParty) {
            formAddParty.addEventListener("submit", handleAdminAddParty);
        }
        const btnDeleteAllParties = document.getElementById("btn-admin-delete-all-parties");
        if (btnDeleteAllParties) {
            btnDeleteAllParties.addEventListener("click", handleAdminDeleteAllParties);
        }

        // Imprimir acta
        document.getElementById("btn-print-acta").addEventListener("click", () => {
            setTimeout(() => {
                window.print();
            }, 50);
        });

        // Exportar a CSV e Imprimir Informe PDF (Vista Pública)
        document.getElementById("btn-export-csv").addEventListener("click", () => {
            exportToCSV();
        });
        document.getElementById("btn-export-pdf").addEventListener("click", () => {
            exportToPDF();
        });

        // Borrar canvas
        document.querySelectorAll(".btn-clear-canvas").forEach(btn => {
            btn.addEventListener("click", function() {
                const canvasId = this.getAttribute("data-canvas");
                const canvas = document.getElementById(canvasId);
                if (canvas && canvas.clear) {
                    canvas.clear();
                }
            });
        });

        // Sincronizar dinámicamente cuando hay cambios en el almacenamiento (entre pestañas / incógnito)
        function syncUIFromState() {
            // Cargar partidos PRIMERO, luego comprobar si el DOM necesita actualizarse
            const sigBefore = PARTIES_CONFIG.map(p => `${p.id}:${p.name}`).join("|");
            loadPartiesFromStorage();
            const sigAfter = PARTIES_CONFIG.map(p => `${p.id}:${p.name}`).join("|");

            // Regenerar si los partidos cambiaron O si el container no tiene el número correcto de tarjetas
            if (!state.selectedMesa) {
                const container = document.getElementById("portal-votes-fields-container");
                const currentCards = container ? container.querySelectorAll("[data-party]").length : -1;
                if (sigBefore !== sigAfter || currentCards !== PARTIES_CONFIG.length) {
                    generateVoteFields();
                }
            }

            initLocalDatabase();
            updateGlobalMetrics();
            renderMapTheme();
            if (state.currentUser && state.currentUser.role === "admin") {
                renderAdminPortal();
            } else if (state.currentUser && state.currentUser.role === "colegio" && !state.selectedMesa) {
                showSchoolPortalView();
            }
        }

        window.addEventListener("storage", (e) => {
            if (e.key === "elecciones_mesas" || e.key === "elecciones_colegios_cerrados" || e.key === "elecciones_parties_config") {
                syncUIFromState();
            }
        });

        window.addEventListener("localDatabaseUpdated", syncUIFromState);

        // Refresco dinámico cada 3 segundos para sincronizar pestañas incógnito/normal
        setInterval(() => {
            if (state.arcgisMode) {
                syncDataWithArcGISServer();
            } else {
                syncUIFromState();
            }
        }, 3000);
    }

    // Cambia de sección visible (Público, Login, Colegio, Admin)
    function switchView(viewId) {
        document.querySelectorAll(".view-section").forEach(sec => {
            sec.classList.add("hidden");
        });
        document.getElementById(viewId).classList.remove("hidden");

        // Acciones específicas al entrar a una vista
        if (viewId === "public-dashboard-view") {
            updateGlobalMetrics();
            renderMapTheme();
            // Refrescar tamaño del mapa
            if (state.view) {
                state.view.container = "mapViewDiv";
            }
        }
    }

    // ==========================================================================
    // AUTENTICACIÓN (LOCAL Y ARCGIS SECURED SERVICES)
    // ==========================================================================
    
    // Autenticación REAL contra el portal ArcGIS Enterprise mediante popup seguro de Esri
    function handleArcGISLogin() {
        const errorDiv = document.getElementById("login-error-msg");
        const errorText = document.getElementById("login-error-text");
        if (errorDiv) {
            errorDiv.classList.add("hidden");
            errorDiv.style.display = "none";
        }

        console.log("Invocando ArcGIS IdentityManager para login real en el portal...");
        
        IdentityManager.getCredential(EDITABLE_SERVICE_URL, {
            forcePermissionPage: false
        }).then(credential => {
            console.log("Autenticación exitosa en Portal ArcGIS. Usuario:", credential.userId);
            saveIdentityManagerSession();
            const allowed = loginUserSuccess(credential.userId, true);
            if (!allowed) {
                if (errorDiv && errorText) {
                    errorText.textContent = `El usuario '${credential.userId}' no tiene rol configurado en la aplicación.`;
                    errorDiv.classList.remove("hidden");
                    errorDiv.style.display = "flex";
                }
            }
        }).catch(err => {
            console.warn("Fallo de autenticación en ArcGIS Portal:", err);
            if (errorDiv && errorText) {
                errorText.textContent = "Error al autenticar contra el portal ArcGIS Enterprise.";
                errorDiv.classList.remove("hidden");
                errorDiv.style.display = "flex";
            }
        });
    }

    function loginUserSuccess(username, isArcGIS) {
        if (!username) return false;

        let userObj = null;
        // 1. Buscar coincidencia exacta o case-insensitive en LOCAL_USERS
        const matchKey = Object.keys(LOCAL_USERS).find(k => k.toLowerCase() === username.toLowerCase());
        if (matchKey) {
            userObj = LOCAL_USERS[matchKey];
        } else {
            // 2. Si es usuario de ArcGIS pero no está explícito en LOCAL_USERS:
            const lowerUser = username.toLowerCase();
            if (lowerUser.includes("admin") || lowerUser.includes("jmrojas") || lowerUser.includes("camartin")) {
                userObj = { role: "admin", colegio: null };
            } else {
                // Buscar si coincide con el nombre de algún colegio de Rivas
                for (const colName in COLEGIO_DETAILS) {
                    const cleanColName = colName.toLowerCase().replace(/[^a-z0-9]/g, "");
                    const cleanUser = lowerUser.replace(/[^a-z0-9]/g, "");
                    const shortName = colName.replace(/C\.E\.I\.P\.S?\.?O?|I\.E\.S\.|CIUDAD EDUCATIVA MUNICIPAL/gi, "").trim().toLowerCase();
                    const cleanShort = shortName.replace(/[^a-z0-9]/g, "");

                    if (cleanUser.includes(cleanShort) || cleanColName.includes(cleanUser) || cleanUser.includes(cleanColName)) {
                        userObj = { role: "colegio", colegio: colName };
                        break;
                    }
                }
            }
        }

        if (!userObj) {
            console.warn(`Usuario no reconocido en la lista de colegios o administradores: ${username}`);
            // Destruir credenciales de ArcGIS
            IdentityManager.destroyCredentials();
            state.currentUser = null;
            state.arcgisMode = false;
            localStorage.removeItem("elecciones_user");
            localStorage.removeItem("elecciones_arcgis_mode");
            localStorage.removeItem("elecciones_arcgis_id_mgr");
            return false;
        }

        state.currentUser = {
            username: username,
            role: userObj.role,
            colegioName: userObj.colegio
        };
        state.arcgisMode = isArcGIS;

        // Persistir sesión
        localStorage.setItem("elecciones_user", JSON.stringify(state.currentUser));
        localStorage.setItem("elecciones_arcgis_mode", isArcGIS ? "true" : "false");
        saveIdentityManagerSession();

        showLoggedInUserInterface();

        // Si estamos en modo ArcGIS, sincronizamos datos con el FeatureServer
        if (isArcGIS) {
            syncDataWithArcGISServer();
            startPeriodicSync();
        }
        return true;
    }

    function showLoggedInUserInterface() {
        // Mostrar área de usuario en cabecera
        const userArea = document.getElementById("logged-user-area");
        const loggedUsername = document.getElementById("logged-username");
        const btnPortalAction = document.getElementById("btn-portal-action");
        const userIcon = document.getElementById("user-role-icon");

        loggedUsername.textContent = state.currentUser.username;
        userArea.classList.remove("hidden");
        
        btnPortalAction.classList.remove("btn-primary");
        btnPortalAction.classList.add("btn-danger");
        btnPortalAction.querySelector("span").textContent = "Cerrar Sesión";
        btnPortalAction.querySelector("i").className = "fa-solid fa-power-off";

        if (state.currentUser.role === "admin") {
            userIcon.className = "fa-solid fa-user-shield";
            userIcon.style.color = "var(--primary-color)";
            // Cargar portal admin
            renderAdminPortal();
            switchView("admin-portal-view");
        } else {
            userIcon.className = "fa-solid fa-school";
            userIcon.style.color = "#3b82f6";
            // Cargar portal de colegio
            showSchoolPortalView();
            switchView("colegio-portal-view");
        }
    }

    // Libera la mesa actualmente seleccionada, volviéndola a "Abierta" (o su estado previo de avance).
    // Se usa al salir de la mesa, al cerrar sesión y al cerrar el navegador.
    async function releaseMesaOnExit(mesa) {
        if (!mesa) return;
        if (mesa.estado !== "Escrutando" && mesa.estado !== "Asignada") return;

        let prevEstado = "Abierta";
        if (mesa.estadoPrevio && mesa.estadoPrevio !== "Escrutando" && mesa.estadoPrevio !== "Asignada") {
            prevEstado = mesa.estadoPrevio;
        } else if (mesa.part2_votos > 0 || mesa.part2_time) {
            prevEstado = "Part2_Enviada";
        } else if (mesa.part1_votos > 0 || mesa.part1_time) {
            prevEstado = "Part1_Enviada";
        }
        mesa.estado = prevEstado;
        delete mesa.estadoPrevio;

        // Registrar el momento de liberación para proteger contra race condition en el sync
        if (!state.recentlyReleasedMesas) state.recentlyReleasedMesas = {};
        state.recentlyReleasedMesas[mesa.codigo] = Date.now();

        saveLocalDatabase();

        // Actualizar en el servidor ArcGIS si es posible
        if (state.arcgisMode && URL_MESAS_TABLE_EDIT) {
            try {
                const tablesLayer = new FeatureLayer({ url: URL_MESAS_TABLE_EDIT, outFields: ["*"] });
                let objId = mesa.objectid;
                if (!objId) {
                    const query = tablesLayer.createQuery();
                    query.where = `CODIGO = '${mesa.codigo}'`;
                    query.outFields = ["OBJECTID"];
                    const qRes = await tablesLayer.queryFeatures(query);
                    if (qRes.features && qRes.features.length > 0) {
                        objId = qRes.features[0].attributes.OBJECTID || qRes.features[0].attributes.objectid;
                        mesa.objectid = objId;
                    }
                }

                if (objId) {
                    const attrs = Object.assign({ OBJECTID: objId }, buildFeatureAttributesFromMesa(mesa));
                    const graphic = new Graphic({ attributes: attrs });
                    const res = await tablesLayer.applyEdits({ updateFeatures: [graphic] });
                    console.log(`[ESTADO] Mesa ${mesa.codigo} liberada a '${prevEstado}' en ArcGIS:`, res);
                }
            } catch (e) {
                console.warn("[ESTADO] Excepción liberando mesa:", e);
            }
        }
    }

    // Intenta liberar la mesa vía fetch con keepalive=true para funcionar incluso
    // cuando la página se está descargando (cierre de pestaña o navegador).
    function releaseMesaViaBeacon(mesa) {
        if (!mesa || !state.arcgisMode || !URL_MESAS_TABLE_EDIT || !mesa.objectid) return;
        try {
            let prevEstado = "Abierta";
            if (mesa.estadoPrevio && mesa.estadoPrevio !== "Escrutando" && mesa.estadoPrevio !== "Asignada") {
                prevEstado = mesa.estadoPrevio;
            } else if (mesa.part2_votos > 0 || mesa.part2_time) {
                prevEstado = "Part2_Enviada";
            } else if (mesa.part1_votos > 0 || mesa.part1_time) {
                prevEstado = "Part1_Enviada";
            }

            const updatePayload = [{
                attributes: {
                    OBJECTID: mesa.objectid,
                    CODIGO: mesa.codigo,
                    ESTADO: prevEstado
                }
            }];
            const formData = new FormData();
            formData.append("updates", JSON.stringify(updatePayload));
            formData.append("f", "json");

            // Extraer token de IdentityManager si existe para evitar error 498/499
            let token = "";
            try {
                if (typeof IdentityManager !== "undefined" && IdentityManager.credentials && IdentityManager.credentials.length > 0) {
                    token = IdentityManager.credentials[0].token || "";
                }
            } catch (e) {}
            if (token) {
                formData.append("token", token);
            }

            // fetch con keepalive para que sobreviva al unload de la página
            fetch(`${URL_MESAS_TABLE_EDIT}/applyEdits`, {
                method: "POST",
                body: formData,
                keepalive: true
            }).catch(() => {});
        } catch (e) {
            // Silenciar: estamos en proceso de descarga de página
        }
    }

    async function logoutUser() {
        console.log("Iniciando cierre de sesión efectivo y limpieza de almacenamiento local...");

        // Feedback visual en botones de salida
        const btnPortalLogout = document.getElementById("btn-portal-logout");
        if (btnPortalLogout) {
            btnPortalLogout.disabled = true;
            btnPortalLogout.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saliendo...`;
        }
        const btnAdminLogout = document.getElementById("btn-admin-logout");
        if (btnAdminLogout) {
            btnAdminLogout.disabled = true;
            btnAdminLogout.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saliendo...`;
        }
        const btnPortalAction = document.getElementById("btn-portal-action");
        if (btnPortalAction) {
            btnPortalAction.disabled = true;
        }

        // 1. Recopilar mesas que deben ser liberadas (la activa y cualquier otra en 'Escrutando' del colegio)
        const mesasToRelease = [];
        if (state.selectedMesa && (state.selectedMesa.estado === "Escrutando" || state.selectedMesa.estado === "Asignada")) {
            mesasToRelease.push(state.selectedMesa);
        }

        if (state.currentUser && state.currentUser.colegioName) {
            const colName = state.currentUser.colegioName;
            const colMesas = state.mesas.filter(m => m.colegio && (
                m.colegio.trim().toUpperCase() === colName.trim().toUpperCase() ||
                m.colegio.trim().toLowerCase().includes(colName.trim().toLowerCase())
            ));
            colMesas.forEach(m => {
                if ((m.estado === "Escrutando" || m.estado === "Asignada") && !mesasToRelease.some(x => x.codigo === m.codigo)) {
                    mesasToRelease.push(m);
                }
            });
        }

        // Liberar mesas en el servidor ArcGIS de forma asíncrona ANTES de destruir credenciales
        for (const m of mesasToRelease) {
            try {
                await releaseMesaOnExit(m);
            } catch (e) {
                console.warn("Error liberando mesa al salir:", e);
            }
        }

        state.selectedMesa = null;

        // Destruir intervalo de sincronización periódica
        if (state.syncInterval) {
            clearInterval(state.syncInterval);
            state.syncInterval = null;
        }

        // 2. Destruir credenciales de ArcGIS en memoria DESPUÉS de que los updates se hayan aplicado
        if (typeof IdentityManager !== "undefined" && IdentityManager.destroyCredentials) {
            IdentityManager.destroyCredentials();
        }

        // 3. Limpiar claves de sesión de localStorage y sessionStorage asociadas a usuario o ArcGIS (conservando partidos y mesas)
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.includes("esri") || key.includes("elecciones"))) {
                    if (key !== "elecciones_parties_config" && key !== "elecciones_mesas" && key !== "elecciones_colegios_cerrados" && key !== "elecciones_censos_manuales") {
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {
            console.error("Error al limpiar localStorage:", e);
        }

        try {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const key = sessionStorage.key(i);
                if (key && (key.includes("esri") || key.includes("elecciones"))) {
                    sessionStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.error("Error al limpiar sessionStorage:", e);
        }

        // 4. Recargar página para volver al estado inicial limpio
        window.location.reload();
    }

    // ==========================================================================
    // PORTAL DE COLEGIO (ESCRUTINIO DE VOTOS)
    // ==========================================================================
    function showSchoolPortalView() {
        getPartiesConfig();
        if (!state.selectedMesa) {
            generateVoteFields();
        }

        const colName = state.currentUser.colegioName;
        const details = COLEGIO_DETAILS[colName];
        
        document.getElementById("portal-colegio-name").textContent = colName;
        document.getElementById("portal-colegio-address").textContent = details?.address || "";

        // Ocultar escrutinio y mostrar selector de mesa SOLO SI NO hay una mesa en edición
        if (!state.selectedMesa) {
            document.getElementById("portal-escrutinio-container").classList.add("hidden");
            document.getElementById("portal-step-select-mesa").classList.remove("hidden");
        }

        // Listar mesas de este colegio
        const grid = document.getElementById("portal-mesas-selection-grid");
        grid.innerHTML = "";

        const colMesas = state.mesas.filter(m => m.colegio && colName && (m.colegio.trim().toUpperCase() === colName.trim().toUpperCase() || m.colegio.trim().toLowerCase().includes(colName.trim().toLowerCase()) || colName.trim().toLowerCase().includes(m.colegio.trim().toLowerCase())));

        // Ordenar mesas del colegio: 1º por Sección, 2º por Letra de Mesa
        colMesas.sort((a, b) => {
            const secComp = (a.seccion || "").localeCompare(b.seccion || "", 'es', { numeric: true, sensitivity: 'base' });
            if (secComp !== 0) return secComp;
            return (a.mesa || "").localeCompare(b.mesa || "", 'es', { sensitivity: 'base' });
        });

        if (colMesas.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); font-size:0.9rem; padding:20px;">No hay mesas registradas para este colegio en la administración.</div>`;
            return;
        }

        const openOrTransmittedMesas = colMesas.filter(m => m.estado !== "Cerrada");
        
        const stepCard = document.getElementById("portal-step-select-mesa");
        const stepTitle = stepCard ? stepCard.querySelector(".step-title") : null;
        const stepDesc = stepCard ? stepCard.querySelector(".text-secondary") : null;

        if (openOrTransmittedMesas.length === 0) {
            if (stepTitle) stepTitle.style.display = "none";
            if (stepDesc) stepDesc.style.display = "none";
            
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:40px 20px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                    <div style="font-size:3.5rem; color:#10b981; margin-bottom:16px;"><i class="fa-solid fa-circle-check"></i></div>
                    <div style="font-weight:700; color:var(--text-primary); font-size:1.3rem; margin-bottom:8px;">¡Escrutinio Completado!</div>
                    <div style="color:var(--text-secondary); font-size:0.95rem; max-width:400px; margin: 0 auto; line-height: 1.5;">Todas las mesas de este colegio electoral han sido cerradas y registradas con éxito.</div>
                </div>
            `;
            return;
        } else {
            if (stepTitle) stepTitle.style.display = "";
            if (stepDesc) stepDesc.style.display = "";
        }

        colMesas.forEach(mesa => {
            const btn = document.createElement("button");
            btn.className = "mesa-btn-select";
            btn.style.display = "flex";
            btn.style.flexDirection = "column";
            btn.style.alignItems = "center";
            btn.style.justifyContent = "center";
            btn.style.padding = "16px 20px";
            btn.style.gap = "8px";
            btn.style.borderRadius = "12px";
            btn.style.transition = "all 0.25s ease-in-out";
            
            let bgGradient = "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)";
            let borderColor = "#22c55e";
            let codeColor = "#15803d";
            let subtextColor = "#166534";
            let statusBadge = `<span style="background:#16a34a; color:#ffffff; padding:5px 12px; border-radius:20px; font-weight:700; font-size:0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><i class="fa-solid fa-lock-open"></i> Abierta - Lista para recuento</span>`;

            if (mesa.estado === "Escrutando" || mesa.estado === "Asignada") {
                bgGradient = "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)";
                borderColor = "#a855f7";
                codeColor = "#7e22ce";
                subtextColor = "#6b21a8";
                statusBadge = `<span style="background:#8b5cf6; color:#ffffff; padding:5px 12px; border-radius:20px; font-weight:700; font-size:0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><i class="fa-solid fa-pen-to-square fa-beat"></i> Ocupada (En recuento)</span>`;
            } else if (mesa.estado === "Part1_Enviada") {
                bgGradient = "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)";
                borderColor = "#0284c7";
                codeColor = "#0369a1";
                subtextColor = "#075985";
                const p1Time = mesa.part1_time ? ` (a las ${mesa.part1_time})` : '';
                statusBadge = `<span style="background:#0284c7; color:#ffffff; padding:5px 12px; border-radius:20px; font-weight:700; font-size:0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><i class="fa-solid fa-chart-line"></i> Part. 1 Enviada${p1Time}</span>`;
            } else if (mesa.estado === "Part2_Enviada") {
                bgGradient = "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)";
                borderColor = "#d97706";
                codeColor = "#b45309";
                subtextColor = "#92400e";
                const p2Time = mesa.part2_time ? ` (a las ${mesa.part2_time})` : '';
                statusBadge = `<span style="background:#d97706; color:#ffffff; padding:5px 12px; border-radius:20px; font-weight:700; font-size:0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><i class="fa-solid fa-chart-line"></i> Part. 2 Enviada${p2Time}</span>`;
            } else if (mesa.estado === "Cerrada") {
                bgGradient = "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)";
                borderColor = "#ef4444";
                codeColor = "#dc2626";
                subtextColor = "#991b1b";
                statusBadge = `<span style="background:#ef4444; color:#ffffff; padding:5px 12px; border-radius:20px; font-weight:700; font-size:0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><i class="fa-solid fa-lock"></i> Mesa Cerrada (No seleccionable)</span>`;
            }

            btn.style.background = bgGradient;
            btn.style.border = `2px solid ${borderColor}`;

            btn.innerHTML = `
                <span class="mesa-btn-code" style="font-size:1.6rem; font-weight:800; color:${codeColor}; font-family: var(--font-heading);">${mesa.codigo}</span>
                <span class="mesa-btn-census" style="font-size:0.82rem; font-weight:600; color:${subtextColor};">Sección ${mesa.seccion} | Censo: ${mesa.censo.toLocaleString()} electores</span>
                <div style="margin-top:4px;">${statusBadge}</div>
            `;

            if (mesa.estado === "Cerrada") {
                btn.style.opacity = "0.85";
                btn.style.cursor = "not-allowed";
                btn.addEventListener("click", () => {
                    alert(`La Mesa ${mesa.codigo} ya ha sido CERRADA definitivamente por el colegio y no admite más envíos.`);
                });
            } else {
                btn.addEventListener("click", () => {
                    selectMesaForScrutiny(mesa);
                });
            }

            grid.appendChild(btn);
        });
    }

    // Selecciona una mesa para escrutinio o avance
    function selectMesaForScrutiny(mesa) {
        state.selectedMesa = mesa;

        if (mesa.estado !== "Cerrada") {
            // estadoPrevio siempre debe ser un estado "libre" (nunca Escrutando ni Asignada)
            // para que al salir siempre se libere correctamente, aunque sea un usuario fantasma
            if (!mesa.estadoPrevio || mesa.estadoPrevio === "Escrutando" || mesa.estadoPrevio === "Asignada") {
                mesa.estadoPrevio = (mesa.estado !== "Escrutando" && mesa.estado !== "Asignada") 
                    ? mesa.estado 
                    : "Abierta";
            }
            mesa.estado = "Escrutando";
            saveLocalDatabase();
            sendMesaUpdateToServer(mesa);
        }

        if (!state.arcgisMode) {
            openScrutinyForm(mesa);
            return;
        }

        console.log(`Verificando disponibilidad de la mesa ${mesa.codigo} en ArcGIS...`);
        
        try {
            const tablesLayer = new FeatureLayer({
                url: URL_MESAS_TABLE_EDIT,
                outFields: ["*"]
            });

            const query = tablesLayer.createQuery();
            query.where = `codigo = '${mesa.codigo}'`;
            query.outFields = ["*"];

            tablesLayer.queryFeatures(query).then(results => {
                if (results.features.length > 0) {
                    const feat = results.features[0];
                    const attrs = feat.attributes;
                    const serverEstado = getAttributeValue(attrs, "estado") || "Abierta";
                    const objectid = getAttributeValue(attrs, "objectid") || getAttributeValue(attrs, "OBJECTID") || getAttributeValue(attrs, "FID");

                    if (serverEstado === "Cerrada") {
                        alert(`La mesa ${mesa.codigo} ya ha sido CERRADA de forma definitiva.`);
                        syncDataWithArcGISServer();
                        return;
                    }

                    mesa.objectid = objectid;
                    state.selectedMesa = mesa;
                    openScrutinyForm(mesa);
                } else {
                    alert("La mesa seleccionada no existe en el servidor.");
                    syncDataWithArcGISServer();
                }
            }).catch(err => {
                console.error("Error al consultar el estado de la mesa en el servidor:", err);
                state.selectedMesa = mesa;
                openScrutinyForm(mesa);
            });
        } catch (e) {
            console.error("Excepción al verificar estado de mesa:", e);
            state.selectedMesa = mesa;
            openScrutinyForm(mesa);
        }
    }

    // Cambia la fase activa en el portal de colegios (part1, part2, escrutinio)
    function switchPortalPhase(phaseKey) {
        document.querySelectorAll(".portal-phase-btn").forEach(btn => {
            if (btn.getAttribute("data-phase") === phaseKey) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        document.querySelectorAll(".portal-phase-pane").forEach(pane => {
            pane.classList.add("hidden");
            pane.classList.remove("active");
        });

        const activePane = document.getElementById(`portal-pane-${phaseKey}`);
        if (activePane) {
            activePane.classList.remove("hidden");
            activePane.classList.add("active");
        }

        // Si se cambia a escrutinio, recalcular sumatorio
        if (phaseKey === "escrutinio") {
            recalculateVotesSum();
        }
    }

    // Calcula en vivo el porcentaje de participación del 1º Avance
    function updateAdvance1LivePercent() {
        if (!state.selectedMesa) return;
        const censo = parseInt(state.selectedMesa.censo, 10) || 0;
        const input = document.getElementById("input-part1-voters");
        let rawStr = input ? input.value : "";
        
        // Si hay ceros a la izquierda (ej: 05, 0120), limpiarlos automáticamente
        if (rawStr.length > 1 && /^0+[0-9]+/.test(rawStr)) {
            rawStr = rawStr.replace(/^0+/, '');
            input.value = rawStr;
        }

        const val = rawStr === "" ? 0 : Math.max(0, parseInt(rawStr, 10) || 0);
        const pct = censo > 0 ? ((val / censo) * 100).toFixed(2) : "0.00";
        
        const valEl = document.getElementById("part1-live-percent-val");
        const subEl = document.getElementById("part1-live-ratio-sub");
        if (valEl) valEl.textContent = `${pct}%`;
        if (subEl) subEl.textContent = `${val.toLocaleString()} de ${censo.toLocaleString()} electores`;
    }

    // Calcula en vivo el porcentaje de participación del 2º Avance
    function updateAdvance2LivePercent() {
        if (!state.selectedMesa) return;
        const censo = parseInt(state.selectedMesa.censo, 10) || 0;
        const input = document.getElementById("input-part2-voters");
        let rawStr = input ? input.value : "";
        
        // Si hay ceros a la izquierda (ej: 05, 0120), limpiarlos automáticamente
        if (rawStr.length > 1 && /^0+[0-9]+/.test(rawStr)) {
            rawStr = rawStr.replace(/^0+/, '');
            input.value = rawStr;
        }

        const val = rawStr === "" ? 0 : Math.max(0, parseInt(rawStr, 10) || 0);
        const pct = censo > 0 ? ((val / censo) * 100).toFixed(2) : "0.00";
        
        const valEl = document.getElementById("part2-live-percent-val");
        const subEl = document.getElementById("part2-live-ratio-sub");
        if (valEl) valEl.textContent = `${pct}%`;
        if (subEl) subEl.textContent = `${val.toLocaleString()} de ${censo.toLocaleString()} electores`;
    }

    function openScrutinyForm(mesa) {
        state.selectedMesa = mesa;
        // Siempre recargar partidos y regenerar el formulario al abrir una mesa
        loadPartiesFromStorage();
        generateVoteFields();
        console.log("[PARTIDOS] openScrutinyForm: pintando", PARTIES_CONFIG.length, "partidos");

        const censoMesa = parseInt(mesa.censo, 10) || 0;

        // Cargar datos en la cabecera
        document.getElementById("portal-active-mesa-title").textContent = `Mesa ${mesa.codigo} (${mesa.colegio})`;
        document.getElementById("portal-active-mesa-census").textContent = `Censo: ${censoMesa.toLocaleString()} electores`;

        // 1. ESTADO DE LA BOTONERA DE FASES
        const btnPhase1 = document.getElementById("btn-phase-part1");
        const btnPhase2 = document.getElementById("btn-phase-part2");
        const btnPhaseEscrutinio = document.getElementById("btn-phase-escrutinio");

        const statusP1El = document.getElementById("phase-status-part1");
        const statusP2El = document.getElementById("phase-status-part2");
        const statusEscrutinioEl = document.getElementById("phase-status-escrutinio");

        const hasP1 = (mesa.part1_votos && mesa.part1_votos > 0) || mesa.part1_time;
        const hasP2 = (mesa.part2_votos && mesa.part2_votos > 0) || mesa.part2_time;
        const isClosed = mesa.estado === "Cerrada";

        // Fase 1 Status
        if (hasP1) {
            const p1Pct = censoMesa > 0 ? (((mesa.part1_votos || 0) / censoMesa) * 100).toFixed(1) : "0.0";
            if (statusP1El) statusP1El.textContent = `Enviado: ${ (mesa.part1_votos || 0).toLocaleString() } (${p1Pct}%)`;
            if (btnPhase1) btnPhase1.classList.add("completed");

            const p1Prev = document.getElementById("part1-previous-info");
            const p1PrevText = document.getElementById("part1-previous-details");
            if (p1Prev && p1PrevText) {
                p1PrevText.textContent = `Registrado a las ${mesa.part1_time || '--:--'} con ${ (mesa.part1_votos || 0).toLocaleString() } votantes (${p1Pct}% sobre el censo). Puedes modificar y retransmitir si hubo una rectificación.`;
                p1Prev.classList.remove("hidden");
            }
        } else {
            if (statusP1El) statusP1El.textContent = "Pendiente";
            if (btnPhase1) btnPhase1.classList.remove("completed");
            const p1Prev = document.getElementById("part1-previous-info");
            if (p1Prev) p1Prev.classList.add("hidden");
        }

        // Pre-cargar input fase 1
        const inpP1 = document.getElementById("input-part1-voters");
        if (inpP1) {
            inpP1.value = hasP1 ? (mesa.part1_votos || "") : "";
        }
        updateAdvance1LivePercent();

        // Fase 2 Status
        if (hasP2) {
            const p2Pct = censoMesa > 0 ? (((mesa.part2_votos || 0) / censoMesa) * 100).toFixed(1) : "0.0";
            if (statusP2El) statusP2El.textContent = `Enviado: ${ (mesa.part2_votos || 0).toLocaleString() } (${p2Pct}%)`;
            if (btnPhase2) btnPhase2.classList.add("completed");

            const p2Prev = document.getElementById("part2-previous-info");
            const p2PrevText = document.getElementById("part2-previous-details");
            if (p2Prev && p2PrevText) {
                p2PrevText.textContent = `Registrado a las ${mesa.part2_time || '--:--'} con ${ (mesa.part2_votos || 0).toLocaleString() } votantes (${p2Pct}% sobre el censo). Puedes modificar y retransmitir si hubo una rectificación.`;
                p2Prev.classList.remove("hidden");
            }
        } else {
            if (statusP2El) statusP2El.textContent = "Pendiente";
            if (btnPhase2) btnPhase2.classList.remove("completed");
            const p2Prev = document.getElementById("part2-previous-info");
            if (p2Prev) p2Prev.classList.add("hidden");
        }

        // Referencia del 1º Avance en el 2º Avance
        const p2RefText = document.getElementById("part2-p1-ref-text");
        if (p2RefText) {
            if (hasP1) {
                const p1Pct = censoMesa > 0 ? (((mesa.part1_votos || 0) / censoMesa) * 100).toFixed(1) : "0.0";
                p2RefText.textContent = `${ (mesa.part1_votos || 0).toLocaleString() } votantes (${p1Pct}%) ${mesa.part1_time ? 'a las ' + mesa.part1_time : ''}`;
            } else {
                p2RefText.textContent = "No transmitido aún (se recomienda enviar primero el 1º avance).";
            }
        }

        // Pre-cargar input fase 2
        const inpP2 = document.getElementById("input-part2-voters");
        if (inpP2) {
            inpP2.value = hasP2 ? (mesa.part2_votos || "") : "";
        }
        updateAdvance2LivePercent();

        // Fase Escrutinio Status
        if (isClosed) {
            if (statusEscrutinioEl) statusEscrutinioEl.textContent = "Cerrada y Transmitida";
            if (btnPhaseEscrutinio) btnPhaseEscrutinio.classList.add("completed");
        } else {
            if (statusEscrutinioEl) statusEscrutinioEl.textContent = "Pendiente de recuento";
            if (btnPhaseEscrutinio) btnPhaseEscrutinio.classList.remove("completed");
        }

        // 2. CARGAR MIEMBROS DE LA MESA
        let presi = "", v1 = "", v2 = "";
        if (mesa.miembros) {
            try {
                const mObj = typeof mesa.miembros === "string" ? JSON.parse(mesa.miembros) : mesa.miembros;
                presi = mObj.presi || "";
                v1 = mObj.vocal1 || "";
                v2 = mObj.vocal2 || "";
            } catch (e) {
                presi = mesa.miembros;
            }
        }
        document.getElementById("input-member-president").value = presi;
        document.getElementById("input-member-vocal1").value = v1;
        document.getElementById("input-member-vocal2").value = v2;

        // Banner de referencia en Escrutinio
        const banner = document.getElementById("portal-previous-advances-banner");
        if (banner) {
            if (hasP1 || hasP2) {
                let bannerContent = `<div style="font-weight:700; color:#1e40af; margin-bottom:8px; font-size:0.85rem;"><i class="fa-solid fa-clock-rotate-left"></i> Registro de Avances Transmitidos Durante la Jornada:</div>`;
                bannerContent += `<div style="display:flex; gap:12px; flex-wrap:wrap; font-size:0.82rem; color:#1e3a8a;">`;
                if (hasP1) {
                    bannerContent += `<div style="background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #93c5fd; box-shadow: 0 1px 2px rgba(0,0,0,0.05);"><strong>1º Avance (14:00h):</strong> ${ (mesa.part1_votos || 0).toLocaleString() } votos ${mesa.part1_time ? '(' + mesa.part1_time + ')' : ''}</div>`;
                }
                if (hasP2) {
                    bannerContent += `<div style="background:#fff; padding:6px 12px; border-radius:6px; border:1px solid #93c5fd; box-shadow: 0 1px 2px rgba(0,0,0,0.05);"><strong>2º Avance (18:00h):</strong> ${ (mesa.part2_votos || 0).toLocaleString() } votos ${mesa.part2_time ? '(' + mesa.part2_time + ')' : ''}</div>`;
                }
                bannerContent += `</div>`;
                banner.innerHTML = bannerContent;
                banner.classList.remove("hidden");
            } else {
                banner.innerHTML = "";
                banner.classList.add("hidden");
            }
        }

        recalculateVotesSum();

        // 3. SELECCIONAR FASE INICIAL RECOMENDADA
        if (isClosed || hasP2) {
            switchPortalPhase("escrutinio");
        } else if (hasP1) {
            switchPortalPhase("part2");
        } else {
            switchPortalPhase("part1");
        }

        // Mostrar formulario y ocultar cuadrícula
        document.getElementById("portal-step-select-mesa").classList.add("hidden");
        document.getElementById("portal-escrutinio-container").classList.remove("hidden");
    }

    // --------------------------------------------------------------------------
    // GESTIÓN DE LOGOS PERSONALIZADOS Y CONFIGURACIÓN DE PARTIDOS
    // --------------------------------------------------------------------------
    function getCustomPartyLogos() {
        try {
            const raw = localStorage.getItem("elecciones_custom_party_logos");
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveCustomPartyLogo(partyId, dataUrl) {
        if (!partyId || !dataUrl) return;
        try {
            const custom = getCustomPartyLogos();
            custom[partyId] = dataUrl;
            localStorage.setItem("elecciones_custom_party_logos", JSON.stringify(custom));
        } catch (e) {
            console.warn("Error guardando logo personalizado en localStorage:", e);
        }
    }

    function removeCustomPartyLogo(partyId) {
        if (!partyId) return;
        try {
            const custom = getCustomPartyLogos();
            delete custom[partyId];
            localStorage.setItem("elecciones_custom_party_logos", JSON.stringify(custom));
        } catch (e) {}
    }

    // Redimensiona imágenes locales a un tamaño óptimo (máx 128x128) para guardarlas como base64 ultraligero
    function resizeImageToDataURL(file, maxWidth, maxHeight, callback) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const img = new Image();
            img.onload = function() {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL("image/png");
                callback(dataUrl);
            };
            img.onerror = function() {
                callback("Imagenes/Logo_OITR.png");
            };
            img.src = evt.target.result;
        };
        reader.onerror = function() {
            callback("Imagenes/Logo_OITR.png");
        };
        reader.readAsDataURL(file);
    }

    const KNOWN_PARTIES_CATALOG = {
        "PP": { name: "PP", color: "#1d84ce", logo: "Imagenes/PP.png" },
        "PSOE": { name: "PSOE", color: "#ef1c27", logo: "Imagenes/PSOE.png" },
        "VOX": { name: "VOX", color: "#63be21", logo: "Imagenes/VOX.png" },
        "VPR": { name: "Vecinos por Rivas", color: "#00a896", logo: "Imagenes/Logo_OITR.png" },
        "IU": { name: "IU - Más Madrid - Verdes Equo", color: "#7b1fa2", logo: "Imagenes/IU.png" },
        "PODEMOS": { name: "Podemos", color: "#673ab7", logo: "Imagenes/UnidasPodemos.png" },
        "MM": { name: "Más Madrid", color: "#00c39a", logo: "Imagenes/Logo_OITR.png" },
        "CS": { name: "Ciudadanos", color: "#fa5000", logo: "Imagenes/Ciudadanos.png" },
        "PACMA": { name: "PACMA", color: "#16a085", logo: "Imagenes/PACMA.png" },
        "SALF": { name: "Se Acabó La Fiesta", color: "#0f172a", logo: "Imagenes/Seacabolafiesta.png" }
    };

    const AUTO_PALETTE = ["#0284c7", "#e11d48", "#16a34a", "#0d9488", "#9333ea", "#d97706", "#4f46e5", "#059669", "#dc2626", "#475569"];

    function loadPartiesFromStorage() {
        const savedParties = localStorage.getItem("elecciones_parties_config");
        const customLogos = getCustomPartyLogos();
        if (savedParties !== null) {
            try {
                const parsed = JSON.parse(savedParties);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    PARTIES_CONFIG.length = 0;
                    parsed.forEach(p => {
                        if (p && p.id && customLogos[p.id]) {
                            p.logo = customLogos[p.id];
                        }
                        PARTIES_CONFIG.push(p);
                    });
                    window.PARTIES_CONFIG = PARTIES_CONFIG;
                    console.log("[PARTIDOS] Cargados desde localStorage:", PARTIES_CONFIG.length, "partidos");
                    return PARTIES_CONFIG;
                }
            } catch (e) {
                console.warn("Error cargando partidos de localStorage:", e);
            }
        }
        
        // Fallback a DEFAULT_PARTIES_CONFIG si no hay datos en localStorage
        if (typeof DEFAULT_PARTIES_CONFIG !== "undefined" && Array.isArray(DEFAULT_PARTIES_CONFIG) && DEFAULT_PARTIES_CONFIG.length > 0) {
            PARTIES_CONFIG.length = 0;
            DEFAULT_PARTIES_CONFIG.forEach(p => {
                const copy = { ...p };
                if (copy.id && customLogos[copy.id]) {
                    copy.logo = customLogos[copy.id];
                }
                PARTIES_CONFIG.push(copy);
            });
            window.PARTIES_CONFIG = PARTIES_CONFIG;
            try {
                localStorage.setItem("elecciones_parties_config", JSON.stringify(PARTIES_CONFIG));
            } catch (e) {}
            console.log("[PARTIDOS] Inicializados desde DEFAULT_PARTIES_CONFIG:", PARTIES_CONFIG.length, "partidos");
            return PARTIES_CONFIG;
        }

        return PARTIES_CONFIG;
    }

    // Auto-detecta y registra cualquier partido presente en los JSON de votos de las features de la GDB
    function ensurePartiesFromFeatures(features) {
        if (!features || !Array.isArray(features) || features.length === 0) return false;
        let modified = false;
        const customLogos = getCustomPartyLogos();

        // Extraer todos los partidos que realmente existen en el JSON de las mesas de la GDB
        const foundPartiesInGdb = new Set();

        features.forEach(feat => {
            const attrs = feat.attributes || feat;
            const resJsonRaw = getAttributeValue(attrs, "resultados_json") || getAttributeValue(attrs, "RESULTADOS_JSON");
            let resObj = null;
            if (resJsonRaw && typeof resJsonRaw === "string" && resJsonRaw.trim().startsWith("{")) {
                try { resObj = JSON.parse(resJsonRaw); } catch(e) {}
            } else if (resJsonRaw && typeof resJsonRaw === "object") {
                resObj = resJsonRaw;
            }

            const partyVotesObj = (resObj && resObj.votos_partidos) ? resObj.votos_partidos : {};
            Object.keys(partyVotesObj).forEach(key => {
                const upper = key.trim().toUpperCase();
                if (upper === "BLANCOS" || upper === "NULOS" || !upper) return;
                foundPartiesInGdb.add(upper);
            });
        });

        // Para cada partido encontrado en la GDB, asegurarse de que está en PARTIES_CONFIG
        foundPartiesInGdb.forEach(upper => {
            const exists = PARTIES_CONFIG.some(p => p.id.toUpperCase() === upper || p.field.toUpperCase() === ("VOTOS_" + upper));
            if (!exists) {
                const known = KNOWN_PARTIES_CATALOG[upper];
                const colorIndex = PARTIES_CONFIG.length % AUTO_PALETTE.length;
                const newParty = {
                    id: upper,
                    name: known ? known.name : upper,
                    field: "votos_" + upper.toLowerCase(),
                    color: known ? known.color : AUTO_PALETTE[colorIndex],
                    logo: (customLogos[upper]) || (known ? known.logo : "Imagenes/Logo_OITR.png")
                };
                PARTIES_CONFIG.push(newParty);
                modified = true;
            }
        });

        if (modified) {
            window.PARTIES_CONFIG = PARTIES_CONFIG;
            savePartiesToStorage(PARTIES_CONFIG);
            generateVoteFields();
            console.log("[PARTIDOS GDB] Partidos sincronizados desde el JSON de la GDB:", PARTIES_CONFIG.map(p => p.id).join(", "));
        }
        return modified;
    }

    function savePartiesToStorage(newParties) {
        const customLogos = getCustomPartyLogos();
        if (Array.isArray(newParties)) {
            // Clonar para evitar vaciar el array cuando newParties === PARTIES_CONFIG
            const sourceList = [...newParties];
            PARTIES_CONFIG.length = 0;
            sourceList.forEach(p => {
                if (p && p.id) {
                    const copy = { ...p };
                    if (customLogos[copy.id]) {
                        copy.logo = customLogos[copy.id];
                    } else if (copy.logo && copy.logo.startsWith("data:")) {
                        saveCustomPartyLogo(copy.id, copy.logo);
                    }
                    PARTIES_CONFIG.push(copy);
                }
            });
            window.PARTIES_CONFIG = PARTIES_CONFIG;
        }
        try {
            const json = JSON.stringify(PARTIES_CONFIG);
            localStorage.setItem("elecciones_parties_config", json);
            console.log("[PARTIDOS] Guardado en localStorage:", json);
        } catch (e) {
            console.warn("Error guardando partidos en localStorage:", e);
        }
    }

    function getPartiesConfig() {
        return loadPartiesFromStorage();
    }

    // Genera inputs de votos dinámicamente
    function generateVoteFields() {
        const parties = getPartiesConfig();
        const container = document.getElementById("portal-votes-fields-container");
        if (!container) return;
        container.innerHTML = "";

        // Partidos ordenados alfabéticamente por nombre (es)
        const sortedParties = [...parties].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

        sortedParties.forEach(p => {
            const card = document.createElement("div");
            card.className = "vote-input-card";
            card.innerHTML = `
                <img src="${p.logo}" alt="Logo ${p.name}" class="party-logo">
                <label for="input-vote-${p.id}">${p.name}</label>
                <input type="number" inputmode="numeric" pattern="[0-9]*" id="input-vote-${p.id}" class="vote-input-field" value="" min="0" data-party="${p.id}">
            `;
            container.appendChild(card);
        });

        // Voto en blanco
        const cardBlanco = document.createElement("div");
        cardBlanco.className = "vote-input-card";
        cardBlanco.style.backgroundColor = "#f1f5f9";
        cardBlanco.innerHTML = `
            <div style="width: 32px; height: 32px; border-radius: 50%; background-color:#7f8c8d; border: 1px solid #ccc; flex-shrink:0;"></div>
            <label for="input-vote-blanco">Votos en Blanco</label>
            <input type="number" inputmode="numeric" pattern="[0-9]*" id="input-vote-blanco" class="vote-input-field" value="" min="0" data-special="blanco">
        `;
        container.appendChild(cardBlanco);

        // Voto nulo
        const cardNulo = document.createElement("div");
        cardNulo.className = "vote-input-card";
        cardNulo.style.backgroundColor = "#f1f5f9";
        cardNulo.innerHTML = `
            <div style="width: 32px; height: 32px; border-radius: 50%; background-color:#95a5a6; border: 1px solid #ccc; flex-shrink:0;"></div>
            <label for="input-vote-nulo">Votos Nulos</label>
            <input type="number" inputmode="numeric" pattern="[0-9]*" id="input-vote-nulo" class="vote-input-field" value="" min="0" data-special="nulo">
        `;
        container.appendChild(cardNulo);

        // Vincular eventos de entrada live a todas las casillas dinámicas
        container.querySelectorAll(".vote-input-field").forEach(inp => {
            inp.addEventListener("input", recalculateVotesSum);
        });
    }

    // Calcula el sumatorio en vivo y valida
    function recalculateVotesSum() {
        let sum = 0;
        document.querySelectorAll(".vote-input-field").forEach(input => {
            let valStr = input.value;
            // Eliminar ceros a la izquierda cuando se introducen números (ej: "010" -> "10", "005" -> "5")
            if (valStr.length > 1 && valStr.startsWith("0")) {
                valStr = valStr.replace(/^0+(?=\d)/, '');
                input.value = valStr;
            }
            const val = parseInt(valStr, 10) || 0;
            if (val < 0) {
                input.value = 0;
            }
            sum += Math.max(0, val);
        });

        const sumEl = document.getElementById("portal-votes-sum");
        if (sumEl) sumEl.textContent = sum.toLocaleString();

        const valBadge = document.getElementById("portal-votes-validation");
        if (state.selectedMesa && valBadge) {
            const censo = parseInt(state.selectedMesa.censo, 10) || 0;
            const refParticipacion = (state.selectedMesa.part2_votos && state.selectedMesa.part2_votos > 0)
                ? state.selectedMesa.part2_votos
                : (state.selectedMesa.part1_votos || 0);
            const refNombre = (state.selectedMesa.part2_votos && state.selectedMesa.part2_votos > 0)
                ? "2º Avance"
                : "1º Avance";

            if (sum > censo) {
                valBadge.className = "vote-validation-badge badge-warning";
                valBadge.style.backgroundColor = "#fee2e2";
                valBadge.style.color = "#991b1b";
                valBadge.style.border = "1px solid #fca5a5";
                valBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error: Votos (${sum.toLocaleString()}) superan el censo (${censo.toLocaleString()})`;
            } else if (refParticipacion > 0 && sum < refParticipacion) {
                valBadge.className = "vote-validation-badge badge-warning";
                valBadge.style.backgroundColor = "#fef3c7";
                valBadge.style.color = "#92400e";
                valBadge.style.border = "1px solid #fde68a";
                valBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Aviso: Votos contabilizados (${sum.toLocaleString()}) < ${refNombre} (${refParticipacion.toLocaleString()})`;
            } else {
                valBadge.className = "vote-validation-badge badge-success";
                valBadge.style.backgroundColor = "";
                valBadge.style.color = "";
                valBadge.style.border = "";
                valBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Votos válidos`;
            }
        }
    }

    // Comprueba si existen casillas de voto vacías antes de transmitir y advierte al usuario
    function checkBlankFieldsWarning() {
        const blankFields = [];
        PARTIES_CONFIG.forEach(p => {
            const input = document.getElementById(`input-vote-${p.id}`);
            if (!input || input.value.trim() === "") {
                blankFields.push(p.name);
            }
        });
        const inputBlanco = document.getElementById("input-vote-blanco");
        if (!inputBlanco || inputBlanco.value.trim() === "") {
            blankFields.push("Votos en Blanco");
        }
        const inputNulo = document.getElementById("input-vote-nulo");
        if (!inputNulo || inputNulo.value.trim() === "") {
            blankFields.push("Votos Nulos");
        }

        if (blankFields.length > 0) {
            const listStr = blankFields.slice(0, 5).join("\n- ") + (blankFields.length > 5 ? `\n...y ${blankFields.length - 5} más.` : "");
            return confirm(
                `ADVERTENCIA: Hay ${blankFields.length} campo(s) de votación sin rellenar (vacíos):\n- ${listStr}\n\nEl sistema registrará estos campos vacíos como 0 votos.\n¿Desea continuar con el envío?`
            );
        }
        return true;
    }

    // Enviar escrutinio de mesa (Paso 5)
    function handleMesaEscrutinioSubmit() {
        if (!state.selectedMesa) return;

        // Validar campos de texto vacíos
        const presiName = document.getElementById("input-member-president").value.trim();
        const vocal1Name = document.getElementById("input-member-vocal1").value.trim();
        const vocal2Name = document.getElementById("input-member-vocal2").value.trim();

        if (!presiName || !vocal1Name || !vocal2Name) {
            alert("Por favor, rellene los nombres de todos los miembros de la mesa (Presidente/a y los dos Vocales) antes de cerrar la mesa.");
            return;
        }

        // Advertencia sobre casillas de voto vacías si existen
        if (!checkBlankFieldsWarning()) {
            return;
        }

        // Validar que la suma de votos no supere el censo antes de proceder
        let sumVotos = 0;
        document.querySelectorAll(".vote-input-field").forEach(input => {
            sumVotos += parseInt(input.value, 10) || 0;
        });

        const censoMesa = parseInt(state.selectedMesa.censo, 10) || 0;
        console.log(`[Validación Cierre] Suma de votos: ${sumVotos}, Censo de mesa: ${censoMesa}`);

        if (sumVotos > censoMesa) {
            alert(`Error de validación: El total de votos contabilizados (${sumVotos.toLocaleString()}) supera el censo electoral de esta mesa (${censoMesa.toLocaleString()}). No es posible cerrar la mesa con esta incongruencia. Por favor, revise y corrija los valores.`);
            return;
        }

        // Regla lógica: Votos escrutados deberían ser >= a la 2ª participación (o 1ª si no hay 2ª)
        const refParticipacion = (state.selectedMesa.part2_votos && state.selectedMesa.part2_votos > 0)
            ? state.selectedMesa.part2_votos
            : (state.selectedMesa.part1_votos || 0);
        const refNombre = (state.selectedMesa.part2_votos && state.selectedMesa.part2_votos > 0)
            ? "2º Avance de Participación (18:00h)"
            : "1º Avance de Participación (14:00h)";

        if (refParticipacion > 0 && sumVotos < refParticipacion) {
            const confirmDiscrepancy = confirm(
                `⚠️ AVISO DE DISCREPANCIA EN EL ESCRUTINIO:\n\n` +
                `El total de votos contabilizados en la urna (${sumVotos.toLocaleString()}) es MENOR que la cifra enviada en el ${refNombre} (${refParticipacion.toLocaleString()} votantes).\n\n` +
                `Por coherencia electoral, los votos escrutados al cierre deben ser al menos iguales o superiores a la participación registrada durante el día.\n\n` +
                `Si se trata de una corrección por error en el recuento del avance, pulsa 'Aceptar' para confirmar y transmitir el acta.\n` +
                `En caso contrario, pulsa 'Cancelar' para revisar los votos.`
            );
            if (!confirmDiscrepancy) {
                return;
            }
        }

        // Advertencia antes de cerrar
        const confirmClose = confirm("¿Está seguro de que desea CERRAR LA MESA? Esta acción transmitirá los resultados al servidor central.");
        if (!confirmClose) return;

        // Recoger votos
        const votes = {};
        PARTIES_CONFIG.forEach(p => {
            votes[p.field] = parseInt(document.getElementById(`input-vote-${p.id}`).value, 10) || 0;
        });
        const votosBlanco = parseInt(document.getElementById("input-vote-blanco").value, 10) || 0;
        const votosNulo = parseInt(document.getElementById("input-vote-nulo").value, 10) || 0;

        const miembrosJson = JSON.stringify({
            presi: presiName,
            vocal1: vocal1Name,
            vocal2: vocal2Name
        });

        // Actualizar objeto en estado local
        const targetMesa = state.mesas.find(m => m.codigo === state.selectedMesa.codigo);
        if (targetMesa) {
            PARTIES_CONFIG.forEach(p => {
                targetMesa[p.field] = votes[p.field];
            });
            targetMesa.votos_blancos = votosBlanco;
            targetMesa.votos_nulos = votosNulo;
            targetMesa.miembros = miembrosJson;
            targetMesa.estado = "Cerrada";
            targetMesa.firma_presi = "firmado";
            targetMesa.firma_vocal1 = "firmado";
            targetMesa.firma_vocal2 = "firmado";
        }

        saveLocalDatabase();
        sendMesaUpdateToServer(targetMesa);

        alert(`¡Mesa ${targetMesa.codigo} cerrada y transmitida con éxito!`);
        state.selectedMesa = null;
        showSchoolPortalView();
        updateGlobalMetrics();
        renderAdminPortal();
    }

    // Actualiza el estado de una mesa por código ("Abierta", "Asignada", etc.)
    function updateMesaState(codigo, nuevoEstado) {
        const target = state.mesas.find(m => m.codigo === codigo);
        if (target) {
            target.estado = nuevoEstado;
            saveLocalDatabase();
            // Notificar a otras pestañas si se abre/cierra
            localStorage.setItem("elecciones_refresh_trigger", Date.now().toString());
            
            // Sincronizar de forma inmediata con el servidor de ArcGIS
            if (state.arcgisMode && target.objectid !== null) {
                console.log(`Sincronizando cambio de estado de mesa ${codigo} a ${nuevoEstado} en ArcGIS Server...`);
                try {
                    const tablesLayer = new FeatureLayer({ url: URL_MESAS_TABLE_EDIT });
                    const attributes = {
                        objectid: target.objectid,
                        OBJECTID: target.objectid,
                        codigo: target.codigo,
                        estado: nuevoEstado
                    };
                    const editGraphic = new Graphic({ attributes: attributes });
                    
                    tablesLayer.applyEdits({ updateFeatures: [editGraphic] }).then(result => {
                        console.log(`Estado de mesa ${codigo} actualizado con éxito en ArcGIS Server:`, result);
                    }).catch(err => {
                        console.error(`Fallo al sincronizar estado de mesa ${codigo} en ArcGIS Server:`, err);
                    });
                } catch (e) {
                    console.error("Excepción al sincronizar estado de mesa en ArcGIS:", e);
                }
            }
        }
    }

    // ==========================================================================
    // CONTROL DE ADMINISTRACIÓN
    // ==========================================================================
    function renderAdminPortal() {
        // Métricas de administrador
        const totalMesas = state.mesas.length;
        const closedMesas = state.mesas.filter(m => m.estado === "Cerrada").length;
        const percentClosed = totalMesas > 0 ? ((closedMesas / totalMesas) * 100).toFixed(2) : "0.00";

        document.getElementById("admin-metric-mesas-percent").textContent = `${percentClosed}%`;
        document.getElementById("admin-metric-mesas-ratio").textContent = `${closedMesas} de ${totalMesas} mesas`;

        // Calcular votos válidos acumulados y censo total
        let totalVotosValidos = 0;
        let totalVotosNulos = 0;
        let censoTotal = 0;
        state.mesas.forEach(m => {
            censoTotal += m.censo;
            if (m.estado === "Cerrada") {
                PARTIES_CONFIG.forEach(p => {
                    totalVotosValidos += (m[p.field] || 0);
                });
                totalVotosValidos += (m.votos_blancos || 0);
                totalVotosNulos += (m.votos_nulos || 0);
            }
        });

        const totalVotosEmitidos = totalVotosValidos + totalVotosNulos;

        document.getElementById("admin-metric-votos-total").textContent = totalVotosValidos.toLocaleString();
        
        // Cálculo de participación dinámica en Administración (Ponderada sobre mesas comunicadas)
        let partPercent = "0.00";
        let partSub = "Pendiente de avances";

        const part2Mesas = state.mesas.filter(m => (m.part2_votos || 0) > 0 || m.estado === "Part2_Enviada" || m.estado === "Cerrada");
        const part1Mesas = state.mesas.filter(m => (m.part1_votos || 0) > 0 || m.estado === "Part1_Enviada" || m.estado === "Part2_Enviada" || m.estado === "Cerrada");

        if (closedMesas > 0) {
            let closedCensus = 0;
            state.mesas.forEach(m => { if (m.estado === "Cerrada") closedCensus += (m.censo || 0); });
            partPercent = closedCensus > 0 ? ((totalVotosEmitidos / closedCensus) * 100).toFixed(2) : "0.00";
            partSub = `${totalVotosEmitidos.toLocaleString()} votos (${closedMesas} de ${totalMesas} mesas cerradas)`;
        } else if (part2Mesas.length > 0) {
            const sumP2Votos = part2Mesas.reduce((acc, m) => acc + (m.part2_votos || 0), 0);
            const sumP2Censo = part2Mesas.reduce((acc, m) => acc + (m.censo || 0), 0);
            partPercent = sumP2Censo > 0 ? ((sumP2Votos / sumP2Censo) * 100).toFixed(2) : "0.00";
            partSub = `${sumP2Votos.toLocaleString()} votos (2º Avance 18:00h · ${part2Mesas.length} de ${totalMesas} mesas)`;
        } else if (part1Mesas.length > 0) {
            const sumP1Votos = part1Mesas.reduce((acc, m) => acc + (m.part1_votos || 0), 0);
            const sumP1Censo = part1Mesas.reduce((acc, m) => acc + (m.censo || 0), 0);
            partPercent = sumP1Censo > 0 ? ((sumP1Votos / sumP1Censo) * 100).toFixed(2) : "0.00";
            partSub = `${sumP1Votos.toLocaleString()} votos (1º Avance 14:00h · ${part1Mesas.length} de ${totalMesas} mesas)`;
        }

        const adminPartEl = document.getElementById("admin-metric-participation");
        if (adminPartEl) adminPartEl.textContent = `${partPercent}%`;
        const adminPartSubEl = document.getElementById("admin-metric-participation-sub");
        if (adminPartSubEl) adminPartSubEl.textContent = partSub;

        // Renderizar Colegios con botones de Cierre
        renderAdminColegiosList();

        // Renderizar Tabla de Mesas
        renderAdminMesasTable();
    }

    function renderAdminColegiosList() {
        const container = document.getElementById("admin-colegios-summary-container");
        container.innerHTML = "";

        const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

        // Obtener colegios de las mesas configuradas ordenados alfabéticamente
        const colegios = [...new Set(state.mesas.map(m => m.colegio))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

        colegios.forEach(colName => {
            const colMesas = state.mesas.filter(m => m.colegio === colName);
            const total = colMesas.length;
            const closed = colMesas.filter(m => m.estado === "Cerrada").length;
            const isAllClosed = (closed === total && total > 0);
            
            const details = COLEGIO_DETAILS[colName];
            const imgUrl = details?.image ? (baseUrl + details.image) : (baseUrl + "Imagenes/Logo_OITR.png");
            const address = details?.address || "Rivas-Vaciamadrid";
            const totalCensus = colMesas.reduce((acc, m) => acc + (m.censo || 0), 0);

            const card = document.createElement("div");
            card.className = "admin-colegio-card";
            card.style.display = "flex";
            card.style.alignItems = "center";
            card.style.gap = "16px";
            card.style.padding = "16px";
            card.style.borderRadius = "12px";
            card.style.background = isAllClosed ? "linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)" : "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)";
            card.style.border = `1.5px solid ${isAllClosed ? '#fca5a5' : '#86efac'}`;
            card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
            card.style.marginBottom = "12px";
            card.style.flexWrap = "wrap";

            let statusBadgeHtml = "";
            let buttonHtml = "";

            if (isAllClosed) {
                statusBadgeHtml = `
                    <span style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color:#ffffff; padding:6px 14px; border-radius:20px; font-weight:800; font-size:0.82rem; box-shadow:0 2px 6px rgba(239,68,68,0.25); display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
                        <i class="fa-solid fa-lock"></i> CERRADO (${closed}/${total} mesas)
                    </span>
                `;
                buttonHtml = `
                    <button class="btn-header btn-primary btn-print-school-acta" data-colegio="${colName}" style="font-size:0.82rem; padding:8px 16px; background-color: var(--primary-color); white-space:nowrap;">
                        <i class="fa-solid fa-file-pdf"></i> Acta Agregada del Colegio
                    </button>
                `;
            } else {
                statusBadgeHtml = `
                    <span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; padding:6px 14px; border-radius:20px; font-weight:800; font-size:0.82rem; box-shadow:0 2px 6px rgba(16,185,129,0.25); display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
                        <i class="fa-solid fa-lock-open"></i> EN PROCESO (${closed}/${total} mesas)
                    </span>
                `;
                buttonHtml = `
                    <button class="btn-header btn-secondary btn-print-school-acta" data-colegio="${colName}" style="font-size:0.82rem; padding:8px 16px; white-space:nowrap;">
                        <i class="fa-solid fa-print"></i> Vista Previa del Acta (${closed}/${total})
                    </button>
                `;
            }

            card.innerHTML = `
                <div style="width: 74px; height: 74px; border-radius: 10px; overflow: hidden; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
                    <img src="${imgUrl}" alt="${colName}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>

                <div style="flex: 1; min-width: 220px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; flex-wrap: wrap;">
                        <span style="font-weight: 800; font-size: 1.05rem; color: #0f172a; font-family: var(--font-heading);">${colName}</span>
                        ${statusBadgeHtml}
                    </div>
                    
                    <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                        <span><i class="fa-solid fa-location-dot" style="color: var(--primary-color);"></i> ${address}</span>
                        <span><i class="fa-solid fa-users"></i> Censo: <strong>${totalCensus.toLocaleString()}</strong> electores</span>
                    </div>
                </div>

                <div style="flex-shrink: 0;">
                    ${buttonHtml}
                </div>
            `;
            container.appendChild(card);
        });

        // Vincular eventos a los botones de acta
        container.querySelectorAll(".btn-print-school-acta").forEach(btn => {
            btn.addEventListener("click", function() {
                const colName = this.getAttribute("data-colegio");
                printSchoolAct(colName);
            });
        });
    }

    function renderAdminMesasTable() {
        const tbody = document.getElementById("admin-mesas-table-body");
        tbody.innerHTML = "";

        // Ordenar mesas: 1º por Colegio, 2º por Sección, 3º por Mesa
        const sortedMesas = [...state.mesas].sort((a, b) => {
            const colComp = (a.colegio || "").localeCompare(b.colegio || "", 'es', { sensitivity: 'base' });
            if (colComp !== 0) return colComp;

            const secComp = (a.seccion || "").localeCompare(b.seccion || "", 'es', { numeric: true, sensitivity: 'base' });
            if (secComp !== 0) return secComp;

            return (a.mesa || "").localeCompare(b.mesa || "", 'es', { sensitivity: 'base' });
        });

        sortedMesas.forEach(mesa => {
            const tr = document.createElement("tr");

            let statusBadgeHtml = `<span class="status-badge-inline status-open">Abierta</span>`;
            if (mesa.estado === "Cerrada") {
                statusBadgeHtml = `<span class="status-badge-inline status-closed"><i class="fa-solid fa-lock"></i> Cerrada</span>`;
            } else if (mesa.estado === "Escrutando" || mesa.estado === "Asignada") {
                statusBadgeHtml = `<span class="status-badge-inline" style="background:#f3e8ff; color:#7e22ce; border:1px solid #d8b4fe; font-weight:700;"><i class="fa-solid fa-pen-to-square fa-beat"></i> Escrutando</span>`;
            } else if (mesa.estado === "Part1_Enviada") {
                statusBadgeHtml = `<span class="status-badge-inline" style="background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc;"><i class="fa-solid fa-chart-line"></i> Part. 1 Enviada</span>`;
            } else if (mesa.estado === "Part2_Enviada") {
                statusBadgeHtml = `<span class="status-badge-inline" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a;"><i class="fa-solid fa-chart-line"></i> Part. 2 Enviada</span>`;
            }

            let actionButtons = `
                <button class="admin-btn-action btn-edit-admin-votes" data-codigo="${mesa.codigo}" title="Editar Votos (Admin)">
                    <i class="fa-solid fa-pen-to-square" style="color: #0284c7;"></i>
                </button>
                <button class="admin-btn-action btn-edit-admin-members" data-codigo="${mesa.codigo}" title="Editar Miembros (Admin)">
                    <i class="fa-solid fa-users-gear" style="color: #7c3aed;"></i>
                </button>
            `;
            
            if (mesa.estado === "Cerrada") {
                actionButtons += `
                    <button class="admin-btn-action btn-view-acta" data-codigo="${mesa.codigo}" title="Ver Acta Escrutada">
                        <i class="fa-solid fa-file-signature" style="color: var(--primary-color);"></i>
                    </button>
                    <button class="admin-btn-action btn-reopen-mesa" data-codigo="${mesa.codigo}" title="Reabrir Mesa para corrección">
                        <i class="fa-solid fa-folder-open" style="color: #f59e0b;"></i>
                    </button>
                `;
            } else {
                actionButtons += `
                    <button class="admin-btn-action btn-delete-mesa" data-codigo="${mesa.codigo}" title="Eliminar Mesa">
                        <i class="fa-solid fa-trash-can" style="color: #ef4444;"></i>
                    </button>
                `;
            }

            tr.innerHTML = `
                <td><strong>${mesa.codigo}</strong></td>
                <td>${mesa.colegio}</td>
                <td>${mesa.seccion}</td>
                <td>${mesa.mesa}</td>
                <td>${mesa.censo}</td>
                <td>${statusBadgeHtml}</td>
                <td style="text-align: right; white-space: nowrap;">${actionButtons}</td>
            `;

            tbody.appendChild(tr);
        });

        // Vincular eventos de la tabla
        tbody.querySelectorAll(".btn-edit-admin-votes").forEach(btn => {
            btn.addEventListener("click", function() {
                const cod = this.getAttribute("data-codigo");
                openAdminEditVotesModal(cod);
            });
        });

        tbody.querySelectorAll(".btn-edit-admin-members").forEach(btn => {
            btn.addEventListener("click", function() {
                const cod = this.getAttribute("data-codigo");
                openAdminEditMembersModal(cod);
            });
        });

        tbody.querySelectorAll(".btn-view-acta").forEach(btn => {
            btn.addEventListener("click", function() {
                const cod = this.getAttribute("data-codigo");
                viewMesaActa(cod);
            });
        });

        tbody.querySelectorAll(".btn-reopen-mesa").forEach(btn => {
            btn.addEventListener("click", function() {
                const cod = this.getAttribute("data-codigo");
                reopenMesaPrompt(cod);
            });
        });

        tbody.querySelectorAll(".btn-delete-mesa").forEach(btn => {
            btn.addEventListener("click", function() {
                const cod = this.getAttribute("data-codigo");
                deleteMesaPrompt(cod);
            });
        });
    }

    // Cierre de colegio electoral por el administrador
    function handleAdminCloseSchool(colegioName) {
        const conf = confirm(`¿Está seguro de que desea CERRAR EL COLEGIO ELECTORAL: ${colegioName}? Esto bloqueará todas sus actas asociadas y permitirá exportar el Acta Agregada del centro.`);
        if (!conf) return;

        const colegiosCerrados = JSON.parse(localStorage.getItem("elecciones_colegios_cerrados") || "[]");
        if (!colegiosCerrados.includes(colegioName)) {
            colegiosCerrados.push(colegioName);
            localStorage.setItem("elecciones_colegios_cerrados", JSON.stringify(colegiosCerrados));
        }

        renderAdminPortal();
        updateGlobalMetrics();
    }

    // Agregar nueva mesa
    function handleAdminAddMesa() {
        const col = document.getElementById("add-mesa-colegio").value;
        const sec = document.getElementById("add-mesa-seccion").value.trim();
        const letMesa = document.getElementById("add-mesa-letra").value.trim().toUpperCase();
        const census = parseInt(document.getElementById("add-mesa-census").value, 10);

        if (isNaN(census) || census <= 0) {
            alert("Introduce una cifra de censo válida mayor a 0.");
            return;
        }

        const cod = sec + letMesa;

        // Validar que la mesa no exista previamente
        const existing = state.mesas.find(m => m.codigo === cod);
        if (existing) {
            alert(`Error: La mesa con el código '${cod}' ya existe registrada en el colegio '${existing.colegio}'. No se permiten mesas duplicadas.`);
            return;
        }

        const nuevaMesa = {
            codigo: cod,
            seccion: sec,
            mesa: letMesa,
            colegio: col,
            votos_blancos: 0,
            votos_nulos: 0,
            miembros: "",
            estado: "Abierta",
            firma_presi: "",
            firma_vocal1: "",
            firma_vocal2: "",
            censo: census,
            objectid: null
        };
        PARTIES_CONFIG.forEach(p => { nuevaMesa[p.field] = 0; });

        // Guardar censo manual para persistencia
        try {
            const censosMap = JSON.parse(localStorage.getItem("elecciones_censos_manuales") || "{}");
            censosMap[cod] = census;
            localStorage.setItem("elecciones_censos_manuales", JSON.stringify(censosMap));
        } catch (e) {}

        state.mesas.push(nuevaMesa);

        saveLocalDatabase();
        sendMesaAddToServer(nuevaMesa);

        alert(`¡Mesa ${cod} configurada con éxito!\nColegio: ${col}\nCenso registrado: ${census} electores`);
        document.getElementById("modal-admin-add-mesa").classList.add("hidden");
        renderAdminPortal();
        updateGlobalMetrics();
        renderMapTheme();
    }

    function deleteMesaPrompt(codigo) {
        const conf = confirm(`¿Está seguro de que desea ELIMINAR la Mesa ${codigo}?`);
        if (!conf) return;

        state.mesas = state.mesas.filter(m => m.codigo !== codigo);
        saveLocalDatabase();
        sendMesaDeleteToServer(codigo);

        renderAdminPortal();
        updateGlobalMetrics();
        renderMapTheme();
    }

    // Eliminar TODAS las mesas generadas (útil para volver a crearlas manualmente)
    async function handleAdminDeleteAllMesas() {
        const conf = confirm(
            "ATENCIÓN: Se van a ELIMINAR todas las mesas del sistema (tanto locales como en el servidor remoto de ArcGIS).\n\n" +
            "Esta acción vaciará completamente la tabla y no se puede deshacer. ¿Desea continuar?"
        );
        if (!conf) return;

        // Si estamos en modo ArcGIS: consultar y borrar todos los registros de la tabla del servidor en bloque
        if (state.arcgisMode) {
            console.log("Consultando todas las mesas en el servidor ArcGIS para su eliminación masiva...");
            try {
                const tablesLayer = new FeatureLayer({ 
                    url: URL_MESAS_TABLE_EDIT,
                    outFields: ["*"]
                });
                
                await tablesLayer.load();
                const query = tablesLayer.createQuery();
                query.where = "1=1";
                query.outFields = ["*"];
                
                const results = await tablesLayer.queryFeatures(query);
                if (results.features && results.features.length > 0) {
                    console.log(`Eliminando ${results.features.length} registros del servidor ArcGIS...`);
                    const result = await tablesLayer.applyEdits({
                        deleteFeatures: results.features
                    });
                    console.log("Servidor ArcGIS respuesta de applyEdits (delete):", result);
                    
                    const failures = (result.deleteFeatureResults || []).filter(r => r.error);
                    if (failures.length > 0) {
                        console.error("Algunos registros no se pudieron eliminar en el servidor:", failures);
                        alert(`Atención: Falló la eliminación de ${failures.length} registro(s) en el servidor de ArcGIS.`);
                    } else {
                        alert(`¡Se han eliminado correctamente ${results.features.length} mesas del servidor de ArcGIS y en local!`);
                    }
                } else {
                    console.log("La tabla del servidor de ArcGIS ya estaba vacía.");
                    alert("La tabla de mesas en ArcGIS Server ya estaba vacía.");
                }
            } catch (err) {
                console.error("Error al vaciar la tabla en ArcGIS Server:", err);
                alert("Error al conectar con ArcGIS Server para eliminar las mesas: " + (err.message || err));
                return;
            }
        } else {
            alert("Todas las mesas locales han sido eliminadas.");
        }

        // Vaciar localmente
        state.mesas = [];
        saveLocalDatabase();
        localStorage.setItem("elecciones_colegios_cerrados", JSON.stringify([]));
        
        renderAdminPortal();
        updateGlobalMetrics();
        renderMapTheme();
    }

    // ==========================================================================
    // GESTIÓN DE FUERZAS POLÍTICAS (PARTIDOS)
    // ==========================================================================
    function renderAdminPartiesModal() {
        loadPartiesFromStorage();
        const countBadge = document.getElementById("parties-count-badge");
        if (countBadge) countBadge.textContent = PARTIES_CONFIG.length;

        const container = document.getElementById("admin-parties-list-container");
        if (!container) return;
        container.innerHTML = "";

        PARTIES_CONFIG.forEach(p => {
            const item = document.createElement("div");
            item.style.display = "flex";
            item.style.alignItems = "center";
            item.style.justifyContent = "space-between";
            item.style.background = "#ffffff";
            item.style.border = "1px solid #e2e8f0";
            item.style.borderRadius = "8px";
            item.style.padding = "10px 14px";
            item.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";

            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${p.logo}" alt="Logo ${p.name}" style="width:34px; height:34px; object-fit:contain; border-radius:4px; border:1px solid #f1f5f9; background:#fff; padding:2px;">
                    <div>
                        <div style="font-weight:700; font-size:0.9rem; color:#0f172a;">${p.name} <span style="font-size:0.75rem; color:#64748b; font-weight:500;">(${p.id})</span></div>
                        <div style="font-size:0.75rem; color:#64748b; display:flex; align-items:center; gap:8px; margin-top:2px;">
                            <span style="width:12px; height:12px; border-radius:50%; background-color:${p.color}; display:inline-block; border:1px solid rgba(0,0,0,0.1);"></span>
                            <code>${p.color}</code>
                            <span style="color:#cbd5e1;">•</span>
                            <span>Campo DB: <code>${p.field}</code></span>
                        </div>
                    </div>
                </div>
                <div>
                    <button class="btn-header btn-danger btn-delete-party" data-id="${p.id}" style="padding:6px 12px; font-size:0.78rem;">
                        <i class="fa-solid fa-trash"></i> Eliminar
                    </button>
                </div>
            `;
            container.appendChild(item);
        });

        container.querySelectorAll(".btn-delete-party").forEach(btn => {
            btn.addEventListener("click", function() {
                const pId = this.getAttribute("data-id");
                handleAdminDeleteParty(pId);
            });
        });
    }

    function handleAdminAddParty(e) {
        e.preventDefault();
        const idInput = document.getElementById("party-id-input");
        const nameInput = document.getElementById("party-name-input");
        const colorInput = document.getElementById("party-color-input");
        const presetSelect = document.getElementById("party-logo-preset-select");

        const rawId = idInput.value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const rawName = nameInput.value.trim();
        const color = colorInput.value;
        const logoUrl = (presetSelect && presetSelect.value) ? presetSelect.value : "Imagenes/Logo_OITR.png";

        if (!rawId || !rawName) {
            alert("Por favor, introduce las siglas (ID) y el nombre completo de la formación política.");
            return;
        }

        if (PARTIES_CONFIG.some(p => p.id === rawId)) {
            alert(`Ya existe una fuerza política con las siglas/ID '${rawId}'. Elige otro identificador.`);
            return;
        }

        const fieldName = `votos_${rawId.toLowerCase()}`;

        const newParty = {
            id: rawId,
            name: rawName,
            color: color,
            logo: logoUrl,
            field: fieldName
        };

        const updated = [...PARTIES_CONFIG, newParty];
        savePartiesToStorage(updated);
        savePartiesToArcGIS(PARTIES_CONFIG); // Sincronizar con servidor para otros navegadores

        // Inicializar campo en 0 para todas las mesas en memoria
        state.mesas.forEach(m => {
            if (m[fieldName] === undefined) {
                m[fieldName] = 0;
            }
        });
        saveLocalDatabase();

        // Limpiar campos del formulario
        idInput.value = "";
        nameInput.value = "";
        if (presetSelect) presetSelect.value = "";

        // Re-generar vista y notificar a la app
        generateVoteFields();
        renderAdminPartiesModal();
        updateGlobalMetrics();
        renderMapTheme();
        renderAdminPortal();

        alert(`¡Fuerza política '${rawName}' (${rawId}) agregada con éxito!`);
    }

    function handleAdminDeleteParty(partyId) {
        const party = PARTIES_CONFIG.find(p => p.id === partyId);
        if (!party) return;

        const conf = confirm(`¿Estás seguro de que deseas eliminar la fuerza política '${party.name} (${party.id})'? Se borrarán sus datos contabilizados.`);
        if (!conf) return;

        removeCustomPartyLogo(partyId);

        const fieldToDelete = party.field;
        const updated = PARTIES_CONFIG.filter(p => p.id !== partyId);
        savePartiesToStorage(updated);
        savePartiesToArcGIS(PARTIES_CONFIG); // Sincronizar con servidor para otros navegadores

        state.mesas.forEach(m => {
            delete m[fieldToDelete];
        });
        saveLocalDatabase();

        generateVoteFields();
        renderAdminPartiesModal();
        updateGlobalMetrics();
        renderMapTheme();
        renderAdminPortal();

        alert(`Fuerza política '${party.name}' eliminada correctamente.`);
    }

    function handleAdminDeleteAllParties() {
        if (PARTIES_CONFIG.length === 0) {
            alert("No hay fuerzas políticas registradas para eliminar.");
            return;
        }

        const conf = confirm("ATENCIÓN: ¿Estás seguro de que deseas ELIMINAR TODAS LAS FUERZAS POLÍTICAS del sistema? Las mesas quedarán únicamente con las casillas neutras (Votos en Blanco y Votos Nulos).");
        if (!conf) return;

        savePartiesToStorage([]);
        savePartiesToArcGIS([]); // Sincronizar con servidor para otros navegadores

        // Limpiar campos de partidos en las mesas
        state.mesas.forEach(m => {
            Object.keys(m).forEach(k => {
                if (k.startsWith("votos_") && k !== "votos_blancos" && k !== "votos_nulos") {
                    delete m[k];
                }
            });
        });
        saveLocalDatabase();

        generateVoteFields();
        renderAdminPartiesModal();
        updateGlobalMetrics();
        renderMapTheme();
        renderAdminPortal();

        alert("Se han eliminado todas las fuerzas políticas del sistema.");
    }

    // Resetear base de datos
    function handleAdminResetDB() {
        const conf = confirm("ATENCIÓN: Se van a borrar todos los votos, miembros y firmas de las mesas escrutadas, restaurándolas a estado abierto. Esta acción no se puede deshacer. ¿Desea continuar?");
        if (!conf) return;

        // Conservar mesas, pero resetear votos y firmas
        state.mesas.forEach(m => {
            PARTIES_CONFIG.forEach(p => { m[p.field] = 0; });
            m.votos_blancos = 0;
            m.votos_nulos = 0;
            m.miembros = "";
            m.estado = "Abierta";
            m.firma_presi = "";
            m.firma_vocal1 = "";
            m.firma_vocal2 = "";
        });

        saveLocalDatabase();
        localStorage.setItem("elecciones_colegios_cerrados", JSON.stringify([]));

        if (state.arcgisMode) {
            // Sincronizar todos los cambios al servidor (actualizar todas las filas)
            state.mesas.forEach(sendMesaUpdateToServer);
        } else {
            alert("Escrutinio reiniciado a cero correctamente.");
            renderAdminPortal();
            updateGlobalMetrics();
            renderMapTheme();
        }
    }

    // Llenar datos de prueba automáticamente
    function handleAdminDemoFill() {
        const conf = confirm(
            "¿Desea rellenar el censo municipal completo generando 3 mesas por sección (A, B, C) con votos aleatorios ponderados realistas?\n\n" +
            "Esto simulará el 100% de las mesas de Rivas-Vaciamadrid y pintará el mapa completo."
        );
        if (!conf) return;

        console.log("Generando simulación municipal...");

        const simulatedMesas = [];
        const sectionsList = Object.keys(SECTION_COLEGIO_MAPPING); // Las 66 secciones de Rivas

        sectionsList.forEach(secCode => {
            const colName = SECTION_COLEGIO_MAPPING[secCode];
            const secCensus = CENSUS_2023[secCode] || 1500;
            
            // Dividir censo entre las 3 mesas A, B y C
            const baseCenso = Math.floor(secCensus / 3);
            const censos = [baseCenso, baseCenso, secCensus - (baseCenso * 2)];
            const letras = ["A", "B", "C"];

            for (let i = 0; i < 3; i++) {
                const letra = letras[i];
                const codMesa = secCode + letra;
                const censoMesa = censos[i];
                
                // Simular participación entre el 60% y el 82%
                const totalVotantes = Math.round(censoMesa * (0.6 + Math.random() * 0.22));
                
                // Pesos ponderados realistas para Rivas-Vaciamadrid
                const weights = { PP: 0.30, PSOE: 0.28, VOX: 0.12, SUMAR: 0.10, UP: 0.08, Cs: 0.02, PACMA: 0.02, SALF: 0.03 };
                let remaining = totalVotantes;
                const votosPartido = {};
                
                PARTIES_CONFIG.forEach(p => {
                    const share = weights[p.id];
                    const votos = Math.round(totalVotantes * (share + (Math.random() * 0.06 - 0.03)));
                    votosPartido[p.field] = Math.max(0, votos);
                    remaining -= votosPartido[p.field];
                });

                // Votos blancos y nulos
                const votos_blancos = Math.max(0, Math.round(remaining * 0.6));
                const votos_nulos = Math.max(0, remaining - votos_blancos);

                // Miembros de mesa ficticios
                const miembros = JSON.stringify({
                    presi: `Presidente/a Mesa ${codMesa}`,
                    vocal1: `Vocal 1 Mesa ${codMesa}`,
                    vocal2: `Vocal 2 Mesa ${codMesa}`
                });

                // Buscar si la mesa ya existía en state.mesas para conservar su objectid en ArcGIS mode
                const existingMesa = state.mesas.find(m => m.codigo === codMesa);
                const objId = existingMesa ? existingMesa.objectid : null;

                const mesaObj = {
                    codigo: codMesa,
                    seccion: secCode,
                    mesa: letra,
                    colegio: colName,
                    votos_blancos: votos_blancos,
                    votos_nulos: votos_nulos,
                    miembros: miembros,
                    estado: "Cerrada", // Todas cerradas para el render completo
                    firma_presi: "10,10 15,12 25,20|30,10 25,25",
                    firma_vocal1: "20,20 40,25 50,40|45,20 35,45",
                    firma_vocal2: "5,5 50,5 50,50|25,5 25,50",
                    censo: censoMesa,
                    objectid: objId
                };

                PARTIES_CONFIG.forEach(p => {
                    mesaObj[p.field] = votosPartido[p.field];
                });

                simulatedMesas.push(mesaObj);
            }
        });

        // Actualizar el estado en memoria
        state.mesas = simulatedMesas;
        localStorage.removeItem("elecciones_mesas_vacias");
        saveLocalDatabase();
        rebuildDynamicMappings();

        // Si estamos en ArcGIS mode: subir los cambios en bloque
        if (state.arcgisMode) {
            console.log("Subiendo lote de simulación a ArcGIS Server...");
            
            const tablesLayer = new FeatureLayer({
                url: URL_MESAS_TABLE_EDIT
            });

            const addGraphics = [];
            const updateGraphics = [];

            simulatedMesas.forEach(m => {
                const attrs = buildFeatureAttributesFromMesa(m);

                if (m.objectid !== null) {
                    attrs.objectid = m.objectid;
                    attrs.OBJECTID = m.objectid;
                    updateGraphics.push(new Graphic({ attributes: attrs }));
                } else {
                    addGraphics.push(new Graphic({ attributes: attrs }));
                }
            });

            console.log(`Lanzando applyEdits. Adiciones: ${addGraphics.length}, Actualizaciones: ${updateGraphics.length}`);
            
            tablesLayer.applyEdits({
                addFeatures: addGraphics,
                updateFeatures: updateGraphics
            }).then(result => {
                console.log("Simulación en bloque completada en el servidor de ArcGIS:", result);
                alert("¡Simulación municipal completa aplicada en ArcGIS Server con éxito! El mapa se cargará en breves instantes.");
                
                // Recargar todo desde el servidor para obtener los ObjectIDs correctos
                syncDataWithArcGISServer();
            }).catch(err => {
                console.error("Error al aplicar la simulación en bloque en ArcGIS Server:", err);
                alert("Error al guardar en ArcGIS Server. Se aplicó en memoria local para la previsualización actual.");
                
                renderAdminPortal();
                updateGlobalMetrics();
                renderMapTheme();
            });

        } else {
            alert("Simulación de todo el municipio (198 mesas) inyectada en local con éxito.");
            renderAdminPortal();
            updateGlobalMetrics();
            renderMapTheme();
        }
    }

    // ==========================================================================
    // AGREGACIÓN DE VOTOS Y RENDERIZADO DEL DASHBOARD PÚBLICO
    // ==========================================================================
    function updateGlobalMetrics() {
        // Contar censo y escrutinio oficial (solo mesas CERRADAS)
        const totalMesas = state.mesas.length;
        const closedMesas = state.mesas.filter(m => m.estado === "Cerrada").length;
        const scrutinyPercent = totalMesas > 0 ? ((closedMesas / totalMesas) * 100).toFixed(2) : "0.00";

        // Actualizar indicadores principales de escrutinio
        document.getElementById("header-scrutiny-percent").textContent = `${scrutinyPercent}%`;
        document.getElementById("global-scrutiny-val").textContent = `${scrutinyPercent}%`;
        document.getElementById("global-scrutiny-bar").style.width = `${scrutinyPercent}%`;
        
        if (closedMesas === 0) {
            document.getElementById("global-mesas-ratio").textContent = `0 de ${totalMesas} mesas cerradas (Recuento a partir de las 20:00h)`;
        } else {
            document.getElementById("global-mesas-ratio").textContent = `${closedMesas} de ${totalMesas} mesas escrutadas`;
        }

        // Censo Total
        let totalCensus = 0;
        state.mesas.forEach(m => {
            totalCensus += (m.censo || 0);
        });
        document.getElementById("global-census-val").textContent = totalCensus.toLocaleString();

        // 1. CÁLCULO DE AVANCE 1 (14:00h) - Ponderado sobre mesas comunicadas
        const part1Mesas = state.mesas.filter(m => (m.part1_votos || 0) > 0 || m.estado === "Part1_Enviada" || m.estado === "Part2_Enviada" || m.estado === "Cerrada");
        const p1ValEl = document.getElementById("global-part1-val");
        const p1SubEl = document.getElementById("global-part1-sub");
        let pctP1 = "0.00";
        let sumP1Votos = 0;
        let sumP1Censo = 0;

        if (part1Mesas.length > 0) {
            part1Mesas.forEach(m => {
                let v = m.part1_votos || 0;
                if (!v && m.estado === "Part1_Enviada") {
                    v = PARTIES_CONFIG.reduce((s, p) => s + (m[p.field] || 0), 0) + (m.votos_blancos || 0) + (m.votos_nulos || 0);
                }
                sumP1Votos += v;
                sumP1Censo += (m.censo || 0);
            });

            pctP1 = sumP1Censo > 0 ? ((sumP1Votos / sumP1Censo) * 100).toFixed(2) : "0.00";
            if (p1ValEl) p1ValEl.textContent = `${pctP1}%`;
            if (p1SubEl) p1SubEl.textContent = `${sumP1Votos.toLocaleString()} votos (${part1Mesas.length} de ${totalMesas} mesas)`;
        } else {
            if (p1ValEl) p1ValEl.textContent = "--";
            if (p1SubEl) p1SubEl.textContent = "Pendiente (14:00h)";
        }

        // 2. CÁLCULO DE AVANCE 2 (18:00h) - Ponderado sobre mesas comunicadas
        const part2Mesas = state.mesas.filter(m => (m.part2_votos || 0) > 0 || m.estado === "Part2_Enviada" || m.estado === "Cerrada");
        const p2ValEl = document.getElementById("global-part2-val");
        const p2SubEl = document.getElementById("global-part2-sub");
        let pctP2 = "0.00";
        let sumP2Votos = 0;
        let sumP2Censo = 0;

        if (part2Mesas.length > 0) {
            part2Mesas.forEach(m => {
                let v = m.part2_votos || 0;
                if (!v && (m.estado === "Part2_Enviada" || m.estado === "Cerrada")) {
                    v = PARTIES_CONFIG.reduce((s, p) => s + (m[p.field] || 0), 0) + (m.votos_blancos || 0) + (m.votos_nulos || 0);
                }
                sumP2Votos += v;
                sumP2Censo += (m.censo || 0);
            });

            pctP2 = sumP2Censo > 0 ? ((sumP2Votos / sumP2Censo) * 100).toFixed(2) : "0.00";
            if (p2ValEl) p2ValEl.textContent = `${pctP2}%`;
            if (p2SubEl) p2SubEl.textContent = `${sumP2Votos.toLocaleString()} votos (${part2Mesas.length} de ${totalMesas} mesas)`;
        } else {
            if (p2ValEl) p2ValEl.textContent = "--";
            if (p2SubEl) p2SubEl.textContent = "Pendiente (18:00h)";
        }

        // 3. CÁLCULO DE VOTOS Y PARTICIPACIÓN OFICIAL
        let totalNulos = 0;
        let totalBlancos = 0;
        let totalVotosValidos = 0;
        let closedCensus = 0;
        const partyTotals = {};
        PARTIES_CONFIG.forEach(p => { partyTotals[p.id] = 0; });

        state.mesas.forEach(m => {
            if (m.estado === "Cerrada") {
                closedCensus += (m.censo || 0);
                totalNulos += (m.votos_nulos || 0);
                totalBlancos += (m.votos_blancos || 0);
                totalVotosValidos += (m.votos_blancos || 0);

                PARTIES_CONFIG.forEach(p => {
                    const v = m[p.field] || 0;
                    partyTotals[p.id] += v;
                    totalVotosValidos += v;
                });
            }
        });

        const totalVotosEmitidos = totalVotosValidos + totalNulos;

        // Tarjeta de Participación General (con subtítulo explicativo de la fase activa)
        const globalPartValEl = document.getElementById("global-participation-val");
        const globalPartBarEl = document.getElementById("global-participation-bar");
        const globalPartSubEl = document.getElementById("global-participation-sub");

        if (closedMesas > 0) {
            const partPercent = closedCensus > 0 ? ((totalVotosEmitidos / closedCensus) * 100).toFixed(2) : "0.00";
            if (globalPartValEl) globalPartValEl.textContent = `${partPercent}%`;
            if (globalPartBarEl) globalPartBarEl.style.width = `${partPercent}%`;
            if (globalPartSubEl) {
                globalPartSubEl.textContent = (closedMesas === totalMesas)
                    ? `Participación Final Oficial`
                    : `Escrutinio (${closedMesas} de ${totalMesas} mesas cerradas)`;
            }
        } else if (part2Mesas.length > 0 && parseFloat(pctP2) > 0) {
            if (globalPartValEl) globalPartValEl.textContent = `${pctP2}%`;
            if (globalPartBarEl) globalPartBarEl.style.width = `${pctP2}%`;
            if (globalPartSubEl) globalPartSubEl.textContent = `2º Avance 18:00h (${part2Mesas.length} de ${totalMesas} mesas)`;
        } else if (part1Mesas.length > 0 && parseFloat(pctP1) > 0) {
            if (globalPartValEl) globalPartValEl.textContent = `${pctP1}%`;
            if (globalPartBarEl) globalPartBarEl.style.width = `${pctP1}%`;
            if (globalPartSubEl) globalPartSubEl.textContent = `1º Avance 14:00h (${part1Mesas.length} de ${totalMesas} mesas)`;
        } else {
            if (globalPartValEl) globalPartValEl.textContent = `0.00%`;
            if (globalPartBarEl) globalPartBarEl.style.width = `0%`;
            if (globalPartSubEl) globalPartSubEl.textContent = `Pendiente de avances`;
        }

        // Votos Nulos y Blancos
        if (closedMesas > 0) {
            const nuloPercent = totalVotosEmitidos > 0 ? ((totalNulos / totalVotosEmitidos) * 100).toFixed(2) : "0.00";
            document.getElementById("global-nulos-val").innerHTML = `${totalNulos.toLocaleString()} <span style="font-size: 0.75rem; font-weight:400; color: var(--text-muted);">(${nuloPercent}%)</span>`;

            const blancoPercent = totalVotosValidos > 0 ? ((totalBlancos / totalVotosValidos) * 100).toFixed(2) : "0.00";
            document.getElementById("global-blancos-val").innerHTML = `${totalBlancos.toLocaleString()} <span style="font-size: 0.75rem; font-weight:400; color: var(--text-muted);">(${blancoPercent}%)</span>`;
        } else {
            document.getElementById("global-nulos-val").innerHTML = `0 <span style="font-size: 0.75rem; font-weight:400; color: var(--text-muted);">(0.00%)</span>`;
            document.getElementById("global-blancos-val").innerHTML = `0 <span style="font-size: 0.75rem; font-weight:400; color: var(--text-muted);">(0.00%)</span>`;
        }

        // Renderizar proyección D'Hondt de concejales (25 escaños)
        renderDHondtWidget(partyTotals, totalVotosValidos, closedMesas);

        // Renderizar partidos en el sidebar
        renderPartiesRanking(partyTotals, totalVotosValidos, closedMesas);

        // Renderizar colegios en el sidebar
        renderColegiosTab();
    }

    /**
     * Aplica la Ley D'Hondt para repartir 25 concejales municipales (Rivas-Vaciamadrid)
     * excluyendo a las candidaturas que no alcanzan la barrera electoral del 5% (LOREG).
     */
    function calculateDHondtSeats(partyVotes, totalVotosValidos, totalSeats = 25, thresholdPct = 5) {
        const seats = {};
        const partyStats = {};
        PARTIES_CONFIG.forEach(p => {
            seats[p.id] = 0;
            const votes = partyVotes[p.id] || 0;
            const pct = totalVotosValidos > 0 ? (votes / totalVotosValidos) * 100 : 0;
            const qualified = votes > 0 && pct >= thresholdPct;
            partyStats[p.id] = { votes, pct, qualified };
        });

        if (!totalVotosValidos || totalVotosValidos === 0) {
            return { seats, partyStats };
        }

        // Partidos que superan la barrera del 5%
        const qualifiedParties = PARTIES_CONFIG.filter(p => partyStats[p.id].qualified);
        if (qualifiedParties.length === 0) {
            return { seats, partyStats };
        }

        // Tabla de cocientes: Q = Votos / s (para s = 1..totalSeats)
        const quotients = [];
        qualifiedParties.forEach(p => {
            const votes = partyVotes[p.id] || 0;
            for (let s = 1; s <= totalSeats; s++) {
                quotients.push({
                    partyId: p.id,
                    quotient: votes / s,
                    divisor: s,
                    votes: votes
                });
            }
        });

        // Ordenar cocientes de mayor a menor (desempata el partido con más votos totales)
        quotients.sort((a, b) => {
            if (Math.abs(b.quotient - a.quotient) > 1e-9) {
                return b.quotient - a.quotient;
            }
            return b.votes - a.votes;
        });

        // Asignar los 25 escaños a los 25 mayores cocientes
        const allocated = Math.min(totalSeats, quotients.length);
        for (let i = 0; i < allocated; i++) {
            const q = quotients[i];
            seats[q.partyId] = (seats[q.partyId] || 0) + 1;
        }

        return { seats, partyStats };
    }

    function renderDHondtWidget(partyTotals, totalVotosValidos, closedMesas) {
        const container = document.getElementById("dhondt-results-container");
        if (!container) return;
        container.innerHTML = "";

        if (!closedMesas || closedMesas === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); font-size: 0.82rem; padding: 20px 15px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-chair" style="font-size: 1.4rem; margin-bottom: 6px; color: #cbd5e1;"></i>
                    <div style="font-weight: 600; color: #64748b;">Proyección de Concejales</div>
                    <span style="font-size: 0.75rem;">Se calculará el reparto (25 concejales) al comenzar el escrutinio de mesas.</span>
                </div>
            `;
            return;
        }

        const dhondt = calculateDHondtSeats(partyTotals, totalVotosValidos, 25, 5);
        const seatsMap = dhondt.seats;
        const statsMap = dhondt.partyStats;

        // Ordenar partidos por número de concejales obtenidos (y luego por votos)
        const sortedParties = [...PARTIES_CONFIG].sort((x, y) => {
            const seatsDiff = (seatsMap[y.id] || 0) - (seatsMap[x.id] || 0);
            if (seatsDiff !== 0) return seatsDiff;
            return (partyTotals[y.id] || 0) - (partyTotals[x.id] || 0);
        });

        if (!sortedParties || sortedParties.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); font-size: 0.82rem; padding: 20px 15px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-chair" style="font-size: 1.4rem; margin-bottom: 6px; color: #cbd5e1;"></i>
                    <div style="font-weight: 600; color: #64748b;">Proyección de Concejales</div>
                    <span style="font-size: 0.75rem;">Se calculará el reparto (25 concejales) al comenzar el escrutinio de mesas.</span>
                </div>
            `;
            return;
        }

        // 1. Barra de Hemiciclo / Pleno Municipal (25 bloques)
        let hemicicloHtml = `<div style="display:flex; height:24px; border-radius:6px; overflow:hidden; border:1px solid #cbd5e1; background:#e2e8f0; margin-bottom:10px; position:relative;" title="Hemiciclo Municipal: 25 concejales">`;
        sortedParties.forEach(p => {
            const count = seatsMap[p.id] || 0;
            if (count > 0) {
                const widthPct = (count / 25) * 100;
                hemicicloHtml += `
                    <div style="width:${widthPct}%; background-color:${p.color}; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:0.75rem;" title="${p.name}: ${count} concejales">
                        ${count >= 2 ? count : ''}
                    </div>
                `;
            }
        });
        hemicicloHtml += `</div>`;

        // Indicador de Mayoría Absoluta (13 concejales)
        let majorityStatusHtml = "";
        const maxSeatParty = sortedParties[0];
        const maxSeats = (maxSeatParty && seatsMap[maxSeatParty.id]) ? seatsMap[maxSeatParty.id] : 0;
        if (maxSeats >= 13 && maxSeatParty) {
            majorityStatusHtml = `
                <div style="background:#ecfdf5; border:1px solid #6ee7b7; color:#047857; padding:8px 12px; border-radius:6px; font-size:0.78rem; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-circle-check" style="font-size:1rem; color:#059669;"></i>
                    <span>Mayoría Absoluta alcanzada: <strong>${maxSeatParty.name}</strong> (${maxSeats} concejales)</span>
                </div>
            `;
        } else if (maxSeatParty && maxSeats > 0) {
            majorityStatusHtml = `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; color:#334155; padding:8px 12px; border-radius:6px; font-size:0.78rem; font-weight:600; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                    <span><i class="fa-solid fa-circle-info" style="color:var(--primary-color);"></i> Mayoría Absoluta: <strong>13 concejales</strong></span>
                    <span style="font-weight:400; color:#64748b; font-size:0.75rem;">Mayor representación: ${maxSeatParty.name} (${maxSeats})</span>
                </div>
            `;
        } else {
            majorityStatusHtml = `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; color:#334155; padding:8px 12px; border-radius:6px; font-size:0.78rem; font-weight:600; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                    <span><i class="fa-solid fa-circle-info" style="color:var(--primary-color);"></i> Mayoría Absoluta: <strong>13 concejales</strong></span>
                    <span style="font-weight:400; color:#64748b; font-size:0.75rem;">Reparto en curso</span>
                </div>
            `;
        }

        // 2. Lista de partidos con concejales y estado de barrera electoral 5%
        let listHtml = `<div style="display:flex; flex-direction:column; gap:8px;">`;
        sortedParties.forEach(p => {
            const count = seatsMap[p.id] || 0;
            const stat = statsMap[p.id] || { pct: 0, qualified: false };
            
            let badgeHtml = "";
            if (count > 0) {
                badgeHtml = `<span style="background:${p.color}; color:#ffffff; padding:4px 10px; border-radius:12px; font-weight:800; font-size:0.82rem; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><i class="fa-solid fa-chair"></i> ${count} ${count === 1 ? 'concejal' : 'concejales'}</span>`;
            } else if (!stat.qualified) {
                badgeHtml = `<span style="background:#f1f5f9; color:#94a3b8; padding:3px 8px; border-radius:12px; font-size:0.72rem; border:1px solid #e2e8f0;">Sin repr. (&lt;5%)</span>`;
            } else {
                badgeHtml = `<span style="background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:12px; font-size:0.72rem; border:1px solid #fde68a;">0 concejales</span>`;
            }

            listHtml += `
                <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; padding:8px 12px; border-radius:8px; border:1px solid #f1f5f9; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.logo}" alt="Logo ${p.name}" style="width:22px; height:22px; object-fit:contain;">
                        <div>
                            <div style="font-weight:700; font-size:0.85rem; color:#0f172a;">${p.name}</div>
                            <div style="font-size:0.72rem; color:#64748b;">${stat.pct.toFixed(2)}% de votos válidos</div>
                        </div>
                    </div>
                    <div>${badgeHtml}</div>
                </div>
            `;
        });
        listHtml += `</div>`;

        container.innerHTML = `
            ${hemicicloHtml}
            ${majorityStatusHtml}
            ${listHtml}
        `;
    }

    function renderPartiesRanking(partyTotals, totalVotosValidos, closedMesas) {
        const container = document.getElementById("global-parties-container");
        container.innerHTML = "";

        if (!closedMesas || closedMesas === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); font-size: 0.82rem; padding: 25px 15px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-hourglass-half" style="font-size: 1.5rem; margin-bottom: 8px; color: var(--primary-color);"></i>
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">Jornada de votación en curso</div>
                    <span style="font-size: 0.75rem; color: #64748b;">El recuento oficial de papeletas comenzará al cierre de los colegios a partir de las 20:00h.</span>
                </div>
            `;
            return;
        }

        // Ordenar por votos
        const sorted = [...PARTIES_CONFIG].sort((x, y) => partyTotals[y.id] - partyTotals[x.id]);
        const maxVotes = sorted.length > 0 ? partyTotals[sorted[0].id] : 0;

        sorted.forEach(p => {
            const votes = partyTotals[p.id];
            const percent = totalVotosValidos > 0 ? ((votes / totalVotosValidos) * 100).toFixed(2) : "0.00";
            const rowWidth = maxVotes > 0 ? (votes / maxVotes * 100) : 0;

            const row = document.createElement("div");
            row.className = "party-row";
            row.innerHTML = `
                <div class="party-row-top">
                    <img src="${p.logo}" alt="Logo ${p.name}" class="party-logo">
                    <span class="party-name">${p.name}</span>
                    <div class="party-votes">
                        ${votes.toLocaleString()} <span class="party-percent">(${percent}%)</span>
                    </div>
                </div>
                <div class="party-bar-container">
                    <div class="party-bar-fill" style="width: ${rowWidth}%; background-color: ${p.color};"></div>
                </div>
            `;
            container.appendChild(row);
        });
    }

    function renderColegiosTab() {
        const container = document.getElementById("colegios-list-container");
        container.innerHTML = "";

        // Obtener la lista única de colegios
        const colegios = [...new Set(state.mesas.map(m => m.colegio))];
        const searchVal = document.getElementById("colegio-search").value.toLowerCase().trim();

        colegios.forEach(colName => {
            const details = COLEGIO_DETAILS[colName];
            const address = details?.address || "";

            // Filtrar por buscador
            if (searchVal && !colName.toLowerCase().includes(searchVal) && !address.toLowerCase().includes(searchVal)) {
                return;
            }

            const colMesas = state.mesas.filter(m => m.colegio === colName);
            const totalMesas = colMesas.length;
            const closedMesas = colMesas.filter(m => m.estado === "Cerrada").length;

            // Votos acumulados en este colegio
            let colVotosValidos = 0;
            let colVotosNulos = 0;
            let colCenso = 0;
            const colPartyVotes = {};
            PARTIES_CONFIG.forEach(p => { colPartyVotes[p.id] = 0; });

            colMesas.forEach(m => {
                colCenso += (m.censo || 0);
                if (m.estado === "Cerrada") {
                    PARTIES_CONFIG.forEach(p => {
                        const v = m[p.field] || 0;
                        colPartyVotes[p.id] += v;
                        colVotosValidos += v;
                    });
                    colVotosValidos += (m.votos_blancos || 0);
                    colVotosNulos += (m.votos_nulos || 0);
                }
            });

            const colVotosEmitidos = colVotosValidos + colVotosNulos;

            // Ganador del colegio
            let winnerParty = null;
            let maxVotes = -1;
            PARTIES_CONFIG.forEach(p => {
                if (colPartyVotes[p.id] > maxVotes) {
                    maxVotes = colPartyVotes[p.id];
                    winnerParty = p;
                }
            });

            const scrutiny = totalMesas > 0 ? ((closedMesas / totalMesas) * 100).toFixed(0) : "0";
            
            // Participación del colegio: calculada sobre el censo de las mesas comunicadas
            let partRate = "0.0";
            if (closedMesas > 0) {
                let closedColCenso = 0;
                colMesas.forEach(m => { if (m.estado === "Cerrada") closedColCenso += (m.censo || 0); });
                partRate = closedColCenso > 0 ? ((colVotosEmitidos / closedColCenso) * 100).toFixed(1) : "0.0";
            } else {
                const p2Mesas = colMesas.filter(m => (m.part2_votos || 0) > 0 || m.estado === "Part2_Enviada" || m.estado === "Cerrada");
                const p1Mesas = colMesas.filter(m => (m.part1_votos || 0) > 0 || m.estado === "Part1_Enviada" || m.estado === "Part2_Enviada" || m.estado === "Cerrada");

                if (p2Mesas.length > 0) {
                    const p2Votos = p2Mesas.reduce((acc, m) => acc + (m.part2_votos || 0), 0);
                    const p2Censo = p2Mesas.reduce((acc, m) => acc + (m.censo || 0), 0);
                    partRate = p2Censo > 0 ? ((p2Votos / p2Censo) * 100).toFixed(1) : "0.0";
                } else if (p1Mesas.length > 0) {
                    const p1Votos = p1Mesas.reduce((acc, m) => acc + (m.part1_votos || 0), 0);
                    const p1Censo = p1Mesas.reduce((acc, m) => acc + (m.censo || 0), 0);
                    partRate = p1Censo > 0 ? ((p1Votos / p1Censo) * 100).toFixed(1) : "0.0";
                }
            }

            const item = document.createElement("div");
            item.className = "colegio-item";
            item.innerHTML = `
                <img src="${details?.image || 'Imagenes/Logo_OITR.png'}" alt="Foto ${colName}" class="colegio-item-img">
                <div class="colegio-item-info">
                    <div class="colegio-item-name">${colName}</div>
                    <div class="colegio-item-sub">
                        <span>Escrutinio: <strong>${scrutiny}%</strong></span>
                        <span>Participación: <strong>${partRate}%</strong></span>
                    </div>
                </div>
                ${closedMesas > 0 && winnerParty && maxVotes > 0 ? `
                    <div class="colegio-item-winner" style="background-color: ${winnerParty.color};" title="Gana ${winnerParty.name}">
                        ${winnerParty.name.substring(0, 2)}
                    </div>
                ` : `
                    <div class="colegio-item-winner" style="background-color: #cbd5e1; color:#64748b;" title="Sin datos de escrutinio">
                        --
                    </div>
                `}
            `;

            item.addEventListener("click", () => {
                viewColegioDetails(colName);
            });

            container.appendChild(item);
        });
    }

    function filterColegiosList(val) {
        renderColegiosTab();
    }

    // Modal de Colegio Electorial detallado
    function viewColegioDetails(colName) {
        const details = COLEGIO_DETAILS[colName];
        const colMesas = state.mesas.filter(m => m.colegio === colName);
        const totalMesas = colMesas.length;
        const closedMesas = colMesas.filter(m => m.estado === "Cerrada").length;

        document.getElementById("modal-colegio-name-title").textContent = colName;
        document.getElementById("modal-colegio-address-text").textContent = details?.address || "";
        
        // Imagen
        document.getElementById("modal-colegio-img-div").style.backgroundImage = `url('${details?.image || "Imagenes/Logo_OITR.png"}')`;

        // Botón cómo llegar
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(colName + ", " + (details?.address || ""))}`;
        document.getElementById("modal-colegio-route-btn").href = mapsUrl;

        // Secciones Censales del colegio obtenidas directamente de la configuración geográfica
        const secciones = Object.keys(SECTION_COLEGIO_MAPPING).filter(sec => SECTION_COLEGIO_MAPPING[sec] === colName);
        document.getElementById("modal-colegio-sections-list").textContent = secciones.join(", ");

        // Censo Total del colegio obtenido sumando el censo real de todas sus mesas en la base de datos
        const colCensoTotal = colMesas.reduce((acc, m) => acc + (m.censo || 0), 0);
        
        let colVotes = 0;
        let colVotesNulos = 0;
        const colPartyVotes = {};
        PARTIES_CONFIG.forEach(p => { colPartyVotes[p.id] = 0; });

        colMesas.forEach(m => {
            if (m.estado === "Cerrada") {
                PARTIES_CONFIG.forEach(p => {
                    const v = m[p.field] || 0;
                    colPartyVotes[p.id] += v;
                    colVotes += v;
                });
                colVotes += (m.votos_blancos || 0);
                colVotesNulos += (m.votos_nulos || 0);
            }
        });

        const colVotesEmitidos = colVotes + colVotesNulos;

        document.getElementById("modal-colegio-census-val").textContent = colCensoTotal.toLocaleString();
        
        let partRate = "0.00";
        if (closedMesas > 0) {
            let closedColCenso = 0;
            colMesas.forEach(m => { if (m.estado === "Cerrada") closedColCenso += (m.censo || 0); });
            partRate = closedColCenso > 0 ? ((colVotesEmitidos / closedColCenso) * 100).toFixed(2) : "0.00";
        } else {
            const p2Mesas = colMesas.filter(m => (m.part2_votos || 0) > 0 || m.estado === "Part2_Enviada" || m.estado === "Cerrada");
            const p1Mesas = colMesas.filter(m => (m.part1_votos || 0) > 0 || m.estado === "Part1_Enviada" || m.estado === "Part2_Enviada" || m.estado === "Cerrada");

            if (p2Mesas.length > 0) {
                const p2 = p2Mesas.reduce((acc, m) => acc + (m.part2_votos || 0), 0);
                const p2Censo = p2Mesas.reduce((acc, m) => acc + (m.censo || 0), 0);
                partRate = p2Censo > 0 ? ((p2 / p2Censo) * 100).toFixed(2) : "0.00";
            } else if (p1Mesas.length > 0) {
                const p1 = p1Mesas.reduce((acc, m) => acc + (m.part1_votos || 0), 0);
                const p1Censo = p1Mesas.reduce((acc, m) => acc + (m.censo || 0), 0);
                partRate = p1Censo > 0 ? ((p1 / p1Censo) * 100).toFixed(2) : "0.00";
            }
        }

        document.getElementById("modal-colegio-participation-val").textContent = `${partRate}%`;
        document.getElementById("modal-colegio-mesas-val").textContent = `${closedMesas} de ${totalMesas}`;

        // Listado de partidos en el colegio
        const partiesContainer = document.getElementById("modal-colegio-parties-container");
        partiesContainer.innerHTML = "";

        if (closedMesas === 0) {
            partiesContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 20px 0;">
                    <i class="fa-solid fa-clock" style="margin-right: 4px;"></i> Esperando cierre de mesas para iniciar el recuento en este centro.
                </div>
            `;
        } else {
            const sortedParties = [...PARTIES_CONFIG].sort((x, y) => colPartyVotes[y.id] - colPartyVotes[x.id]);
            const maxVotes = sortedParties.length > 0 ? colPartyVotes[sortedParties[0].id] : 0;

            sortedParties.forEach(p => {
                const votes = colPartyVotes[p.id];
                const pct = colVotes > 0 ? ((votes / colVotes) * 100).toFixed(2) : "0.00";
                const rowWidth = maxVotes > 0 ? (votes / maxVotes * 100) : 0;

                const row = document.createElement("div");
                row.className = "party-row";
                row.innerHTML = `
                    <div class="party-row-top">
                        <img src="${p.logo}" alt="Logo ${p.name}" class="party-logo">
                        <span class="party-name">${p.name}</span>
                        <div class="party-votes">
                            ${votes.toLocaleString()} <span class="party-percent">(${pct}%)</span>
                        </div>
                    </div>
                    <div class="party-bar-container">
                        <div class="party-bar-fill" style="width: ${rowWidth}%; background-color: ${p.color};"></div>
                    </div>
                `;
                partiesContainer.appendChild(row);
            });
        }

        // Mostrar modal
        document.getElementById("modal-colegio-detail").classList.remove("hidden");

        // Zoom al colegio en el mapa de ArcGIS
        zoomMapToColegio(colName, secciones);
    }

    function zoomMapToColegio(colName, secciones) {
        if (!state.view || geomsCache.length === 0) return;
        
        // Buscar las secciones que pertenecen a este colegio electoral
        const matchingFeatures = geomsCache.filter(f => {
            const sec = normalizeSeccion(f.attributes.SECCION || f.attributes.SECC);
            return secciones.includes(sec);
        });

        if (matchingFeatures.length > 0) {
            const geoms = matchingFeatures.map(f => f.geometry);
            state.view.goTo(geoms, { duration: 1000 }).catch(err => {});
        }
    }

    // ==========================================================================
    // RENDERIZADO TEMÁTICO CARTOGRÁFICO (DIBUJO DE POLÍGONOS E ICONOS)
    // ==========================================================================
    function renderMapTheme() {
        if (!state.view || geomsCache.length === 0 || !state.seccionesLayer) return;
        // Usar siempre GraphicsLayer para pintar polígonos de color (más fiable que UniqueValueRenderer en capas seguras)
        renderMapThemeViaGraphics();
    }

    function renderMapThemeViaGraphics() {
        if (!state.view || geomsCache.length === 0) return;

        const closedMesasCount = state.mesas.filter(m => m.estado === "Cerrada").length;

        // 1. Agrupar votos de mesas CERRADAS por SECCIÓN CENSAL
        const seccionVotes = {};
        state.mesas.forEach(m => {
            if (m.estado === "Cerrada") {
                const sec = normalizeSeccion(m.seccion);
                if (!seccionVotes[sec]) {
                    seccionVotes[sec] = {};
                    PARTIES_CONFIG.forEach(p => { seccionVotes[sec][p.id] = 0; });
                }
                PARTIES_CONFIG.forEach(p => {
                    seccionVotes[sec][p.id] += (m[p.field] || 0);
                });
            }
        });

        // Ganador por sección
        const seccionWinners = {};
        if (closedMesasCount > 0) {
            for (const sec in seccionVotes) {
                let maxVotes = -1;
                let winnerId = null;
                for (const pId in seccionVotes[sec]) {
                    const v = seccionVotes[sec][pId];
                    if (v > maxVotes) {
                        maxVotes = v;
                        winnerId = pId;
                    }
                }
                if (maxVotes > 0) {
                    seccionWinners[sec] = winnerId;
                }
            }
        }

        // Determinar nombre del campo de sección en atributos
        let rendererFieldName = "SECCION";
        if (geomsCache[0]) {
            const attrs = geomsCache[0].attributes;
            for (const f of ["SECCION", "seccion", "SECC", "secc", "Seccion", "Secc"]) {
                if (attrs[f] !== undefined) { rendererFieldName = f; break; }
            }
        }

        // 2. Ocultar FeatureLayer base
        if (state.seccionesLayer) {
            state.seccionesLayer.visible = false;
        }

        // 3. Limpiar capas de gráficos previas
        state.labelsLayer.removeAll();

        // 4. Obtener o crear la capa de polígonos de color
        let colorLayer = state.map.findLayerById("colorPolygonsLayer");
        if (!colorLayer) {
            colorLayer = new GraphicsLayer({ id: "colorPolygonsLayer" });
            state.map.add(colorLayer);
        }
        colorLayer.removeAll();

        const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

        // Plantilla de popup reutilizada por cada gráfico de sección
        const sectionPopupTemplate = {
            title: "Sección Censal {SECCION}",
            content: function(target) {
                const attrs = (target && target.graphic) ? target.graphic.attributes : ((target && target.attributes) ? target.attributes : target);
                return getPopupContent(attrs);
            }
        };

        geomsCache.forEach(feature => {
            const geom = feature.geometry;
            if (!geom) return;

            const rawVal = feature.attributes[rendererFieldName];
            const secCode = normalizeSeccion(rawVal);
            const winnerPartyId = seccionWinners[secCode];

            // --- Color de relleno según partido ganador ---
            let fillColor;
            if (winnerPartyId) {
                const party = PARTIES_CONFIG.find(p => p.id === winnerPartyId);
                if (party) {
                    const hex = party.color.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    fillColor = [r, g, b, 0.72];
                } else {
                    fillColor = [203, 213, 225, 0.45];
                }
            } else {
                fillColor = [203, 213, 225, 0.45];
            }

            const polyGraphic = new Graphic({
                geometry: geom,
                symbol: {
                    type: "simple-fill",
                    color: fillColor,
                    outline: { color: [255, 255, 255, 0.9], width: 1.5 }
                },
                attributes: Object.assign({}, feature.attributes, { SECCION: secCode }),
                popupTemplate: sectionPopupTemplate
            });
            colorLayer.add(polyGraphic);

            // --- Logo del partido ganador en el centroide (solo si hay escrutinio) ---
            if (!winnerPartyId) return;
            const winParty = PARTIES_CONFIG.find(p => p.id === winnerPartyId);
            if (!winParty) return;

            let centroid = geom.centroid;
            if (!centroid) centroid = getFallbackCentroid(geom);
            if (!centroid) return;

            let markerSymbol;
            if (winParty.logo) {
                const logoUrl = (winParty.logo.startsWith("data:") || winParty.logo.startsWith("http")) ? winParty.logo : (baseUrl + winParty.logo);
                markerSymbol = new PictureMarkerSymbol({
                    url: logoUrl,
                    width: "26px",
                    height: "26px"
                });
            } else {
                markerSymbol = new TextSymbol({
                    text: winParty.name.substring(0, 2),
                    color: "#ffffff",
                    haloColor: winParty.color,
                    haloSize: "2px",
                    font: { size: 10, family: "Outfit", weight: "bold" }
                });
            }

            state.labelsLayer.add(new Graphic({
                geometry: centroid,
                symbol: markerSymbol
            }));
        });

        // Garantizar que labelsLayer queda siempre en la cima
        state.map.reorder(state.labelsLayer, state.map.layers.length - 1);

        // Actualizar Leyenda del mapa
        renderMapLegendUI();
    }

    function renderMapLegendUI() {
        const container = document.getElementById("legend-items-container");
        container.innerHTML = "";
        
        const closedMesasCount = state.mesas.filter(m => m.estado === "Cerrada").length;
        if (closedMesasCount === 0) {
            container.innerHTML = `
                <div style="font-size:0.75rem; color:var(--text-muted); font-style:italic; padding:4px 0;">
                    <i class="fa-solid fa-info-circle"></i> Escrutinio a partir de las 20:00h
                </div>
            `;
            return;
        }

        // 1. Calcular votos totales municipales por partido (solo mesas cerradas)
        const partyVotes = {};
        PARTIES_CONFIG.forEach(p => { partyVotes[p.id] = 0; });
        
        let totalValidos = 0;
        state.mesas.forEach(m => {
            if (m.estado === "Cerrada") {
                totalValidos += (m.votos_blancos || 0);
                PARTIES_CONFIG.forEach(p => {
                    const v = m[p.field] || 0;
                    partyVotes[p.id] += v;
                    totalValidos += v;
                });
            }
        });
        
        // 2. Ordenar por votos descendente
        const sorted = [...PARTIES_CONFIG].sort((a, b) => (partyVotes[b.id] || 0) - (partyVotes[a.id] || 0));
        
        // 3. Tomar el Top 3
        const top3 = sorted.slice(0, 3);
        
        // 4. Renderizar el Top 3 con sus colores, votos y porcentaje
        top3.forEach((p, index) => {
            const votes = partyVotes[p.id] || 0;
            const pct = totalValidos > 0 ? ((votes / totalValidos) * 100).toFixed(1) : "0.0";
            
            const item = document.createElement("div");
            item.className = "legend-item";
            item.style.display = "flex";
            item.style.alignItems = "center";
            item.style.justifyContent = "space-between";
            item.style.width = "100%";
            item.style.gap = "8px";
            item.style.marginBottom = "4px";
            
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
                    <span style="font-weight:700; color:var(--text-muted); font-size:0.75rem; width:12px;">${index + 1}.</span>
                    <div class="legend-color" style="background-color: ${p.color}; flex-shrink: 0;"></div>
                    <span style="font-weight:600; font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.name}</span>
                </div>
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-align:right; flex-shrink:0;">
                    ${votes.toLocaleString()} <span style="font-weight:400; color:var(--text-muted); font-size:0.68rem;">(${pct}%)</span>
                </span>
            `;
            container.appendChild(item);
        });
    }

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

    function isMesaActiveWithData(mesa) {
        if (!mesa) return false;
        if (mesa.estado === "Cerrada" || mesa.estado === "Part1_Enviada" || mesa.estado === "Part2_Enviada") {
            return true;
        }
        if (mesa.votos_blancos > 0 || mesa.votos_nulos > 0) return true;
        return PARTIES_CONFIG.some(p => (mesa[p.field] || 0) > 0);
    }

    // Retorna el contenido del Popup de sección censal dinámicamente (estilo Ficha Premium)
    function getPopupContent(target) {
        if (!target) return "";
        let attrs = target;
        if (target.graphic && target.graphic.attributes) {
            attrs = target.graphic.attributes;
        } else if (target.attributes) {
            attrs = target.attributes;
        }
        if (!attrs) return "";

        const secAttr = getAttributeValue(attrs, "SECCION") || getAttributeValue(attrs, "seccion") || getAttributeValue(attrs, "SECC") || getAttributeValue(attrs, "secc") || attrs.SECCION || attrs.seccion || attrs.SECC || attrs.secc;
        const secCode = normalizeSeccion(secAttr);
        const colName = SECTION_COLEGIO_MAPPING[secCode] || "Colegio Electoral";
        const details = COLEGIO_DETAILS[colName];
        
        // Sumar mesas de esta sección
        const secMesas = state.mesas.filter(m => normalizeSeccion(m.seccion) === normalizeSeccion(secCode));
        const totalCensus = secMesas.reduce((acc, m) => acc + (m.censo || 0), 0);
        
        let votesTotal = 0;
        let nulos = 0;
        let blancos = 0;
        const pVotes = {};
        PARTIES_CONFIG.forEach(p => { pVotes[p.id] = 0; });

        secMesas.forEach(m => {
            if (isMesaActiveWithData(m)) {
                nulos += (m.votos_nulos || 0);
                blancos += (m.votos_blancos || 0);
                votesTotal += (m.votos_blancos || 0);
                PARTIES_CONFIG.forEach(p => {
                    const v = m[p.field] || 0;
                    pVotes[p.id] += v;
                    votesTotal += v;
                });
            }
        });

        const totalMesas = secMesas.length;
        const closedMesas = secMesas.filter(m => m.estado === "Cerrada").length;
        const scrutinyPercent = totalMesas > 0 ? ((closedMesas / totalMesas) * 100).toFixed(2) : "0.00";

        const totalVotesEmitidos = votesTotal + nulos;
        
        let partPercent = "0.00";
        if (closedMesas > 0) {
            let closedCensusSec = 0;
            secMesas.forEach(m => { if (m.estado === "Cerrada") closedCensusSec += (m.censo || 0); });
            partPercent = closedCensusSec > 0 ? ((totalVotesEmitidos / closedCensusSec) * 100).toFixed(2) : "0.00";
        } else {
            const p2Mesas = secMesas.filter(m => (m.part2_votos || 0) > 0 || m.estado === "Part2_Enviada" || m.estado === "Cerrada");
            const p1Mesas = secMesas.filter(m => (m.part1_votos || 0) > 0 || m.estado === "Part1_Enviada" || m.estado === "Part2_Enviada" || m.estado === "Cerrada");

            if (p2Mesas.length > 0) {
                const p2 = p2Mesas.reduce((acc, m) => acc + (m.part2_votos || 0), 0);
                const p2Censo = p2Mesas.reduce((acc, m) => acc + (m.censo || 0), 0);
                partPercent = p2Censo > 0 ? ((p2 / p2Censo) * 100).toFixed(2) : "0.00";
            } else if (p1Mesas.length > 0) {
                const p1 = p1Mesas.reduce((acc, m) => acc + (m.part1_votos || 0), 0);
                const p1Censo = p1Mesas.reduce((acc, m) => acc + (m.censo || 0), 0);
                partPercent = p1Censo > 0 ? ((p1 / p1Censo) * 100).toFixed(2) : "0.00";
            }
        }

        const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

        // HTML de la imagen del colegio usando URL ABSOLUTA para evitar restricciones de sandbox de ArcGIS
        let imageHtml = "";
        const imgUrl = details?.image ? (baseUrl + details.image) : (baseUrl + "Imagenes/Logo_OITR.png");
        imageHtml = `
            <div style="width:100%; height:140px; border-radius:8px; overflow:hidden; margin-bottom:12px; position:relative; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                <img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;" />
            </div>
        `;

        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(colName + ", " + (details?.address || ""))}`;

        let html = `
            <div style="font-family:'Outfit',sans-serif; color:#0f172a; font-size:13px; width:100%; box-sizing:border-box; line-height:1.6; padding: 4px;">
                ${imageHtml}
                <div style="font-size:16px; font-weight:700; color:#0f172a; margin-bottom:6px;">
                    ${colName} (Sección ${secCode})
                </div>
                
                <div style="font-size:11px; color:#475569; margin-bottom:12px; display:flex; align-items:flex-start; gap:8px; border-bottom:1px solid #e2e8f0; padding-bottom:8px; flex-wrap:wrap;">
                    <i class="fa-solid fa-location-dot" style="color:var(--primary-color); margin-top:3px;"></i>
                    <span style="flex:1; line-height:1.4;">${details?.address || "Rivas-Vaciamadrid, Madrid"}</span>
                    <a href="${mapsUrl}" target="_blank" style="color:var(--primary-color); text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-left:auto;">
                        <i class="fa-solid fa-route"></i> Llegar
                    </a>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:15px; font-size:12px;">
                    <tr style="border-bottom:2px solid rgba(0,0,0,0.08); font-weight:600; color:#475569;">
                        <td style="padding:4px 0;">Indicador</td>
                        <td style="text-align:right; padding:4px 0;">Valor</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 0; color:#475569;">Porcentaje Escrutado</td>
                        <td style="text-align:right; padding:6px 0; font-weight:700; color:#10b981;">${scrutinyPercent}% <span style="font-size:10px; font-weight:400; color:#64748b;">(${closedMesas}/${totalMesas} mesas)</span></td>
                    </tr>
                    <tr>
                        <td style="padding:6px 0; color:#475569;">Censo Sección</td>
                        <td style="text-align:right; padding:6px 0; font-weight:700; color:#0f172a;">${totalCensus.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 0; color:#475569;">Votos Totales</td>
                        <td style="text-align:right; padding:6px 0; font-weight:700; color:#0f172a;">${totalVotesEmitidos.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 0; color:#475569;">Participación</td>
                        <td style="text-align:right; padding:6px 0; font-weight:700; color:#f59e0b;">${partPercent}%</td>
                    </tr>
                </table>
                
                <div style="font-weight:700; margin-bottom:8px; font-size:11px; text-transform:uppercase; color:#475569; border-bottom:1px dashed #cbd5e1; padding-bottom:5px; letter-spacing:0.5px;">Desglose de Partidos</div>
        `;

        if (totalVotesEmitidos === 0) {
            html += `<div style="text-align:center; color:#94a3b8; font-style:italic; padding:12px 0; font-size:12px;">Esperando escrutinio de mesas...</div>`;
        } else {
            const sorted = [...PARTIES_CONFIG].sort((x, y) => pVotes[y.id] - pVotes[x.id]);
            sorted.forEach(p => {
                const v = pVotes[p.id];
                const pct = votesTotal > 0 ? ((v / votesTotal) * 100).toFixed(2) : "0.00";
                html += `
                    <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px; padding:3px 0; gap:6px;">
                        <span style="width:10px; height:10px; border-radius:50%; background-color:${p.color}; flex-shrink:0;"></span>
                        <span style="font-weight:600; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</span>
                        <span style="flex-shrink:0; font-weight:700; color:#0f172a; margin-left:8px;">${v.toLocaleString()}</span>
                        <span style="flex-shrink:0; font-weight:400; font-size:10px; color:#64748b; min-width:42px; text-align:right;">(${pct}%)</span>
                    </div>
                `;
            });

            // Blanco y nulo
            html += `
                <div style="border-top:1px solid #e2e8f0; padding-top:6px; margin-top:6px; display:flex; justify-content:space-between; color:#64748b; font-size:11px;">
                    <span>Votos en Blanco / Nulos</span>
                    <strong>${blancos} / ${nulos}</strong>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    }

    function normalizeSeccion(seccionVal) {
        if (seccionVal === undefined || seccionVal === null) return "";
        let s = String(seccionVal).trim();
        if (s.length >= 3) {
            s = s.slice(-3);
        }
        const parsed = parseInt(s, 10);
        if (isNaN(parsed)) return s;
        return String(parsed).padStart(3, '0');
    }

    // ==========================================================================
    // CAPTURA Y DIBUJO DE FIRMAS DIGITALES VECTORIALES EN CANVAS
    // ==========================================================================
    function setupSignatureCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let drawing = false;
        let points = [];
        let strokes = []; // Almacena todos los trazos realizados: [[{x,y}, {x,y}], ...]

        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#0f172a"; // Color trazo firma

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            // Soporte multi-touch para tablets/móviles
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }

        function startDrawing(e) {
            drawing = true;
            const pos = getPos(e);
            points = [pos];
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }

        function draw(e) {
            if (!drawing) return;
            e.preventDefault(); // Evitar scroll de pantalla en touch
            const pos = getPos(e);
            points.push(pos);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        }

        function stopDrawing() {
            if (!drawing) return;
            drawing = false;
            if (points.length > 0) {
                strokes.push(points);
            }
        }

        // Mouse listeners
        canvas.addEventListener("mousedown", startDrawing);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", stopDrawing);
        canvas.addEventListener("mouseleave", stopDrawing);

        // Touch listeners
        canvas.addEventListener("touchstart", startDrawing);
        canvas.addEventListener("touchmove", draw);
        canvas.addEventListener("touchend", stopDrawing);

        // Método borrar
        canvas.clear = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            strokes = [];
        };

        // Serializar a cadena de coordenadas ultracompacta: x,y x,y|x,y x,y...
        canvas.getCoordinateString = function() {
            if (strokes.length === 0) return "";
            return strokes.map(stroke => stroke.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ")).join("|");
        };

        // Redibujar desde la cadena de coordenadas serializada
        canvas.loadFromCoordinateString = function(str) {
            canvas.clear();
            if (!str) return;
            const strokeLines = str.split("|");
            strokeLines.forEach(line => {
                const pts = line.split(" ").map(pStr => {
                    const parts = pStr.split(",");
                    return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
                });
                if (pts.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) {
                        ctx.lineTo(pts[i].x, pts[i].y);
                    }
                    ctx.stroke();
                    strokes.push(pts);
                }
            });
        };
    }

    // ==========================================================================
    // VISUALIZACIÓN DE ACTAS E IMPRESIÓN (ADMINISTRACIÓN)
    // ==========================================================================
    function viewMesaActa(codigo) {
        const mesa = state.mesas.find(m => m.codigo === codigo);
        if (!mesa) return;

        let miembros = { presi: "Sin asignar", vocal1: "Sin asignar", vocal2: "Sin asignar" };
        try {
            if (mesa.miembros) {
                miembros = typeof mesa.miembros === 'string' ? JSON.parse(mesa.miembros) : mesa.miembros;
            }
        } catch (e) {
            console.warn("Error al parsear miembros de mesa:", e);
        }

        const censoVal = parseInt(mesa.censo || 0, 10);
        const nulosVal = parseInt(mesa.votos_nulos || 0, 10);
        const blancosVal = parseInt(mesa.votos_blancos || 0, 10);

        // Sumatorios
        let totalValidos = blancosVal;
        PARTIES_CONFIG.forEach(p => { totalValidos += parseInt(mesa[p.field] || 0, 10); });
        const totalEmitidos = totalValidos + nulosVal;

        // Generar HTML del Acta para el visor
        const bodyContainer = document.getElementById("modal-acta-body-content");
        
        let tableRowsHtml = "";
        const sortedParties = [...PARTIES_CONFIG].sort((a, b) => {
            const votesA = parseInt(mesa[a.field] || 0, 10);
            const votesB = parseInt(mesa[b.field] || 0, 10);
            return votesB - votesA;
        });

        sortedParties.forEach(p => {
            const v = parseInt(mesa[p.field] || 0, 10);
            const pct = totalValidos > 0 ? ((v / totalValidos) * 100).toFixed(2) : "0.00";
            tableRowsHtml += `
                <tr>
                    <td style="display:flex; align-items:center; gap:8px;">
                        <img src="${p.logo}" style="width:20px; height:20px; object-fit:contain;">
                        <strong>${p.name}</strong>
                    </td>
                    <td style="text-align:right; font-weight:700;">${v.toLocaleString()}</td>
                    <td style="text-align:right; color:var(--text-muted);">${pct}%</td>
                </tr>
            `;
        });

        // SVGs para las firmas dibujadas en los canvas
        const svgPresi = getSvgFromCoordinateString(mesa.firma_presi);
        const svgVocal1 = getSvgFromCoordinateString(mesa.firma_vocal1);
        const svgVocal2 = getSvgFromCoordinateString(mesa.firma_vocal2);

        let auditRowsHtml = "";
        if (mesa.auditoria && Array.isArray(mesa.auditoria) && mesa.auditoria.length > 0) {
            let auditItemsHtml = "";
            mesa.auditoria.forEach(item => {
                auditItemsHtml += `
                    <div style="font-size:0.75rem; background:#fff; border:1px solid #e2e8f0; padding:8px 10px; border-radius:4px; margin-bottom:6px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:700; color:#334155;">
                            <span><i class="fa-solid fa-user-shield" style="color:var(--primary-color);"></i> ${item.usuario || 'Administrador'}</span>
                            <span style="color:var(--text-muted);">${item.fecha || ''}</span>
                        </div>
                        <div style="color:#0f172a; margin-bottom:2px;"><strong>Acción:</strong> ${item.accion || 'Modificación'}</div>
                        <div style="color:#475569; font-style:italic;"><strong>Motivo:</strong> "${item.motivo || ''}"</div>
                    </div>
                `;
            });
            auditRowsHtml = `
                <div style="font-weight:700; margin-top:15px; margin-bottom:6px; font-size:0.85rem; border-bottom:1px solid #cbd5e1; padding-bottom:3px; color:#991b1b;">
                    <i class="fa-solid fa-clipboard-check"></i> Histórico de Auditoría y Justificaciones
                </div>
                <div style="background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:6px; margin-bottom:15px;">
                    ${auditItemsHtml}
                </div>
            `;
        }

        bodyContainer.innerHTML = `
            <div style="font-family: var(--font-body); color:#000;">
                <div style="text-align:center; margin-bottom:15px; border-bottom:2px solid #000; padding-bottom:10px;">
                    <h4 style="text-transform:uppercase; font-size:0.75rem; letter-spacing:1px; color:var(--primary-color); margin-bottom:2px;">Escrutinio Oficial</h4>
                    <h3 style="font-size:1.35rem; font-family:var(--font-heading);">ACTA DE ESCRUTINIO DE MESA</h3>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.8rem; margin-bottom:15px; background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:6px;">
                    <div><strong>Colegio:</strong> ${mesa.colegio || ''}</div>
                    <div><strong>Código de Mesa:</strong> ${mesa.codigo || ''}</div>
                    <div><strong>Sección Censal:</strong> ${mesa.seccion || ''}</div>
                    <div><strong>Censo Electoral:</strong> ${censoVal.toLocaleString()} electores</div>
                </div>

                <div style="font-weight:700; margin-bottom:6px; font-size:0.85rem; border-bottom:1px solid #cbd5e1; padding-bottom:3px;">Miembros de la Mesa</div>
                <div style="font-size:0.8rem; margin-bottom:15px; display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
                    <div><strong>Presidente:</strong><br>${miembros.presi || 'Sin asignar'}</div>
                    <div><strong>Vocal 1:</strong><br>${miembros.vocal1 || 'Sin asignar'}</div>
                    <div><strong>Vocal 2:</strong><br>${miembros.vocal2 || 'Sin asignar'}</div>
                </div>

                <div style="font-weight:700; margin-bottom:6px; font-size:0.85rem; border-bottom:1px solid #cbd5e1; padding-bottom:3px;">Votos Contabilizados</div>
                <table class="admin-table" style="font-size:0.8rem; margin-bottom:15px;">
                    <thead>
                        <tr>
                            <th>Fuerza Política</th>
                            <th style="text-align:right;">Votos</th>
                            <th style="text-align:right;">% / Válidos</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                        <tr style="border-top:1px solid #000; font-weight:700;">
                            <td>Votos en Blanco</td>
                            <td style="text-align:right;">${blancosVal.toLocaleString()}</td>
                            <td style="text-align:right;">${totalValidos > 0 ? ((blancosVal / totalValidos) * 100).toFixed(2) : '0.00'}%</td>
                        </tr>
                        <tr style="border-top:1px solid #cbd5e1;">
                            <td style="color:var(--text-muted);">Votos Nulos</td>
                            <td style="text-align:right;">${nulosVal.toLocaleString()}</td>
                            <td style="text-align:right; color:var(--text-muted);">-</td>
                        </tr>
                        <tr style="border-top:2px solid #000; font-weight:800; font-size:0.85rem; background:#f8fafc;">
                            <td>TOTAL EMITIDOS</td>
                            <td style="text-align:right; color:var(--primary-color);">${totalEmitidos.toLocaleString()}</td>
                            <td style="text-align:right;">Participación: ${censoVal > 0 ? ((totalEmitidos / censoVal) * 100).toFixed(2) : '0.00'}%</td>
                        </tr>
                    </tbody>
                </table>

                ${auditRowsHtml}
            </div>
        `;

        // Generar también la estructura para el contenedor de impresión #printableActa
        generatePrintableActaLayout(mesa, miembros, tableRowsHtml, svgPresi, svgVocal1, svgVocal2, totalValidos, totalEmitidos);

        document.getElementById("modal-view-acta").classList.remove("hidden");
    }

    // Convierte el string de coordenadas ultracompacto en una ruta SVG vectorial
    function getSvgFromCoordinateString(str) {
        if (!str) return `<span style="font-style:italic; font-size:0.75rem; color:#cbd5e1;">Sin firma</span>`;
        
        let pathD = "";
        const strokeLines = str.split("|");
        strokeLines.forEach(line => {
            const pts = line.split(" ").map(pStr => {
                const parts = pStr.split(",");
                return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
            });
            if (pts.length > 0) {
                pathD += ` M ${pts[0].x} ${pts[0].y}`;
                for (let i = 1; i < pts.length; i++) {
                    pathD += ` L ${pts[i].x} ${pts[i].y}`;
                }
            }
        });

        // Retornamos el elemento SVG
        return `<svg viewBox="0 0 220 120" style="width:100%; height:100%; max-height:60px; pointer-events:none;"><path d="${pathD}" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
    }

    // Estructura HTML de impresión oficial
    function generatePrintableActaLayout(mesa, miembros, rowsHtml, svgPresi, svgVocal1, svgVocal2, totalValidos, totalEmitidos) {
        const printContainer = document.getElementById("printableActa");
        if (!printContainer) return;
        
        const censoVal = parseInt(mesa.censo || 0, 10);
        const nulosVal = parseInt(mesa.votos_nulos || 0, 10);
        const blancosVal = parseInt(mesa.votos_blancos || 0, 10);
        const validosVal = parseInt(totalValidos || 0, 10);
        const emitidosVal = parseInt(totalEmitidos || 0, 10);
        
        printContainer.innerHTML = `
            <div class="acta-header">
                <img src="Imagenes/Logo_OITR.png" class="acta-logo-oitr" alt="Ayuntamiento Rivas">
                <div class="acta-header-title">
                    <h1>AYUNTAMIENTO DE RIVAS-VACIAMADRID</h1>
                    <p>OFICINA DE INFORMACIÓN TERRITORIAL (OITR) - ELECCIONES MUNICIPALES 2027</p>
                </div>
            </div>

            <div style="font-size:14px; font-weight:800; border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:15px; text-transform:uppercase;">
                Acta de Escrutinio y Transmisión de Resultados Electorales - Elecciones Municipales 2027
            </div>

            <div class="acta-metadata-grid">
                <div class="acta-metadata-item">
                    <strong>Colegio Electoral</strong>
                    <span>${mesa.colegio || ''}</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Código de Mesa</strong>
                    <span>${mesa.codigo || ''}</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Sección Censal</strong>
                    <span>Sección ${mesa.seccion || ''}</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Censo Electoral de la Mesa</strong>
                    <span>${censoVal.toLocaleString()} electores</span>
                </div>
            </div>

            <div class="acta-title-section">Miembros que suscriben el Acta</div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; font-size:11px; margin-bottom:20px;">
                <div><strong>Presidente/a:</strong><br>${miembros.presi || 'Sin asignar'}</div>
                <div><strong>Primer Vocal:</strong><br>${miembros.vocal1 || 'Sin asignar'}</div>
                <div><strong>Segundo Vocal:</strong><br>${miembros.vocal2 || 'Sin asignar'}</div>
            </div>

            <div class="acta-title-section">Resultados Contabilizados</div>
            <table class="acta-table">
                <thead>
                    <tr>
                        <th>Fuerza Política</th>
                        <th style="text-align:right; width:120px;">Votos Obtenidos</th>
                        <th style="text-align:right; width:120px;">% / Válidos</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    <tr style="border-top:2px solid #000; font-weight:bold;">
                        <td>Votos en Blanco</td>
                        <td class="align-right">${blancosVal.toLocaleString()}</td>
                        <td style="text-align:right;">${validosVal > 0 ? ((blancosVal / validosVal) * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                    <tr style="color:#333;">
                        <td>Votos Nulos</td>
                        <td class="align-right">${nulosVal.toLocaleString()}</td>
                        <td style="text-align:right;">-</td>
                    </tr>
                    <tr style="border-top:3px double #000; font-weight:800; font-size:13px; background-color:#eee !important;">
                        <td>TOTAL EMITIDOS (Votos en Urna)</td>
                        <td class="align-right">${emitidosVal.toLocaleString()}</td>
                        <td style="text-align:right;">Participación: ${censoVal > 0 ? ((emitidosVal / censoVal) * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                </tbody>
            </table>

            <div class="acta-footer" style="margin-top: 30px;">
                Documento oficial generado e informatizado de forma segura.<br>
                Elecciones Municipales Rivas Vaciamadrid 2027 - Fecha de escrutinio oficial: ${new Date().toLocaleDateString('es-ES')} - Rivas-Vaciamadrid, Madrid.
            </div>
        `;
    }

    // Acta agregada del colegio completo al cerrarlo el Administrador
    window.printSchoolAct = function(colegioName) {
        const colMesas = state.mesas.filter(m => m.colegio === colegioName);
        const censoTotal = colMesas.reduce((acc, m) => acc + m.censo, 0);

        let totalValidos = 0;
        let totalNulos = 0;
        let totalBlancos = 0;
        const partyTotals = {};
        PARTIES_CONFIG.forEach(p => { partyTotals[p.id] = 0; });

        colMesas.forEach(m => {
            totalNulos += m.votos_nulos;
            totalBlancos += m.votos_blancos;
            totalValidos += m.votos_blancos;
            PARTIES_CONFIG.forEach(p => {
                const v = m[p.field] || 0;
                partyTotals[p.id] += v;
                totalValidos += v;
            });
        });

        const totalEmitidos = totalValidos + totalNulos;

        let tableRowsHtml = "";
        const sortedParties = [...PARTIES_CONFIG].sort((a, b) => {
            const votesA = partyTotals[a.id] || 0;
            const votesB = partyTotals[b.id] || 0;
            return votesB - votesA;
        });

        sortedParties.forEach(p => {
            const v = partyTotals[p.id] || 0;
            const pct = totalValidos > 0 ? ((v / totalValidos) * 100).toFixed(2) : "0.00";
            tableRowsHtml += `
                <tr>
                    <td style="display:flex; align-items:center; gap:8px;">
                        <img src="${p.logo}" style="width:20px; height:20px; object-fit:contain;">
                        <strong>${p.name}</strong>
                    </td>
                    <td class="align-right">${v.toLocaleString()}</td>
                    <td style="text-align:right;">${pct}%</td>
                </tr>
            `;
        });

        // Crear una lista de actas de mesas incorporadas
        let mesasIncorporadasHtml = colMesas.map(m => `Mesa ${m.codigo} (Censo: ${m.censo})`).join(", ");

        const printContainer = document.getElementById("printableActa");
        printContainer.innerHTML = `
            <div class="acta-header">
                <img src="Imagenes/Logo_OITR.png" class="acta-logo-oitr" alt="Ayuntamiento Rivas">
                <div class="acta-header-title">
                    <h1>AYUNTAMIENTO DE RIVAS-VACIAMADRID</h1>
                    <p>OFICINA DE INFORMACIÓN TERRITORIAL (OITR) - ELECCIONES MUNICIPALES 2027</p>
                </div>
            </div>

            <div style="font-size:14px; font-weight:800; border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:15px; text-transform:uppercase;">
                Acta de Cierre Agregado de Centro de Votación - Elecciones Municipales 2027
            </div>

            <div class="acta-metadata-grid" style="grid-template-columns: 3fr 1fr;">
                <div class="acta-metadata-item">
                    <strong>Colegio Electoral Cerrado</strong>
                    <span>${colegioName}</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Censo Total del Centro</strong>
                    <span>${censoTotal.toLocaleString()} electores</span>
                </div>
                <div class="acta-metadata-item" style="grid-column: span 2;">
                    <strong>Mesas Escrutadas e Incorporadas</strong>
                    <span style="font-size:11px; font-weight:normal;">${mesasIncorporadasHtml}</span>
                </div>
            </div>

            <div class="acta-title-section">Resultados Consolidados del Colegio</div>
            <table class="acta-table">
                <thead>
                    <tr>
                        <th>Fuerza Política</th>
                        <th style="text-align:right; width:120px;">Votos Obtenidos</th>
                        <th style="text-align:right; width:120px;">% / Válidos</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                    <tr style="border-top:2px solid #000; font-weight:bold;">
                        <td>Votos en Blanco</td>
                        <td class="align-right">${totalBlancos.toLocaleString()}</td>
                        <td style="text-align:right;">${totalValidos > 0 ? ((totalBlancos / totalValidos) * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                    <tr style="color:#333;">
                        <td>Votos Nulos</td>
                        <td class="align-right">${totalNulos.toLocaleString()}</td>
                        <td style="text-align:right;">-</td>
                    </tr>
                    <tr style="border-top:3px double #000; font-weight:800; font-size:13px; background-color:#eee !important;">
                        <td>TOTAL EMITIDOS CONSOLIDADOS</td>
                        <td class="align-right">${totalEmitidos.toLocaleString()}</td>
                        <td style="text-align:right;">Participación Centro: ${censoTotal > 0 ? ((totalEmitidos / censoTotal) * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                </tbody>
            </table>

            <div class="acta-footer" style="margin-top: 30px;">
                Documento oficial generado e informatizado de forma segura.<br>
                Elecciones Municipales Rivas Vaciamadrid 2027 - Fecha: ${new Date().toLocaleDateString('es-ES')} - Rivas-Vaciamadrid, Madrid.
            </div>
        `;

        window.print();
    };

    // ==========================================================================
    // ESCRIBIR Y LEER DATOS DESDE EL FEATURE SERVICE DE ARCGIS (GDB DE PRUEBAS)
    // ==========================================================================

    // Retorna el valor de un atributo de forma totalmente insensible a mayúsculas/minúsculas
    function getAttributeValue(attributes, fieldName) {
        if (!attributes) return undefined;
        if (attributes[fieldName] !== undefined) return attributes[fieldName];
        
        const upperName = fieldName.toUpperCase();
        if (attributes[upperName] !== undefined) return attributes[upperName];
        
        const lowerName = fieldName.toLowerCase();
        if (attributes[lowerName] !== undefined) return attributes[lowerName];
        
        // Búsqueda case-insensitive completa entre todas las claves
        const keys = Object.keys(attributes);
        for (const key of keys) {
            if (key.toLowerCase() === lowerName) {
                return attributes[key];
            }
        }
        return undefined;
    }

    // Extrae y normaliza el código de sección a partir de los atributos o el código de mesa
    function getSeccionFromAttributes(attributes, cod) {
        let sec = getAttributeValue(attributes, "seccion") || getAttributeValue(attributes, "SECCION") || getAttributeValue(attributes, "SECC") || getAttributeValue(attributes, "secc");
        if (sec) {
            return normalizeSeccion(sec);
        }
        if (cod && cod.length >= 3) {
            const match = cod.match(/^\d{3}/);
            if (match) return match[0];
            return cod.substring(0, 3);
        }
        return "";
    }

    function rebuildDynamicMappings() {
        state.mesas.forEach(m => {
            if (m.seccion && m.colegio) {
                const sec = normalizeSeccion(m.seccion);
                SECTION_COLEGIO_MAPPING[sec] = m.colegio;
            }
        });
    }

    function updateMesaSeccionDropdown(colName, seccionSelect, currentValue) {
        if (!seccionSelect) return;
        seccionSelect.innerHTML = "";
        
        // Obtener las secciones asociadas a ese colegio desde SECTION_COLEGIO_MAPPING
        const secciones = Object.keys(SECTION_COLEGIO_MAPPING).filter(sec => SECTION_COLEGIO_MAPPING[sec] === colName);
        
        secciones.forEach(sec => {
            const opt = document.createElement("option");
            opt.value = sec;
            opt.textContent = `Sección ${sec}`;
            if (sec === currentValue) {
                opt.selected = true;
            }
            seccionSelect.appendChild(opt);
        });
    }

    function updateAddMesaPreview() {
        const secSelect = document.getElementById("add-mesa-seccion");
        const letSelect = document.getElementById("add-mesa-letra");
        const previewSpan = document.getElementById("add-mesa-code-preview");
        if (secSelect && letSelect && previewSpan) {
            const sec = secSelect.value || "000";
            const letMesa = letSelect.value || "A";
            previewSpan.textContent = sec + letMesa;
        }
    }


    function exportToCSV() {
        console.log("Generando exportación CSV...");
        
        let csvContent = "\ufeff"; // BOM para asegurar codificación UTF-8 en Excel con acentos en español
        
        // Cabeceras
        const headers = [
            "Colegio Electoral",
            "Sección Censal",
            "Mesa",
            "Estado",
            "Censo Electoral",
            "Votos Emitidos",
            "Votos Válidos",
            "Votos en Blanco",
            "Votos Nulos",
            "Participación (%)"
        ];
        
        // Añadir cabeceras para cada partido
        PARTIES_CONFIG.forEach(p => {
            headers.push(`Votos ${p.name}`);
        });
        
        csvContent += headers.map(h => `"${h}"`).join(";") + "\n";
        
        // Filas de mesas
        state.mesas.forEach(m => {
            let totalValidos = m.votos_blancos;
            PARTIES_CONFIG.forEach(p => { totalValidos += (m[p.field] || 0); });
            const totalEmitidos = totalValidos + m.votos_nulos;
            const pctPart = m.censo > 0 ? ((totalEmitidos / m.censo) * 100).toFixed(2) : "0.00";
            
            const row = [
                m.colegio,
                m.seccion,
                m.mesa,
                m.estado,
                m.censo,
                totalEmitidos,
                totalValidos,
                m.votos_blancos,
                m.votos_nulos,
                pctPart
            ];
            
            PARTIES_CONFIG.forEach(p => {
                row.push(m[p.field] || 0);
            });
            
            csvContent += row.map(v => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v).join(";") + "\n";
        });
        
        // Crear enlace de descarga y dispararlo
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `elecciones_rivas_recuento_global_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportToPDF() {
        console.log("Generando informe consolidado en PDF...");
        
        // Calcular sumas globales
        let censoTotal = 0;
        let totalNulos = 0;
        let totalBlancos = 0;
        let totalValidos = 0;
        const partyTotals = {};
        
        PARTIES_CONFIG.forEach(p => { partyTotals[p.id] = 0; });
        
        // Sumar todos los colegios y mesas
        state.mesas.forEach(m => {
            censoTotal += m.censo;
            totalNulos += m.votos_nulos;
            totalBlancos += m.votos_blancos;
            totalValidos += m.votos_blancos;
            PARTIES_CONFIG.forEach(p => {
                const v = m[p.field] || 0;
                partyTotals[p.id] += v;
                totalValidos += v;
            });
        });
        
        const totalEmitidos = totalValidos + totalNulos;
        const pctParticipacion = censoTotal > 0 ? ((totalEmitidos / censoTotal) * 100).toFixed(2) : "0.00";
        
        // Escrutinio % (mesas cerradas / total)
        const totalMesas = state.mesas.length;
        const closedMesas = state.mesas.filter(m => m.estado === "Cerrada").length;
        const pctScrutiny = totalMesas > 0 ? ((closedMesas / totalMesas) * 100).toFixed(2) : "0.00";
        
        // 1. Filas de partidos ordenadas por votos desc
        let partyRowsHtml = "";
        const sortedParties = [...PARTIES_CONFIG].sort((a, b) => {
            const votesA = partyTotals[a.id] || 0;
            const votesB = partyTotals[b.id] || 0;
            return votesB - votesA;
        });

        sortedParties.forEach(p => {
            const v = partyTotals[p.id] || 0;
            const pct = totalValidos > 0 ? ((v / totalValidos) * 100).toFixed(2) : "0.00";
            partyRowsHtml += `
                <tr>
                    <td style="display:flex; align-items:center; gap:8px;">
                        <img src="${p.logo}" style="width:20px; height:20px; object-fit:contain;">
                        <strong>${p.name}</strong>
                    </td>
                    <td style="text-align:right; font-weight:700;">${v.toLocaleString()}</td>
                    <td style="text-align:right;">${pct}%</td>
                </tr>
            `;
        });
        
        // 2. Desglose por Colegio
        let colegioRowsHtml = "";
        const colegios = [...new Set(state.mesas.map(m => m.colegio))].sort();
        colegios.forEach(colName => {
            const colMesas = state.mesas.filter(m => m.colegio === colName);
            const colTotal = colMesas.length;
            const colClosed = colMesas.filter(m => m.estado === "Cerrada").length;
            const colCenso = colMesas.reduce((acc, m) => acc + m.censo, 0);
            
            let colEmitidos = 0;
            let colValidos = 0;
            const colPartyVotes = {};
            PARTIES_CONFIG.forEach(p => { colPartyVotes[p.id] = 0; });
            
            colMesas.forEach(m => {
                let mValidos = m.votos_blancos;
                PARTIES_CONFIG.forEach(p => {
                    const v = m[p.field] || 0;
                    mValidos += v;
                    colPartyVotes[p.id] += v;
                });
                colValidos += mValidos;
                colEmitidos += mValidos + m.votos_nulos;
            });
            
            const colPartPct = colCenso > 0 ? ((colEmitidos / colCenso) * 100).toFixed(2) : "0.00";
            const colEscPct = colTotal > 0 ? ((colClosed / colTotal) * 100).toFixed(2) : "0.00";
            
            // Ganador del colegio
            let colWinnerName = "-";
            let colWinnerVotes = -1;
            PARTIES_CONFIG.forEach(p => {
                const v = colPartyVotes[p.id] || 0;
                if (v > colWinnerVotes) {
                    colWinnerVotes = v;
                    colWinnerName = p.name;
                }
            });
            if (colWinnerVotes === 0) colWinnerName = "Empate / Sin datos";
            
            colegioRowsHtml += `
                <tr>
                    <td><strong>${colName}</strong></td>
                    <td style="text-align:center;">${colClosed} de ${colTotal} (${colEscPct}%)</td>
                    <td style="text-align:right;">${colCenso.toLocaleString()}</td>
                    <td style="text-align:right; font-weight:700;">${colPartPct}%</td>
                    <td style="text-align:right; color:var(--primary-color); font-weight:700;">${colWinnerName}</td>
                </tr>
            `;
        });
        
        // Inyectar en printableActa
        const printContainer = document.getElementById("printableActa");
        printContainer.innerHTML = `
            <div class="acta-header">
                <img src="Imagenes/Logo_OITR.png" class="acta-logo-oitr" alt="Ayuntamiento Rivas">
                <div class="acta-header-title">
                    <h1>AYUNTAMIENTO DE RIVAS-VACIAMADRID</h1>
                    <p>OFICINA DE INFORMACIÓN TERRITORIAL (OITR) - ELECCIONES MUNICIPALES 2027</p>
                </div>
            </div>

            <div style="font-size:14px; font-weight:800; border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:15px; text-transform:uppercase; display:flex; justify-content:space-between; align-items:center;">
                <span>Informe Consolidado de Escrutinio Municipal</span>
                <span style="font-size:10px; font-weight:400; color:#555;">Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}</span>
            </div>

            <div class="acta-title-section">Métricas Globales del Municipio</div>
            <div class="acta-metadata-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 20px;">
                <div class="acta-metadata-item">
                    <strong>Progreso Escrutinio</strong>
                    <span>${pctScrutiny}% (${closedMesas} de ${totalMesas} mesas)</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Participación</strong>
                    <span>${pctParticipacion}%</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Censo Electoral</strong>
                    <span>${censoTotal.toLocaleString()} electores</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Votos Emitidos</strong>
                    <span>${totalEmitidos.toLocaleString()} votos</span>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:25px;">
                <div>
                    <div class="acta-title-section">Ranking de Fuerzas Políticas</div>
                    <table class="acta-table" style="font-size:11px;">
                        <thead>
                            <tr>
                                <th>Fuerza Política</th>
                                <th style="text-align:right;">Votos</th>
                                <th style="text-align:right;">% / Válidos</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${partyRowsHtml}
                        </tbody>
                    </table>
                </div>
                <div>
                    <div class="acta-title-section">Distribución de Votos Adicionales</div>
                    <table class="acta-table" style="font-size:11px;">
                        <thead>
                            <tr>
                                <th>Tipo de Voto</th>
                                <th style="text-align:right;">Votos</th>
                                <th style="text-align:right;">% / Emitidos</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Votos en Blanco</td>
                                <td style="text-align:right; font-weight:700;">${totalBlancos.toLocaleString()}</td>
                                <td style="text-align:right;">${totalEmitidos > 0 ? ((totalBlancos / totalEmitidos) * 100).toFixed(2) : '0.00'}%</td>
                            </tr>
                            <tr>
                                <td>Votos Nulos</td>
                                <td style="text-align:right; font-weight:700;">${totalNulos.toLocaleString()}</td>
                                <td style="text-align:right;">${totalEmitidos > 0 ? ((totalNulos / totalEmitidos) * 100).toFixed(2) : '0.00'}%</td>
                            </tr>
                            <tr style="border-top:1.5px solid #000; font-weight:bold; background-color:#eee !important;">
                                <td>Total Votos Válidos</td>
                                <td style="text-align:right; color:var(--primary-color);">${totalValidos.toLocaleString()}</td>
                                <td style="text-align:right;">${totalEmitidos > 0 ? ((totalValidos / totalEmitidos) * 100).toFixed(2) : '0.00'}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="acta-title-section" style="page-break-before: auto;">Detalle por Centros de Votación</div>
            <table class="acta-table" style="font-size:10px; margin-bottom:20px;">
                <thead>
                    <tr>
                        <th>Centro de Votación (Colegio)</th>
                        <th style="text-align:center; width:140px;">Mesas Escrutadas</th>
                        <th style="text-align:right; width:90px;">Censo</th>
                        <th style="text-align:right; width:90px;">Participación</th>
                        <th style="text-align:right; width:120px;">Ganador</th>
                    </tr>
                </thead>
                <tbody>
                    ${colegioRowsHtml}
                </tbody>
            </table>

            <div class="acta-footer" style="margin-top:30px; border-top:1px solid #ccc; padding-top:10px; font-size:9px; text-align:center;">
                Informe Informativo Consolidado - Ayuntamiento de Rivas-Vaciamadrid<br>
                Plataforma de Escrutinio y Visualización de Resultados Electorales en Tiempo Real.
            </div>
        `;
        
        window.print();
    }

    // ==========================================================================
    // PERSISTENCIA Y GESTIÓN DE CREDENCIALES ARCGIS (TOKEN Y IDENTITYMANAGER)
    // ==========================================================================
    async function generateAndRegisterArcGISToken(username, password) {
        const tokenUrl = "https://sit.rivasciudad.es/portal/sharing/rest/generateToken";
        const params = new URLSearchParams();
        params.append("username", username);
        params.append("password", password);
        params.append("client", "referer");
        params.append("referer", window.location.href);
        params.append("expiration", "1440"); // 24 horas
        params.append("f", "json");

        const resp = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        });

        const data = await resp.json();
        if (data.error) {
            throw new Error(data.error.message || (data.error.details && data.error.details[0]) || "Error al autenticar con ArcGIS Enterprise");
        }

        if (!data.token) {
            throw new Error("No se recibió token de seguridad de ArcGIS Enterprise.");
        }

        if (typeof IdentityManager !== "undefined") {
            // Registrar los servidores
            IdentityManager.registerServers([
                {
                    server: "https://sit.rivasciudad.es/server/rest/services",
                    tokenServiceUrl: tokenUrl,
                    owningSystemUrl: "https://sit.rivasciudad.es/portal",
                    isTokenBasedSecurity: true
                },
                {
                    server: "https://sit.rivasciudad.es",
                    tokenServiceUrl: tokenUrl,
                    owningSystemUrl: "https://sit.rivasciudad.es/portal",
                    isTokenBasedSecurity: true
                }
            ]);

            // Registrar el token para las rutas del servidor
            const tokenObj = {
                token: data.token,
                userId: username,
                expires: data.expires || (Date.now() + 86400000),
                ssl: true
            };

            IdentityManager.registerToken({ server: "https://sit.rivasciudad.es/server/rest/services", ...tokenObj });
            IdentityManager.registerToken({ server: "https://sit.rivasciudad.es", ...tokenObj });
            IdentityManager.registerToken({ server: "https://sit.rivasciudad.es/portal", ...tokenObj });

            // Persistir token explícito
            localStorage.setItem("elecciones_arcgis_token_data", JSON.stringify(tokenObj));
            saveIdentityManagerSession();
        }

        return data;
    }

    function saveIdentityManagerSession() {
        try {
            if (typeof IdentityManager !== "undefined" && IdentityManager.toJSON) {
                const idJson = IdentityManager.toJSON();
                localStorage.setItem("elecciones_arcgis_id_mgr", JSON.stringify(idJson));
            }
        } catch (e) {
            console.warn("No se pudo guardar la sesión de IdentityManager en localStorage:", e);
        }
    }

    function restoreIdentityManagerSession() {
        try {
            if (typeof IdentityManager !== "undefined") {
                // 1. Registrar servidores
                IdentityManager.registerServers([
                    {
                        server: "https://sit.rivasciudad.es/server/rest/services",
                        tokenServiceUrl: "https://sit.rivasciudad.es/portal/sharing/rest/generateToken",
                        owningSystemUrl: "https://sit.rivasciudad.es/portal",
                        isTokenBasedSecurity: true
                    },
                    {
                        server: "https://sit.rivasciudad.es",
                        tokenServiceUrl: "https://sit.rivasciudad.es/portal/sharing/rest/generateToken",
                        owningSystemUrl: "https://sit.rivasciudad.es/portal",
                        isTokenBasedSecurity: true
                    }
                ]);

                // 2. Restaurar token explícito si existe y está vigente
                const tokenDataStr = localStorage.getItem("elecciones_arcgis_token_data");
                if (tokenDataStr) {
                    const tokenData = JSON.parse(tokenDataStr);
                    if (tokenData && tokenData.token && (!tokenData.expires || tokenData.expires > Date.now())) {
                        IdentityManager.registerToken({ server: "https://sit.rivasciudad.es/server/rest/services", ...tokenData });
                        IdentityManager.registerToken({ server: "https://sit.rivasciudad.es", ...tokenData });
                        IdentityManager.registerToken({ server: "https://sit.rivasciudad.es/portal", ...tokenData });
                        console.log("Token de ArcGIS restaurado y registrado activamente en IdentityManager.");
                    }
                }

                // 3. Restaurar serialización nativa de IdentityManager
                const idJsonStr = localStorage.getItem("elecciones_arcgis_id_mgr");
                if (idJsonStr && IdentityManager.initialize) {
                    const idJson = JSON.parse(idJsonStr);
                    IdentityManager.initialize(idJson);
                    console.log("Sesión de ArcGIS IdentityManager restaurada desde almacenamiento local.");
                }
                return true;
            }
        } catch (e) {
            console.warn("No se pudo restaurar la sesión de IdentityManager:", e);
        }
        return false;
    }

    // ==========================================================================
// DESCARGA Y SINCRONIZACIÓN CON ARCGIS FEATURE SERVER
    // ==========================================================================

    // Descarga resultados públicos desde el servidor de ArcGIS de forma anónima (para el Visor Público)
    function loadResultsFromServer() {
        if (state.currentUser && state.arcgisMode) {
            syncDataWithArcGISServer();
            return;
        }
        
        console.log("Intentando descargar resultados públicos desde ArcGIS Server...");
        console.log("URL de la tabla de mesas pública:", URL_MESAS_TABLE);
        
        try {
            const tablesLayer = new FeatureLayer({
                url: URL_MESAS_TABLE,
                outFields: ["*"]
            });

            tablesLayer.load().then(() => {
                const query = tablesLayer.createQuery();
                query.where = "1=1";
                query.outFields = ["*"];

                tablesLayer.queryFeatures(query).then(results => {
                    console.log(`Resultados públicos: se descargaron ${results.features ? results.features.length : 0} registros.`);
                    if (results.features && results.features.length > 0) {
                        // 1. Extraer primero la configuración de partidos del registro especial __PARTIES__
                        const partiesFeat = results.features.find(feat => {
                            const cod = getAttributeValue(feat.attributes, "codigo");
                            return cod === "__PARTIES__";
                        });

                        if (partiesFeat) {
                            try {
                                const raw = getAttributeValue(partiesFeat.attributes, "RESULTADOS_JSON") ||
                                            getAttributeValue(partiesFeat.attributes, "resultados_json");
                                if (raw) {
                                    const parsed = JSON.parse(raw);
                                    const serverList = parsed.parties_config || (Array.isArray(parsed) ? parsed : null);
                                    if (serverList && Array.isArray(serverList) && serverList.length > 0) {
                                        const customLogos = getCustomPartyLogos();
                                        serverList.forEach(p => {
                                            if (p && p.id && customLogos[p.id]) {
                                                p.logo = customLogos[p.id];
                                            }
                                        });
                                        const currentIds = PARTIES_CONFIG.map(p => p.id).sort().join(",");
                                        const serverIds  = serverList.map(p => p.id).sort().join(",");
                                        if (currentIds !== serverIds || PARTIES_CONFIG.length === 0) {
                                            savePartiesToStorage(serverList);
                                            generateVoteFields();
                                            console.log("[PARTIDOS PUBLICO] Partidos actualizados desde ArcGIS Server:", serverList.length, "partidos");
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn("[PARTIDOS PUBLICO] Error leyendo config de partidos del servidor:", e);
                            }
                        }

                        // 1.5 Auto-descubrir partidos a partir de los datos reales de mesas
                        ensurePartiesFromFeatures(results.features);

                        // 2. Parsear mesas reales usando la configuración de partidos ya actualizada
                        const serverMesas = [];
                        results.features.forEach(feat => {
                            const cod = getAttributeValue(feat.attributes, "codigo");
                            if (!cod || cod === "__PARTIES__") return;
                            const existingMesa = state.mesas.find(m => m.codigo === cod);
                            const mesaObj = parseMesaFromAttributes(feat.attributes, existingMesa);
                            if (mesaObj) {
                                serverMesas.push(mesaObj);
                            }
                        });
                        
                        state.mesas = serverMesas;
                        rebuildDynamicMappings();
                        saveLocalDatabase();
                        updateGlobalMetrics();
                        renderMapTheme();
                    } else {
                        console.log("La tabla de mesas pública está vacía.");
                        state.mesas = [];
                        rebuildDynamicMappings();
                        saveLocalDatabase();
                        updateGlobalMetrics();
                        renderMapTheme();
                    }
                }).catch(err => {
                    console.error("Error en queryFeatures de la tabla de mesas pública:", err);
                });
            }).catch(err => {
                console.error("Error al cargar la tabla pública:", err);
            });
        } catch (e) {
            console.error("Excepción al instanciar FeatureLayer de la tabla pública:", e);
        }
    }
    
    // Al autenticar con ArcGIS, descargamos los registros actuales del FeatureServer editable
    function syncDataWithArcGISServer() {
        if (!state.arcgisMode) return;

        loadPartiesFromStorage();
        console.log("Iniciando sincronización con ArcGIS Feature Server...");

        try {
            const tablesLayer = new FeatureLayer({
                url: URL_MESAS_TABLE_EDIT,
                outFields: ["*"]
            });

            const query = tablesLayer.createQuery();
            query.where = "1=1";
            query.outFields = ["*"];

            tablesLayer.queryFeatures(query).then(results => {
                console.log(`Se recuperaron ${results.features ? results.features.length : 0} registros del servidor ArcGIS.`);
                
                if (results.features && results.features.length > 0) {
                    // 1. Extraer primero la configuración de partidos si existe
                    const partiesFeature = results.features.find(feature => {
                        const cod = getAttributeValue(feature.attributes, "codigo");
                        return cod === "__PARTIES__";
                    });

                    if (partiesFeature) {
                        try {
                            const raw = getAttributeValue(partiesFeature.attributes, "RESULTADOS_JSON") ||
                                        getAttributeValue(partiesFeature.attributes, "resultados_json");
                            if (raw) {
                                const parsed = JSON.parse(raw);
                                const serverList = parsed.parties_config || (Array.isArray(parsed) ? parsed : null);
                                if (serverList && Array.isArray(serverList) && serverList.length > 0) {
                                    const customLogos = getCustomPartyLogos();
                                    serverList.forEach(p => {
                                        if (p && p.id && customLogos[p.id]) {
                                            p.logo = customLogos[p.id];
                                        }
                                    });
                                    const currentIds = PARTIES_CONFIG.map(p => p.id).sort().join(",");
                                    const serverIds  = serverList.map(p => p.id).sort().join(",");
                                    if (currentIds !== serverIds || PARTIES_CONFIG.length === 0) {
                                        savePartiesToStorage(serverList);
                                        generateVoteFields();
                                        console.log("[PARTIDOS] Partidos actualizados desde ArcGIS Server:", serverList.length, "partidos");
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn("[PARTIDOS] Error leyendo config de partidos del servidor:", e);
                        }
                    }

                    // 1.5 Auto-descubrir partidos a partir de los datos reales de mesas
                    ensurePartiesFromFeatures(results.features);

                    // 2. Parsear mesas reales usando la configuración de partidos ya actualizada
                    const serverMesas = [];
                    results.features.forEach(feature => {
                        const cod = getAttributeValue(feature.attributes, "codigo");
                        if (!cod || cod === "__PARTIES__") return;

                        const existingMesa = state.mesas.find(m => m.codigo === cod);
                        const mesaObj = parseMesaFromAttributes(feature.attributes, existingMesa);
                        if (mesaObj) {
                            serverMesas.push(mesaObj);
                        }
                    });

                    // El servidor es la fuente de verdad. Solo preservamos el estado local
                    // para mesas que ESTA sesión acaba de liberar (protección contra race condition
                    // del sync periódico, sin bloquear actualizaciones de otros navegadores).
                    const now = Date.now();
                    serverMesas.forEach(serverMesa => {
                        const localMesa = state.mesas.find(m => m.codigo === serverMesa.codigo);
                        if (localMesa) {
                            // Preservar el objectid cacheado localmente
                            if (localMesa.objectid && !serverMesa.objectid) {
                                serverMesa.objectid = localMesa.objectid;
                            }
                            // Solo ignorar "Escrutando" del servidor si ESTA sesión liberó esa mesa
                            // hace menos de 8 segundos (ventana de seguridad para el update en vuelo)
                            const releasedAt = state.recentlyReleasedMesas && state.recentlyReleasedMesas[serverMesa.codigo];
                            if (serverMesa.estado === "Escrutando" &&
                                releasedAt && (now - releasedAt) < 8000) {
                                serverMesa.estado = "Abierta";
                            }
                        }
                    });

                    // Limpiar entradas caducadas del registro de mesas recientemente liberadas
                    if (state.recentlyReleasedMesas) {
                        Object.keys(state.recentlyReleasedMesas).forEach(cod => {
                            if (now - state.recentlyReleasedMesas[cod] >= 8000) {
                                delete state.recentlyReleasedMesas[cod];
                            }
                        });
                    }

                    state.mesas = serverMesas;
                    rebuildDynamicMappings();
                    saveLocalDatabase();
                    
                    // Refrescar vistas
                    updateGlobalMetrics();
                    renderMapTheme();
                    if (state.currentUser && state.currentUser.role === "admin") {
                        renderAdminPortal();
                    } else if (state.currentUser && state.currentUser.role === "colegio") {
                        if (state.selectedMesa === null) {
                            showSchoolPortalView();
                        }
                    }
                } else {
                    console.log("La tabla de mesas está vacía en ArcGIS Server.");
                    state.mesas = [];
                    rebuildDynamicMappings();
                    saveLocalDatabase();
                    updateGlobalMetrics();
                    renderMapTheme();
                }
            }).catch(err => {
                console.error("Fallo al consultar la tabla de mesas en ArcGIS Server:", err);
            });
        } catch (e) {
            console.error("Excepción en syncDataWithArcGISServer:", e);
        }
    }

    // Helper para extraer objeto mesa desde atributos de ArcGIS Server (soporta CENSO nativo y RESULTADOS_JSON)
    function parseMesaFromAttributes(attrs, existingMesa) {
        const cod = getAttributeValue(attrs, "codigo");
        if (!cod) return null;
        
        const seccion = getSeccionFromAttributes(attrs, cod);
        
        // 1. Censo nativo de GDB
        let censoVal = parseInt(getAttributeValue(attrs, "censo") || getAttributeValue(attrs, "CENSO"), 10);
        if (isNaN(censoVal) || censoVal <= 0) censoVal = null;

        // 2. Miembros empaquetados
        const miembrosRaw = getAttributeValue(attrs, "miembros") || "";
        let mObj = null;
        if (miembrosRaw && miembrosRaw.trim().startsWith("{")) {
            try {
                mObj = JSON.parse(miembrosRaw);
                if (!censoVal && mObj.censo && !isNaN(parseInt(mObj.censo, 10)) && parseInt(mObj.censo, 10) > 0) {
                    censoVal = parseInt(mObj.censo, 10);
                }
            } catch (e) {}
        }

        const censosManuales = JSON.parse(localStorage.getItem("elecciones_censos_manuales") || "{}");
        if (!censoVal && censosManuales[cod]) {
            censoVal = parseInt(censosManuales[cod], 10);
        } else if (!censoVal && existingMesa && existingMesa.censo) {
            censoVal = existingMesa.censo;
        }

        if (!censoVal) {
            censoVal = CENSUS_2023[seccion] || 1000;
        }

        // Parsear RESULTADOS_JSON si existe
        let resObj = null;
        const resJsonRaw = getAttributeValue(attrs, "resultados_json") || getAttributeValue(attrs, "RESULTADOS_JSON");
        if (resJsonRaw && typeof resJsonRaw === "string" && resJsonRaw.trim().startsWith("{")) {
            try {
                resObj = JSON.parse(resJsonRaw);
            } catch (e) {}
        } else if (resJsonRaw && typeof resJsonRaw === "object") {
            resObj = resJsonRaw;
        }

        let p1Votos = 0;
        let p1Time = "";
        let p2Votos = 0;
        let p2Time = "";

        if (resObj && resObj.part1) {
            p1Votos = parseInt(resObj.part1.votos, 10) || 0;
            p1Time = resObj.part1.hora || resObj.part1.time || "";
        }
        if (resObj && resObj.part2) {
            p2Votos = parseInt(resObj.part2.votos, 10) || 0;
            p2Time = resObj.part2.hora || resObj.part2.time || "";
        }

        // Fallbacks para avances si no estaban en RESULTADOS_JSON
        if (!p1Votos) p1Votos = parseInt(getAttributeValue(attrs, "part1_votos") || getAttributeValue(attrs, "PART1_VOTOS"), 10) || 0;
        if (!p1Time) p1Time = getAttributeValue(attrs, "part1_time") || getAttributeValue(attrs, "PART1_TIME") || "";
        if (!p2Votos) p2Votos = parseInt(getAttributeValue(attrs, "part2_votos") || getAttributeValue(attrs, "PART2_VOTOS"), 10) || 0;
        if (!p2Time) p2Time = getAttributeValue(attrs, "part2_time") || getAttributeValue(attrs, "PART2_TIME") || "";

        if (mObj) {
            if (!p1Votos && mObj.part1_votos) p1Votos = parseInt(mObj.part1_votos, 10);
            if (!p1Time && mObj.part1_time) p1Time = mObj.part1_time;
            if (!p2Votos && mObj.part2_votos) p2Votos = parseInt(mObj.part2_votos, 10);
            if (!p2Time && mObj.part2_time) p2Time = mObj.part2_time;
        }

        let colegio = getAttributeValue(attrs, "colegio");
        if (!colegio && existingMesa && existingMesa.colegio) {
            colegio = existingMesa.colegio;
        }
        if (!colegio) {
            colegio = SECTION_COLEGIO_MAPPING[seccion] || "Colegio Electoral";
        }

        const estadoActual = getAttributeValue(attrs, "estado") || "Abierta";

        const objId = getAttributeValue(attrs, "objectid") || getAttributeValue(attrs, "OBJECTID") || getAttributeValue(attrs, "FID");

        const mesaObj = {
            codigo: cod,
            seccion: seccion,
            mesa: getAttributeValue(attrs, "mesa") || (cod ? cod.slice(-1) : "U"),
            colegio: colegio,
            censo: censoVal,
            estado: estadoActual,
            miembros: miembrosRaw,
            firma_presi: getAttributeValue(attrs, "firma_presi") || "",
            firma_vocal1: getAttributeValue(attrs, "firma_vocal1") || "",
            firma_vocal2: getAttributeValue(attrs, "firma_vocal2") || "",
            objectid: objId,
            votos_blancos: 0,
            votos_nulos: 0,
            part1_votos: p1Votos,
            part1_time: p1Time,
            part2_votos: p2Votos,
            part2_time: p2Time
        };

        // Extraer votos de partidos y blancos/nulos de RESULTADOS_JSON o fallback a columnas
        const partyVotesObj = (resObj && resObj.votos_partidos) ? resObj.votos_partidos : {};

        mesaObj.votos_blancos = partyVotesObj.BLANCOS !== undefined ? (parseInt(partyVotesObj.BLANCOS, 10) || 0) :
                               (partyVotesObj.blancos !== undefined ? (parseInt(partyVotesObj.blancos, 10) || 0) :
                               (parseInt(getAttributeValue(attrs, "votos_blancos"), 10) || 0));

        mesaObj.votos_nulos = partyVotesObj.NULOS !== undefined ? (parseInt(partyVotesObj.NULOS, 10) || 0) :
                             (partyVotesObj.nulos !== undefined ? (parseInt(partyVotesObj.nulos, 10) || 0) :
                             (parseInt(getAttributeValue(attrs, "votos_nulos"), 10) || 0));

        PARTIES_CONFIG.forEach(p => {
            let pVal = 0;
            if (partyVotesObj[p.id] !== undefined) {
                pVal = parseInt(partyVotesObj[p.id], 10) || 0;
            } else if (partyVotesObj[p.id.toLowerCase()] !== undefined) {
                pVal = parseInt(partyVotesObj[p.id.toLowerCase()], 10) || 0;
            } else if (partyVotesObj[p.field] !== undefined) {
                pVal = parseInt(partyVotesObj[p.field], 10) || 0;
            } else {
                pVal = parseInt(getAttributeValue(attrs, p.field), 10) || 0;
            }
            mesaObj[p.field] = pVal;
        });

        // Asegurar que también se asignen votos si las claves coinciden sin distinción de mayúsculas/minúsculas
        Object.keys(partyVotesObj).forEach(k => {
            const upperK = k.toUpperCase();
            if (upperK !== "BLANCOS" && upperK !== "NULOS") {
                const match = PARTIES_CONFIG.find(p => p.id.toUpperCase() === upperK || p.field.toUpperCase() === upperK);
                if (match && (!mesaObj[match.field] || mesaObj[match.field] === 0)) {
                    mesaObj[match.field] = parseInt(partyVotesObj[k], 10) || 0;
                }
            }
        });

        return mesaObj;
    }

    // Helper para empaquetar los atributos que se envían a ArcGIS Server
    function buildFeatureAttributesFromMesa(targetMesa) {
        const partidosVotesMap = {};
        PARTIES_CONFIG.forEach(p => {
            partidosVotesMap[p.id] = targetMesa[p.field] || 0;
        });
        partidosVotesMap["BLANCOS"] = targetMesa.votos_blancos || 0;
        partidosVotesMap["NULOS"] = targetMesa.votos_nulos || 0;

        const resultadosObj = {
            part1: {
                votos: targetMesa.part1_votos || 0,
                hora: targetMesa.part1_time || ""
            },
            part2: {
                votos: targetMesa.part2_votos || 0,
                hora: targetMesa.part2_time || ""
            },
            votos_partidos: partidosVotesMap
        };
        const resultadosJsonStr = JSON.stringify(resultadosObj);

        let miembrosObj = { 
            presi: "", 
            vocal1: "", 
            vocal2: "", 
            censo: targetMesa.censo
        };
        if (typeof targetMesa.miembros === "object" && targetMesa.miembros !== null) {
            miembrosObj = { ...targetMesa.miembros, censo: targetMesa.censo };
        } else if (typeof targetMesa.miembros === "string" && targetMesa.miembros.trim().startsWith("{")) {
            try {
                miembrosObj = { ...JSON.parse(targetMesa.miembros), censo: targetMesa.censo };
            } catch (e) {}
        }
        const miembrosStr = JSON.stringify(miembrosObj);

        const attrs = {
            CODIGO: targetMesa.codigo,
            SECCION: targetMesa.seccion,
            MESA: targetMesa.mesa,
            COLEGIO: targetMesa.colegio,
            CENSO: targetMesa.censo || 1000,
            ESTADO: targetMesa.estado || "Abierta",
            RESULTADOS_JSON: resultadosJsonStr,
            resultados_json: resultadosJsonStr,
            MIEMBROS: miembrosStr,
            FIRMA_PRESI: targetMesa.firma_presi || "",
            FIRMA_VOCAL1: targetMesa.firma_vocal1 || "",
            FIRMA_VOCAL2: targetMesa.firma_vocal2 || "",

            codigo: targetMesa.codigo,
            seccion: targetMesa.seccion,
            mesa: targetMesa.mesa,
            colegio: targetMesa.colegio,
            censo: targetMesa.censo || 1000,
            estado: targetMesa.estado || "Abierta",
            miembros: miembrosStr,
            firma_presi: targetMesa.firma_presi || "",
            firma_vocal1: targetMesa.firma_vocal1 || "",
            firma_vocal2: targetMesa.firma_vocal2 || "",
            votos_blancos: targetMesa.votos_blancos || 0,
            votos_nulos: targetMesa.votos_nulos || 0,
            part1_votos: targetMesa.part1_votos || 0,
            part1_time: targetMesa.part1_time || "",
            part2_votos: targetMesa.part2_votos || 0,
            part2_time: targetMesa.part2_time || ""
        };

        PARTIES_CONFIG.forEach(p => {
            attrs[p.field.toUpperCase()] = targetMesa[p.field] || 0;
            attrs[p.field] = targetMesa[p.field] || 0;
        });

        return attrs;
    }

    // Guarda la configuración de partidos en ArcGIS Server como un registro especial "__PARTIES__"
    // Solo usa campos del esquema real de la GDB. Los logos base64 se sustituyen por la ruta genérica
    // para no exceder el límite de 2000 chars de RESULTADOS_JSON.
    function savePartiesToArcGIS(partiesList) {
        if (typeof FeatureLayer === "undefined" || !URL_MESAS_TABLE_EDIT || !state.arcgisMode) return;

        try {
            // Crear versión "ligera" sin logos base64 (pueden superar los 2000 chars del campo)
            const leanParties = partiesList.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                logo: (p.logo && p.logo.startsWith("data:")) ? "Imagenes/Logo_OITR.png" : (p.logo || "Imagenes/Logo_OITR.png"),
                field: p.field
            }));

            const configJson = JSON.stringify({ parties_config: leanParties });

            // Usar solo los campos que existen en la GDB (según el esquema proporcionado)
            const attrs = {
                CODIGO: "__PARTIES__",
                SECCION: "0",
                MESA: "CONFIG",
                COLEGIO: "CONFIG",
                CENSO: 0,
                ESTADO: "Config",
                RESULTADOS_JSON: configJson,
                MIEMBROS: leanParties.length.toString() + " partidos"
            };

            const tablesLayer = new FeatureLayer({ url: URL_MESAS_TABLE_EDIT, outFields: ["*"] });

            // Buscar si ya existe el registro __PARTIES__ (usar campo CODIGO en mayúsculas)
            const q = tablesLayer.createQuery();
            q.where = "CODIGO = '__PARTIES__'";
            q.outFields = ["OBJECTID"];

            tablesLayer.queryFeatures(q).then(res => {
                if (res.features && res.features.length > 0) {
                    // Actualizar registro existente
                    const objId = res.features[0].attributes.OBJECTID;
                    attrs.OBJECTID = objId;
                    const updateGraphic = new Graphic({ attributes: attrs });
                    return tablesLayer.applyEdits({ updateFeatures: [updateGraphic] });
                } else {
                    // Crear nuevo registro
                    const addGraphic = new Graphic({ attributes: attrs });
                    return tablesLayer.applyEdits({ addFeatures: [addGraphic] });
                }
            }).then(result => {
                console.log("[PARTIDOS] Config de partidos guardada en ArcGIS Server:", leanParties.length, "partidos", result);
            }).catch(err => {
                console.warn("[PARTIDOS] Error al guardar partidos en ArcGIS:", err);
            });
        } catch (e) {
            console.warn("[PARTIDOS] Excepción en savePartiesToArcGIS:", e);
        }
    }

    // Configura e inicia la sincronización periódica en segundo plano
    function startPeriodicSync() {
        if (state.syncInterval) {
            clearInterval(state.syncInterval);
        }
        state.syncInterval = setInterval(() => {
            if (state.currentUser && state.arcgisMode) {
                syncDataWithArcGISServer();
            } else {
                loadResultsFromServer();
            }
        }, 4000); // 4 segundos
    }

    // Funciones auxiliares de edición en ArcGIS
    function sendMesaAddToServer(nuevaMesa) {
        if (!nuevaMesa || typeof FeatureLayer === "undefined" || !URL_MESAS_TABLE_EDIT) return;

        console.log(`Enviando creación de Mesa ${nuevaMesa.codigo} a ArcGIS Server...`);

        try {
            const tablesLayer = new FeatureLayer({
                url: URL_MESAS_TABLE_EDIT,
                outFields: ["*"]
            });

            const attrs = buildFeatureAttributesFromMesa(nuevaMesa);
            const addGraphic = new Graphic({ attributes: attrs });

            tablesLayer.applyEdits({
                addFeatures: [addGraphic]
            }).then(res => {
                console.log(`Mesa ${nuevaMesa.codigo} añadida con éxito en ArcGIS Server:`, res);
                if (res.addFeatureResults && res.addFeatureResults.length > 0 && res.addFeatureResults[0].objectId) {
                    nuevaMesa.objectid = res.addFeatureResults[0].objectId;
                    saveLocalDatabase();
                }
                syncDataWithArcGISServer();
            }).catch(err => {
                console.error(`Error al añadir la Mesa ${nuevaMesa.codigo} en ArcGIS Server:`, err);
            });
        } catch (e) {
            console.error("Excepción en sendMesaAddToServer:", e);
        }
    }

    function sendMesaUpdateToServer(targetMesa) {
        if (!targetMesa || typeof FeatureLayer === "undefined" || !URL_MESAS_TABLE_EDIT) return;

        console.log(`Enviando actualización de la Mesa ${targetMesa.codigo} al servicio de ArcGIS...`);

        try {
            const tablesLayer = new FeatureLayer({
                url: URL_MESAS_TABLE_EDIT,
                outFields: ["*"]
            });

            const doUpdate = (objIdKey, objIdVal) => {
                const updateAttrs = Object.assign({ [objIdKey]: objIdVal }, buildFeatureAttributesFromMesa(targetMesa));
                const updateGraphic = new Graphic({ attributes: updateAttrs });
                tablesLayer.applyEdits({ updateFeatures: [updateGraphic] }).then(res => {
                    console.log(`Mesa ${targetMesa.codigo} actualizada con éxito en ArcGIS Server:`, res);
                }).catch(err => {
                    console.error(`Error al aplicar edits en ArcGIS Server para la Mesa ${targetMesa.codigo}:`, err);
                });
            };

            // Camino rápido: si ya tenemos el objectid cacheado, actualizar directamente
            // sin hacer una queryFeatures previa (evita race condition con el sync periódico)
            if (targetMesa.objectid) {
                doUpdate("OBJECTID", targetMesa.objectid);
                return;
            }

            // Camino lento: buscar el objectid primero
            const query = tablesLayer.createQuery();
            query.where = `CODIGO = '${targetMesa.codigo}'`;
            query.outFields = ["OBJECTID"];

            tablesLayer.queryFeatures(query).then(results => {
                if (results.features && results.features.length > 0) {
                    const attrs = results.features[0].attributes;
                    const objIdKey = attrs.OBJECTID !== undefined ? "OBJECTID" : "objectid";
                    const objIdVal = attrs[objIdKey];
                    // Cachear para futuros updates de esta mesa
                    targetMesa.objectid = objIdVal;
                    doUpdate(objIdKey, objIdVal);
                } else {
                    sendMesaAddToServer(targetMesa);
                }
            }).catch(err => {
                console.error(`Error al consultar mesa ${targetMesa.codigo} para actualizar:`, err);
            });
        } catch (e) {
            console.error("Excepción en sendMesaUpdateToServer:", e);
        }
    }

    function sendMesaDeleteToServer(mesaOrCode) {
        const codigo = typeof mesaOrCode === "object" ? mesaOrCode.codigo : mesaOrCode;
        if (!codigo || typeof FeatureLayer === "undefined" || !URL_MESAS_TABLE_EDIT) return;

        try {
            const tablesLayer = new FeatureLayer({
                url: URL_MESAS_TABLE_EDIT,
                outFields: ["*"]
            });

            const query = tablesLayer.createQuery();
            query.where = `CODIGO = '${codigo}' OR codigo = '${codigo}'`;
            query.outFields = ["*"];

            tablesLayer.queryFeatures(query).then(results => {
                if (results.features && results.features.length > 0) {
                    tablesLayer.applyEdits({
                        deleteFeatures: results.features
                    }).then(res => {
                        console.log(`Mesa ${codigo} eliminada de ArcGIS Server:`, res);
                        state.mesas = state.mesas.filter(m => m.codigo !== codigo);
                        saveLocalDatabase();
                        renderAdminPortal();
                        updateGlobalMetrics();
                        renderMapTheme();
                    }).catch(err => {
                        console.error(`Error al eliminar mesa ${codigo} en ArcGIS Server:`, err);
                    });
                }
            }).catch(err => {
                console.error("Error buscando mesa a eliminar:", err);
            });
        } catch (e) {
            console.error("Error al eliminar mesa en el servidor:", e);
        }
    }

    // Alias para compatibilidad
    function sendMesaToArcGISServer(mesaObj) {
        sendMesaUpdateToServer(mesaObj);
    }

    // ==========================================================================
    // REAPERTURA DE MESA Y CONSULTA DE CENSO POR DNI
    // ==========================================================================
    function reopenMesaPrompt(codigo) {
        const mesa = state.mesas.find(m => m.codigo === codigo);
        if (!mesa) return;

        const conf = confirm(`¿Está seguro de que desea REABRIR la Mesa ${codigo}? Esto permitirá volver a modificar e introducir votos en esta mesa por si ha habido errores en la captura.`);
        if (!conf) return;

        mesa.estado = "Abierta";

        // Si estamos en modo ArcGIS: actualizar servidor
        if (state.arcgisMode) {
            sendMesaToArcGISServer(mesa);
        }

        saveLocalDatabase();
        renderAdminPortal();
        updateGlobalMetrics();
        alert(`La Mesa ${codigo} ha sido reabierta correctamente.`);
    }

    let censusMap = null;
    let censusLoading = false;

    function loadCensusData() {
        if (censusMap) return Promise.resolve(censusMap);
        if (censusLoading) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (censusMap) {
                        clearInterval(checkInterval);
                        resolve(censusMap);
                    }
                }, 100);
            });
        }
        censusLoading = true;
        const statusDiv = document.getElementById("dni-search-status");
        if (statusDiv) statusDiv.classList.remove("hidden");

        return fetch("SI_E2812301sssmCERyCERE (CENSO DEFINITIVO).txt")
            .then(res => res.arrayBuffer())
            .then(buf => {
                const decoder = new TextDecoder("iso-8859-1");
                const text = decoder.decode(buf);
                const lines = text.split(/\r?\n/);
                const map = new window.Map();

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const cols = line.split(";").map(c => c.replace(/^"|"$/g, "").trim());
                    if (cols.length > 27) {
                        const ident = cols[27]; // IDENT (DNI/NIE)
                        if (ident) {
                            const cleanDni = ident.toUpperCase().replace(/[^A-Z0-9]/g, "");
                            map.set(cleanDni, {
                                dni: ident,
                                nombre: cols[13] || "",
                                ape1: cols[14] || "",
                                ape2: cols[15] || "",
                                colegio: cols[6] || "",
                                dirMesa: cols[9] || "",
                                distrito: cols[3] || "",
                                seccion: cols[4] || "",
                                mesa: cols[5] || ""
                            });
                        }
                    }
                }
                censusMap = map;
                censusLoading = false;
                if (statusDiv) statusDiv.classList.add("hidden");
                return censusMap;
            })
            .catch(err => {
                console.error("Error al cargar el censo:", err);
                censusLoading = false;
                if (statusDiv) {
                    statusDiv.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> No se pudo cargar el censo.</span>`;
                }
                return null;
            });
    }

    function calculateDniLetter(numStr) {
        const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
        const cleanDigits = numStr.replace(/[^0-9]/g, "");
        if (!cleanDigits) return "";
        const num = parseInt(cleanDigits, 10);
        if (isNaN(num)) return "";
        return letters[num % 23];
    }

    function findInCensus(rawQuery, cMap) {
        const q = rawQuery.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!q || !cMap) return null;

        // 1. Coincidencia exacta (ej. 51017266T o 02324267W)
        if (cMap.has(q)) return cMap.get(q);

        // 2. Si el usuario introdujo solo números (se le olvidó la letra)
        const isNumeric = /^[0-9]+$/.test(q);
        if (isNumeric) {
            const letter = calculateDniLetter(q);
            if (letter) {
                // Probar número + letra calculada (ej. 51017266T)
                const withLetter = q + letter;
                if (cMap.has(withLetter)) return cMap.get(withLetter);

                // Probar rellenando ceros a la izquierda hasta 8 dígitos + letra (ej. 02324267W)
                const paddedDigits = q.padStart(8, '0');
                const paddedLetter = calculateDniLetter(paddedDigits);
                const paddedWithLetter = paddedDigits + paddedLetter;
                if (cMap.has(paddedWithLetter)) return cMap.get(paddedWithLetter);
            }
        }

        // 3. Si introdujo número con letra pero omitió el cero inicial (ej. 2324267W en lugar de 02324267W)
        const matchDigitsLetter = q.match(/^([0-9]+)([A-Z])$/);
        if (matchDigitsLetter) {
            const digits = matchDigitsLetter[1];
            const letter = matchDigitsLetter[2];
            const padded = digits.padStart(8, '0') + letter;
            if (cMap.has(padded)) return cMap.get(padded);
        }

        // 4. Si introdujo un NIE con letra pero le falta cero inicial (ej. X234567W en lugar de X0234567W)
        const matchNie = q.match(/^([A-Z])([0-9]+)([A-Z])$/);
        if (matchNie) {
            const prefix = matchNie[1];
            const digits = matchNie[2];
            const letter = matchNie[3];
            const paddedNie = prefix + digits.padStart(7, '0') + letter;
            if (cMap.has(paddedNie)) return cMap.get(paddedNie);
        }

        // 5. Búsqueda por escaneo de dígitos limpios (ignorando ceros a la izquierda y letras)
        const qCleanDigits = q.replace(/[^0-9]/g, "").replace(/^0+/, "");
        if (qCleanDigits.length >= 6) {
            for (const item of cMap.values()) {
                const itemDigits = item.dni.replace(/[^0-9]/g, "").replace(/^0+/, "");
                if (itemDigits === qCleanDigits) {
                    return item;
                }
            }
        }

        return null;
    }

    function getColegioOfficialAddress(colName, rawDir) {
        if (!colName) return rawDir || "";
        const cleanColName = colName.trim().toUpperCase();

        // 1. Coincidencia directa
        if (COLEGIO_DETAILS[colName] && COLEGIO_DETAILS[colName].address) {
            return COLEGIO_DETAILS[colName].address;
        }

        // 2. Búsqueda insensible a acentos/mayúsculas
        const normCol = cleanColName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        for (const key in COLEGIO_DETAILS) {
            const normKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            if (normKey === normCol || normCol.includes(normKey) || normKey.includes(normCol)) {
                if (COLEGIO_DETAILS[key].address) {
                    return COLEGIO_DETAILS[key].address;
                }
            }
        }

        return rawDir || "";
    }

    function handleDniSearch() {
        const input = document.getElementById("dni-search-input");
        const container = document.getElementById("dni-search-result-container");
        if (!input || !container) return;

        const rawQuery = input.value.trim();
        const query = rawQuery.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!query) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 20px 10px;">
                    Por favor, introduce un DNI o NIE válido.
                </div>`;
            return;
        }

        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">
                <i class="fa-solid fa-spinner fa-spin"></i> Consultando censo electoral...
            </div>`;

        loadCensusData().then(cMap => {
            if (!cMap) {
                container.innerHTML = `
                    <div style="text-align: center; color: #ef4444; padding: 20px;">
                        Error al consultar el censo. Inténtalo de nuevo.
                    </div>`;
                return;
            }

            const result = findInCensus(rawQuery, cMap);
            if (!result) {
                container.innerHTML = `
                    <div class="stat-card" style="border-left: 4px solid #ef4444; background: #fff5f5; padding: 16px; margin-top: 10px;">
                        <div style="font-weight: 700; color: #ef4444; margin-bottom: 6px; display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-circle-xmark"></i> No encontrado
                        </div>
                        <p style="font-size: 0.82rem; color: #475569; margin: 0;">
                            No se ha encontrado ninguna inscripción en Rivas-Vaciamadrid para el DNI/NIE <strong>${rawQuery}</strong> en el Censo Definitivo.
                        </p>
                    </div>`;
                return;
            }

            const fullName = `${result.nombre} ${result.ape1} ${result.ape2}`.trim();
            const officialAddress = getColegioOfficialAddress(result.colegio, result.dirMesa);
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.colegio + ", " + officialAddress)}`;
            
            container.innerHTML = `
                <div class="stat-card" style="border-left: 5px solid var(--primary-color); background: #ffffff; padding: 20px; box-shadow: var(--shadow-md); margin-top: 10px; border-radius: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--primary-color); letter-spacing: 0.5px;">
                            <i class="fa-solid fa-user-check"></i> Elector Empadronado
                        </span>
                        <span style="font-size: 0.72rem; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 12px; font-weight: 600;">
                            <i class="fa-solid fa-clock"></i> 09:00h - 20:00h
                        </span>
                    </div>
                    
                    <h4 style="font-size: 1.2rem; margin: 0 0 14px 0; color: var(--text-primary); font-family: var(--font-heading); font-weight: 800;">
                        ${fullName}
                    </h4>

                    <!-- Bloque 1: Colegio Electoral -->
                    <div style="background: #f8fafc; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                        <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">
                            Centro de Votación (Dónde ir)
                        </div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: var(--primary-color); margin-bottom: 4px;">
                            ${result.colegio}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: flex-start; gap: 6px;">
                            <i class="fa-solid fa-location-dot" style="margin-top: 3px; color: #ef4444; flex-shrink: 0;"></i>
                            <span>${officialAddress}</span>
                        </div>
                    </div>

                    <!-- Bloque 2: Mesa y Sección Igualadas y Destacadas -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                        <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 0.75rem; color: #9f1239; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Mesa Electoral</div>
                            <div style="font-size: 1.45rem; font-weight: 800; color: var(--primary-color); font-family: var(--font-heading); margin-top: 4px;">
                                Mesa ${result.mesa}
                            </div>
                        </div>

                        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Sección Censal</div>
                            <div style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-heading); margin-top: 4px;">
                                Sección ${result.seccion}
                            </div>
                        </div>
                    </div>

                    <!-- Botones de Acción -->
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button id="btn-censo-view-map" class="btn-header btn-primary" style="width: 100%; justify-content: center; font-size: 0.85rem; padding: 10px;" data-colegio="${result.colegio}">
                            <i class="fa-solid fa-map-location-dot"></i> Ver en el Mapa interactivo
                        </button>
                        <a href="${googleMapsUrl}" target="_blank" class="btn-header btn-secondary" style="width: 100%; justify-content: center; font-size: 0.82rem; padding: 8px; text-decoration: none; display: flex; align-items: center; gap: 6px; background: #ffffff; border: 1px solid #cbd5e1; color: var(--text-primary);">
                            <i class="fa-solid fa-route" style="color: #4285F4;"></i> Cómo llegar (Google Maps GPS)
                        </a>
                    </div>
                </div>`;

            const mapBtn = document.getElementById("btn-censo-view-map");
            if (mapBtn) {
                mapBtn.addEventListener("click", function() {
                    const colName = this.getAttribute("data-colegio");
                    locateColegioOnMap(colName);
                });
            }
        });
    }

    function locateColegioOnMap(colName) {
        viewColegioDetails(colName);
        const modal = document.getElementById("modal-colegio-detail");
        if (modal) modal.classList.remove("hidden");

        if (state.view && geomsCache && geomsCache.length > 0) {
            const secKey = Object.keys(SECTION_COLEGIO_MAPPING).find(k => SECTION_COLEGIO_MAPPING[k] === colName);
            if (secKey) {
                const feat = geomsCache.find(f => {
                    const s = f.attributes.SECCION || f.attributes.seccion || f.attributes.Seccion;
                    return s && (s.toString().padStart(3, '0') === secKey.padStart(3, '0') || s.toString() === secKey);
                });
                if (feat && feat.geometry) {
                    state.view.goTo({
                        target: feat.geometry,
                        zoom: 15
                    }, { duration: 1200 });
                }
            }
        }
    }

    // ==========================================================================
    // CAMPO DE CONTRASEÑA CON OJO TOGGLE (SOPORTE PARA ARCGIS IDENTITYMANAGER)
    // ==========================================================================
    function setupPasswordToggles() {
        function attachEyeToInput(input) {
            if (!input || input.dataset.eyeProcessed === "true") return;
            input.dataset.eyeProcessed = "true";

            let container = input.parentElement;
            if (container) {
                const pos = window.getComputedStyle(container).position;
                if (pos === "static") {
                    container.style.position = "relative";
                }
            }

            if (container && !container.classList.contains("password-wrapper") && !input.classList.contains("dijitInputInner")) {
                const wrapper = document.createElement("div");
                wrapper.className = "password-wrapper";
                wrapper.style.position = "relative";
                wrapper.style.display = "inline-flex";
                wrapper.style.alignItems = "center";
                wrapper.style.width = "100%";
                
                if (input.style.width) wrapper.style.width = input.style.width;

                container.insertBefore(wrapper, input);
                wrapper.appendChild(input);
                container = wrapper;
            }

            const eyeBtn = document.createElement("i");
            eyeBtn.className = "fa-solid fa-eye toggle-password-btn";
            eyeBtn.style.position = "absolute";
            eyeBtn.style.right = "12px";
            eyeBtn.style.top = "50%";
            eyeBtn.style.transform = "translateY(-50%)";
            eyeBtn.style.cursor = "pointer";
            eyeBtn.style.color = "#64748b";
            eyeBtn.style.fontSize = "1.1rem";
            eyeBtn.style.zIndex = "999999";
            eyeBtn.style.userSelect = "none";

            input.style.paddingRight = "38px";

            eyeBtn.addEventListener("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (input.type === "password") {
                    input.type = "text";
                    eyeBtn.className = "fa-solid fa-eye-slash toggle-password-btn";
                } else {
                    input.type = "password";
                    eyeBtn.className = "fa-solid fa-eye toggle-password-btn";
                }
            });

            if (container) {
                container.appendChild(eyeBtn);
            }
        }

        function scanAll() {
            document.querySelectorAll("input[type='password'], input[name*='password'], input[id*='password'], .dijitInputInner[type='password']").forEach(attachEyeToInput);
        }

        scanAll();
        setInterval(scanAll, 400);

        const observer = new MutationObserver(scanAll);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    }

    // ==========================================================================
    // TRANSMISIÓN DE AVANCES DE PARTICIPACIÓN (PARTICIPACIÓN 1 Y 2)
    // ==========================================================================
    function handleParticipacion1Submit() {
        if (!state.selectedMesa) return;

        const inputEl = document.getElementById("input-part1-voters");
        const inputVal = inputEl ? inputEl.value.trim() : "";
        if (inputVal === "") {
            alert("Por favor, introduce el número de personas que han votado hasta las 14:00h.");
            if (inputEl) inputEl.focus();
            return;
        }

        const numVotantes = parseInt(inputVal, 10);
        if (isNaN(numVotantes) || numVotantes < 0) {
            alert("El número de votantes no puede ser un valor negativo o inválido.");
            return;
        }

        const censoMesa = parseInt(state.selectedMesa.censo, 10) || 0;
        if (numVotantes > censoMesa) {
            alert(`Error de validación: El número de votantes introducido (${numVotantes.toLocaleString()}) no puede superar el censo electoral de esta mesa (${censoMesa.toLocaleString()} electores).`);
            return;
        }

        const pct = censoMesa > 0 ? ((numVotantes / censoMesa) * 100).toFixed(2) : "0.00";
        const confirmSubmit = confirm(`¿Confirmas la transmisión del 1º AVANCE (14:00h) para la Mesa ${state.selectedMesa.codigo}?\n\n• Votantes acumulados: ${numVotantes.toLocaleString()}\n• Participación estimada: ${pct}%\n• Censo de la mesa: ${censoMesa.toLocaleString()}`);
        if (!confirmSubmit) return;

        const targetMesa = state.mesas.find(m => m.codigo === state.selectedMesa.codigo);
        if (targetMesa) {
            targetMesa.part1_votos = numVotantes;
            targetMesa.part1_time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (targetMesa.estado !== "Cerrada" && targetMesa.estado !== "Part2_Enviada") {
                targetMesa.estado = "Part1_Enviada";
            }

            saveLocalDatabase();

            if (state.arcgisMode) {
                sendMesaUpdateToServer(targetMesa);
            }

            alert(`¡1º AVANCE TRANSMITIDO CON ÉXITO!\nMesa ${targetMesa.codigo} | ${numVotantes.toLocaleString()} votantes (${pct}%)`);
            
            // Actualizar vista interna de la mesa y pasar a la siguiente fase recomendada
            openScrutinyForm(targetMesa);
            switchPortalPhase("part2");
            updateGlobalMetrics();
            renderAdminPortal();
        }
    }

    function handleParticipacion2Submit() {
        if (!state.selectedMesa) return;

        const inputEl = document.getElementById("input-part2-voters");
        const inputVal = inputEl ? inputEl.value.trim() : "";
        if (inputVal === "") {
            alert("Por favor, introduce el número acumulado de personas que han votado hasta las 18:00h.");
            if (inputEl) inputEl.focus();
            return;
        }

        const numVotantes = parseInt(inputVal, 10);
        if (isNaN(numVotantes) || numVotantes < 0) {
            alert("El número de votantes no puede ser un valor negativo o inválido.");
            return;
        }

        const censoMesa = parseInt(state.selectedMesa.censo, 10) || 0;
        if (numVotantes > censoMesa) {
            alert(`Error de validación: El número de votantes acumulados (${numVotantes.toLocaleString()}) no puede superar el censo electoral de esta mesa (${censoMesa.toLocaleString()} electores).`);
            return;
        }

        const targetMesa = state.mesas.find(m => m.codigo === state.selectedMesa.codigo);
        if (!targetMesa) return;

        const pct = censoMesa > 0 ? ((numVotantes / censoMesa) * 100).toFixed(2) : "0.00";

        // Advertencia si la cifra de la tarde es inferior a la del mediodía
        if (targetMesa.part1_votos && numVotantes < targetMesa.part1_votos) {
            const confirmLower = confirm(`AVISO DE DISCREPANCIA:\nEl número acumulado del 2º Avance (${numVotantes.toLocaleString()}) es menor que el enviado en el 1º Avance (${targetMesa.part1_votos.toLocaleString()}).\n\nSi se trata de una corrección previa, pulsa 'Aceptar' para transmitir la rectificación. En caso contrario, pulsa 'Cancelar' para revisar los datos.`);
            if (!confirmLower) return;
        } else {
            const confirmSubmit = confirm(`¿Confirmas la transmisión del 2º AVANCE (18:00h) para la Mesa ${targetMesa.codigo}?\n\n• Votantes acumulados: ${numVotantes.toLocaleString()}\n• Participación estimada: ${pct}%\n• Censo de la mesa: ${censoMesa.toLocaleString()}`);
            if (!confirmSubmit) return;
        }

        targetMesa.part2_votos = numVotantes;
        targetMesa.part2_time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (targetMesa.estado !== "Cerrada") {
            targetMesa.estado = "Part2_Enviada";
        }

        saveLocalDatabase();

        if (state.arcgisMode) {
            sendMesaUpdateToServer(targetMesa);
        }

        alert(`¡2º AVANCE TRANSMITIDO CON ÉXITO!\nMesa ${targetMesa.codigo} | ${numVotantes.toLocaleString()} votantes (${pct}%)`);

        // Actualizar vista interna de la mesa y pasar a la fase de escrutinio
        openScrutinyForm(targetMesa);
        switchPortalPhase("escrutinio");
        updateGlobalMetrics();
        renderAdminPortal();
    }

    // ==========================================================================
    // FUNCIONES DE EDICIÓN POR ADMINISTRADOR (VOTOS Y MIEMBROS)
    // ==========================================================================
    let editingAdminMesaCode = null;
    let editingAdminMemberMesaCode = null;

    function openAdminEditVotesModal(codigo) {
        const mesa = state.mesas.find(m => m.codigo === codigo);
        if (!mesa) return;

        loadPartiesFromStorage();

        editingAdminMesaCode = codigo;
        document.getElementById("modal-admin-votes-mesa-code").textContent = codigo;
        document.getElementById("admin-edit-votes-census-val").textContent = mesa.censo;

        const container = document.getElementById("admin-edit-votes-fields-container");
        container.innerHTML = "";

        const sortedParties = [...PARTIES_CONFIG].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

        sortedParties.forEach(party => {
            const card = document.createElement("div");
            card.className = "vote-input-card";
            card.style.borderLeft = `4px solid ${party.color}`;
            const val = mesa[party.field];
            const displayVal = (val !== undefined && val !== null && val !== 0 && val !== "0") ? val : "";
            card.innerHTML = `
                <div style="width: 24px; height: 24px; border-radius: 50%; background-color:${party.color}; flex-shrink:0;"></div>
                <label for="admin-input-vote-${party.id}">${party.name}</label>
                <input type="number" id="admin-input-vote-${party.id}" class="vote-input-field admin-vote-input" placeholder="0" value="${displayVal}" min="0">
            `;
            container.appendChild(card);
        });

        // Blanco
        const cardBlanco = document.createElement("div");
        cardBlanco.className = "vote-input-card";
        const valBlanco = mesa.votos_blancos;
        const displayBlanco = (valBlanco !== undefined && valBlanco !== null && valBlanco !== 0 && valBlanco !== "0") ? valBlanco : "";
        cardBlanco.innerHTML = `
            <div style="width: 24px; height: 24px; border-radius: 50%; background-color:#7f8c8d; flex-shrink:0;"></div>
            <label for="admin-input-vote-blanco">Votos Blancos</label>
            <input type="number" id="admin-input-vote-blanco" class="vote-input-field admin-vote-input" placeholder="0" value="${displayBlanco}" min="0">
        `;
        container.appendChild(cardBlanco);

        // Nulo
        const cardNulo = document.createElement("div");
        cardNulo.className = "vote-input-card";
        const valNulo = mesa.votos_nulos;
        const displayNulo = (valNulo !== undefined && valNulo !== null && valNulo !== 0 && valNulo !== "0") ? valNulo : "";
        cardNulo.innerHTML = `
            <div style="width: 24px; height: 24px; border-radius: 50%; background-color:#95a5a6; flex-shrink:0;"></div>
            <label for="admin-input-vote-nulo">Votos Nulos</label>
            <input type="number" id="admin-input-vote-nulo" class="vote-input-field admin-vote-input" placeholder="0" value="${displayNulo}" min="0">
        `;
        container.appendChild(cardNulo);

        // Calcular total y alerta inicial
        updateAdminEditVotesAlert(mesa);

        // Evento input para actualizar alertas live
        container.querySelectorAll(".admin-vote-input").forEach(inp => {
            inp.addEventListener("input", () => updateAdminEditVotesAlert(mesa));
        });

        document.getElementById("modal-admin-edit-votes").classList.remove("hidden");
    }

    function updateAdminEditVotesAlert(mesa) {
        let sum = 0;
        document.querySelectorAll(".admin-vote-input").forEach(inp => {
            const v = parseInt(inp.value, 10) || 0;
            if (v < 0) inp.value = 0;
            sum += Math.max(0, v);
        });

        document.getElementById("admin-edit-votes-total-val").textContent = sum;
        const census = parseInt(mesa.censo, 10) || 1;
        const alertBox = document.getElementById("admin-edit-votes-alert-box");
        const alertIcon = document.getElementById("admin-edit-votes-alert-icon");
        const alertTitle = document.getElementById("admin-edit-votes-alert-title");
        const alertBadge = document.getElementById("admin-edit-votes-alert-badge");
        const alertDesc = document.getElementById("admin-edit-votes-alert-desc");

        const nullInput = document.getElementById("admin-input-vote-nulo");
        const nullVotes = nullInput ? (parseInt(nullInput.value, 10) || 0) : 0;

        if (sum > census || nullVotes > (census * 0.25)) {
            alertBox.className = "alert-box critical";
            alertIcon.className = "fa-solid fa-triangle-exclamation";
            alertTitle.textContent = "Evaluación de Criticidad: ALTA (ALERTA ROJA)";
            alertBadge.className = "alert-critical-badge critical";
            alertBadge.textContent = "Nivel: Crítico (Alta)";
            if (sum > census) {
                alertDesc.textContent = `¡ATENCIÓN! La suma total de votos (${sum}) supera el censo electoral registrado (${census}). Modificación de alta sensibilidad.`;
            } else {
                alertDesc.textContent = `¡ATENCIÓN! El volumen de votos nulos (${nullVotes}) supera el 25% del censo. Verifique el acta detenidamente.`;
            }
        } else if ((sum / census) > 0.95 || (sum / census) < 0.10) {
            alertBox.className = "alert-box warning";
            alertIcon.className = "fa-solid fa-circle-exclamation";
            alertTitle.textContent = "Evaluación de Criticidad: MEDIA (ADVERTENCIA)";
            alertBadge.className = "alert-critical-badge warning";
            alertBadge.textContent = "Nivel: Advertencia (Media)";
            alertDesc.textContent = `Participación extrema detectada (${((sum / census) * 100).toFixed(1)}%). Compruebe que coincide con el acta oficial del colegio.`;
        } else {
            alertBox.className = "alert-box info";
            alertIcon.className = "fa-solid fa-circle-info";
            alertTitle.textContent = "Evaluación de Criticidad: BAJA (INFORMACIÓN)";
            alertBadge.className = "alert-critical-badge info";
            alertBadge.textContent = "Nivel: Información (Bajo)";
            alertDesc.textContent = "Los datos ingresados están dentro de los márgenes normativos de censo y participación.";
        }
    }

    function saveAdminEditVotesSubmit(e) {
        e.preventDefault();
        if (!editingAdminMesaCode) return;

        const mesa = state.mesas.find(m => m.codigo === editingAdminMesaCode);
        if (!mesa) return;

        // Recoger votos
        PARTIES_CONFIG.forEach(p => {
            const inp = document.getElementById(`admin-input-vote-${p.id}`);
            if (inp) mesa[p.field] = parseInt(inp.value, 10) || 0;
        });
        const inpBlanco = document.getElementById("admin-input-vote-blanco");
        const inpNulo = document.getElementById("admin-input-vote-nulo");
        mesa.votos_blancos = inpBlanco ? (parseInt(inpBlanco.value, 10) || 0) : 0;
        mesa.votos_nulos = inpNulo ? (parseInt(inpNulo.value, 10) || 0) : 0;

        // Registrar en historial de auditoría
        if (!mesa.auditoria) mesa.auditoria = [];
        const now = new Date();
        const formattedDate = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        const adminUser = (state.currentUser && state.currentUser.username) ? state.currentUser.username : "AdminEleccionesGenPrueba";

        mesa.auditoria.push({
            fecha: formattedDate,
            usuario: adminUser,
            accion: "Modificación de Escrutinio por Administración",
            motivo: "Modificación directa por Administración"
        });

        saveLocalDatabase();

        sendMesaUpdateToServer(mesa);

        document.getElementById("modal-admin-edit-votes").classList.add("hidden");
        alert(`¡Votos de la Mesa ${mesa.codigo} actualizados con éxito por Administración!`);

        renderAdminPortal();
        updateGlobalMetrics();
        renderMapTheme();
    }

    function openAdminEditMembersModal(codigo) {
        const mesa = state.mesas.find(m => m.codigo === codigo);
        if (!mesa) return;

        editingAdminMemberMesaCode = codigo;
        document.getElementById("modal-admin-members-mesa-code").textContent = codigo;

        let presi = "";
        let vocal1 = "";
        let vocal2 = "";

        if (mesa.miembros) {
            try {
                const parsed = typeof mesa.miembros === "string" ? JSON.parse(mesa.miembros) : mesa.miembros;
                presi = parsed.presi || "";
                vocal1 = parsed.vocal1 || "";
                vocal2 = parsed.vocal2 || "";
            } catch (e) {
                presi = mesa.miembros;
            }
        }

        document.getElementById("admin-member-president").value = presi;
        document.getElementById("admin-member-vocal1").value = vocal1;
        document.getElementById("admin-member-vocal2").value = vocal2;

        document.getElementById("modal-admin-edit-members").classList.remove("hidden");
    }

    function saveAdminEditMembersSubmit(e) {
        e.preventDefault();
        if (!editingAdminMemberMesaCode) return;

        const mesa = state.mesas.find(m => m.codigo === editingAdminMemberMesaCode);
        if (!mesa) return;

        const presi = document.getElementById("admin-member-president").value.trim();
        const vocal1 = document.getElementById("admin-member-vocal1").value.trim();
        const vocal2 = document.getElementById("admin-member-vocal2").value.trim();

        if (!presi || !vocal1 || !vocal2) {
            alert("Debe indicar el nombre completo del Presidente y ambos Vocales.");
            return;
        }

        mesa.miembros = JSON.stringify({ presi, vocal1, vocal2 });
        saveLocalDatabase();

        if (state.arcgisMode) {
            sendMesaUpdateToServer(mesa);
        }

        document.getElementById("modal-admin-edit-members").classList.add("hidden");
        alert(`¡Miembros de la Mesa ${mesa.codigo} actualizados correctamente por Administración!`);

        renderAdminPortal();
    }



    // ==========================================================================
    // EJECUTAR AL CARGAR EL SCRIPT
    // ==========================================================================
    init();

});
