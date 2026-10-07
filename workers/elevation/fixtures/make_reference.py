#!/usr/bin/env python3
"""Снимает эталоны контрактного теста с сервиса автора. Запускается вручную, один раз.

    python3 make_reference.py > reference.txt

Точки — в 10 четвертях градуса (по куску 301×301 на каждую), список кусков для
`elevation-repack --only` печатается в stderr: из них собираются прореженные `dem3/*`.
Сид фиксирован, поэтому повторный запуск даёт те же точки; ответы автора берутся живые.
Формат строки reference.txt: `<lat> <lng> <ответ автора>`; координаты с 6 знаками, как
шлёт клиент (`src/lib/elevations/index.js`).
"""

import random
import sys
import urllib.request

AUTHOR = 'https://elevation.nakarte.me/'
POINTS_PER_CELL = 28

# Юго-западный угол четверти градуса и что в ней проверяется.
CELLS = [
    (43.25, 42.25, 'Эльбрус'),
    (42.5, 44.5, 'Казбек'),
    (41.5, 44.75, 'Тбилиси'),
    (41.5, 41.5, 'Батуми, море и берег'),
    (45.75, 6.75, 'Монблан'),
    (45.75, 7.5, 'Маттерхорн'),
    (27.75, 86.75, 'Эверест'),
    (53.75, 27.5, 'Минск, равнина'),
    (-32.75, -70.25, 'Аконкагуа, юг и запад'),
    (78.0, 15.5, 'Шпицберген'),
]

# Точки без данных и вне сетки: для них фикстуры не нужны.
EXTRA = [(43.0, 35.0), (90.0, 0.0), (90.5, 0.0), (43.35, 202.44), (43.0, 180.0), (43.0, -180.0)]


def degree_name(lat0, lon0):
    return f"{'S' if lat0 < 0 else 'N'}{abs(lat0):02d}{'W' if lon0 < 0 else 'E'}{abs(lon0):03d}"


def cell_points(rng, lat_lo, lon_lo):
    points = [(lat_lo, lon_lo), (lat_lo + 100 / 1200, lon_lo + 200 / 1200)]
    while len(points) < POINTS_PER_CELL + 2:
        lat = round(lat_lo + rng.random() * 0.25, 6)
        lon = round(lon_lo + rng.random() * 0.25, 6)
        if lat < lat_lo + 0.25 and lon < lon_lo + 0.25:
            points.append((lat, lon))
    return points


def main():
    rng = random.Random(20261007)
    points = []
    chunks = {}
    for lat_lo, lon_lo, _ in CELLS:
        points.extend(cell_points(rng, lat_lo, lon_lo))
        tile_y, tile_x = round(lat_lo * 4), round(lon_lo * 4)
        name = degree_name(tile_y // 4, tile_x // 4)
        chunks.setdefault(name, []).append((tile_y % 4) * 4 + tile_x % 4)
    points.extend(EXTRA)
    body = '\n'.join(f'{lat:.6f} {lon:.6f}' for lat, lon in points).encode()
    request = urllib.request.Request(AUTHOR, data=body, method='POST')
    with urllib.request.urlopen(request) as response:
        answers = response.read().decode().split('\n')
    assert len(answers) == len(points), (len(answers), len(points))
    for (lat, lon), answer in zip(points, answers):
        print(f'{lat:.6f} {lon:.6f} {answer}')
    only = ' '.join(f'--only {name}={",".join(map(str, sorted(c)))}' for name, c in sorted(chunks.items()))
    print(only, file=sys.stderr)


if __name__ == '__main__':
    main()
