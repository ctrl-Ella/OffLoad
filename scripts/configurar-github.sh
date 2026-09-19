#!/usr/bin/env bash
#
# Configura el repositorio en GitHub: etiquetas, ramas y reglas de protección.
#
# CUÁNDO EJECUTARLO
#   Una sola vez, sobre el repositorio ya creado.
#   Es idempotente: si lo lanzas dos veces no rompe nada.
#
# QUÉ NECESITAS ANTES
#   - gh instalado y con sesión iniciada:  gh auth login
#   - el repositorio ya creado y como remoto `origin`
#
# QUÉ HACE
#   1. Configura git para que los acentos no se rompan (UTF-8)
#   2. Crea las etiquetas de .github/labels.yml
#   3. Crea la rama dev
#   4. Aplica las reglas de protección de .github/rulesets/
#   5. Activa el borrado automático de ramas al mergear
#
# QUÉ NO HACE
#   - Crear el repositorio ni la organización
#   - Crear el tablero (Project): se crea a mano y el auto-añadir se activa
#     desde su pantalla de Workflows. Ver docs/workflow/issues-y-labels.md

set -euo pipefail

# ---------------------------------------------------------------------------
# Comprobaciones previas: fallar pronto y con un mensaje que se entienda
# ---------------------------------------------------------------------------

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: falta la herramienta 'gh' (GitHub CLI)."
  echo "       Instálala desde https://cli.github.com y vuelve a intentarlo."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: 'gh' no tiene sesión iniciada."
  echo "       Ejecuta:  gh auth login"
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "ERROR: este repositorio no tiene remoto 'origin'."
  echo "       Crea el repositorio en la organización y añádelo:"
  echo "       git remote add origin https://github.com/ctrl-Ella/OffLoad.git"
  exit 1
fi

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
echo "Repositorio: $REPO"
echo

# ---------------------------------------------------------------------------
# 1. UTF-8 en git
# ---------------------------------------------------------------------------
# Sin esto, en Windows los acentos acaban en el historial como \303\261 y los
# nombres de archivo con tilde se ven igual de mal.

echo "== Configurando git para UTF-8 =="
git config core.quotepath false
git config i18n.commitEncoding utf-8
git config i18n.logOutputEncoding utf-8
echo "   hecho"
echo

# ---------------------------------------------------------------------------
# 2. Etiquetas
# ---------------------------------------------------------------------------

echo "== Creando etiquetas =="

# Se leen de .github/labels.yml sin depender de un parser YAML: el formato es
# fijo y conocido (lo escribimos nosotras), así que basta con leer los campos.
nombre=""
color=""
descripcion=""

crear_etiqueta() {
  [ -z "$nombre" ] && return 0
  if gh label create "$nombre" --color "$color" --description "$descripcion" --force >/dev/null 2>&1; then
    echo "   $nombre"
  else
    echo "   AVISO: no se pudo crear '$nombre'"
  fi
}

while IFS= read -r linea; do
  case "$linea" in
    "- nombre: "*)
      crear_etiqueta
      nombre="$(echo "$linea" | sed 's/^- nombre: *//; s/^"//; s/"$//')"
      color=""
      descripcion=""
      ;;
    *"color: "*)
      color="$(echo "$linea" | sed 's/^ *color: *//; s/^"//; s/"$//')"
      ;;
    *"descripcion: "*)
      descripcion="$(echo "$linea" | sed 's/^ *descripcion: *//; s/^"//; s/"$//')"
      ;;
  esac
done < .github/labels.yml
crear_etiqueta

echo

# ---------------------------------------------------------------------------
# 3. Rama dev
# ---------------------------------------------------------------------------

echo "== Creando la rama dev =="
if git show-ref --verify --quiet refs/heads/dev; then
  echo "   ya existe en local"
else
  git branch dev
  echo "   creada en local"
fi

if git ls-remote --exit-code --heads origin dev >/dev/null 2>&1; then
  echo "   ya existe en remoto"
else
  git push -u origin dev
  echo "   subida a remoto"
fi
echo

# ---------------------------------------------------------------------------
# 4. Reglas de protección
# ---------------------------------------------------------------------------
# Solo funcionan en repositorios públicos con plan gratuito. Si el repo es
# privado, la API responde con un error de permisos: se avisa y se sigue.

echo "== Aplicando reglas de protección =="
for archivo in .github/rulesets/*.json; do
  nombre_regla="$(basename "$archivo" .json)"
  if gh api "repos/$REPO/rulesets" \
       --method POST \
       --input "$archivo" >/dev/null 2>&1; then
    echo "   $nombre_regla aplicada"
  else
    echo "   AVISO: no se pudo aplicar '$nombre_regla'."
    echo "          Suele significar que el repositorio es privado (las reglas"
    echo "          solo funcionan en públicos con plan gratuito) o que la regla"
    echo "          ya existe. Compruébalo en Settings > Rules."
  fi
done
echo

# ---------------------------------------------------------------------------
# 5. Ajustes del repositorio
# ---------------------------------------------------------------------------

echo "== Ajustes del repositorio =="
if gh api "repos/$REPO" --method PATCH \
     -F delete_branch_on_merge=true \
     -F allow_squash_merge=true \
     -F allow_merge_commit=true \
     -F allow_rebase_merge=false >/dev/null 2>&1; then
  echo "   borrado automático de ramas al mergear: activado"
else
  echo "   AVISO: no se pudieron cambiar los ajustes (¿permisos de administración?)"
fi
echo

# ---------------------------------------------------------------------------
# Lo que queda a mano
# ---------------------------------------------------------------------------

cat <<'FIN'
== Listo ==

Queda por hacer a mano (GitHub no lo permite por API con plan gratuito):

  1. Crear el tablero (Project) en la organización.
     Después: Workflows > Auto-add to project, con el filtro  is:issue is:open
     Así las issues entran solas al crearse.

  2. Comprobar que el escaneo de secretos está activo:
     Settings > Code security > Secret scanning > Push protection

  3. Rellenar .github/CODEOWNERS con los usuarios reales del equipo.

  4. Revisar las URLs de .github/ISSUE_TEMPLATE/config.yml: llevan un nombre
     de organización de ejemplo.

Detalles en docs/workflow/issues-y-labels.md
FIN
