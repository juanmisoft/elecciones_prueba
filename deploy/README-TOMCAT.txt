Empaquetado Apache Tomcat (portal público)
==========================================

Generar el WAR
--------------
  chmod +x deploy/package-tomcat.sh
  ./deploy/package-tomcat.sh

Salida: dist/elecciones.war

Variantes
---------
  # Raíz del servidor (http://host:8080/)
  WAR_NAME=ROOT.war CONTEXT= ./deploy/package-tomcat.sh

  # Otro context path
  WAR_NAME=elecciones-publico.war CONTEXT=elecciones-publico ./deploy/package-tomcat.sh

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
