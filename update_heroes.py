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

CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/"
# В сетке игра показывает вертикальный портрет (heroimagestyle="portrait"), обрезанный «cover»
# под картинку карточки: 51×83 минус отступ 4px с каждой стороны (panorama hero_grid_new.css).
IMG_W, IMG_H = 51 - 8, 83 - 8


def fetch(url):
    return Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")


def cover_crop(im):
    w, h = im.size
    if w / h > IMG_W / IMG_H:
        cw = h * IMG_W / IMG_H
        return im.crop((int((w - cw) / 2), 0, int((w + cw) / 2), h))
    ch = w * IMG_H / IMG_W
    return im.crop((0, int((h - ch) / 2), w, int((h + ch) / 2)))


def hero_color(h):
    short = h["name"].replace("npc_dota_hero_", "")
    try:
        im, vert = fetch(CDN + "heroes/" + short + "_vert.jpg"), 1
    except Exception:  # у новых героев вертикального портрета на CDN нет — берём широкий
        im, vert = fetch(CDN + "dota_react/heroes/" + short + ".png"), 0
    c = cover_crop(im).resize((1, 1), Image.BOX).getpixel((0, 0))
    r = dict(id=h["id"], n=h["localized_name"], s=short, a=h["primary_attr"], c="%02x%02x%02x" % c)
    if vert:
        r["v"] = 1
    return r


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
