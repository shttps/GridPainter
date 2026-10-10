"""Обновляет файлы главного меню Dota 2 для сборщика фонов (dota-menu/).

Фон меню ставится паком pak02_dir.vpk: в нём текущий dashboard.xml Valve, где фон меню
(override-background у DOTADashboardBackgroundManager) указывает на нашу разметку с видео.
Поэтому после крупных обновлений Доты, когда Valve меняет меню, файлы надо обновить —
иначе пак подменит меню старой версией и что-то в нём пропадёт.

Источник — декомпилированные файлы клиента в github.com/spirit-bear-productions/dota_vpk_updates
(обновляются сами после каждого патча). Декомпилятор пишет ссылки без «_c» и комментарий
в первой строке — приводим к виду, в котором файлы лежат в игре.

Запуск:  python update_menu.py
Потом проверь фон в игре и подними ?v= у скриптов в workshop.html.
"""
import json
import pathlib
import re
import sys
import urllib.request

REPO = "spirit-bear-productions/dota_vpk_updates"
FILES = ["panorama/layout/dashboard.xml", "panorama/layout/dashboard_page_home.xml"]
OUT = pathlib.Path(__file__).with_name("dota-menu")

op = urllib.request.build_opener()
op.addheaders = [("User-Agent", "GridStudio-update-menu")]
urllib.request.install_opener(op)


def text(url):
    return urllib.request.urlopen(url).read().decode("utf-8")


def normalize(src):
    src = src.replace("\r\n", "\n")
    src = re.sub(r"\A<!--[^\n]*-->\n", "", src)
    # s2r://….vcss → s2r://….vcss_c (и остальные скомпилированные ресурсы)
    src = re.sub(r"(s2r://[^\"')\s]+\.(?:vcss|vxml|vjs|vtex|vsvg|vpcf|vmdl|vsnd|vmat))(?!_c)", r"\1_c", src)
    return src.strip() + "\n"


def main():
    OUT.mkdir(exist_ok=True)
    for path in FILES:
        src = normalize(text(f"https://raw.githubusercontent.com/{REPO}/main/{path}"))
        if re.search(r"[^\x00-\x7f]", src):
            sys.exit(f"{path}: не-ASCII символы — так Valve файлы не пишет, что-то не то с источником")
        if path.endswith("dashboard.xml"):
            n = len(re.findall(r"<DOTADashboardBackgroundManager\b[^>]*\boverride-background=\"", src))
            if n != 1:
                sys.exit(f"{path}: override-background найден {n} раз вместо одного — Valve поменяла меню, сборщик надо проверять руками")
        if path.endswith("dashboard_page_home.xml") and '<Panel id="TodayPages"' not in src:
            sys.exit(f"{path}: нет колонки новостей #TodayPages — галочку «Убрать новости» надо проверять руками")
        (OUT / pathlib.Path(path).name).write_text(src, encoding="utf-8", newline="\n")
        print("ok", path)
    # дата — последнего коммита в источнике, который менял меню
    commits = json.loads(text(f"https://api.github.com/repos/{REPO}/commits?path={FILES[0]}&per_page=1"))
    date = commits[0]["commit"]["committer"]["date"][:10] if commits else ""
    (OUT / "menu.json").write_text(json.dumps({"source": f"https://github.com/{REPO}", "date": date}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("menu.json:", date)


if __name__ == "__main__":
    main()
