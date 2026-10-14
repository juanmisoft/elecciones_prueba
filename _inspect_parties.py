# -*- coding: utf-8 -*-
from pathlib import Path

t = Path("generales/app.js").read_text(encoding="utf-8")
i = t.find("elecciones_custom_party_logos")
print("==== custom logos ====")
print(t[max(0, i - 350) : i + 800])
print("==== __PARTIES__ apply ====")
i = t.find('if (cod === "__PARTIES__")')
print(t[i : i + 1100])
print("==== mapping ====")
m = Path("generales/section_colegio_mapping.js").read_text(encoding="utf-8")
print("has DEFAULT", "DEFAULT_PARTIES_CONFIG" in m)
print([ln for ln in m.splitlines() if "PARTIES_CONFIG" in ln][-4:])
m2 = Path("section_colegio_mapping.js").read_text(encoding="utf-8")
print("root", [ln for ln in m2.splitlines() if "PARTIES" in ln][-4:])
