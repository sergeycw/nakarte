#!/usr/bin/env bash
# Конвейер данных высот: zip с HGT 3″ viewfinderpanoramas → `elevation-repack` → R2.
#
#   scripts/elevation-data.sh dem3/K38 dem3/L32   # отдельные zip (путь на viewfinderpanoramas.org без .zip)
#   scripts/elevation-data.sh all                 # все zip со страницы покрытия
#
# Запускать из workers/elevation после `cargo build --release -p elevation-repack`.
# По умолчанию (R2_MODE=--local) пишет в локальный R2 wrangler для `wrangler dev`.
# R2_MODE=--remote пишет в бакет Cloudflare через S3 API R2: нужны R2_ACCESS_KEY_ID,
# R2_SECRET_ACCESS_KEY (токен R2 с Object Read & Write на бакет) и R2_ENDPOINT
# (https://<account id>.r2.cloudflarestorage.com). Градусы, которые уже лежат в бакете,
# пропускаются, так что прерванный прогон можно просто перезапустить; FORCE=1 перезаливает всё.
#
# Подвохи:
# - `wrangler r2 bulk put --remote` идёт через API Cloudflare (~1200 запросов за 5 минут) и на
#   деле давал ~0.4 объекта в секунду — 27 тыс. градусов не влезали в лимит job. Поэтому S3;
# - viewfinderpanoramas отдаёт ~1.5 МБ/с на соединение, поэтому zip готовятся пачками по
#   PARALLEL штук параллельно, а дедупликация и заливка идут по порядку списка;
# - один HGT встречается в нескольких zip; первый по списку выигрывает, повторы считаются как
#   same|different, итог — в конце (и в $GITHUB_STEP_SUMMARY);
# - диск: в каждый момент на нём одна пачка zip и её объекты.
set -euo pipefail

COVERAGE_URL='https://viewfinderpanoramas.org/Coverage%20map%20viewfinderpanoramas_org3.htm'
BUCKET="${BUCKET:-nakarte-elevation}"
R2_MODE="${R2_MODE:---local}"
REPACK="${REPACK:-$PWD/target/release/elevation-repack}"
PARALLEL="${PARALLEL:-8}"
FORCE="${FORCE:-0}"

if [ "$#" -eq 0 ]; then
    sed -n '2,23p' "$0"
    exit 2
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# Учёт градусов — файлами-маркерами: поиск по спискам из 27 тыс. строк на каждый объект слишком медленный.
seen="$work/seen"
existing="$work/existing"
mkdir -p "$seen" "$existing"

if [ "$R2_MODE" = --remote ]; then
    # ключи из секретов GitHub часто приходят с переводом строки после копирования из дашборда,
    # а aws CLI тогда собирает битый заголовок Authorization
    AWS_ACCESS_KEY_ID=$(printf '%s' "$R2_ACCESS_KEY_ID" | tr -d '[:space:]')
    AWS_SECRET_ACCESS_KEY=$(printf '%s' "$R2_SECRET_ACCESS_KEY" | tr -d '[:space:]')
    export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
    export AWS_DEFAULT_REGION=auto AWS_CONFIG_FILE="$work/aws-config"
    printf '[default]\ns3 =\n  max_concurrent_requests = 32\n' >"$AWS_CONFIG_FILE"
    if [ "$FORCE" != 1 ]; then
        # не `aws s3 ls`: на пустом префиксе он выходит с кодом 1, а s3api — нет
        aws s3api list-objects-v2 --bucket "$BUCKET" --prefix dem3/ --endpoint-url "$R2_ENDPOINT" \
            --query 'Contents[].Key' --output text >"$work/listing.txt"
        { tr '\t' '\n' <"$work/listing.txt" | grep '^dem3/' || true; } | sed 's#^dem3/##' >"$work/existing.txt"
        (cd "$existing" && xargs touch <"$work/existing.txt")
        echo "already in bucket: $(wc -l <"$work/existing.txt") degrees"
    fi
fi

if [ "$1" = all ]; then
    zips=$(curl -fsSL "$COVERAGE_URL" | grep -oE 'href="https://viewfinderpanoramas.org/[^"]+\.zip"' |
        sed -E 's#href="https://viewfinderpanoramas.org/##; s#\.zip"$##' | sort -u)
