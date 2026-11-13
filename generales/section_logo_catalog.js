/* Catálogo de logotipos — ámbito GENERALES (Congreso 29N 2026)
 * Logos en Imagenes/logos/generales.
 */
const ELECTION_AMBITO = "generales";
const LOGO_CATALOG_FOLDER = "../Imagenes/logos/generales";

const LOGO_PRESETS = [
  { label: "Frente Obrero (FO)", file: "FO.png" },
  { label: "PSOE", file: "PSOE.png" },
  { label: "Falange Española de las J.O.N.S. (FE de las JONS)", file: "falange.png" },
  { label: "VOX", file: "VOX.png" },
  { label: "PCTE", file: "PCTE.png" },
  { label: "Partido Humanista (PH)", file: "Partido Humanista.png" },
  { label: "Democracia para el Siglo 21 (D21)", file: "democracia21.jpg" },
  { label: "Iustitia Europa (IE)", file: "iustitiaeuropa.png" },
  { label: "Por Un Mundo Más Justo (MUNDO+JUSTO)", file: "mundojusto.png" },
  { label: "Se Acabó la Fiesta (SALF)", file: "Seacabolafiesta.png" },
  { label: "PP", file: "PP.png" },
  { label: "PACMA", file: "PACMA.png" },
  { label: "Frente Amplio (FA)", file: "frenteamplio.jpeg" },
  { label: "Podemos", file: "podemos.jpg" },
  { label: "Otras candidaturas — genérico OITR", file: "Logo_OITR.png" }
];

function getLogoPresetPath(file) {
  return `${LOGO_CATALOG_FOLDER}/${file}`;
}

function fillPartyLogoPresetSelect(selectEl) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "-- Seleccionar imagen --";
  selectEl.appendChild(empty);
  LOGO_PRESETS.forEach((item, idx) => {
    const opt = document.createElement("option");
    opt.value = `${getLogoPresetPath(item.file)}#${idx}`;
    opt.dataset.logo = getLogoPresetPath(item.file);
    opt.textContent = item.label;
    selectEl.appendChild(opt);
  });
  if (current && [...selectEl.options].some((o) => o.value === current)) {
    selectEl.value = current;
  }
}

function resolveSelectedLogoPath(selectEl) {
  if (!selectEl || !selectEl.value) return getLogoPresetPath("Logo_OITR.png");
  const opt = selectEl.selectedOptions[0];
  if (opt && opt.dataset.logo) return opt.dataset.logo;
  return selectEl.value.split("#")[0];
}
