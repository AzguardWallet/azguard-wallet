#!/usr/bin/env bash
# Extract + gzip the barretenberg WASM blobs the wallet bundles for proof generation.
#
# Download these two release assets for the target version from
#   https://github.com/AztecProtocol/aztec-packages/releases
# into <src-dir>:
#   - barretenberg-wasm.tar.gz
#   - barretenberg-threads-wasm.tar.gz
#
# Usage: extract-wasm.sh <src-dir> [dest-dir]
#   <src-dir>   dir containing the two downloaded *-wasm.tar.gz files
#   [dest-dir]  wallet bb.js libs dir (default: ./libs/@aztec/bb.js relative to cwd)
#
# Note: compare DECOMPRESSED content before committing — gzip metadata makes .gz bytes differ
# even when the wasm is unchanged:  gunzip -c old.gz | sha256sum  vs  gunzip -c new.gz | sha256sum
set -euo pipefail

SRC_DIR="${1:?source dir with barretenberg-wasm.tar.gz and barretenberg-threads-wasm.tar.gz}"
DEST_DIR="${2:-./libs/@aztec/bb.js}"

if [ ! -d "$SRC_DIR" ]; then
  echo "Error: source directory not found: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
echo "Source:      $SRC_DIR"
echo "Destination: $DEST_DIR"

tar xzf "$SRC_DIR/barretenberg-wasm.tar.gz" --to-stdout barretenberg.wasm \
  | gzip -9 > "$DEST_DIR/barretenberg.wasm.gz"

tar xzf "$SRC_DIR/barretenberg-threads-wasm.tar.gz" --to-stdout barretenberg.wasm \
  | gzip -9 > "$DEST_DIR/barretenberg-threads.wasm.gz"

echo "Created:"
echo "  $DEST_DIR/barretenberg.wasm.gz ($(wc -c < "$DEST_DIR/barretenberg.wasm.gz") bytes)"
echo "  $DEST_DIR/barretenberg-threads.wasm.gz ($(wc -c < "$DEST_DIR/barretenberg-threads.wasm.gz") bytes)"
