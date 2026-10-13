/* Catálogo de logotipos para administración — ámbito MUNICIPALES */
const ELECTION_AMBITO = "municipales";
const LOGO_CATALOG_FOLDER = "../Imagenes/logos/municipales";
const LOGO_PRESETS = [
  { label: "PP", file: "PP.png" },
  { label: "PP 2", file: "PP2.png" },
  { label: "PSOE", file: "PSOE.png" },
  { label: "VOX", file: "VOX.png" },
  { label: "IU / Más Madrid / Equo", file: "IU.png" },
  { label: "Podemos / Unidas Podemos", file: "UnidasPodemos.png" },
  { label: "Ciudadanos", file: "Ciudadanos.png" },
  { label: "PACMA", file: "PACMA.png" },
  { label: "Genérico OITR (local / otras)", file: "Logo_OITR.png" }
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
  LOGO_PRESETS.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = getLogoPresetPath(item.file);
    opt.textContent = `${item.label} (${LOGO_CATALOG_FOLDER}/${item.file})`;
    selectEl.appendChild(opt);
  });
  if (current && [...selectEl.options].some((o) => o.value === current)) {
    selectEl.value = current;
  }
}
