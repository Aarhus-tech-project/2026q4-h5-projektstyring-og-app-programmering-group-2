import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE / "src"))

import database
import services
import media

CHROME_CANDIDATES = [
    os.environ.get("CHROME", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
]
MERMAID_CLI = "@mermaid-js/mermaid-cli@11.4.2"

MERMAID_SOURCES = {
    "DatabaseDiagram.md": ["database-er"],
    "ServiceDiagram.md": ["services-flowchart", "media-upload-sequence", "vote-counting-sequence"],
}


def chrome():
    for c in CHROME_CANDIDATES:
        if c and Path(c).exists():
            return c
    return None


def svg_size(svg):
    m = re.search(r'<svg[^>]*width="(\d+)"[^>]*height="(\d+)"', svg)
    return int(m.group(1)), int(m.group(2))


def png_from_svg(svg_path, png_path, scale=2):
    exe = chrome()
    if not exe:
        print(f"  skipped {png_path.name}: no Chrome found (set CHROME=...)")
        return
    w, h = svg_size(svg_path.read_text())
    subprocess.run([exe, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    f"--force-device-scale-factor={scale}", f"--window-size={w},{h}",
                    f"--screenshot={png_path}", svg_path.as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"  wrote {png_path.relative_to(ROOT)}")


def build_hand_laid_out():
    for name, module in [("database", database), ("services", services), ("media", media)]:
        svg = HERE / f"{name}.svg"
        svg.write_text(module.build())
        print(f"  wrote {svg.relative_to(ROOT)}")
        png_from_svg(svg, HERE / f"{name}.png")


def build_mermaid():
    out = HERE / "mermaid"
    out.mkdir(exist_ok=True)
    npx = shutil.which("npx")
    if not npx:
        print("  skipped Mermaid renders: npx not found")
        return
    exe = chrome()
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        puppeteer = tmp / "puppeteer.json"
        puppeteer.write_text(json.dumps({"executablePath": exe} if exe else {}))
        env = dict(os.environ, PUPPETEER_SKIP_DOWNLOAD="1") if exe else dict(os.environ)
        for md, names in MERMAID_SOURCES.items():
            blocks = re.findall(r"```mermaid\n(.*?)```", (ROOT / md).read_text(), re.S)
            if len(blocks) != len(names):
                raise SystemExit(f"{md}: expected {len(names)} mermaid blocks, found {len(blocks)}")
            for name, block in zip(names, blocks):
                src = tmp / f"{name}.mmd"
                src.write_text(block)
                for ext, extra in [("svg", []), ("png", ["-s", "2"])]:
                    target = out / f"{name}.{ext}"
                    subprocess.run([npx, "-y", MERMAID_CLI, "-q", "-i", str(src), "-o", str(target),
                                    "-c", str(HERE / "src" / "mermaid-config.json"), "-p", str(puppeteer),
                                    "-b", "white", *extra], check=True, env=env)
                    print(f"  wrote {target.relative_to(ROOT)}")


if __name__ == "__main__":
    print("hand-laid-out diagrams")
    build_hand_laid_out()
    if "--no-mermaid" not in sys.argv:
        print("mermaid diagrams")
        build_mermaid()
