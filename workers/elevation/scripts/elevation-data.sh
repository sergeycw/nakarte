#!/usr/bin/env bash
# Конвейер данных высот: zip с HGT 3″ viewfinderpanoramas → `elevation-repack` → R2.
#
#   scripts/elevation-data.sh dem3/K38 dem3/L32   # отдельные zip (путь на viewfinderpanoramas.org без .zip)
#   scripts/elevation-data.sh all                 # все zip со страницы покрытия
#
# Запускать из workers/elevation после `cargo build --release -p elevation-repack`.
# R2_MODE=--remote пишет в бакет Cloudflare (нужны CLOUDFLARE_API_TOKEN и CLOUDFLARE_ACCOUNT_ID),
# по умолчанию --local — в локальный R2 wrangler (для `wrangler dev`).
#
# Подвохи:
# - один HGT встречается в нескольких zip; первый выигрывает, повтор пишется в лог как
#   `duplicate <градус> same|different`, итог — в конце (и в $GITHUB_STEP_SUMMARY);
# - API Cloudflare пускает ~1200 запросов за 5 минут, поэтому загрузка в 4 потока;
# - диск: в каждый момент на нём один zip, его HGT и объекты, остальное удаляется.
set -euo pipefail

COVERAGE_URL='https://viewfinderpanoramas.org/Coverage%20map%20viewfinderpanoramas_org3.htm'
BUCKET="${BUCKET:-nakarte-elevation}"
R2_MODE="${R2_MODE:---local}"
REPACK="${REPACK:-target/release/elevation-repack}"
CONCURRENCY="${CONCURRENCY:-4}"

if [ "$#" -eq 0 ]; then
    sed -n '2,15p' "$0"
    exit 2
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
seen="$work/seen.txt"
touch "$seen"

if [ "$1" = all ]; then
    zips=$(curl -fsSL "$COVERAGE_URL" | grep -oE 'href="https://viewfinderpanoramas.org/[^"]+\.zip"' |
        sed -E 's#href="https://viewfinderpanoramas.org/##; s#\.zip"$##' | sort -u)
else
    zips="$*"
fi

started=$(date +%s)
uploaded=0
uploaded_bytes=0
duplicates_same=0
duplicates_different=""

for zip in $zips; do
    echo "== $zip"
    rm -rf "$work/hgt" "$work/out"
    mkdir -p "$work/hgt"
    curl -fsS --retry 5 --retry-delay 10 -o "$work/archive.zip" "https://viewfinderpanoramas.org/$zip.zip"
    unzip -q -j -o "$work/archive.zip" -d "$work/hgt"
    rm "$work/archive.zip"
    find "$work/hgt" -type f ! -iname '*.hgt' -delete
    if [ -z "$(ls -A "$work/hgt")" ]; then
        echo "no HGT in $zip"
        continue
    fi
    "$REPACK" --out "$work/out" "$work/hgt"/* >/dev/null
    rm -rf "$work/hgt"

    entries=()
    for object in "$work/out/dem3"/*; do
        name=$(basename "$object")
        sum=$(shasum -a 256 "$object" | cut -d' ' -f1)
        previous=$(awk -v name="$name" '$1 == name {print $2}' "$seen")
        if [ -n "$previous" ]; then
            if [ "$previous" = "$sum" ]; then
                duplicates_same=$((duplicates_same + 1))
                echo "duplicate $name same"
            else
                duplicates_different="$duplicates_different $name($zip)"
                echo "duplicate $name different, kept the first"
            fi
            rm "$object"
            continue
        fi
        echo "$name $sum" >>"$seen"
        uploaded_bytes=$((uploaded_bytes + $(wc -c <"$object")))
        entries+=("{\"key\":\"dem3/$name\",\"file\":\"$object\"}")
    done
    if [ "${#entries[@]}" -gt 0 ]; then
        (IFS=,; echo "[${entries[*]}]") >"$work/bulk.json"
        npx --yes wrangler@4 r2 bulk put "$BUCKET" --filename "$work/bulk.json" \
            --concurrency "$CONCURRENCY" --content-type application/octet-stream "$R2_MODE"
        uploaded=$((uploaded + ${#entries[@]}))
    fi
    rm -rf "$work/out"
done

summary="uploaded $uploaded objects, $((uploaded_bytes / 1048576)) MiB, $(($(date +%s) - started)) s;"
summary="$summary duplicates: $duplicates_same same, different:${duplicates_different:- none}"
echo "$summary"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "$summary" >>"$GITHUB_STEP_SUMMARY"
fi
