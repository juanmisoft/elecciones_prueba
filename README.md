# Visor Electoral y Portal de Escrutinio (Rivas-Vaciamadrid)

Aplicación web frontend pura desarrollada para la gestión del escrutinio en tiempo real, actas firmadas y visualización interactiva de resultados electorales. Integrada con el **ArcGIS Maps SDK for JavaScript** y servicios de entidades seguras de **ArcGIS Enterprise (Feature Server)**.

## 🚀 Características Principales

*   **Mapa Electoral Interactivo:** Representación dinámica por secciones censales de Rivas-Vaciamadrid. Los polígonos cambian de color en tiempo real con el color de la fuerza política ganadora en cada sección.
*   **Leyenda Inteligente (Top 3):** Leyenda dinámica en el mapa que calcula y muestra en tiempo real las 3 fuerzas más votadas en el municipio, detallando votos acumulados y porcentaje.
*   **Portal de Representantes de Colegio:**
    *   Asignación y registro de mesas electorales.
    *   Formulario simple e intuitivo para introducir votos por partido, nulos y blancos.
    *   Firma digital integrada para el presidente y los dos vocales de la mesa (soporte para ratón y pantallas táctiles).
    *   Bloqueo automático de mesas al finalizar para garantizar la integridad de los datos.
*   **Portal de Administración General:**
    *   Control centralizado de colegios electorales y mesas.
    *   Visualización y descarga de actas digitalizadas con las firmas correspondientes.
    *   Herramientas de exportación rápida: **Descarga CSV** compatible con Excel (UTF-8 BOM) y **Generación de Informes en PDF** listos para imprimir.
*   **Control de Acceso Seguro (Lista Blanca):**
    *   Autenticación oficial OAuth mediante `IdentityManager` contra el Portal ArcGIS Enterprise de Rivas.
    *   Filtro estricto que restringe el acceso únicamente a los usuarios autorizados:
        *   `AdminEleccionesGenPrueba` (Administrador)
        *   `JaramaEleccionesGenPrueba` (Colegio Jarama)
        *   `AlmendrosEleccionesGenPrueba` (Colegio Los Almendros)
    *   Cualquier otra cuenta de la organización será denegada y sus credenciales destruidas en cliente de forma automática para evitar logins automáticos no deseados.
*   **Simulador Municipal Completo:**
    *   Botón integrado en administración para simular el comportamiento electoral en las **198 mesas** del municipio (3 mesas A, B y C para cada una de las 66 secciones de Rivas), dividiendo proporcionalmente el censo real de 2023.

---

## 📁 Estructura del Proyecto

*   `index.html`: Estructura y maquetación de las 4 vistas principales (Visor Público, Login, Portal de Colegio y Portal de Administración).
*   `styles.css`: Hojas de estilo personalizadas con variables CSS, transiciones suaves y diseño adaptivo optimizado.
*   `app.js`: Lógica principal de control, autenticación ArcGIS, manipulación de mapas Esri y renderizado del dashboard.
*   `section_colegio_mapping.js`: Archivo de configuración estática que contiene:
    *   Mapeo de secciones censales a colegios.
    *   Censo electoral oficial de 2023 por sección.
    *   Configuración de logos, nombres y colores de los partidos políticos.
*   `serve.ps1`: Script PowerShell que inicia un servidor HTTP de desarrollo en el puerto 8000.
*   `.gitignore`: Archivo para excluir temporales de Office, configuraciones de editores y temporales del sistema en el repositorio.

---

## 🛠️ Cómo Ejecutar en Local

1.  Abre una consola de PowerShell en la carpeta raíz del proyecto.
2.  Ejecuta el script de servidor de desarrollo:
    ```powershell
    .\serve.ps1
    ```
3.  Abre tu navegador y entra en la dirección local indicada:
    ```
    http://localhost:8000
    ```

---

## 🔒 Configuración de Capas de ArcGIS Server

Los endpoints del Feature Server se configuran al inicio de `app.js` mediante las variables:
*   `URL_SECCIONES_LAYER`: Capa geográfica de polígonos de secciones.
*   `URL_MESAS_TABLE`: Tabla alfanumérica de mesas (acceso de consulta pública).
*   `URL_MESAS_TABLE_EDIT`: Tabla alfanumérica de mesas (acceso de edición con credenciales).
