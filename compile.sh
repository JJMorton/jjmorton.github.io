#!/bin/bash

# Compile all typescript in the project
tsc

echo "Starting server..."
PORT=1337
PORT=$PORT node server.js &
sleep 1

# Only output_dir/ will be modified
output_dir="./docs"
static_dir="./static"

# echo "Compiling latex..."
# cd "$static_dir/tex"
# for file in *.tex; do
# 	equation="$(cat "$file")"
# 	output="$(basename "$file" | cut -d '.' -f 1).png"
# 	echo "Processing $file -> $output... "
# 	pnglatex -p bm -b transparent -Sf "$equation" -o "$output" -d 500
# done
# cd ../..

# Remove the output directory to start from scratch
rm -rf "$output_dir"

# Copy all the static assets over
echo "Copying static files..."
mkdir -p "$output_dir"
cp -r "$static_dir"/* "$output_dir/"

urls=(
	"/"
	"/simulations"
	"/about"
	"/lmc"
	"/spirograph"
	"/photos"
	"/art"
	"/404"
)

files=(
	"/index.html"
	"/simulations/index.html"
	"/about/index.html"
	"/lmc/index.html"
	"/spirograph/index.html"
	"/404.html"
)

echo "Finding simulations..."
simulations=( $(grep -Eo '\"id\": \".*\"' simulations.json | sed 's/"id": //g' | sed 's/"//g') )
for i in $(seq 0 $((${#simulations[@]} - 1))); do
	urls+=("/simulations/${simulations[$i]}")
	files+=("/simulations/${simulations[$i]}/index.html")
done

echo "Writing files..."
for i in $(seq 0 $((${#urls[@]} - 1))); do
	echo "localhost:$PORT${urls[$i]} > $output_dir${files[$i]}"
	mkdir -p "$(dirname "$output_dir${files[$i]}")"
	curl -s "localhost:$PORT${urls[$i]}" > "$output_dir${files[$i]}"
done

echo "Saving timestamp..."
date > "$output_dir/compiledate"

kill $(jobs -p)

echo "Creating CNAME file..."
echo "jjmorton.com" > "${output_dir}/CNAME"
