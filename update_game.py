"""Генерирует game-data.js для «Угадайки»: портрет каждого героя в оттенках серого.

Valve CDN отдаёт портреты с CORS только для dota2.com, поэтому браузер не может прочитать
их пиксели и построить ASCII-арт сам — портреты готовим заранее этим скриптом.

Запуск:  pip install pillow  &&  python update_game.py
Нужен после update_heroes.py, когда выходят новые герои.
"""
import base64
import concurrent.futures as cf
import io
import json
import pathlib
import sys
import urllib.request

from PIL import Image, ImageOps

op = urllib.request.build_opener()
op.addheaders = [("User-Agent", "Mozilla/5.0")]
urllib.request.install_opener(op)

CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/"
# Пропорции картинки карточки в сетке (51×83 минус отступы 4px) — как портрет в игре
CARD_W, CARD_H = 43, 75
# Размер портрета в данных: 56×98, 4 бита на пиксель (16 оттенков хватает для ASCII)
W, H = 56, 98


def fetch(url):
    return Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")


def cover_crop(im):
    w, h = im.size
    if w / h > CARD_W / CARD_H:
        cw = h * CARD_W / CARD_H
        return im.crop((int((w - cw) / 2), 0, int((w + cw) / 2), h))
    ch = w * CARD_H / CARD_W
    return im.crop((0, int((h - ch) / 2), w, int((h + ch) / 2)))


def portrait(h):
    try:
        im = fetch(CDN + "heroes/" + h["s"] + "_vert.jpg")
    except Exception:  # у новых героев вертикального портрета нет — берём широкий
        im = fetch(CDN + "dota_react/heroes/" + h["s"] + ".png")
    g = ImageOps.autocontrast(cover_crop(im).convert("L"), cutoff=1)
    px = g.resize((W, H), Image.LANCZOS).tobytes()
    packed = bytes((px[i] >> 4) << 4 | (px[i + 1] >> 4) for i in range(0, len(px), 2))
    return h["id"], base64.b64encode(packed).decode("ascii")


def main():
    src = pathlib.Path(__file__).with_name("heroes.js").read_text(encoding="utf-8")
    heroes = json.loads(src[src.index("["): src.rindex("]") + 1])
    with cf.ThreadPoolExecutor(16) as ex:
        arts = dict(sorted(ex.map(portrait, heroes)))
    out = pathlib.Path(__file__).with_name("game-data.js")
    out.write_text(
        "// Сгенерировано update_game.py: портреты героев для «Угадайки», "
        f"{W}×{H}, 16 оттенков серого (4 бита на пиксель, base64).\n"
        "window.GAME_ARTS = " + json.dumps({"w": W, "h": H, "d": arts}, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"{len(arts)} портретов → {out} ({out.stat().st_size // 1024} КБ)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # консоль Windows по умолчанию cp1252
    main()