else
    zips="$*"
fi

# Скачать, распаковать и перепаковать один zip в $2/dem3; вызывается параллельно из xargs.
prepare() {
    local zip="$1" dir="$2"
    mkdir -p "$dir/hgt"
    curl -fsS --retry 5 --retry-delay 10 -o "$dir/archive.zip" "https://viewfinderpanoramas.org/$zip.zip"
    unzip -q -j -o "$dir/archive.zip" -d "$dir/hgt"
    rm "$dir/archive.zip"
    find "$dir/hgt" -type f ! -iname '*.hgt' -delete
    if [ -n "$(ls -A "$dir/hgt")" ]; then
        "$REPACK" --out "$dir" "$dir/hgt"/* >/dev/null
    fi
    rm -rf "$dir/hgt"
}
export -f prepare
export REPACK

started=$(date +%s)
uploaded=0
uploaded_bytes=0
skipped_existing=0
duplicates_same=0
duplicates_different=""

# Отобрать из каталога пачки новые градусы в $work/upload, по порядку zip.
collect() {
    local zip="$1" dir="$2"
    if [ ! -d "$dir/dem3" ]; then
        echo "no HGT in $zip"
        return
    fi
    for object in "$dir/dem3"/*; do
        local name sum
        name=$(basename "$object")
        sum=$(shasum -a 256 "$object" | cut -d' ' -f1)
        if [ -f "$seen/$name" ]; then
            if [ "$(cat "$seen/$name")" = "$sum" ]; then
                duplicates_same=$((duplicates_same + 1))
            else
                duplicates_different="$duplicates_different $name($zip)"
                echo "duplicate $name in $zip differs, kept the first"
            fi
            continue
        fi
        echo "$sum" >"$seen/$name"
        if [ -f "$existing/$name" ]; then
            skipped_existing=$((skipped_existing + 1))
            continue
        fi
        mv "$object" "$work/upload/dem3/$name"
    done
}

upload() {
    local count
    count=$(find "$work/upload/dem3" -type f | wc -l)
    [ "$count" -gt 0 ] || return 0
    uploaded=$((uploaded + count))
    uploaded_bytes=$((uploaded_bytes + $(du -sk "$work/upload/dem3" | cut -f1) * 1024))
    if [ "$R2_MODE" = --remote ]; then
        aws s3 cp "$work/upload/dem3/" "s3://$BUCKET/dem3/" --recursive --endpoint-url "$R2_ENDPOINT" \
            --content-type application/octet-stream --only-show-errors
        return
    fi
    local entries=()
    for object in "$work/upload/dem3"/*; do
        entries+=("{\"key\":\"dem3/$(basename "$object")\",\"file\":\"$object\"}")
    done
    (IFS=,; echo "[${entries[*]}]") >"$work/bulk.json"
    npx --yes wrangler@4 r2 bulk put "$BUCKET" --filename "$work/bulk.json" \
        --content-type application/octet-stream --local >/dev/null
}

batch=()
flush() {
    [ "${#batch[@]}" -gt 0 ] || return 0
    rm -rf "$work/batch" "$work/upload"
    mkdir -p "$work/batch" "$work/upload/dem3"
    local i
    for i in "${!batch[@]}"; do
        printf '%s\0%s\0' "${batch[$i]}" "$work/batch/$i"
    done | xargs -0 -n 2 -P "$PARALLEL" bash -c 'set -euo pipefail; prepare "$0" "$1"'
    for i in "${!batch[@]}"; do
        collect "${batch[$i]}" "$work/batch/$i"
    done
    upload
    echo "done up to ${batch[${#batch[@]} - 1]}: uploaded $uploaded, skipped $skipped_existing, $(($(date +%s) - started)) s"
    batch=()
}

for zip in $zips; do
    batch+=("$zip")
    if [ "${#batch[@]}" -ge "$PARALLEL" ]; then
        flush
    fi
done
flush

summary="uploaded $uploaded objects, $((uploaded_bytes / 1048576)) MiB, skipped $skipped_existing already in bucket,"
summary="$summary $(($(date +%s) - started)) s; duplicates: $duplicates_same same, different:${duplicates_different:- none}"
echo "$summary"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "$summary" >>"$GITHUB_STEP_SUMMARY"
fi
