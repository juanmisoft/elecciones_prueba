#!/usr/bin/env bash
# Empaqueta lo esencial del portal para Apache Tomcat (WAR estático).
# Uso:
#   ./deploy/package-tomcat.sh
#   WAR_NAME=ROOT.war ./deploy/package-tomcat.sh   # desplegar en /
#   CONTEXT=elecciones-publico ./deploy/package-tomcat.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${ROOT}/dist/tomcat-stage"
OUT_DIR="${ROOT}/dist"
WAR_NAME="${WAR_NAME:-elecciones.war}"
if [[ -n "${CONTEXT+x}" ]]; then
  CONTEXT_NAME="${CONTEXT}"
elif [[ "${WAR_NAME}" == "ROOT.war" ]]; then
  CONTEXT_NAME=""
else
  CONTEXT_NAME="${WAR_NAME%.war}"
fi
CONTEXT_PATH="/${CONTEXT_NAME}"
CONTEXT_PATH="${CONTEXT_PATH%/}"
[[ -z "${CONTEXT_PATH}" ]] && CONTEXT_PATH=""

echo "==> Empaquetado Tomcat"
echo "    origen : ${ROOT}"
echo "    WAR    : ${OUT_DIR}/${WAR_NAME}"
echo "    context: ${CONTEXT_PATH:-/}"

rm -rf "${STAGE}"
mkdir -p "${STAGE}/WEB-INF" "${OUT_DIR}"

# Descriptor Tomcat
cp "${ROOT}/deploy/tomcat/WEB-INF/web.xml" "${STAGE}/WEB-INF/web.xml"

# Entrada + módulos públicos
cp "${ROOT}/index.html" "${STAGE}/index.html"
if [[ -f "${ROOT}/favicon.ico" ]]; then
  cp "${ROOT}/favicon.ico" "${STAGE}/favicon.ico"
fi
rsync -a --delete \
  --exclude '.DS_Store' \
  --exclude 'Thumbs.db' \
  --exclude '*.map' \
  "${ROOT}/hub/" "${STAGE}/hub/"
rsync -a --delete \
  --exclude '.DS_Store' \
  --exclude 'Thumbs.db' \
  "${ROOT}/generales/" "${STAGE}/generales/"
rsync -a --delete \
  --exclude '.DS_Store' \
  --exclude 'Thumbs.db' \
  "${ROOT}/municipales/" "${STAGE}/municipales/"
rsync -a --delete \
  --exclude '.DS_Store' \
  --exclude 'Thumbs.db' \
  --exclude '* (1).*' \
  --exclude '_opt_tmp' \
  --exclude '*.md' \
  "${ROOT}/Imagenes/" "${STAGE}/Imagenes/"

# Defensa RGPD: nunca incluir fichero de censo electoral nominativo.
# Sí se mantiene hub/data/ine-censo-rivas.json (series agregadas del INE).
find "${STAGE}" -type f \( \
  -iname 'SI_*.txt' -o \
  -iname '*CENSO*DEFINITIVO*' -o \
  -iname '*censo*elector*' -o \
  -name 'placeholder.txt' \
\) -print -delete 2>/dev/null || true

# Manifest mínimo
mkdir -p "${STAGE}/META-INF"
cat > "${STAGE}/META-INF/MANIFEST.MF" <<EOF
Manifest-Version: 1.0
Created-By: package-tomcat.sh
Implementation-Title: Elecciones Rivas Vaciamadrid
Implementation-Version: $(date -u +%Y%m%dT%H%M%SZ)
EOF

# Context path explícito (útil si el WAR no se llama como el context)
cat > "${STAGE}/META-INF/context.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<Context path="${CONTEXT_PATH}" antiResourceLocking="false" />
EOF

# Nota dentro del WAR
PUBLIC_URL_HINT="${CONTEXT_PATH:-}/"
cat > "${STAGE}/DEPLOY.txt" <<EOF
Elecciones Rivas Vaciamadrid — paquete Tomcat
=============================================
Entrada: index.html → generales/index.html (login del portal).
El visor público permanece en el WAR pero no es la entrada por defecto.
Contenido: index.html, hub/, generales/, municipales/, Imagenes/, WEB-INF/

NO incluye (a propósito):
- Fichero de censo electoral (datos personales / RGPD)
- Scripts de mantenimiento (_*.py), DATOS INTERIOR, loadtests, .git
- Manuales y hojas Excel internas

Despliegue:
1. Copiar ${WAR_NAME} a \$CATALINA_BASE/webapps/
2. Arrancar Tomcat 10+ (Jakarta) o adaptar web.xml a javax si usáis Tomcat 9
3. Abrir http://servidor:8080${PUBLIC_URL_HINT}

Requisitos de red en el navegador:
- https://js.arcgis.com (API)
- https://sit.rivasciudad.es (servicios / Portal)
- CDN Font Awesome y Google Fonts

Los portales colegio/admin siguen detrás del login de ArcGIS Portal;
este WAR no abre el censo al público.
EOF

# Comprobar esenciales
for must in index.html hub/index.html generales/index.html municipales/index.html Imagenes/Logo_OITR.png favicon.ico WEB-INF/web.xml; do
  if [[ ! -e "${STAGE}/${must}" ]]; then
    echo "ERROR: falta ${must} en el stage" >&2
    exit 1
  fi
done

# Empaquetar WAR (zip)
(
  cd "${STAGE}"
  rm -f "${OUT_DIR}/${WAR_NAME}"
  zip -qry "${OUT_DIR}/${WAR_NAME}" .
)

SIZE="$(du -h "${OUT_DIR}/${WAR_NAME}" | awk '{print $1}')"
echo "==> OK ${OUT_DIR}/${WAR_NAME} (${SIZE})"
echo "    Stage temporal: ${STAGE}"
echo "    Copiar a webapps/ y reiniciar Tomcat, o: cp dist/${WAR_NAME} \"\$CATALINA_BASE/webapps/\""
