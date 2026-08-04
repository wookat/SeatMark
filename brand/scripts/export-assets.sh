#!/usr/bin/env bash
# 将 brand/assets/ 下 SVG 导出为同名 PNG（需 librsvg：apt install librsvg2-bin）
set -euo pipefail
cd "$(dirname "$0")/../assets"
for f in *.svg; do
  rsvg-convert -o "${f%.svg}.png" "$f"
  echo "exported ${f%.svg}.png"
done
