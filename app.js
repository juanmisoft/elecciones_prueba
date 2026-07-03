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
        "AlmendrosEleccionesGenPrueba": { role: "colegio", colegio: "C.E.I.P. LOS ALMENDROS" }
    };

    // Mesas iniciales por defecto para la prueba (Jarama y Almendros)
    const DEFAULT_MESAS = [
        { codigo: "006A", seccion: "006", mesa: "A", colegio: "C.E.I.P. JARAMA", votos_pp: 0, votos_psoe: 0, votos_vox: 0, votos_sumar: 0, votos_up: 0, votos_cs: 0, votos_pacma: 0, votos_salf: 0, votos_blancos: 0, votos_nulos: 0, miembros: "", estado: "Abierta", firma_presi: "", firma_vocal1: "", firma_vocal2: "", censo: 800, objectid: null },
        { codigo: "006B", seccion: "006", mesa: "B", colegio: "C.E.I.P. JARAMA", votos_pp: 0, votos_psoe: 0, votos_vox: 0, votos_sumar: 0, votos_up: 0, votos_cs: 0, votos_pacma: 0, votos_salf: 0, votos_blancos: 0, votos_nulos: 0, miembros: "", estado: "Abierta", firma_presi: "", firma_vocal1: "", firma_vocal2: "", censo: 727, objectid: null },
        { codigo: "018U", seccion: "018", mesa: "U", colegio: "C.E.I.P. JARAMA", votos_pp: 0, votos_psoe: 0, votos_vox: 0, votos_sumar: 0, votos_up: 0, votos_cs: 0, votos_pacma: 0, votos_salf: 0, votos_blancos: 0, votos_nulos: 0, miembros: "", estado: "Abierta", firma_presi: "", firma_vocal1: "", firma_vocal2: "", censo: 756, objectid: null },
        
        { codigo: "008A", seccion: "008", mesa: "A", colegio: "C.E.I.P. LOS ALMENDROS", votos_pp: 0, votos_psoe: 0, votos_vox: 0, votos_sumar: 0, votos_up: 0, votos_cs: 0, votos_pacma: 0, votos_salf: 0, votos_blancos: 0, votos_nulos: 0, miembros: "", estado: "Abierta", firma_presi: "", firma_vocal1: "", firma_vocal2: "", censo: 450, objectid: null },
        { codigo: "008B", seccion: "008", mesa: "B", colegio: "C.E.I.P. LOS ALMENDROS", votos_pp: 0, votos_psoe: 0, votos_vox: 0, votos_sumar: 0, votos_up: 0, votos_cs: 0, votos_pacma: 0, votos_salf: 0, votos_blancos: 0, votos_nulos: 0, miembros: "", estado: "Abierta", firma_presi: "", firma_vocal1: "", firma_vocal2: "", censo: 465, objectid: null },
        { codigo: "014A", seccion: "014", mesa: "A", colegio: "C.E.I.P. LOS ALMENDROS", votos_pp: 0, votos_psoe: 0, votos_vox: 0, votos_sumar: 0, votos_up: 0, votos_cs: 0, votos_pacma: 0, votos_salf: 0, votos_blancos: 0, votos_nulos: 0, miembros: "", estado: "Abierta", firma_presi: "", firma_vocal1: "", firma_vocal2: "", censo: 700, objectid: null },
        { codigo: "014B", seccion: "014", mesa: "B", colegio: "C.E.I.P. LOS ALMENDROS", votos_pp: 0, votos_psoe: 0, votos_vox: 0, votos_sumar: 0, votos_up: 0, votos_cs: 0, votos_pacma: 0, votos_salf: 0, votos_blancos: 0, votos_nulos: 0, miembros: "", estado: "Abierta", firma_presi: "", firma_vocal1: "", firma_vocal2: "", censo: 703, objectid: null },
        { codigo: "042U", seccion: "042", mesa: "U", colegio: "C.E.I.P. LOS ALMENDROS", votos_pp: 0, votos_psoe: 0, votos_vox: 0, votos_sumar: 0, votos_up: 0, votos_cs: 0, votos_pacma: 0, votos_salf: 0, votos_blancos: 0, votos_nulos: 0, miembros: "", estado: "Abierta", firma_presi: "", firma_vocal1: "", firma_vocal2: "", censo: 1011, objectid: null }
    ];

    // ==========================================================================
    // INICIALIZACIÓN DE LA APLICACIÓN
    // ==========================================================================
    function init() {
        // 1. Inicializar base de datos local
        initLocalDatabase();
        
        // 2. Intentar recuperar sesión previa
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

        // 7. Cargar resultados de ArcGIS Server si están disponibles públicamente
        loadResultsFromServer();

        // 8. Renderizar vistas iniciales
        updateGlobalMetrics();

        // 9. Exponer estado globalmente para depuración en la consola del navegador
        window.appState = state;
        window.appConfig = { PARTIES_CONFIG, SECTION_COLEGIO_MAPPING, COLEGIO_DETAILS };
    }

    // Inicializa la base de datos local en localStorage
    function initLocalDatabase() {
        if (!localStorage.getItem("elecciones_mesas")) {
            localStorage.setItem("elecciones_mesas", JSON.stringify(DEFAULT_MESAS));
        }
        state.mesas = JSON.parse(localStorage.getItem("elecciones_mesas"));
        
        // Si no existen colegios cerrados en local, los creamos
        if (!localStorage.getItem("elecciones_colegios_cerrados")) {
            localStorage.setItem("elecciones_colegios_cerrados", JSON.stringify([]));
        }
        rebuildDynamicMappings();
    }

    // Guarda el estado actual de las mesas en localStorage
    function saveLocalDatabase() {
        localStorage.setItem("elecciones_mesas", JSON.stringify(state.mesas));
    }

    // Intenta restaurar sesión de usuario de localStorage
    function restoreSession() {
        const storedUser = localStorage.getItem("elecciones_user");
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                const allowedUsers = ["admineleccionesgenprueba", "jaramaeleccionesgenprueba", "almendroseleccionesgenprueba"];
                if (parsed && parsed.username && allowedUsers.includes(parsed.username.toLowerCase())) {
                    state.currentUser = parsed;
                    state.arcgisMode = localStorage.getItem("elecciones_arcgis_mode") === "true";
                    showLoggedInUserInterface();
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

        // Iniciar Sesión con ArcGIS Portal (Escrutinio Real)
        document.getElementById("btn-login-arcgis").addEventListener("click", () => {
            handleArcGISLogin();
        });



        // Pestañas de la Barra Lateral (Global / Colegios)
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

        document.getElementById("btn-close-edit-mesa-modal").addEventListener("click", () => {
            document.getElementById("modal-admin-edit-mesa").classList.add("hidden");
        });
        document.getElementById("btn-cancel-edit-mesa").addEventListener("click", () => {
            document.getElementById("modal-admin-edit-mesa").classList.add("hidden");
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
        document.getElementById("btn-change-mesa").addEventListener("click", () => {
            // Desasignar mesa localmente y volver
            if (state.selectedMesa) {
                // Si estaba en proceso de escrutinio pero no cerrada, la dejamos "Abierta" en local
                if (state.selectedMesa.estado === "Asignada") {
                    updateMesaState(state.selectedMesa.codigo, "Abierta");
                }
                state.selectedMesa = null;
            }
            showSchoolPortalView();
        });

        // Cambiar Votos: Sumar en vivo
        document.getElementById("portal-votes-fields-container").addEventListener("input", (e) => {
            if (e.target.classList.contains("vote-input-field")) {
                recalculateVotesSum();
            }
        });

        // Enviar escrutinio de mesa
        document.getElementById("btn-submit-mesa").addEventListener("click", handleMesaEscrutinioSubmit);

        // Acciones de Administración
        document.getElementById("btn-admin-logout").addEventListener("click", logoutUser);
        document.getElementById("add-mesa-colegio").addEventListener("change", (e) => {
            updateMesaSeccionDropdown(e.target.value, document.getElementById("add-mesa-seccion"));
        });

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
            
            document.getElementById("modal-admin-add-mesa").classList.remove("hidden");
        });

        document.getElementById("btn-admin-reset-db").addEventListener("click", handleAdminResetDB);
        document.getElementById("btn-admin-demo-fill").addEventListener("click", handleAdminDemoFill);
        document.getElementById("btn-admin-delete-demo-mesas").addEventListener("click", handleAdminDeleteAllMesas);

        // Imprimir acta
        document.getElementById("btn-print-acta").addEventListener("click", () => {
            window.print();
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

        // Sincronizar dinámicamente cuando hay cambios en el almacenamiento (entre pestañas)
        window.addEventListener("storage", (e) => {
            if (e.key === "elecciones_mesas" || e.key === "elecciones_colegios_cerrados") {
                state.mesas = JSON.parse(localStorage.getItem("elecciones_mesas") || "[]");
                updateGlobalMetrics();
                renderMapTheme();
                if (state.currentUser && state.currentUser.role === "admin") {
                    renderAdminPortal();
                }
            }
        });
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
        errorDiv.style.display = "none";

        console.log("Invocando ArcGIS IdentityManager para login real en el portal...");
        
        // IdentityManager.getCredential abrirá la ventana oficial de Login del Portal Enterprise de Rivas
        IdentityManager.getCredential(EDITABLE_SERVICE_URL, {
            forcePermissionPage: false
        }).then(credential => {
            console.log("Autenticación exitosa en Portal ArcGIS. Usuario:", credential.userId);
            const allowed = loginUserSuccess(credential.userId, true);
            if (!allowed) {
                errorDiv.querySelector("span").textContent = `El usuario '${credential.userId}' no tiene permisos asignados en esta aplicación electoral.`;
                errorDiv.style.display = "block";
            }
        }).catch(err => {
            console.warn("Fallo de autenticación en ArcGIS Portal:", err);
            errorDiv.querySelector("span").textContent = "Error al autenticar contra el portal ArcGIS Enterprise.";
            errorDiv.style.display = "block";
        });
    }

    function loginUserSuccess(username, isArcGIS) {
        const allowedUsers = ["admineleccionesgenprueba", "jaramaeleccionesgenprueba", "almendroseleccionesgenprueba"];
        if (!allowedUsers.includes(username.toLowerCase())) {
            console.warn(`Usuario no autorizado intentó acceder: ${username}`);
            
            // Destruir credenciales de ArcGIS
            IdentityManager.destroyCredentials();
            
            // Limpiar estado
            state.currentUser = null;
            state.arcgisMode = false;
            localStorage.removeItem("elecciones_user");
            localStorage.removeItem("elecciones_arcgis_mode");
            
            switchView("login-view");
            return false;
        }

        // Si está autorizado, procedemos
        let userObj = LOCAL_USERS[username];
        if (!userObj) {
            const matchKey = Object.keys(LOCAL_USERS).find(k => k.toLowerCase() === username.toLowerCase());
            userObj = matchKey ? LOCAL_USERS[matchKey] : { role: "colegio", colegio: "C.E.I.P. JARAMA" };
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

        showLoggedInUserInterface();

        // Si estamos en modo ArcGIS, sincronizamos datos
        if (isArcGIS) {
            syncDataWithArcGISServer();
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

    function logoutUser() {
        // Si hay una mesa asignada pero no cerrada, la liberamos
        if (state.selectedMesa && state.selectedMesa.estado === "Asignada") {
            updateMesaState(state.selectedMesa.codigo, "Abierta");
        }

        state.currentUser = null;
        state.selectedMesa = null;
        state.arcgisMode = false;

        localStorage.removeItem("elecciones_user");
        localStorage.removeItem("elecciones_arcgis_mode");

        document.getElementById("logged-user-area").classList.add("hidden");
        
        const btnPortalAction = document.getElementById("btn-portal-action");
        btnPortalAction.classList.remove("btn-danger");
        btnPortalAction.classList.add("btn-primary");
        btnPortalAction.querySelector("span").textContent = "Acceso Portal";
        btnPortalAction.querySelector("i").className = "fa-solid fa-lock";

        // Limpiar canvas
        document.getElementById("canvas-signature-president").clear();
        document.getElementById("canvas-signature-vocal1").clear();
        document.getElementById("canvas-signature-vocal2").clear();

        // Destruir credenciales de ArcGIS si las hubiera
        IdentityManager.destroyCredentials();

        switchView("public-dashboard-view");
    }

    // ==========================================================================
    // PORTAL DE COLEGIO (ESCRUTINIO DE VOTOS)
    // ==========================================================================
    function showSchoolPortalView() {
        const colName = state.currentUser.colegioName;
        const details = COLEGIO_DETAILS[colName];
        
        document.getElementById("portal-colegio-name").textContent = colName;
        document.getElementById("portal-colegio-address").textContent = details?.address || "";

        // Ocultar escrutinio y mostrar selector de mesa
        document.getElementById("portal-escrutinio-container").classList.add("hidden");
        document.getElementById("portal-step-select-mesa").classList.remove("hidden");

        // Listar mesas disponibles (Abiertas) de este colegio
        const grid = document.getElementById("portal-mesas-selection-grid");
        grid.innerHTML = "";

        const colMesas = state.mesas.filter(m => m.colegio === colName);

        if (colMesas.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); font-size:0.9rem; padding:20px;">No hay mesas registradas para este colegio en la administración.</div>`;
            return;
        }

        // Listar solo las que están abiertas para escrutar
        const openMesas = colMesas.filter(m => m.estado === "Abierta");
        
        const stepCard = document.getElementById("portal-step-select-mesa");
        const stepTitle = stepCard ? stepCard.querySelector(".step-title") : null;
        const stepDesc = stepCard ? stepCard.querySelector(".text-secondary") : null;

        if (openMesas.length === 0) {
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

        openMesas.forEach(mesa => {
            const btn = document.createElement("button");
            btn.className = "mesa-btn-select";
            btn.innerHTML = `
                <span class="mesa-btn-code">${mesa.codigo}</span>
                <span class="mesa-btn-census">Sección ${mesa.seccion} (Censo: ${mesa.censo})</span>
            `;
            btn.addEventListener("click", () => {
                selectMesaForScrutiny(mesa);
            });
            grid.appendChild(btn);
        });
    }

    // Selecciona una mesa y bloquea su edición (la pone como "Asignada")
    function selectMesaForScrutiny(mesa) {
        state.selectedMesa = mesa;
        
        // Cambiar estado a "Asignada" en caliente para evitar que otros usuarios del colegio la elijan
        updateMesaState(mesa.codigo, "Asignada");

        // Cargar datos en la UI
        document.getElementById("portal-active-mesa-title").textContent = `Mesa ${mesa.codigo} (Sección ${mesa.seccion})`;
        document.getElementById("portal-active-mesa-census").textContent = `Censo: ${mesa.censo} electores`;

        // Vaciar inputs
        document.getElementById("input-member-president").value = "";
        document.getElementById("input-member-vocal1").value = "";
        document.getElementById("input-member-vocal2").value = "";

        PARTIES_CONFIG.forEach(p => {
            const input = document.getElementById(`input-vote-${p.id}`);
            if (input) input.value = "0";
        });
        document.getElementById("input-vote-blanco").value = "0";
        document.getElementById("input-vote-nulo").value = "0";

        // Limpiar firmas
        document.getElementById("canvas-signature-president").clear();
        document.getElementById("canvas-signature-vocal1").clear();
        document.getElementById("canvas-signature-vocal2").clear();

        recalculateVotesSum();

        // Mostrar formulario y ocultar selector
        document.getElementById("portal-step-select-mesa").classList.add("hidden");
        document.getElementById("portal-escrutinio-container").classList.remove("hidden");
    }

    // Genera inputs de votos dinámicamente
    function generateVoteFields() {
        const container = document.getElementById("portal-votes-fields-container");
        container.innerHTML = "";

        // Partidos
        PARTIES_CONFIG.forEach(p => {
            const card = document.createElement("div");
            card.className = "vote-input-card";
            card.innerHTML = `
                <img src="${p.logo}" alt="Logo ${p.name}" class="party-logo">
                <label for="input-vote-${p.id}">${p.name}</label>
                <input type="number" id="input-vote-${p.id}" class="vote-input-field" value="0" min="0" data-party="${p.id}">
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
            <input type="number" id="input-vote-blanco" class="vote-input-field" value="0" min="0" data-special="blanco">
        `;
        container.appendChild(cardBlanco);

        // Voto nulo
        const cardNulo = document.createElement("div");
        cardNulo.className = "vote-input-card";
        cardNulo.style.backgroundColor = "#f1f5f9";
        cardNulo.innerHTML = `
            <div style="width: 32px; height: 32px; border-radius: 50%; background-color:#95a5a6; border: 1px solid #ccc; flex-shrink:0;"></div>
            <label for="input-vote-nulo">Votos Nulos</label>
            <input type="number" id="input-vote-nulo" class="vote-input-field" value="0" min="0" data-special="nulo">
        `;
        container.appendChild(cardNulo);
    }

    // Calcula el sumatorio en vivo y valida
    function recalculateVotesSum() {
        let sum = 0;
        document.querySelectorAll(".vote-input-field").forEach(input => {
            // Evitar valores negativos: si el usuario escribe un negativo, lo corregimos a 0
            const val = parseInt(input.value, 10) || 0;
            if (val < 0) {
                input.value = 0;
            }
            sum += Math.max(0, val);
        });

        document.getElementById("portal-votes-sum").textContent = sum;

        const valBadge = document.getElementById("portal-votes-validation");
        if (state.selectedMesa) {
            const censo = state.selectedMesa.censo;
            if (sum > censo) {
                valBadge.className = "vote-validation-badge badge-warning";
                valBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Alerta: Votos superan censo (${censo})`;
            } else {
                valBadge.className = "vote-validation-badge badge-success";
                valBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Suma válida`;
            }
        }
    }

    // Enviar escrutinio de mesa (Paso 5)
    function handleMesaEscrutinioSubmit() {
        if (!state.selectedMesa) return;

        // Validar que la suma de votos no supere el censo antes de proceder
        let sumVotos = 0;
        document.querySelectorAll(".vote-input-field").forEach(input => {
            sumVotos += parseInt(input.value, 10) || 0;
        });

        const censoMesa = parseInt(state.selectedMesa.censo, 10) || 0;
        console.log(`[Validación Cierre] Suma de votos: ${sumVotos}, Censo de mesa: ${censoMesa}`);

        if (sumVotos > censoMesa) {
            alert(`Error de validación: El total de votos contabilizados (${sumVotos}) supera el censo electoral de esta mesa (${censoMesa}). No es posible cerrar la mesa con esta incongruencia. Por favor, revise y corrija los valores.`);
            return;
        }

        // Validar campos de texto vacíos
        const presiName = document.getElementById("input-member-president").value.trim();
        const vocal1Name = document.getElementById("input-member-vocal1").value.trim();
        const vocal2Name = document.getElementById("input-member-vocal2").value.trim();

        if (!presiName || !vocal1Name || !vocal2Name) {
            alert("Por favor, rellene los nombres de todos los miembros de la mesa.");
            return;
        }

        // Obtener firmas
        const sigPresi = document.getElementById("canvas-signature-president").getCoordinateString();
        const sigVocal1 = document.getElementById("canvas-signature-vocal1").getCoordinateString();
        const sigVocal2 = document.getElementById("canvas-signature-vocal2").getCoordinateString();

        if (!sigPresi || !sigVocal1 || !sigVocal2) {
            alert("Todos los miembros de la mesa deben realizar su firma digital para proceder.");
            return;
        }

        // Advertencia crítica antes de cerrar
        const confirmClose = confirm("¿Está seguro de que desea CERRAR LA MESA? Esta acción es irreversible, transmitirá los resultados al servidor central y bloqueará posteriores modificaciones.");
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
            targetMesa.firma_presi = sigPresi;
            targetMesa.firma_vocal1 = sigVocal1;
            targetMesa.firma_vocal2 = sigVocal2;
        }

        saveLocalDatabase();

        // SI ESTAMOS EN MODO ARCGIS: enviar cambios mediante applyEdits
        if (state.arcgisMode) {
            sendMesaToArcGISServer(targetMesa);
        } else {
            // Modo local: Confirmación exitosa e ir al listado de mesas
            alert(`¡Mesa ${targetMesa.codigo} cerrada con éxito en local!`);
            state.selectedMesa = null;
            showSchoolPortalView();
            updateGlobalMetrics();
        }
    }

    // Actualiza el estado de una mesa por código ("Abierta", "Asignada", etc.)
    function updateMesaState(codigo, nuevoEstado) {
        const target = state.mesas.find(m => m.codigo === codigo);
        if (target) {
            target.estado = nuevoEstado;
            saveLocalDatabase();
            // Notificar a otras pestañas si se abre/cierra
            localStorage.setItem("elecciones_refresh_trigger", Date.now().toString());
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

        // Calcular votos válidos acumulados
        let totalVotes = 0;
        let censoAcumulado = 0;
        state.mesas.forEach(m => {
            if (m.estado === "Cerrada") {
                PARTIES_CONFIG.forEach(p => {
                    totalVotes += (m[p.field] || 0);
                });
                totalVotes += (m.votos_blancos || 0);
                censoAcumulado += m.censo;
            }
        });

        document.getElementById("admin-metric-votos-total").textContent = totalVotes.toLocaleString();
        
        const partPercent = censoAcumulado > 0 ? ((totalVotes / censoAcumulado) * 100).toFixed(2) : "0.00";
        document.getElementById("admin-metric-participation").textContent = `${partPercent}%`;

        // Renderizar Colegios con botones de Cierre
        renderAdminColegiosList();

        // Renderizar Tabla de Mesas
        renderAdminMesasTable();
    }

    function renderAdminColegiosList() {
        const container = document.getElementById("admin-colegios-summary-container");
        container.innerHTML = "";

        // Obtener colegios de las mesas configuradas
        const colegios = [...new Set(state.mesas.map(m => m.colegio))];
        const colegiosCerrados = JSON.parse(localStorage.getItem("elecciones_colegios_cerrados") || "[]");

        colegios.forEach(colName => {
            const colMesas = state.mesas.filter(m => m.colegio === colName);
            const total = colMesas.length;
            const closed = colMesas.filter(m => m.estado === "Cerrada").length;
            const isClosed = colegiosCerrados.includes(colName);

            const card = document.createElement("div");
            card.className = "admin-colegio-card";
            
            let buttonHtml = "";
            if (isClosed) {
                buttonHtml = `
                    <button class="btn-header btn-secondary" onclick="printSchoolAct('${colName}')" style="font-size:0.8rem; padding:6px 12px;">
                        <i class="fa-solid fa-print"></i> Imprimir Acta del Colegio
                    </button>
                `;
            } else if (closed === total && total > 0) {
                // Habilitado para cerrar
                buttonHtml = `
                    <button class="btn-header btn-primary btn-close-school" data-colegio="${colName}" style="font-size:0.8rem; padding:6px 12px; background-color:#10b981;">
                        <i class="fa-solid fa-circle-check"></i> Cerrar Colegio Electoral
                    </button>
                `;
            } else {
                buttonHtml = `
                    <button class="btn-header btn-secondary" style="font-size:0.8rem; padding:6px 12px; opacity:0.5; cursor:not-allowed;" disabled>
                        Esperando Mesas (${closed}/${total})
                    </button>
                `;
            }

            const isSchoolScrutinized = (closed === total && total > 0);
            const showClosed = isClosed || isSchoolScrutinized;
            const statusText = isClosed ? 'CERRADO DEFINITIVO' : (isSchoolScrutinized ? 'CERRADO' : `ABIERTO (${closed}/${total})`);

            card.innerHTML = `
                <div class="admin-colegio-header">
                    <span class="admin-colegio-title">${colName}</span>
                    <span class="admin-colegio-status ${showClosed ? 'status-closed' : 'status-open'}">
                        ${statusText}
                    </span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.8rem; color:var(--text-secondary);">
                        Censo total del centro: <strong>${colMesas.reduce((acc, m) => acc + m.censo, 0).toLocaleString()}</strong> electores.
                    </div>
                    ${buttonHtml}
                </div>
            `;
            container.appendChild(card);
        });

        // Añadir eventos a botones de cerrar colegio
        container.querySelectorAll(".btn-close-school").forEach(btn => {
            btn.addEventListener("click", function() {
                const colName = this.getAttribute("data-colegio");
                handleAdminCloseSchool(colName);
            });
        });
    }

    function renderAdminMesasTable() {
        const tbody = document.getElementById("admin-mesas-table-body");
        tbody.innerHTML = "";

        state.mesas.forEach(mesa => {
            const tr = document.createElement("tr");

            let statusClass = "status-open";
            let statusText = "Abierta";
            if (mesa.estado === "Cerrada") {
                statusClass = "status-closed";
                statusText = "Cerrada";
            } else if (mesa.estado === "Asignada") {
                statusClass = "status-open";
                statusText = "Asignando...";
            }

            let actionButtons = "";
            if (mesa.estado === "Cerrada") {
                actionButtons = `
                    <button class="admin-btn-action btn-view-acta" data-codigo="${mesa.codigo}" title="Ver Acta Firmada">
                        <i class="fa-solid fa-file-signature" style="color: var(--primary-color);"></i>
                    </button>
                `;
            } else {
                actionButtons = `
                    <button class="admin-btn-action btn-edit-mesa" data-codigo="${mesa.codigo}" title="Modificar Censo">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
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
                <td><span class="status-badge-inline ${statusClass}">${statusText}</span></td>
                <td style="text-align: right; white-space: nowrap;">${actionButtons}</td>
            `;

            tbody.appendChild(tr);
        });

        // Vincular eventos de la tabla
        tbody.querySelectorAll(".btn-view-acta").forEach(btn => {
            btn.addEventListener("click", function() {
                const cod = this.getAttribute("data-codigo");
                viewMesaActa(cod);
            });
        });

        tbody.querySelectorAll(".btn-edit-mesa").forEach(btn => {
            btn.addEventListener("click", function() {
                const cod = this.getAttribute("data-codigo");
                editMesaPrompt(cod);
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

        const cod = sec + letMesa;

        // Comprobar duplicado
        if (state.mesas.some(m => m.codigo === cod)) {
            alert(`Error: La mesa con código ${cod} ya existe en el censo.`);
            return;
        }

        const nuevaMesa = {
            codigo: cod,
            seccion: sec,
            mesa: letMesa,
            colegio: col,
            votos_pp: 0,
            votos_psoe: 0,
            votos_vox: 0,
            votos_sumar: 0,
            votos_up: 0,
            votos_cs: 0,
            votos_pacma: 0,
            votos_salf: 0,
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

        state.mesas.push(nuevaMesa);
        localStorage.removeItem("elecciones_mesas_vacias");
        saveLocalDatabase();
        
        // SI ESTAMOS EN MODO ARCGIS: enviar adición al servidor
        if (state.arcgisMode) {
            sendMesaAddToServer(nuevaMesa);
        } else {
            alert(`Mesa ${cod} añadida correctamente en local.`);
            document.getElementById("modal-admin-add-mesa").classList.add("hidden");
            renderAdminPortal();
            updateGlobalMetrics();
            renderMapTheme();
        }
    }



    function deleteMesaPrompt(codigo) {
        const conf = confirm(`¿Está seguro de que desea ELIMINAR la Mesa ${codigo}?`);
        if (!conf) return;

        const target = state.mesas.find(m => m.codigo === codigo);
        if (state.arcgisMode && target && target.objectid !== null) {
            sendMesaDeleteToServer(target);
        } else {
            state.mesas = state.mesas.filter(m => m.codigo !== codigo);
            saveLocalDatabase();
            renderAdminPortal();
            updateGlobalMetrics();
            renderMapTheme();
        }
    }

    // Eliminar TODAS las mesas generadas (útil para volver a crearlas manualmente)
    function handleAdminDeleteAllMesas() {
        const conf = confirm(
            "ATENCIÓN: Se van a ELIMINAR todas las mesas del sistema (tanto locales como en el servidor remoto de ArcGIS).\n\n" +
            "Esta acción vaciará completamente la tabla y no se puede deshacer. ¿Desea continuar?"
        );
        if (!conf) return;

        // Establecer flag para evitar recarga de datos antiguos de ArcGIS Server público
        localStorage.setItem("elecciones_mesas_vacias", "true");

        // SI ESTAMOS EN MODO ARCGIS: consultar y borrar todos los registros de la tabla del servidor en bloque
        if (state.arcgisMode) {
            console.log("Consultando todas las mesas en el servidor ArcGIS para su eliminación...");
            const tablesLayer = new FeatureLayer({ 
                url: URL_MESAS_TABLE_EDIT,
                outFields: ["*"]
            });
            
            tablesLayer.load().then(() => {
                const query = tablesLayer.createQuery();
                query.where = "1=1";
                query.outFields = ["*"];
                
                tablesLayer.queryFeatures(query).then(results => {
                    if (results.features.length > 0) {
                        console.log(`Eliminando ${results.features.length} registros del servidor ArcGIS...`);
                        tablesLayer.applyEdits({
                            deleteFeatures: results.features
                        }).then(result => {
                            console.log("Servidor ArcGIS completamente vaciado:", result);
                            alert("Se han eliminado todas las mesas del servidor de ArcGIS y en local.");
                            
                            // Vaciar localmente tras el borrado remoto exitoso
                            state.mesas = [];
                            saveLocalDatabase();
                            localStorage.setItem("elecciones_colegios_cerrados", JSON.stringify([]));
                            
                            renderAdminPortal();
                            updateGlobalMetrics();
                            renderMapTheme();
                        }).catch(err => {
                            console.error("Error al vaciar la tabla en ArcGIS Server (applyEdits):", err);
                            alert("Se detectó un error al vaciar los registros del servidor remoto.");
                        });
                    } else {
                        console.log("La tabla del servidor de ArcGIS ya estaba vacía.");
                        // Vaciar localmente
                        state.mesas = [];
                        saveLocalDatabase();
                        localStorage.setItem("elecciones_colegios_cerrados", JSON.stringify([]));
                        
                        renderAdminPortal();
                        updateGlobalMetrics();
                        renderMapTheme();
                    }
                }).catch(err => {
                    console.error("Error al ejecutar queryFeatures en ArcGIS Server:", err);
                    alert("No se pudieron recuperar los registros del servidor remoto.");
                });
            }).catch(err => {
                console.error("Error al cargar la capa FeatureLayer (load) de ArcGIS:", err);
                alert("No se pudo conectar con el servidor remoto para vaciar la tabla.");
            });
        } else {
            // Vaciar todas las mesas en local
            state.mesas = [];
            saveLocalDatabase();
            localStorage.setItem("elecciones_colegios_cerrados", JSON.stringify([]));
            alert("Todas las mesas locales han sido eliminadas.");
            
            renderAdminPortal();
            updateGlobalMetrics();
            renderMapTheme();
        }
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
                const attrs = {
                    codigo: m.codigo,
                    seccion: m.seccion,
                    mesa: m.mesa,
                    colegio: m.colegio,
                    votos_blancos: m.votos_blancos,
                    votos_nulos: m.votos_nulos,
                    miembros: m.miembros,
                    estado: m.estado,
                    firma_presi: m.firma_presi,
                    firma_vocal1: m.firma_vocal1,
                    firma_vocal2: m.firma_vocal2,
                    censo: m.censo
                };
                PARTIES_CONFIG.forEach(p => {
                    attrs[p.field] = m[p.field];
                });

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
        // Contar censo y escrutinio
        const totalMesas = state.mesas.length;
        const closedMesas = state.mesas.filter(m => m.estado === "Cerrada").length;
        const progress = totalMesas > 0 ? ((closedMesas / totalMesas) * 100).toFixed(2) : "0.00";

        // Actualizar header y sidebar
        document.getElementById("header-scrutiny-percent").textContent = `${progress}%`;
        document.getElementById("global-scrutiny-val").textContent = `${progress}%`;
        document.getElementById("global-scrutiny-bar").style.width = `${progress}%`;
        document.getElementById("global-mesas-ratio").textContent = `${closedMesas} de ${totalMesas} mesas cerradas`;

        // Calcular censo acumulado y votos de las mesas CERRADAS
        let totalCensus = 0;
        let totalNulos = 0;
        let totalBlancos = 0;
        let totalVotosValidos = 0;

        const partyTotals = {};
        PARTIES_CONFIG.forEach(p => { partyTotals[p.id] = 0; });

        state.mesas.forEach(m => {
            if (m.estado === "Cerrada") {
                totalCensus += m.censo;
                totalNulos += m.votos_nulos;
                totalBlancos += m.votos_blancos;
                totalVotosValidos += m.votos_blancos; // Voto en blanco cuenta como válido en España

                PARTIES_CONFIG.forEach(p => {
                    const v = m[p.field] || 0;
                    partyTotals[p.id] += v;
                    totalVotosValidos += v;
                });
            }
        });

        // Votos emitidos totales
        const totalVotosEmitidos = totalVotosValidos + totalNulos;

        document.getElementById("global-census-val").textContent = totalCensus.toLocaleString();
        
        const partPercent = totalCensus > 0 ? ((totalVotosEmitidos / totalCensus) * 100).toFixed(2) : "0.00";
        document.getElementById("global-participation-val").textContent = `${partPercent}%`;
        document.getElementById("global-participation-bar").style.width = `${partPercent}%`;

        // Votos en Blanco y Nulo
        const nuloPercent = totalVotosEmitidos > 0 ? ((totalNulos / totalVotosEmitidos) * 100).toFixed(2) : "0.00";
        document.getElementById("global-nulos-val").innerHTML = `${totalNulos.toLocaleString()} <span style="font-size: 0.75rem; font-weight:400; color: var(--text-muted);">(${nuloPercent}%)</span>`;

        const blancoPercent = totalVotosValidos > 0 ? ((totalBlancos / totalVotosValidos) * 100).toFixed(2) : "0.00";
        document.getElementById("global-blancos-val").innerHTML = `${totalBlancos.toLocaleString()} <span style="font-size: 0.75rem; font-weight:400; color: var(--text-muted);">(${blancoPercent}%)</span>`;

        // Renderizar partidos en el sidebar
        renderPartiesRanking(partyTotals, totalVotosValidos);

        // Renderizar colegios en el sidebar
        renderColegiosTab();
    }

    function renderPartiesRanking(partyTotals, totalVotosValidos) {
        const container = document.getElementById("global-parties-container");
        container.innerHTML = "";

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
            let colVotos = 0;
            let colCenso = 0;
            const colPartyVotes = {};
            PARTIES_CONFIG.forEach(p => { colPartyVotes[p.id] = 0; });

            colMesas.forEach(m => {
                if (m.estado === "Cerrada") {
                    colCenso += m.censo;
                    PARTIES_CONFIG.forEach(p => {
                        const v = m[p.field] || 0;
                        colPartyVotes[p.id] += v;
                        colVotos += v;
                    });
                    colVotos += (m.votos_blancos || 0);
                }
            });

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
            const partRate = colCenso > 0 ? ((colVotos / colCenso) * 100).toFixed(1) : "0.0";

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
                ${closedMesas > 0 && winnerParty ? `
                    <div class="colegio-item-winner" style="background-color: ${winnerParty.color};" title="Gana ${winnerParty.name}">
                        ${winnerParty.name.substring(0, 2)}
                    </div>
                ` : `
                    <div class="colegio-item-winner" style="background-color: #cbd5e1; color:#64748b;" title="Sin datos">
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
        const colCensoTotal = colMesas.reduce((acc, m) => acc + m.censo, 0);
        
        // Censo de las mesas que ya están cerradas (escrutadas) para el cálculo de la participación
        const colCensoEscrutado = colMesas.filter(m => m.estado === "Cerrada").reduce((acc, m) => acc + m.censo, 0);
        
        let colVotes = 0;
        const colPartyVotes = {};
        PARTIES_CONFIG.forEach(p => { colPartyVotes[p.id] = 0; });

        colMesas.forEach(m => {
            if (m.estado === "Cerrada") {
                PARTIES_CONFIG.forEach(p => {
                    const v = m[p.field] || 0;
                    colPartyVotes[p.id] += v;
                    colVotes += v;
                });
                colVotes += m.votos_blancos;
            }
        });

        document.getElementById("modal-colegio-census-val").textContent = colCensoTotal.toLocaleString();
        
        const partRate = colCensoEscrutado > 0 ? ((colVotes / colCensoEscrutado) * 100).toFixed(2) : "0.00";
        document.getElementById("modal-colegio-participation-val").textContent = `${partRate}%`;
        document.getElementById("modal-colegio-mesas-val").textContent = `${closedMesas} de ${totalMesas}`;

        // Listado de partidos en el colegio
        const partiesContainer = document.getElementById("modal-colegio-parties-container");
        partiesContainer.innerHTML = "";

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

        // 1. Agrupar votos de mesas cerradas por SECCIÓN CENSAL
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

        console.log("=== RENDER MAP THEME (GRAPHICS) ===");
        console.log("Ganadores por sección:", JSON.stringify(seccionWinners));
        console.log("Secciones en caché:", geomsCache.length);
        if (state.map) {
            console.log("Capas en el mapa:");
            state.map.layers.forEach((l, idx) => {
                console.log(` - [${idx}] ID: ${l.id}, Visible: ${l.visible}, Type: ${l.declaredClass}`);
            });
        }

        // Determinar nombre del campo de sección en atributos
        let rendererFieldName = "SECCION";
        if (geomsCache[0]) {
            const attrs = geomsCache[0].attributes;
            for (const f of ["SECCION", "seccion", "SECC", "secc", "Seccion", "Secc"]) {
                if (attrs[f] !== undefined) { rendererFieldName = f; break; }
            }
        }
        console.log("Campo de sección detectado:", rendererFieldName);

        // 2. OCULTAR el FeatureLayer completamente — ya no necesitamos que renderice.
        //    Los popups se gestionarán desde los propios gráficos del colorLayer.
        if (state.seccionesLayer) {
            state.seccionesLayer.visible = false;
        }

        // 3. Limpiar capas de gráficos previas
        state.labelsLayer.removeAll();

        // 4. Obtener o crear la capa de polígonos de color.
        //    Cada gráfico lleva su propio popupTemplate para que el popup funcione
        //    sin depender del FeatureLayer oculto.
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
            content: function(feature) {
                return getPopupContent(feature.graphic.attributes);
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
                    fillColor = [180, 180, 180, 0.45];
                }
            } else {
                fillColor = [180, 180, 180, 0.45];
            }

            // Cada gráfico lleva los atributos originales más SECCION normalizada
            // y su propio popupTemplate para el popup electoral
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

            // --- Logo del partido ganador en el centroide ---
            if (!winnerPartyId) return;
            const winParty = PARTIES_CONFIG.find(p => p.id === winnerPartyId);
            if (!winParty) return;

            let centroid = geom.centroid;
            if (!centroid) centroid = getFallbackCentroid(geom);
            if (!centroid) return;

            let markerSymbol;
            if (winParty.logo) {
                markerSymbol = new PictureMarkerSymbol({
                    url: baseUrl + winParty.logo,
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
        
        // 1. Calcular votos totales municipales por partido
        const partyVotes = {};
        PARTIES_CONFIG.forEach(p => { partyVotes[p.id] = 0; });
        
        let totalValidos = 0;
        state.mesas.forEach(m => {
            totalValidos += m.votos_blancos;
            PARTIES_CONFIG.forEach(p => {
                const v = m[p.field] || 0;
                partyVotes[p.id] += v;
                totalValidos += v;
            });
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

    // Retorna el contenido del Popup de sección censal dinámicamente (estilo Ficha Premium)
    function getPopupContent(attrs) {
        const secAttr = getAttributeValue(attrs, "SECCION") || getAttributeValue(attrs, "SECC");
        const secCode = normalizeSeccion(secAttr);
        const colName = SECTION_COLEGIO_MAPPING[secCode] || "Colegio Electoral";
        const details = COLEGIO_DETAILS[colName];
        
        // Sumar mesas de esta sección
        const secMesas = state.mesas.filter(m => m.seccion === secCode);
        const totalCensus = secMesas.reduce((acc, m) => acc + m.censo, 0);
        
        let votesTotal = 0;
        let nulos = 0;
        let blancos = 0;
        const pVotes = {};
        PARTIES_CONFIG.forEach(p => { pVotes[p.id] = 0; });

        secMesas.forEach(m => {
            if (m.estado === "Cerrada") {
                nulos += m.votos_nulos;
                blancos += m.votos_blancos;
                votesTotal += m.votos_blancos;
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
        const partPercent = totalCensus > 0 ? ((totalVotesEmitidos / totalCensus) * 100).toFixed(2) : "0.00";

        const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

        // HTML de la imagen del colegio usando URL ABSOLUTA para evitar restricciones de sandbox de ArcGIS
        let imageHtml = "";
        const imgUrl = details?.image ? (baseUrl + details.image) : (baseUrl + "Iconos/Logo_OITR.png");
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

        const miembros = JSON.parse(mesa.miembros || '{"presi":"","vocal1":"","vocal2":""}');

        // Sumatorios
        let totalValidos = mesa.votos_blancos;
        PARTIES_CONFIG.forEach(p => { totalValidos += (mesa[p.field] || 0); });
        const totalEmitidos = totalValidos + mesa.votos_nulos;

        // Generar HTML del Acta para el visor
        const bodyContainer = document.getElementById("modal-acta-body-content");
        
        let tableRowsHtml = "";
        const sortedParties = [...PARTIES_CONFIG].sort((a, b) => {
            const votesA = mesa[a.field] || 0;
            const votesB = mesa[b.field] || 0;
            return votesB - votesA;
        });

        sortedParties.forEach(p => {
            const v = mesa[p.field] || 0;
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

        bodyContainer.innerHTML = `
            <div style="font-family: var(--font-body); color:#000;">
                <div style="text-align:center; margin-bottom:15px; border-bottom:2px solid #000; padding-bottom:10px;">
                    <h4 style="text-transform:uppercase; font-size:0.75rem; letter-spacing:1px; color:var(--primary-color); margin-bottom:2px;">Escrutinio Oficial</h4>
                    <h3 style="font-size:1.35rem; font-family:var(--font-heading);">ACTA DE ESCRUTINIO DE MESA</h3>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.8rem; margin-bottom:15px; background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:6px;">
                    <div><strong>Colegio:</strong> ${mesa.colegio}</div>
                    <div><strong>Código de Mesa:</strong> ${mesa.codigo}</div>
                    <div><strong>Sección Censal:</strong> ${mesa.seccion}</div>
                    <div><strong>Censo Electoral:</strong> ${mesa.censo} electores</div>
                </div>

                <div style="font-weight:700; margin-bottom:6px; font-size:0.85rem; border-bottom:1px solid #cbd5e1; padding-bottom:3px;">Miembros de la Mesa</div>
                <div style="font-size:0.8rem; margin-bottom:15px; display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
                    <div><strong>Presidente:</strong><br>${miembros.presi}</div>
                    <div><strong>Vocal 1:</strong><br>${miembros.vocal1}</div>
                    <div><strong>Vocal 2:</strong><br>${miembros.vocal2}</div>
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
                            <td style="text-align:right;">${mesa.votos_blancos.toLocaleString()}</td>
                            <td style="text-align:right;">${totalValidos > 0 ? ((mesa.votos_blancos / totalValidos) * 100).toFixed(2) : '0.00'}%</td>
                        </tr>
                        <tr style="border-top:1px solid #cbd5e1;">
                            <td style="color:var(--text-muted);">Votos Nulos</td>
                            <td style="text-align:right;">${mesa.votos_nulos.toLocaleString()}</td>
                            <td style="text-align:right; color:var(--text-muted);">-</td>
                        </tr>
                        <tr style="border-top:2px solid #000; font-weight:800; font-size:0.85rem; background:#f8fafc;">
                            <td>TOTAL EMITIDOS</td>
                            <td style="text-align:right; color:var(--primary-color);">${totalEmitidos.toLocaleString()}</td>
                            <td style="text-align:right;">Participación: ${mesa.censo > 0 ? ((totalEmitidos / mesa.censo) * 100).toFixed(2) : '0.00'}%</td>
                        </tr>
                    </tbody>
                </table>

                <div style="font-weight:700; margin-bottom:6px; font-size:0.85rem; border-bottom:1px solid #cbd5e1; padding-bottom:3px;">Firmas Conformidad</div>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:10px;">
                    <div style="border:1px solid #e2e8f0; border-radius:6px; padding:6px; text-align:center; background:#fff;">
                        <span style="font-size:0.65rem; font-weight:700; text-transform:uppercase; color:var(--text-secondary);">Presidente/a</span>
                        <div style="height:60px; display:flex; align-items:center; justify-content:center;">${svgPresi}</div>
                    </div>
                    <div style="border:1px solid #e2e8f0; border-radius:6px; padding:6px; text-align:center; background:#fff;">
                        <span style="font-size:0.65rem; font-weight:700; text-transform:uppercase; color:var(--text-secondary);">Primer Vocal</span>
                        <div style="height:60px; display:flex; align-items:center; justify-content:center;">${svgVocal1}</div>
                    </div>
                    <div style="border:1px solid #e2e8f0; border-radius:6px; padding:6px; text-align:center; background:#fff;">
                        <span style="font-size:0.65rem; font-weight:700; text-transform:uppercase; color:var(--text-secondary);">Segundo Vocal</span>
                        <div style="height:60px; display:flex; align-items:center; justify-content:center;">${svgVocal2}</div>
                    </div>
                </div>
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
        
        printContainer.innerHTML = `
            <div class="acta-header">
                <img src="Imagenes/Logo_OITR.png" class="acta-logo-oitr" alt="Ayuntamiento Rivas">
                <div class="acta-header-title">
                    <h1>AYUNTAMIENTO DE RIVAS-VACIAMADRID</h1>
                    <p>OFICINA DE INFORMACIÓN TERRITORIAL (OITR) - ELECCIONES GENERALES</p>
                </div>
            </div>

            <div style="font-size:14px; font-weight:800; border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:15px; text-transform:uppercase;">
                Acta de Escrutinio y Transmisión de Resultados Electorales
            </div>

            <div class="acta-metadata-grid">
                <div class="acta-metadata-item">
                    <strong>Colegio Electoral</strong>
                    <span>${mesa.colegio}</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Código de Mesa</strong>
                    <span>${mesa.codigo}</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Sección Censal</strong>
                    <span>Sección ${mesa.seccion}</span>
                </div>
                <div class="acta-metadata-item">
                    <strong>Censo Electoral de la Mesa</strong>
                    <span>${mesa.censo.toLocaleString()} electores</span>
                </div>
            </div>

            <div class="acta-title-section">Miembros que suscriben el Acta</div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; font-size:11px; margin-bottom:20px;">
                <div><strong>Presidente/a:</strong><br>${miembros.presi}</div>
                <div><strong>Primer Vocal:</strong><br>${miembros.vocal1}</div>
                <div><strong>Segundo Vocal:</strong><br>${miembros.vocal2}</div>
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
                        <td class="align-right">${mesa.votos_blancos.toLocaleString()}</td>
                        <td style="text-align:right;">${totalValidos > 0 ? ((mesa.votos_blancos / totalValidos) * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                    <tr style="color:#333;">
                        <td>Votos Nulos</td>
                        <td class="align-right">${mesa.votos_nulos.toLocaleString()}</td>
                        <td style="text-align:right;">-</td>
                    </tr>
                    <tr style="border-top:3px double #000; font-weight:800; font-size:13px; background-color:#eee !important;">
                        <td>TOTAL EMITIDOS (Votos en Urna)</td>
                        <td class="align-right">${totalEmitidos.toLocaleString()}</td>
                        <td style="text-align:right;">Participación: ${mesa.censo > 0 ? ((totalEmitidos / mesa.censo) * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                </tbody>
            </table>

            <div class="acta-title-section">Firmas Conformidad de los Miembros</div>
            <div class="acta-signatures-block">
                <div class="acta-signature-box">
                    <strong>Presidente/a</strong>
                    ${svgPresi}
                    <span>Fdo: ${miembros.presi}</span>
                </div>
                <div class="acta-signature-box">
                    <strong>Primer Vocal</strong>
                    ${svgVocal1}
                    <span>Fdo: ${miembros.vocal1}</span>
                </div>
                <div class="acta-signature-box">
                    <strong>Segundo Vocal</strong>
                    ${svgVocal2}
                    <span>Fdo: ${miembros.vocal2}</span>
                </div>
            </div>

            <div class="acta-footer">
                Documento oficial generado e informatizado de forma segura.<br>
                Fecha de escrutinio oficial: ${new Date().toLocaleDateString('es-ES')} - Rivas-Vaciamadrid, Madrid.
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
                    <p>OFICINA DE INFORMACIÓN TERRITORIAL (OITR) - ELECCIONES GENERALES</p>
                </div>
            </div>

            <div style="font-size:14px; font-weight:800; border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:15px; text-transform:uppercase;">
                Acta de Cierre Agregado de Centro de Votación
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

            <div class="acta-title-section" style="page-break-inside: avoid;">Certificación de Administración</div>
            <div style="font-size:11px; line-height:1.5; margin-bottom:30px; page-break-inside: avoid;">
                Por la presente, el Administrador General de las Elecciones de Rivas-Vaciamadrid certifica que habiéndose cerrado y escrutado conformes el 100% de las mesas constituidas en este colegio electoral, se procedió al bloqueo e integración definitiva de sus datos electorales en el portal del Ayuntamiento.
            </div>

            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; page-break-inside: avoid; text-align:center;">
                <div></div>
                <div style="border: 1px solid #000; padding:15px; height:120px; display:flex; flex-direction:column; justify-content:space-between;">
                    <strong style="font-size:10px; text-transform:uppercase;">Firma del Administrador</strong>
                    <div style="font-family:'Outfit', cursive; font-size:18px; color:#555; text-align:center; font-style:italic;">AdminEleccionesGenPrueba</div>
                    <span>Cierre de Colegio</span>
                </div>
                <div></div>
            </div>

            <div class="acta-footer">
                Documento oficial consolidado e informatizado de forma segura.<br>
                Fecha de consolidación: ${new Date().toLocaleDateString('es-ES')} - Rivas-Vaciamadrid, Madrid.
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

    function editMesaPrompt(codigo) {
        const target = state.mesas.find(m => m.codigo === codigo);
        if (!target) return;

        // Mostrar el modal de edición y poner título
        document.getElementById("edit-mesa-code-title").textContent = codigo;
        
        // Rellenar colegios
        const selectCol = document.getElementById("edit-mesa-colegio");
        selectCol.innerHTML = "";
        for (const colName in COLEGIO_DETAILS) {
            const opt = document.createElement("option");
            opt.value = colName;
            opt.textContent = colName;
            if (colName === target.colegio) {
                opt.selected = true;
            }
            selectCol.appendChild(opt);
        }

        // Rellenar secciones basadas en el colegio
        const selectSec = document.getElementById("edit-mesa-seccion");
        updateMesaSeccionDropdown(target.colegio, selectSec, target.seccion);

        // Censo
        document.getElementById("edit-mesa-census").value = target.censo;

        // Registrar manejador de cambio de colegio (usar clon para evitar duplicados)
        const newSelectCol = selectCol.cloneNode(true);
        selectCol.parentNode.replaceChild(newSelectCol, selectCol);
        newSelectCol.addEventListener("change", (e) => {
            updateMesaSeccionDropdown(e.target.value, document.getElementById("edit-mesa-seccion"));
        });

        // Registrar manejador de submit (usar clon)
        const form = document.getElementById("form-admin-edit-mesa");
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const selectedCol = newSelectCol.value;
            const selectedSec = document.getElementById("edit-mesa-seccion").value;
            const newCensus = parseInt(document.getElementById("edit-mesa-census").value, 10);

            if (isNaN(newCensus) || newCensus <= 0) {
                alert("Censo no válido.");
                return;
            }

            // Actualizar objeto mesa
            target.colegio = selectedCol;
            target.seccion = selectedSec;
            target.censo = newCensus;

            saveLocalDatabase();
            rebuildDynamicMappings();

            if (state.arcgisMode) {
                sendMesaUpdateToServer(target);
                document.getElementById("modal-admin-edit-mesa").classList.add("hidden");
            } else {
                alert(`Mesa ${codigo} modificada correctamente.`);
                document.getElementById("modal-admin-edit-mesa").classList.add("hidden");
                renderAdminPortal();
                updateGlobalMetrics();
                renderMapTheme();
            }
        });

        document.getElementById("modal-admin-edit-mesa").classList.remove("hidden");
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
                    <p>OFICINA DE INFORMACIÓN TERRITORIAL (OITR) - ELECCIONES GENERALES</p>
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

    // Descarga resultados públicos desde el servidor de ArcGIS de forma anónima (para el Visor Público)
    function loadResultsFromServer() {
        if (localStorage.getItem("elecciones_mesas_vacias") === "true") {
            console.log("Las mesas han sido vaciadas manualmente. Omitiendo la descarga de datos anteriores del servidor público.");
            return;
        }
        
        console.log("Intentando descargar resultados públicos desde ArcGIS Server...");
        console.log("URL de la tabla de mesas pública:", URL_MESAS_TABLE);
        
        try {
            const tablesLayer = new FeatureLayer({
                url: URL_MESAS_TABLE,
                outFields: ["*"]
            });
            console.log("Objeto tablesLayer de FeatureLayer creado.");

            tablesLayer.load().then(() => {
                console.log("tablesLayer.load() -> ¡Cargada correctamente!");
                
                const query = tablesLayer.createQuery();
                query.where = "1=1";
                query.outFields = ["*"];

                console.log("Lanzando queryFeatures sobre la tabla de mesas...");
                tablesLayer.queryFeatures(query).then(results => {
                    console.log(`Resultados públicos: se descargaron ${results.features.length} mesas.`);
                    if (results.features.length > 0) {
                        const serverMesas = [];
                        results.features.forEach(feat => {
                            const attrs = feat.attributes;
                            const cod = getAttributeValue(attrs, "codigo");
                            if (!cod) return;
                            
                            const mesaObj = {
                                codigo: cod,
                                seccion: getSeccionFromAttributes(attrs, cod),
                                mesa: getAttributeValue(attrs, "mesa"),
                                colegio: getAttributeValue(attrs, "colegio"),
                                votos_blancos: parseInt(getAttributeValue(attrs, "votos_blancos"), 10) || 0,
                                votos_nulos: parseInt(getAttributeValue(attrs, "votos_nulos"), 10) || 0,
                                miembros: getAttributeValue(attrs, "miembros") || "",
                                estado: getAttributeValue(attrs, "estado") || "Abierta",
                                firma_presi: getAttributeValue(attrs, "firma_presi") || "",
                                firma_vocal1: getAttributeValue(attrs, "firma_vocal1") || "",
                                firma_vocal2: getAttributeValue(attrs, "firma_vocal2") || "",
                                censo: parseInt(getAttributeValue(attrs, "censo"), 10) || 500,
                                objectid: getAttributeValue(attrs, "objectid") || getAttributeValue(attrs, "OBJECTID") || getAttributeValue(attrs, "FID")
                            };
                            PARTIES_CONFIG.forEach(p => {
                                mesaObj[p.field] = parseInt(getAttributeValue(attrs, p.field), 10) || 0;
                            });
                            serverMesas.push(mesaObj);
                        });
                        
                        state.mesas = serverMesas;
                        rebuildDynamicMappings();
                        saveLocalDatabase();
                        updateGlobalMetrics();
                        renderMapTheme();
                    } else {
                        console.log("La tabla de mesas pública no devolvió ningún registro.");
                    }
                }).catch(err => {
                    console.error("Error en queryFeatures de la tabla de mesas pública:", err);
                });
            }).catch(err => {
                console.error("tablesLayer.load() -> Error de carga de la tabla pública:", err);
                if (err) {
                    console.error("Error de carga mensaje:", err.message);
                    console.error("Error de carga detalles:", JSON.stringify(err.details));
                }
            });
        } catch (e) {
            console.error("Excepción al instanciar FeatureLayer de la tabla pública:", e);
        }
    }
    
    // Al autenticar con ArcGIS, descargamos los registros actuales del servidor para acoplarlos
    function syncDataWithArcGISServer() {
        if (!state.arcgisMode) return;

        console.log("Iniciando sincronización con ArcGIS Feature Server...");

        const tablesLayer = new FeatureLayer({
            url: URL_MESAS_TABLE_EDIT,
            outFields: ["*"]
        });

        const query = tablesLayer.createQuery();
        query.where = "1=1";
        query.outFields = ["*"];

        tablesLayer.queryFeatures(query).then(results => {
            console.log(`Se recuperaron ${results.features.length} mesas del servidor ArcGIS.`);
            
            if (results.features.length > 0) {
                // Mapear features del servidor a nuestro estado
                results.features.forEach(feat => {
                    const attrs = feat.attributes;
                    const cod = getAttributeValue(attrs, "codigo");
                    if (!cod) return;
                    
                    const mesaLocal = state.mesas.find(m => m.codigo === cod);
                    
                    if (mesaLocal) {
                        // Actualizar local con datos del servidor (el servidor tiene primacía)
                        mesaLocal.seccion = getSeccionFromAttributes(attrs, cod);
                        PARTIES_CONFIG.forEach(p => {
                            mesaLocal[p.field] = parseInt(getAttributeValue(attrs, p.field), 10) || 0;
                        });
                        mesaLocal.votos_blancos = parseInt(getAttributeValue(attrs, "votos_blancos"), 10) || 0;
                        mesaLocal.votos_nulos = parseInt(getAttributeValue(attrs, "votos_nulos"), 10) || 0;
                        mesaLocal.miembros = getAttributeValue(attrs, "miembros") || "";
                        mesaLocal.estado = getAttributeValue(attrs, "estado") || "Abierta";
                        mesaLocal.firma_presi = getAttributeValue(attrs, "firma_presi") || "";
                        mesaLocal.firma_vocal1 = getAttributeValue(attrs, "firma_vocal1") || "";
                        mesaLocal.firma_vocal2 = getAttributeValue(attrs, "firma_vocal2") || "";
                        mesaLocal.censo = parseInt(getAttributeValue(attrs, "censo"), 10) || mesaLocal.censo;
                        mesaLocal.objectid = getAttributeValue(attrs, "objectid") || getAttributeValue(attrs, "OBJECTID") || getAttributeValue(attrs, "FID"); // Conservar ObjectID
                    } else {
                        // Si la mesa no estaba en nuestro DEFAULT_MESAS local, la añadimos!
                        const nuevaMesa = {
                            codigo: cod,
                            seccion: getSeccionFromAttributes(attrs, cod),
                            mesa: getAttributeValue(attrs, "mesa"),
                            colegio: getAttributeValue(attrs, "colegio"),
                            votos_blancos: parseInt(getAttributeValue(attrs, "votos_blancos"), 10) || 0,
                            votos_nulos: parseInt(getAttributeValue(attrs, "votos_nulos"), 10) || 0,
                            miembros: getAttributeValue(attrs, "miembros") || "",
                            estado: getAttributeValue(attrs, "estado") || "Abierta",
                            firma_presi: getAttributeValue(attrs, "firma_presi") || "",
                            firma_vocal1: getAttributeValue(attrs, "firma_vocal1") || "",
                            firma_vocal2: getAttributeValue(attrs, "firma_vocal2") || "",
                            censo: parseInt(getAttributeValue(attrs, "censo"), 10) || 500,
                            objectid: getAttributeValue(attrs, "objectid") || getAttributeValue(attrs, "OBJECTID") || getAttributeValue(attrs, "FID")
                        };
                        PARTIES_CONFIG.forEach(p => {
                            nuevaMesa[p.field] = parseInt(getAttributeValue(attrs, p.field), 10) || 0;
                        });
                        state.mesas.push(nuevaMesa);
                    }
                });

                // Guardar base de datos consolidada
                rebuildDynamicMappings();
                saveLocalDatabase();
                
                // Refrescar vistas
                updateGlobalMetrics();
                renderMapTheme();
                if (state.currentUser && state.currentUser.role === "admin") {
                    renderAdminPortal();
                } else if (state.currentUser && state.currentUser.role === "colegio") {
                    showSchoolPortalView();
                }
            } else {
                // Si la tabla del servidor está vacía, subimos las mesas locales iniciales por defecto!
                console.log("Servidor vacío. Subiendo mesas iniciales por defecto...");
                state.mesas.forEach(sendMesaAddToServer);
            }
        }).catch(err => {
            console.error("Fallo al consultar la tabla de mesas en ArcGIS Server:", err);
            if (err) {
                console.error("Error Message:", err.message);
                console.error("Error Details:", JSON.stringify(err.details));
            }
        });
    }

    // Enviar votos e informes de una mesa al servidor mediante applyEdits
    function sendMesaToArcGISServer(mesaObj) {
        const tablesLayer = new FeatureLayer({
            url: URL_MESAS_TABLE_EDIT
        });

        // Crear atributos que coinciden exactamente con las columnas de la GDB
        const attributes = {
            codigo: mesaObj.codigo,
            seccion: mesaObj.seccion,
            mesa: mesaObj.mesa,
            colegio: mesaObj.colegio,
            votos_blancos: mesaObj.votos_blancos,
            votos_nulos: mesaObj.votos_nulos,
            miembros: mesaObj.miembros,
            estado: mesaObj.estado,
            firma_presi: mesaObj.firma_presi,
            firma_vocal1: mesaObj.firma_vocal1,
            firma_vocal2: mesaObj.firma_vocal2,
            censo: mesaObj.censo
        };

        PARTIES_CONFIG.forEach(p => {
            attributes[p.field] = mesaObj[p.field];
        });

        // Si ya tenemos el ObjectID de ArcGIS, actualizamos; si no, insertamos
        if (mesaObj.objectid !== null) {
            attributes.objectid = mesaObj.objectid;
            attributes.OBJECTID = mesaObj.objectid; // Soporte para Enterprise GDB
            
            const editGraphic = new Graphic({ attributes: attributes });
            
            tablesLayer.applyEdits({
                updateFeatures: [editGraphic]
            }).then(result => {
                console.log("Mesa actualizada correctamente en ArcGIS Server:", result);
                alert(`¡Mesa ${mesaObj.codigo} cerrada y sincronizada con ArcGIS Server!`);
                
                state.selectedMesa = null;
                showSchoolPortalView();
                updateGlobalMetrics();
                renderMapTheme();
            }).catch(err => {
                console.error("Error al actualizar la mesa en ArcGIS Server:", err);
                if (err) {
                    console.error("Error Message:", err.message);
                    console.error("Error Details:", JSON.stringify(err.details));
                }
                alert("Mesa guardada localmente, pero falló la sincronización con ArcGIS Server. Se reintentará en segundo plano.");
                state.selectedMesa = null;
                showSchoolPortalView();
                updateGlobalMetrics();
            });
        } else {
            // No tiene ObjectID, agregamos registro
            const editGraphic = new Graphic({ attributes: attributes });
            
            tablesLayer.applyEdits({
                addFeatures: [editGraphic]
            }).then(result => {
                console.log("Mesa añadida a ArcGIS Server:", result);
                if (result.addFeatureResults && result.addFeatureResults[0]) {
                    mesaObj.objectid = result.addFeatureResults[0].objectId;
                    saveLocalDatabase();
                }
                alert(`¡Mesa ${mesaObj.codigo} cerrada y registrada en ArcGIS Server!`);
                
                state.selectedMesa = null;
                showSchoolPortalView();
                updateGlobalMetrics();
                renderMapTheme();
            }).catch(err => {
                console.error("Error al añadir mesa en ArcGIS Server:", err);
                if (err) {
                    console.error("Error Message:", err.message);
                    console.error("Error Details:", JSON.stringify(err.details));
                }
                alert("Mesa guardada localmente, pero falló el registro en ArcGIS Server.");
                state.selectedMesa = null;
                showSchoolPortalView();
                updateGlobalMetrics();
            });
        }
    }

    // Funciones auxiliares de edición por parte del Administrador en ArcGIS
    function sendMesaAddToServer(mesaObj) {
        if (!state.arcgisMode) return;
        const tablesLayer = new FeatureLayer({ url: URL_MESAS_TABLE_EDIT });
        
        const attributes = {
            codigo: mesaObj.codigo,
            seccion: mesaObj.seccion,
            mesa: mesaObj.mesa,
            colegio: mesaObj.colegio,
            votos_blancos: mesaObj.votos_blancos,
            votos_nulos: mesaObj.votos_nulos,
            miembros: mesaObj.miembros,
            estado: mesaObj.estado,
            firma_presi: mesaObj.firma_presi,
            firma_vocal1: mesaObj.firma_vocal1,
            firma_vocal2: mesaObj.firma_vocal2,
            censo: mesaObj.censo
        };
        PARTIES_CONFIG.forEach(p => { attributes[p.field] = mesaObj[p.field]; });

        const editGraphic = new Graphic({ attributes: attributes });
        
        tablesLayer.applyEdits({ addFeatures: [editGraphic] }).then(result => {
            console.log("Mesa inicial subida a ArcGIS Server:", result);
            if (result.addFeatureResults && result.addFeatureResults[0]) {
                mesaObj.objectid = result.addFeatureResults[0].objectId;
                saveLocalDatabase();
            }
            if (state.currentUser && state.currentUser.role === "admin") {
                document.getElementById("modal-admin-add-mesa").classList.add("hidden");
                renderAdminPortal();
            }
        }).catch(err => {
            console.error("Fallo al subir mesa inicial:", err);
        });
    }

    function sendMesaUpdateToServer(mesaObj) {
        if (!state.arcgisMode || mesaObj.objectid === null) return;
        const tablesLayer = new FeatureLayer({ url: URL_MESAS_TABLE_EDIT });

        const attributes = {
            objectid: mesaObj.objectid,
            OBJECTID: mesaObj.objectid,
            codigo: mesaObj.codigo,
            seccion: mesaObj.seccion,
            mesa: mesaObj.mesa,
            colegio: mesaObj.colegio,
            votos_blancos: mesaObj.votos_blancos,
            votos_nulos: mesaObj.votos_nulos,
            miembros: mesaObj.miembros,
            estado: mesaObj.estado,
            firma_presi: mesaObj.firma_presi,
            firma_vocal1: mesaObj.firma_vocal1,
            firma_vocal2: mesaObj.firma_vocal2,
            censo: mesaObj.censo
        };
        PARTIES_CONFIG.forEach(p => { attributes[p.field] = mesaObj[p.field]; });

        const editGraphic = new Graphic({ attributes: attributes });
        
        tablesLayer.applyEdits({ updateFeatures: [editGraphic] }).then(result => {
            console.log("Mesa editada en ArcGIS Server:", result);
            if (state.currentUser && state.currentUser.role === "admin") {
                renderAdminPortal();
            }
        }).catch(err => {
            console.error("Fallo al editar mesa en ArcGIS Server:", err);
        });
    }

    function sendMesaDeleteToServer(mesaObj) {
        if (!state.arcgisMode || mesaObj.objectid === null) return;
        const tablesLayer = new FeatureLayer({ url: URL_MESAS_TABLE_EDIT });

        const editGraphic = new Graphic({
            attributes: {
                objectid: mesaObj.objectid,
                OBJECTID: mesaObj.objectid
            }
        });

        tablesLayer.applyEdits({ deleteFeatures: [editGraphic] }).then(result => {
            console.log("Mesa borrada en ArcGIS Server:", result);
            state.mesas = state.mesas.filter(m => m.codigo !== mesaObj.codigo);
            saveLocalDatabase();
            renderAdminPortal();
            updateGlobalMetrics();
            renderMapTheme();
        }).catch(err => {
            console.error("Fallo al borrar mesa en ArcGIS Server:", err);
            alert("No se pudo borrar del servidor de ArcGIS. Comprueba tu conexión.");
        });
    }

    // ==========================================================================
    // EJECUTAR AL CARGAR EL SCRIPT
    // ==========================================================================
    init();

});
