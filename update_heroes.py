"""Обновляет heroes.js: список героев (OpenDota) + средний цвет портрета (Valve CDN).

Запуск:  pip install pillow  &&  python update_heroes.py
Нужен после выхода новых героев.
"""
import concurrent.futures as cf
import io
import json
import pathlib
import sys
import urllib.request

from PIL import Image

op = urllib.request.build_opener()
op.addheaders = [("User-Agent", "Mozilla/5.0")]
urllib.request.install_opener(op)

CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/"
CARD_W, CARD_H = 51, 83  # пропорции карточки героя в сетке (panorama hero_grid_new.css)


def hero_color(h):
    short = h["name"].replace("npc_dota_hero_", "")
    im = Image.open(io.BytesIO(urllib.request.urlopen(CDN + short + ".png").read())).convert("RGB")
    w, H = im.size
    cw = H * CARD_W / CARD_H  # центральный вертикальный кроп, как карточка в сетке
    x0 = (w - cw) / 2
    crop = im.crop((int(x0), 0, int(x0 + cw), H))
    c = crop.resize((1, 1), Image.BOX).getpixel((0, 0))
    return dict(id=h["id"], n=h["localized_name"], s=short, a=h["primary_attr"], c="%02x%02x%02x" % c)


def main():
    heroes = json.load(urllib.request.urlopen("https://api.opendota.com/api/heroes"))
    with cf.ThreadPoolExecutor(16) as ex:
        res = sorted(ex.map(hero_color, heroes), key=lambda r: r["id"])
    out = pathlib.Path(__file__).with_name("heroes.js")
    out.write_text(
        "// Сгенерировано update_heroes.py из OpenDota API + портретов Valve CDN.\n"
        "window.HEROES = " + json.dumps(res, separators=(",", ":"), ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"{len(res)} героев → {out}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # консоль Windows по умолчанию cp1252
    main()
