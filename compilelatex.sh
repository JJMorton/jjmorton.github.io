#!/bin/bash

# Requires 'pnglatex' on the AUR

cd ./static/tex
rm *.png
for file in *.tex; do
	equation="$(cat "$file")"
	output="$(basename "$file" | cut -d '.' -f 1).png"
	echo "Processing $file -> $output... "
	pnglatex -p bm -b transparent -Sf "$equation" -o "$output" -d 500
done
cd ../..
