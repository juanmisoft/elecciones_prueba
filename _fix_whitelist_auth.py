# -*- coding: utf-8 -*-
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent

LOGIN_FN = r"""
    function loginUserSuccess(username, isArcGIS) {
        if (!username) return false;

        // Solo usuarios de la whitelist de ESTE ámbito (sin heurísticas "admin"/colegio).
        const matchKey = Object.keys(LOCAL_USERS).find(k => k.toLowerCase() === username.toLowerCase());
        if (!matchKey) {
            console.warn(`Usuario no autorizado en este ámbito (${AUTH_STORAGE_PREFIX}): ${username}`);
            IdentityManager.destroyCredentials();
            state.currentUser = null;
            state.arcgisMode = false;
            clearAuthStorage();
            return false;
        }

        const userObj = LOCAL_USERS[matchKey];
        state.currentUser = {
            username: username,
            role: userObj.role,
            colegioName: userObj.colegio
        };
        state.arcgisMode = isArcGIS;
"""

# The original function continues after setting state - we need to replace only the matching part
# through return false block, keeping the rest of the function body after state.currentUser assignment.

PATTERN = re.compile(
    r"function loginUserSuccess\(username, isArcGIS\) \{[\s\S]*?"
    r"state\.currentUser = \{\s*"
    r"username: username,\s*"
    r"role: userObj\.role,\s*"
    r"colegioName: userObj\.colegio\s*"
    r"\};\s*"
    r"state\.arcgisMode = isArcGIS;",
    re.M,
)


def patch_app(path: Path, storage_prefix: str, users_block: str | None = None):
    text = path.read_text(encoding="utf-8")

    if "AUTH_STORAGE_PREFIX" not in text:
        text = text.replace(
            "const LOCAL_USERS = {",
            f'    const AUTH_STORAGE_PREFIX = "{storage_prefix}";\n\n    const LOCAL_USERS = {{',
            1,
        )

    if users_block:
        text, n = re.subn(
            r"const LOCAL_USERS = \{.*?\n    \};",
            users_block.strip(),
            text,
            count=1,
            flags=re.S,
        )
        print(path.name, "users", n)

    text2, n = PATTERN.subn(LOGIN_FN.strip() + "\n        state.arcgisMode = isArcGIS;", text, count=1)
    # Fix double state.arcgisMode - my replacement already includes it once at end wrongly
    # Actually LOGIN_FN ends before state.arcgisMode - I appended it. Good.
    # Wait LOGIN_FN already has state.arcgisMode = isArcGIS at end - and I appended again. Fix.
    print(path.name, "loginUserSuccess", n)
    text = text2

    # Deduplicate if double
    text = text.replace(
        "state.arcgisMode = isArcGIS;\n        state.arcgisMode = isArcGIS;",
        "state.arcgisMode = isArcGIS;",
    )

    # Add clearAuthStorage + scoped storage helpers near LOCAL_USERS
    if "function clearAuthStorage" not in text:
        helper = f"""
    function authKey(suffix) {{
        return AUTH_STORAGE_PREFIX + "_" + suffix;
    }}

    function clearAuthStorage() {{
        localStorage.removeItem(authKey("user"));
        localStorage.removeItem(authKey("arcgis_mode"));
        localStorage.removeItem(authKey("arcgis_id_mgr"));
        // claves legacy compartidas (evitar cruce entre ámbitos)
        localStorage.removeItem("elecciones_user");
        localStorage.removeItem("elecciones_arcgis_mode");
        localStorage.removeItem("elecciones_arcgis_id_mgr");
    }}
"""
        text = text.replace(
            "const DEFAULT_MESAS = [];",
            "const DEFAULT_MESAS = [];\n" + helper,
            1,
        )

    # Fix session restore: only whitelist, use scoped keys
    text, n = re.subn(
        r'const storedUser = localStorage\.getItem\("elecciones_user"\);',
        'const storedUser = localStorage.getItem(authKey("user")) || localStorage.getItem("elecciones_user");',
        text,
        count=1,
    )
    print(path.name, "storedUser", n)

    text, n = re.subn(
        r"const allowedUsers = Object\.keys\(LOCAL_USERS\)\.map\(u => u\.toLowerCase\(\)\);\s*"
        r"if \(parsed && parsed\.username && \(allowedUsers\.includes\(parsed\.username\.toLowerCase\(\)\) \|\| parsed\.role\)\) \{",
        "const allowedUsers = Object.keys(LOCAL_USERS).map(u => u.toLowerCase());\n"
        "                if (parsed && parsed.username && allowedUsers.includes(parsed.username.toLowerCase())) {",
        text,
        count=1,
    )
    print(path.name, "restore check", n)

    text = text.replace(
        'state.arcgisMode = localStorage.getItem("elecciones_arcgis_mode") === "true";',
        'state.arcgisMode = (localStorage.getItem(authKey("arcgis_mode")) || localStorage.getItem("elecciones_arcgis_mode")) === "true";',
        1,
    )

    # Persist with scoped keys on successful login - find localStorage.setItem elecciones_user
    text = text.replace(
        'localStorage.setItem("elecciones_user"',
        'localStorage.setItem(authKey("user")',
    )
    text = text.replace(
        'localStorage.setItem("elecciones_arcgis_mode"',
        'localStorage.setItem(authKey("arcgis_mode")',
    )
    text = text.replace(
        'localStorage.setItem("elecciones_arcgis_id_mgr"',
        'localStorage.setItem(authKey("arcgis_id_mgr")',
    )
    text = text.replace(
        'localStorage.getItem("elecciones_arcgis_id_mgr")',
        'localStorage.getItem(authKey("arcgis_id_mgr")) || localStorage.getItem("elecciones_arcgis_id_mgr")',
    )
    text = text.replace(
        'localStorage.removeItem("elecciones_user")',
        'localStorage.removeItem(authKey("user")); localStorage.removeItem("elecciones_user")',
    )
    text = text.replace(
        'localStorage.removeItem("elecciones_arcgis_mode")',
        'localStorage.removeItem(authKey("arcgis_mode")); localStorage.removeItem("elecciones_arcgis_mode")',
    )
    text = text.replace(
        'localStorage.removeItem("elecciones_arcgis_id_mgr")',
        'localStorage.removeItem(authKey("arcgis_id_mgr")); localStorage.removeItem("elecciones_arcgis_id_mgr")',
    )

    path.write_text(text, encoding="utf-8")
    print("patched", path)


