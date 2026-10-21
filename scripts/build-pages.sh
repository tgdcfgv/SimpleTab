#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

# Only publish web assets; keep extension packages and repository files private.
rm -rf .pages-output
mkdir -p .pages-output
cp newtab.html .pages-output/index.html
cp -R css js icons .pages-output/
cp privacy.html install.html .pages-output/
cp icons/favicon.ico .pages-output/favicon.ico
if [ -d functions ]; then
  cp -R functions .pages-output/
fi
printf '/newtab.html / 301\n' > .pages-output/_redirects
printf '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate\n' > .pages-output/_headers
echo 'Cloudflare Pages assets built in .pages-output/'
