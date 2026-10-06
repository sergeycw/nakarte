#!/bin/sh
set -eu

cd "$(dirname "$0")"
container=${BROUTER_CONTAINER:-nakarte-brouter}

mkdir -p lib profiles classes
docker cp "$container:/app/brouter.jar" lib/brouter.jar
for name in lookups.dat hiking-mountain.brf trekking.brf fastbike.brf gravel.brf mtb.brf; do
    docker cp "$container:/profiles2/$name" "profiles/$name"
done

rm -rf classes/*
javac --release 11 -cp lib/brouter.jar -d classes java/WasmRouter.java
jar --create --file lib/wasm-router.jar -C classes .

rm -rf patch-classes && mkdir patch-classes
javac --release 11 -cp lib/brouter.jar -d patch-classes patch/btools/mapaccess/NodesCache.java
jar --create --file lib/brouter-patch.jar -C patch-classes .
ls -l lib profiles
