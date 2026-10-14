# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(__file__).resolve().parent
logo = "../Imagenes/logos/generales"
folder = root / "Imagenes" / "logos" / "generales"

have = {p.name for p in folder.iterdir() if p.is_file()}
print("files:", sorted(have))

# Prefer real files; fallback OITR
def pick(*names):
    for n in names:
        if n in have:
            return f"{logo}/{n}"
    return f"{logo}/Logo_OITR.png"

mapping = {
    "FO": pick("FO.png"),
    "PCTE": pick("PCTE.png"),
    "VOLT": pick("VOLT.svg"),
    "IZQESP": pick("IZQESP2.png", "IZQESP.jpg"),
    "PUMMJ": pick("PUMMJ.png", "PUMMJ.svg"),
    "RECORTES_CERO": pick("RECORTES_CERO.jpg"),
    "FJONS": pick("FJONS.png", "FJONS.svg"),
    "PCPE": pick("PCPE.jpg"),
}

m = root / "generales" / "section_colegio_mapping.js"
t = m.read_text(encoding="utf-8")
for pid, path in mapping.items():
    t, n = re.subn(
        rf'(id: "{pid}",[\s\S]*?logo: ")[^"]+(")',
        rf"\1{path}\2",
        t,
        count=1,
    )
    print(f"party {pid}: {n} -> {path}")
m.write_text(t, encoding="utf-8")

# catalog: only list files that exist + OITR for PH
catalog = root / "generales" / "section_logo_catalog.js"
presets = [
    ("PP", "PP.png"),
    ("PP (alt)", "PP2.png"),
    ("PSOE", "PSOE.png"),
    ("VOX", "VOX.png"),
    ("Sumar", "sumar-logo-png_seeklogo-487418.png"),
    ("Podemos / Unidas Podemos", "UnidasPodemos.png"),
    ("IU", "IU.png"),
    ("Ciudadanos (CS)", "Ciudadanos.png"),
    ("PACMA", "PACMA.png"),
    ("Se Acabó La Fiesta (SALF / SAF)", "Seacabolafiesta.png"),
]
extra = [
    ("Frente Obrero (FO)", "FO.png"),
    ("PCTE", "PCTE.png"),
    ("PUM+J", "PUMMJ.png"),
    ("Recortes Cero", "RECORTES_CERO.jpg"),
    ("FE-JONS", "FJONS.png"),
    ("PCPE", "PCPE.jpg"),
    ("Volt", "VOLT.svg"),
    ("Izquierda Española", "IZQESP2.png"),
]
lines = []
for label, file in presets + extra:
    if file in have:
        lines.append(f'  {{ label: "{label}", file: "{file}" }},')
    else:
        # alternate extensions
        alt = None
        stem = file.rsplit(".", 1)[0]
        for ext in (".png", ".jpg", ".svg", ".jpeg"):
            cand = stem + ext
            if cand in have:
                alt = cand
                break
        if alt:
            lines.append(f'  {{ label: "{label}", file: "{alt}" }},')
        else:
            print("missing for catalog:", file)

lines.append('  { label: "Partido Humanista — genérico OITR", file: "Logo_OITR.png" },')
lines.append('  { label: "Otras candidaturas — genérico OITR", file: "Logo_OITR.png" }')

body = Path("generales/section_logo_catalog.js").read_text(encoding="utf-8")
# replace LOGO_PRESETS array
new_presets = "const LOGO_PRESETS = [\n" + "\n".join(lines) + "\n];"
body2, n = re.subn(r"const LOGO_PRESETS = \[[\s\S]*?\];", new_presets, body, count=1)
print("catalog presets", n)
catalog.write_text(body2, encoding="utf-8")

idx = root / "generales" / "index.html"
h = idx.read_text(encoding="utf-8")
h = re.sub(r"section_logo_catalog\.js\?v=[\d.]+", "section_logo_catalog.js?v=1.2.0", h)
h = re.sub(r"section_colegio_mapping\.js\?v=[\d.]+", "section_colegio_mapping.js?v=1.2.0", h)
idx.write_text(h, encoding="utf-8")
print("done")
