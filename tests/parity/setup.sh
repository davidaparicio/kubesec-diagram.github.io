#!/bin/sh
# Clones the reference (this site before diagram-webkit) at its pinned commit
# and builds the current site into tests/parity/.current. With
# DIAGRAM_WEBKIT_DIR set, the build uses that diagram-webkit checkout.
set -eu

REFERENCE_COMMIT=9847549b2d529942ad21339ea3a36c89f2e8f833
REFERENCE_SOURCE=${REFERENCE_SOURCE:-https://github.com/kubesec-diagram/kubesec-diagram.github.io.git}
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)

if [ ! -d "$HERE/.reference/.git" ]; then
  git clone --quiet --no-checkout "$REFERENCE_SOURCE" "$HERE/.reference"
fi
git -C "$HERE/.reference" checkout --quiet "$REFERENCE_COMMIT"

(cd "$ROOT" && npx vite build --logLevel warn --emptyOutDir --outDir "$HERE/.current")
