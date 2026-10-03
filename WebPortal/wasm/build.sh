#!/bin/bash
# Build NarvosEngine C++ → WebAssembly via Emscripten
# Prerequisites: emsdk installed and activated (source emsdk_env.sh)
#
# Usage:
#   cd WebPortal/wasm
#   ./build.sh          # release build
#   ./build.sh debug    # debug build with DWARF

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUILD_TYPE="${1:-Release}"
if [ "$BUILD_TYPE" = "debug" ]; then
    BUILD_TYPE="Debug"
fi

BUILD_DIR="build"
mkdir -p "$BUILD_DIR"

# Check GLM vendored
if [ ! -d "vendor/glm" ]; then
    echo "Fetching GLM (header-only)..."
    mkdir -p vendor
    git clone --depth 1 --branch 1.0.1 https://github.com/g-truc/glm.git vendor/glm
fi

echo "=== NarvosEngine WASM Build ($BUILD_TYPE) ==="

emcmake cmake -B "$BUILD_DIR" -S . \
    -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
    -DCMAKE_CXX_STANDARD=20

emmake cmake --build "$BUILD_DIR" --parallel

echo ""
echo "Build complete:"
ls -lh dist/narvos-engine.*
echo ""
echo "Copy dist/narvos-engine.{js,wasm} to WebPortal/public/wasm/"
