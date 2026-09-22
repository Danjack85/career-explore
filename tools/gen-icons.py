"""生成应用图标与启动页。

图标是二进制资源，直接改很难维护，所以用脚本重新生成，保证可复现、可微调。

设计对齐 docs/DESIGN.md：干净、务实、不焦虑。
- 主色 #2563EB，白色图形，白底启动页
- 图形：一条基线上方一个向上的箭头，表达「下一步」而不是「登顶」
- 不做渐变、发光、立体感

用法（需要 Pillow）：
    python tools/gen-icons.py

会覆盖以下文件：
    android/app/src/main/res/mipmap-*/ic_launcher.png
    android/app/src/main/res/mipmap-*/ic_launcher_round.png
    android/app/src/main/res/mipmap-*/ic_launcher_foreground.png
    android/app/src/main/res/drawable*/splash.png

注意：自适应图标的背景色在
`res/values/ic_launcher_background.xml`，是 #2563EB。
前景是白色图形，**改背景时别改成浅色**，否则图形会看不见。
"""

from pathlib import Path

from PIL import Image, ImageDraw

# 脚本位于 <repo>/tools/，资源目录相对仓库根定位
ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"

PRIMARY = (37, 99, 235, 255)  # #2563EB
WHITE = (255, 255, 255, 255)

# 启动图标：48dp，各密度对应像素
ICON_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

# 自适应图标前景：108dp
FOREGROUND_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

# 启动页尺寸
SPLASH_SIZES = {
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
}


def rounded_square(size: int, radius_ratio: float, fill) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle(
        [(0, 0), (size - 1, size - 1)], radius=int(size * radius_ratio), fill=fill
    )
    return img


def draw_mark(canvas: Image.Image, size: int, color) -> None:
    """画「下一步」标记：一条基线上方一个向上的箭头。"""
    d = ImageDraw.Draw(canvas)
    s = size

    base_w = s * 0.46
    base_x0 = (s - base_w) / 2
    base_y = s * 0.70
    thickness = max(2, round(s * 0.075))
    d.rounded_rectangle(
        [base_x0, base_y - thickness / 2, base_x0 + base_w, base_y + thickness / 2],
        radius=thickness / 2,
        fill=color,
    )

    shaft_h = s * 0.34
    shaft_top = base_y - shaft_h
    shaft_w = thickness
    d.rounded_rectangle(
        [s / 2 - shaft_w / 2, shaft_top, s / 2 + shaft_w / 2, base_y - thickness],
        radius=shaft_w / 2,
        fill=color,
    )

    head_w = s * 0.26
    head_h = s * 0.16
    d.polygon(
        [
            (s / 2, shaft_top - head_h),
            (s / 2 - head_w / 2, shaft_top + head_h * 0.15),
            (s / 2 + head_w / 2, shaft_top + head_h * 0.15),
        ],
        fill=color,
    )


def make_icon(size: int) -> Image.Image:
    img = rounded_square(size, 0.22, PRIMARY)
    draw_mark(img, size, WHITE)
    return img


def make_round_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(img).ellipse([(0, 0), (size - 1, size - 1)], fill=PRIMARY)
    draw_mark(img, size, WHITE)
    return img


def make_foreground(size: int) -> Image.Image:
    """自适应图标前景：透明底，图形落在中间 66% 安全区内（系统会裁切）。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.62)
    layer = Image.new("RGBA", (inner, inner), (0, 0, 0, 0))
    draw_mark(layer, inner, WHITE)
    off = (size - inner) // 2
    img.alpha_composite(layer, (off, off))
    return img


def make_splash(w: int, h: int) -> Image.Image:
    """启动页：白底 + 居中主色标记。"""
    img = Image.new("RGBA", (w, h), WHITE)
    mark = int(min(w, h) * 0.30)
    layer = Image.new("RGBA", (mark, mark), (0, 0, 0, 0))
    draw_mark(layer, mark, PRIMARY)
    img.alpha_composite(layer, ((w - mark) // 2, (h - mark) // 2))
    return img


def main() -> None:
    written: list[str] = []

    for bucket, size in ICON_SIZES.items():
        out_dir = RES / f"mipmap-{bucket}"
        out_dir.mkdir(parents=True, exist_ok=True)
        make_icon(size).save(out_dir / "ic_launcher.png")
        make_round_icon(size).save(out_dir / "ic_launcher_round.png")
        written.append(f"mipmap-{bucket}/ic_launcher.png ({size}px)")
        written.append(f"mipmap-{bucket}/ic_launcher_round.png ({size}px)")

    for bucket, size in FOREGROUND_SIZES.items():
        out_dir = RES / f"mipmap-{bucket}"
        out_dir.mkdir(parents=True, exist_ok=True)
        make_foreground(size).save(out_dir / "ic_launcher_foreground.png")
        written.append(f"mipmap-{bucket}/ic_launcher_foreground.png ({size}px)")

    for folder, (w, h) in SPLASH_SIZES.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        make_splash(w, h).save(out_dir / "splash.png")
        written.append(f"{folder}/splash.png ({w}x{h})")

    # 无密度 / 方向限定符时的兜底
    (RES / "drawable").mkdir(parents=True, exist_ok=True)
    make_splash(480, 800).save(RES / "drawable" / "splash.png")
    written.append("drawable/splash.png (480x800 兜底)")

    print(f"生成 {len(written)} 个文件：")
    for line in written:
        print("  " + line)


if __name__ == "__main__":
    main()
