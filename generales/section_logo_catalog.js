/* Catálogo de logotipos — ámbito GENERALES (Congreso)
 * Logos con fichero propio en Imagenes/logos/generales (Commons / existentes).
 * Partido Humanista: sin logo libre claro en Commons → genérico OITR (sustituible).
 */
const ELECTION_AMBITO = "generales";
const LOGO_CATALOG_FOLDER = "../Imagenes/logos/generales";

const LOGO_PRESETS = [
  { label: "PP", file: "PP.png" },
  { label: "PP (alt)", file: "PP2.png" },
  { label: "PSOE", file: "PSOE.png" },
  { label: "VOX", file: "VOX.png" },
  { label: "Sumar", file: "sumar-logo-png_seeklogo-487418.png" },
  { label: "Podemos / Unidas Podemos", file: "UnidasPodemos.png" },
  { label: "IU", file: "IU.png" },
  { label: "Ciudadanos (CS)", file: "Ciudadanos.png" },
  { label: "PACMA", file: "PACMA.png" },
  { label: "Se Acabó La Fiesta (SALF / SAF)", file: "Seacabolafiesta.png" },
  { label: "Frente Obrero (FO)", file: "FO.png" },
  { label: "PCTE", file: "PCTE.png" },
  { label: "Volt", file: "VOLT.svg" },
  { label: "Izquierda Española", file: "IZQESP2.png" },
  { label: "Partido Humanista — genérico OITR", file: "Logo_OITR.png" },
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
