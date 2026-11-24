Empaquetado Apache Tomcat (portal de acceso)
=============================================

Entrada actual
--------------
  index.html → generales/index.html (login del portal).
  El visor público sigue empaquetado, pero no es la entrada.
  Para reactivarlo más adelante:
    1) generales/app.js → PUBLIC_VIEWER_ENABLED = true
    2) Mostrar de nuevo el botón "Volver al Visor Público" (deja de ocultarse solo)
    3) index.html raíz → redirigir otra vez a hub/index.html si conviene

Generar el WAR (Windows)
------------------------
  powershell -ExecutionPolicy Bypass -File .\deploy\package-tomcat.ps1

  # Raíz del servidor (http://host:8080/)
  powershell -ExecutionPolicy Bypass -File .\deploy\package-tomcat.ps1 -WarName ROOT.war

  # Otro context path
  powershell -ExecutionPolicy Bypass -File .\deploy\package-tomcat.ps1 -WarName elecciones.war -Context elecciones

Generar el WAR (bash / Git Bash / WSL)
--------------------------------------
  chmod +x deploy/package-tomcat.sh
  ./deploy/package-tomcat.sh

Salida: dist/elecciones.war

Despliegue
----------
  cp dist/elecciones.war $CATALINA_BASE/webapps/
  # Tomcat 10+ (Jakarta). Si usáis Tomcat 9, cambiad el xmlns de web.xml a Java EE 8 / javax.

Qué lleva / qué no
------------------
Incluye: index.html, favicon.ico, hub/, generales/, municipales/, Imagenes/, WEB-INF/
Excluye: censo electoral (RGPD), DATOS INTERIOR, scripts _*.py, loadtests, Excel/docs internos

Rendimiento
-----------
- Fotos de colegios en JPEG optimizado (~3 MB de Imagenes en el WAR).
- web.xml activa ExpiresFilter (caché de imágenes/CSS/JS).
- Tras cambios de CSS/JS, bump del ?v= en index.html para invalidar caché.

Nota: la consulta de DNI del portal interno usa servicios ArcGIS (generales) o
fichero local de censo (municipales en desarrollo). El WAR público no lleva ese
fichero; no publicar el TXT del censo en Tomcat.
