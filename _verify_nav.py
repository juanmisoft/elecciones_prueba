# -*- coding: utf-8 -*-
from pathlib import Path

h = Path("hub/historico.html").read_text(encoding="utf-8")
assert "Históricos" in h, [ln for ln in h.splitlines() if "ambitoEyebrow" in ln]
assert "btn-back-hub" in h and "HUB" in h
print("historico OK")

hub = Path("hub/index.html").read_text(encoding="utf-8")
assert "Elecciones Rivas Vaciamadrid" in hub
print("hub OK")

for p in ["index.html", "generales/index.html"]:
    t = Path(p).read_text(encoding="utf-8")
    assert 'class="brand-context">En vivo</span>' in t
    print(p, "OK")