# Municipales: users for muni ambit (legacy GenPrueba names used while FS is shared for tests)
muni_users = """
    const LOCAL_USERS = {
        "AdminEleccionesGenPrueba": { role: "admin", colegio: null },
        "JaramaEleccionesGenPrueba": { role: "colegio", colegio: "C.E.I.P. JARAMA" },
        "AlmendrosEleccionesGenPrueba": { role: "colegio", colegio: "C.E.I.P. LOS ALMENDROS" },
        "jmrojas": { role: "admin", colegio: null },
        "camartin": { role: "admin", colegio: null },
        "sbenito": { role: "colegio", colegio: "C.E.I.P. LOS ALMENDROS" },
        "tromero": { role: "colegio", colegio: "C.E.I.P. JARAMA" }
    };
"""

gen_users = """
    const LOCAL_USERS = {
        "admin1EleccionesGen": { role: "admin", colegio: null },
        "eljaramaEleccionesGen": { role: "colegio", colegio: "C.E.I.P. JARAMA" },
        "elolivarEleccionesGen": { role: "colegio", colegio: "C.E.I.P. EL OLIVAR" },
        "jmrojas": { role: "admin", colegio: null }
    };
"""

# Note: jmrojas in BOTH - user might want OITR in both. Keep for now as intentional dual admin.
# If user wants strict separation of jmrojas too, remove from one - they complained about Admin* cross only.

patch_app(ROOT / "app.js", "elecciones_muni", muni_users)
patch_app(ROOT / "generales" / "app.js", "elecciones_gen", gen_users)

# bump cache
for idx, ver in [(ROOT / "index.html", "2.2.0"), (ROOT / "generales" / "index.html", "1.3.0")]:
    h = idx.read_text(encoding="utf-8")
    h = re.sub(r"app\.js\?v=[\d.]+", f"app.js?v={ver}", h)
    idx.write_text(h, encoding="utf-8")

print("done")
