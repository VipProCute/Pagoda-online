#!/usr/bin/env python3
"""
Sinh public/img/devil.svg  -  mặt quỷ hoạt hình cho màn "jump scare" mốc 666.

Chạy:  python3 tools/devil-preview/gen_devil.py [đường_dẫn_ra.svg]
Mặc định ghi vào public/img/devil.svg (cạnh thư mục gốc dự án).

Ảnh được vẽ hoàn toàn bằng toán học (đường Bezier), đối xứng gương tuyệt đối: chỉ cần mô tả
nửa TRÁI (x < 300), nửa PHẢI được lật gương tự động. Không dùng ảnh ngoài, phông ngoài,
script hay tham chiếu href. Lọc (filter) chỉ có 2 lớp feTurbulence rất nhẹ cho vân da.
"""
import math
import os
import random
import sys

W, H = 600, 800
CX = 300


# ---------------------------------------------------------------- helpers
def f(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def pt(p):
    return '%s %s' % (f(p[0]), f(p[1]))


def mir(p):
    return (W - p[0], p[1])


def C(c1, c2, p):
    return ('C', c1, c2, p)


def L(p):
    return ('L', p)


def sym_path(start, segs):
    """Đường kín đối xứng. start và điểm cuối nằm trên trục x=300; segs mô tả nửa trái."""
    pts = [start] + [s[-1] for s in segs]
    d = ['M' + pt(start)]
    for s in segs:
        if s[0] == 'C':
            d.append('C%s %s %s' % (pt(s[1]), pt(s[2]), pt(s[3])))
        else:
            d.append('L' + pt(s[1]))
    for i in range(len(segs), 0, -1):
        s = segs[i - 1]
        prev = pts[i - 1]
        if s[0] == 'C':
            d.append('C%s %s %s' % (pt(mir(s[2])), pt(mir(s[1])), pt(mir(prev))))
        else:
            d.append('L' + pt(mir(prev)))
    d.append('Z')
    return ''.join(d)


def path_of(start, segs, close=True):
    d = ['M' + pt(start)]
    for s in segs:
        if s[0] == 'C':
            d.append('C%s %s %s' % (pt(s[1]), pt(s[2]), pt(s[3])))
        else:
            d.append('L' + pt(s[1]))
    if close:
        d.append('Z')
    return ''.join(d)


def pair(inner):
    """Vẽ phần tử bên trái + bản lật gương bên phải."""
    return inner + '<g transform="matrix(-1 0 0 1 600 0)">' + inner + '</g>'


def bez(p0, p1, p2, p3, t):
    u = 1 - t
    x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
    y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
    return (x, y)


def bez_d(p0, p1, p2, p3, t):
    u = 1 - t
    x = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
    y = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
    return (x, y)


def t_for_dx(curve, dx):
    """t sao cho điểm nằm cách trục giữa dx (x = 300 - dx)."""
    best_t, best_e = 0, 1e9
    for i in range(0, 1001):
        t = i / 1000
        e = abs(bez(*curve, t)[0] - (CX - dx))
        if e < best_e:
            best_t, best_e = t, e
    return best_t


def tooth(curve, dx, width, length, up, fill, bias=0.65):
    """Một chiếc răng nhọn có đáy nằm trên đường cong `curve` (nửa trái)."""
    t = t_for_dx(curve, dx)
    p = bez(*curve, t)
    tx, ty = bez_d(*curve, t)
    n = math.hypot(tx, ty)
    tx, ty = tx / n, ty / n
    # pháp tuyến hướng vào trong miệng (xuống với hàm trên, lên với hàm dưới)
    nx, ny = -ty, tx
    want = 1 if not up else -1  # up=True: răng hàm dưới mọc lên
    if ny * want < 0:
        nx, ny = -nx, -ny
    # trộn với phương thẳng đứng để răng không chĩa ngang ở khóe miệng
    vx, vy = 0, want
    dx_, dy_ = nx * (1 - bias) + vx * bias, ny * (1 - bias) + vy * bias
    m = math.hypot(dx_, dy_)
    dx_, dy_ = dx_ / m, dy_ / m
    h = width / 2
    # đáy hơi lấn ra ngoài môi (-7) để không lộ khe hở
    a = (p[0] - tx * h - dx_ * 7, p[1] - ty * h - dy_ * 7)
    b = (p[0] + tx * h - dx_ * 7, p[1] + ty * h - dy_ * 7)
    tip = (p[0] + dx_ * length + tx * (width * 0.06), p[1] + dy_ * length + ty * (width * 0.06))
    mid_a = (a[0] + dx_ * length * 0.55, a[1] + dy_ * length * 0.55)
    mid_b = (b[0] + dx_ * length * 0.55, b[1] + dy_ * length * 0.55)
    # cạnh hơi phình (đường cong) cho răng "nanh"
    d = 'M%s Q%s %s Q%s %sZ' % (
        pt(a),
        pt((mid_a[0] + (tip[0] - a[0]) * 0.02 + ty * width * 0.10, mid_a[1] - tx * width * 0.10)),
        pt(tip),
        pt((mid_b[0] - ty * width * 0.10, mid_b[1] + tx * width * 0.10)),
        pt(b),
    )
    return d


# ---------------------------------------------------------------- geometry
HEAD_START = (300, 112)
HEAD_SEGS = [
    C((205, 108), (96, 160), (46, 262)),
    C((14, 330), (2, 404), (16, 474)),
    C((34, 566), (116, 660), (214, 728)),
    C((250, 754), (280, 776), (300, 796)),
]

# miệng (nửa trái): mép trên và mép dưới là hai đường Bezier chung khóe miệng
UP = ((300, 492), (212, 494), (100, 474), (20, 408))        # mép trên: giữa -> khóe
LO = ((300, 628), (196, 624), (66, 566), (20, 408))         # mép dưới: giữa -> khóe

EYE_P = ((104, 334), [
    C((150, 314), (234, 336), (290, 396)),
    C((254, 428), (168, 432), (128, 396)),
    C((116, 384), (108, 360), (104, 334)),
])
EYE = path_of(*EYE_P)

# lông mày: cạnh dưới trơn, cạnh trên răng cưa (sinh bằng hàm brow_path)
BROW_UP = ((72, 230), (132, 234), (236, 282), (292, 346))
BROW_LOW = ((292, 394), (240, 352), (170, 318), (116, 292))


def brow_path():
    n = 11
    up = []
    for i in range(n + 1):
        t = i / n
        x, y = bez(*BROW_UP, t)
        tx, ty = bez_d(*BROW_UP, t)
        m = math.hypot(tx, ty)
        nx, ny = ty / m, -tx / m  # pháp tuyến hướng lên (ra ngoài)
        k = 0 if i in (0, n) else (7 if i % 2 else -2)
        up.append((x + nx * k, y + ny * k))
    d = 'M' + pt(up[0])
    for q in up[1:]:
        d += 'L' + pt(q)
    d += 'L' + pt(BROW_LOW[0])
    d += 'C%s %s %s' % (pt(BROW_LOW[1]), pt(BROW_LOW[2]), pt(BROW_LOW[3]))
    d += 'C%s %s %s' % (pt((98, 276)), pt((78, 256)), pt(BROW_UP[0]))
    return d + 'Z'


BROW = brow_path()
HORN = path_of((62, 244), [
    C((6, 194), (2, 112), (98, 40)),
    C((70, 104), (102, 164), (164, 200)),
    C((130, 226), (96, 240), (62, 244)),
])


def build():
    rnd = random.Random(666)
    o = []
    A = o.append

    A('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" '
      'preserveAspectRatio="xMidYMid slice">' % (W, H, W, H))
    A('<title>Quỷ</title>')

    # ----------------------------------------------------------- defs
    A('<defs>')
    A('<radialGradient id="bg" gradientUnits="userSpaceOnUse" cx="300" cy="330" r="560">'
      '<stop offset="0" stop-color="#b02a10"/><stop offset=".3" stop-color="#6e0f08"/>'
      '<stop offset=".62" stop-color="#2a0403"/><stop offset="1" stop-color="#050101"/></radialGradient>')
    A('<radialGradient id="skin" gradientUnits="userSpaceOnUse" cx="300" cy="440" r="450">'
      '<stop offset="0" stop-color="#ff6244"/><stop offset=".28" stop-color="#e22c27"/>'
      '<stop offset=".58" stop-color="#a50f1b"/><stop offset=".82" stop-color="#5c050f"/>'
      '<stop offset="1" stop-color="#260208"/></radialGradient>')
    A('<linearGradient id="hornG" gradientUnits="userSpaceOnUse" x1="0" y1="290" x2="140" y2="0">'
      '<stop offset="0" stop-color="#1c0305"/><stop offset=".4" stop-color="#4e0e0c"/>'
      '<stop offset=".75" stop-color="#b8845a"/><stop offset="1" stop-color="#f6e6bc"/></linearGradient>')
    A('<linearGradient id="hairG" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="240">'
      '<stop offset="0" stop-color="#0c0104"/><stop offset="1" stop-color="#4a0912"/></linearGradient>')
    A('<radialGradient id="bridgeG" gradientUnits="objectBoundingBox">'
      '<stop offset="0" stop-color="#ffa27e" stop-opacity=".5"/><stop offset="1" stop-color="#ffa27e" stop-opacity="0"/></radialGradient>')
    A('<linearGradient id="browG" gradientUnits="userSpaceOnUse" x1="40" y1="240" x2="40" y2="380">'
      '<stop offset="0" stop-color="#3a070b"/><stop offset="1" stop-color="#0d0102"/></linearGradient>')
    A('<radialGradient id="eyeG" gradientUnits="userSpaceOnUse" cx="205" cy="378" r="100">'
      '<stop offset="0" stop-color="#fffce0"/><stop offset=".3" stop-color="#fff27a"/>'
      '<stop offset=".7" stop-color="#ffc21a"/><stop offset="1" stop-color="#ee7a00"/></radialGradient>')
    A('<radialGradient id="irisG" gradientUnits="userSpaceOnUse" cx="206" cy="378" r="42">'
      '<stop offset="0" stop-color="#fff59a" stop-opacity="0"/><stop offset=".55" stop-color="#ffb000" stop-opacity=".25"/>'
      '<stop offset=".85" stop-color="#f05a00" stop-opacity=".85"/><stop offset="1" stop-color="#9c1c00"/></radialGradient>')
    A('<radialGradient id="eyeGlow" gradientUnits="userSpaceOnUse" cx="200" cy="376" r="170">'
      '<stop offset="0" stop-color="#ffe23a" stop-opacity=".9"/><stop offset=".35" stop-color="#ff9a1a" stop-opacity=".45"/>'
      '<stop offset="1" stop-color="#ff4a10" stop-opacity="0"/></radialGradient>')
    A('<radialGradient id="socket" gradientUnits="userSpaceOnUse" cx="198" cy="372" r="150">'
      '<stop offset="0" stop-color="#1a0103" stop-opacity=".95"/><stop offset=".55" stop-color="#2a0306" stop-opacity=".7"/>'
      '<stop offset="1" stop-color="#2a0306" stop-opacity="0"/></radialGradient>')
    A('<linearGradient id="lidSh" gradientUnits="userSpaceOnUse" x1="0" y1="316" x2="0" y2="400">'
      '<stop offset="0" stop-color="#000" stop-opacity=".85"/><stop offset=".55" stop-color="#000" stop-opacity=".25"/>'
      '<stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>')
    A('<radialGradient id="cheek" gradientUnits="userSpaceOnUse" cx="120" cy="468" r="95">'
      '<stop offset="0" stop-color="#ff7a52" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a52" stop-opacity="0"/></radialGradient>')
    A('<radialGradient id="hollow" gradientUnits="userSpaceOnUse" cx="76" cy="548" r="110">'
      '<stop offset="0" stop-color="#1e0206" stop-opacity=".65"/><stop offset="1" stop-color="#1e0206" stop-opacity="0"/></radialGradient>')
    A('<radialGradient id="noseG" gradientUnits="userSpaceOnUse" cx="300" cy="430" r="56">'
      '<stop offset="0" stop-color="#ff8a62" stop-opacity=".85"/><stop offset="1" stop-color="#ff5a3c" stop-opacity="0"/></radialGradient>')
    A('<radialGradient id="mouthG" gradientUnits="userSpaceOnUse" cx="300" cy="560" r="300" '
      'gradientTransform="translate(0 560) scale(1 .5) translate(0 -560)">'
      '<stop offset="0" stop-color="#6a0a10"/><stop offset=".25" stop-color="#2a0307"/>'
      '<stop offset=".7" stop-color="#0a0102"/><stop offset="1" stop-color="#000"/></radialGradient>')
    A('<linearGradient id="toothG" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">'
      '<stop offset="0" stop-color="#fffbe6"/><stop offset=".6" stop-color="#f4e6b8"/><stop offset="1" stop-color="#cdb27a"/></linearGradient>')
    A('<linearGradient id="toothGu" gradientUnits="objectBoundingBox" x1="0" y1="1" x2="0" y2="0">'
      '<stop offset="0" stop-color="#fffbe6"/><stop offset=".6" stop-color="#f4e6b8"/><stop offset="1" stop-color="#cdb27a"/></linearGradient>')
    A('<linearGradient id="tongueG" gradientUnits="userSpaceOnUse" x1="0" y1="566" x2="0" y2="630">'
      '<stop offset="0" stop-color="#6e0c1e"/><stop offset="1" stop-color="#26040b"/></linearGradient>')
    A('<linearGradient id="beardG" gradientUnits="userSpaceOnUse" x1="0" y1="630" x2="0" y2="800">'
      '<stop offset="0" stop-color="#3b050a"/><stop offset="1" stop-color="#0a0102"/></linearGradient>')
    A('<radialGradient id="vig" gradientUnits="userSpaceOnUse" cx="300" cy="400" r="520" '
      'gradientTransform="translate(300 400) scale(.78 1) translate(-300 -400)">'
      '<stop offset=".42" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".88"/></radialGradient>')
    A('<radialGradient id="ember"><stop offset="0" stop-color="#fff2a0"/><stop offset=".35" stop-color="#ff9a1a"/>'
      '<stop offset="1" stop-color="#ff4a10" stop-opacity="0"/></radialGradient>')

    # vân da: hạt mịn + loang mảng (2 filter, mỗi cái 2 octave, chỉ trong vùng đầu)
    A('<filter id="grain" filterUnits="userSpaceOnUse" x="0" y="100" width="600" height="700" '
      'color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".9" '
      'numOctaves="1" seed="7"/><feColorMatrix type="matrix" '
      'values="0 0 0 0 .08  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -1.05"/></filter>')
    A('<filter id="mottle" filterUnits="userSpaceOnUse" x="0" y="100" width="600" height="700" '
      'color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".014 .02" '
      'numOctaves="1" seed="21"/><feColorMatrix type="matrix" '
      'values="0 0 0 0 .2  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -0.85"/></filter>')

    A('<clipPath id="headClip"><path d="%s"/></clipPath>' % sym_path(HEAD_START, HEAD_SEGS))
    A('<clipPath id="eyeClip"><path d="%s"/></clipPath>' % EYE)
    # đường miệng kín: giữa-trên -> khóe trái -> giữa-dưới, rồi lật gương
    mouth_d = sym_path(UP[0], [C(UP[1], UP[2], UP[3]), C(LO[2], LO[1], LO[0])])
    A('<clipPath id="mouthClip"><path d="%s"/></clipPath>' % mouth_d)
    A('</defs>')

    # ----------------------------------------------------------- background
    A('<rect width="600" height="800" fill="#050101"/>')
    A('<rect width="600" height="800" fill="url(#bg)"/>')

    # tàn lửa (đốm sáng nhỏ) quanh viền
    for _ in range(46):
        side = rnd.random()
        x = rnd.uniform(4, 596)
        y = rnd.uniform(4, 780)
        if side < .6:
            # dồn về vùng trên (giữa hai sừng) và hai bên
            y = rnd.uniform(4, 240)
        r = rnd.choice([1.4, 1.8, 2.4, 3.2, 4.2, 5.5])
        A('<circle cx="%s" cy="%s" r="%s" fill="url(#ember)" opacity="%s"/>' % (
            f(x), f(y), f(r * 2.4), f(rnd.uniform(.55, 1))))

    # ----------------------------------------------------------- head
    head_d = sym_path(HEAD_START, HEAD_SEGS)
    A('<path d="%s" fill="url(#skin)" stroke="#1c0206" stroke-width="6" stroke-linejoin="round"/>' % head_d)
    A('<g clip-path="url(#headClip)">')
    # gò má sáng + hõm má tối
    A(pair('<ellipse cx="120" cy="468" rx="110" ry="80" fill="url(#cheek)"/>'
           '<ellipse cx="76" cy="548" rx="110" ry="110" fill="url(#hollow)"/>'))
    # nếp trán
    A(pair('<path d="M92 238C150 210 214 212 270 246" fill="none" stroke="#2a0307" '
           'stroke-opacity=".5" stroke-width="7" stroke-linecap="round"/>'
           '<path d="M126 196C176 178 232 188 276 218" fill="none" stroke="#2a0307" stroke-opacity=".4" '
           'stroke-width="6" stroke-linecap="round"/>'))
    # tóc: đường chân tóc nhọn hình chữ M (mỏm nhọn giữa trán)
    hair = sym_path((300, 232), [
        L((266, 178)), L((248, 198)), L((214, 142)), L((194, 168)), L((150, 130)), L((130, 156)),
        L((92, 176)), L((62, 232)), L((24, 252)), L((-20, 292)), L((-20, 60)), L((300, 60)),
    ])
    A('<path d="%s" fill="url(#hairG)" stroke="#ff5a3c" stroke-opacity=".35" stroke-width="2.5" stroke-linejoin="round"/>' % hair)
    # mảng loang + hạt
    A('<rect x="0" y="100" width="600" height="700" filter="url(#mottle)" opacity=".5"/>')
    A('<rect x="0" y="100" width="600" height="700" filter="url(#grain)" opacity=".5"/>')
    A('</g>')

    # ----------------------------------------------------------- horns
    horn_inner = (
        '<path d="%s" fill="url(#hornG)" stroke="#120203" stroke-width="5" stroke-linejoin="round"/>'
        '<path d="M42 232C-2 190 0 114 90 48" fill="none" stroke="#ff8a4a" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/>'
        '<path d="M74 238C56 232 40 222 28 208M64 200C80 192 98 188 114 192M52 156C72 146 92 142 110 144M66 110C84 98 100 92 114 90" '
        'fill="none" stroke="#0e0102" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>'
    ) % HORN
    A(pair(horn_inner))

    # ----------------------------------------------------------- eyes
    # lớp nền của mắt (hốc mắt, quầng, ánh sáng) vẽ cho CẢ HAI bên trước rồi mới vẽ nhãn cầu,
    # nếu không hốc mắt phải sẽ phủ lên khóe mắt trái -> mất đối xứng.
    eye_back = (
        '<ellipse cx="198" cy="372" rx="170" ry="120" fill="url(#socket)" transform="rotate(-16 198 372)"/>'
        '<path d="M116 402C160 440 236 448 290 414C240 428 160 424 116 402Z" fill="#2a0307" fill-opacity=".5"/>'
    )
    eye_glow = '<circle cx="200" cy="376" r="170" fill="url(#eyeGlow)"/>'
    eye_front = (
        '<path d="%(eye)s" fill="url(#eyeG)"/>'
        '<g clip-path="url(#eyeClip)">'
        '<path d="M110 346C140 350 160 362 170 378M112 362C140 366 154 376 164 388M286 394C256 392 236 388 228 380" '
        'fill="none" stroke="#d31e10" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round"/>'
        '<circle cx="206" cy="378" r="42" fill="url(#irisG)"/>'
        '<path d="M206 320C214 352 214 404 206 438C198 404 198 352 206 320Z" fill="#0b0101"/>'
        '<rect x="90" y="310" width="220" height="130" fill="url(#lidSh)"/>'
        '<circle cx="192" cy="362" r="3.2" fill="#fff" fill-opacity=".45"/>'
        '</g>'
        '<path d="%(eye)s" fill="none" stroke="#1a0204" stroke-width="7" stroke-linejoin="round"/>'
        '<path d="M130 402C164 428 238 434 282 406" fill="none" stroke="#ffb06a" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>'
    ) % {'eye': EYE}
    A(pair(eye_back))
    A(pair(eye_glow))
    A(pair(eye_front))

    # ----------------------------------------------------------- brows
    brow_inner = (
        '<path d="%(b)s" fill="url(#browG)" stroke="#0a0102" stroke-width="5" stroke-linejoin="round"/>'
        '<path d="M290 388C240 346 170 314 118 290" fill="none" stroke="#b83a28" stroke-opacity=".5" '
        'stroke-width="2.5" stroke-linecap="round"/>'
    ) % {'b': BROW}
    A('<g clip-path="url(#headClip)">' + pair(brow_inner) + '</g>')
    # nếp cau mày giữa hai chân mày
    A(pair('<path d="M286 258L292 322M270 270L276 320" fill="none" stroke="#2a0307" stroke-opacity=".5" '
           'stroke-width="5" stroke-linecap="round"/>'))

    # ----------------------------------------------------------- nose
    A('<ellipse cx="300" cy="388" rx="15" ry="48" fill="url(#bridgeG)"/>')
    A('<ellipse cx="300" cy="446" rx="52" ry="38" fill="url(#noseG)"/>')
    nose_inner = (
        '<path d="M296 452C284 434 256 430 228 438C232 462 252 480 280 481C290 479 296 468 296 454Z" '
        'fill="#4a040c" fill-opacity=".45"/>'
        '<path d="M228 438C246 426 278 428 296 446M228 438C226 462 246 482 274 482" fill="none" stroke="#240207" '
        'stroke-opacity=".75" stroke-width="4.5" stroke-linecap="round"/>'
        '<path d="M292 464C278 452 258 450 242 454C250 468 272 474 292 464Z" fill="#070001"/>'
    )
    A(pair(nose_inner))

    # nếp mũi - má
    A(pair('<path d="M232 450C190 450 130 470 84 512M222 470C196 486 150 506 110 536" fill="none" stroke="#2a0307" '
           'stroke-opacity=".5" stroke-width="6" stroke-linecap="round"/>'))

    # ----------------------------------------------------------- mouth
    # môi (viền ngoài, dày)
    A('<path d="%s" fill="#3a050c" stroke="#3a050c" stroke-width="26" stroke-linejoin="round"/>' % mouth_d)
    A('<path d="%s" fill="none" stroke="#ff5a3c" stroke-opacity=".55" stroke-width="3" transform="translate(0 -15)"/>' % mouth_d)
    A('<path d="%s" fill="url(#mouthG)"/>' % mouth_d)
    A('<g clip-path="url(#mouthClip)">')
    # lưỡi
    A('<path d="M200 628C226 586 272 566 300 566C328 566 374 586 400 628Z" fill="url(#tongueG)"/>')
    A('<path d="M300 572L300 606" stroke="#1a0208" stroke-width="4" stroke-linecap="round"/>')
    # răng hàm trên (cong theo mép trên)
    up_teeth = [
        # dx, rộng, dài
        (13, 26, 44), (40, 30, 56), (74, 34, 66),
        (112, 44, 100),  # nanh trên
        (152, 34, 58), (186, 32, 48), (216, 28, 40), (242, 24, 32), (262, 20, 25),
    ]
    lo_teeth = [
        (14, 26, 38), (42, 32, 54),
        (80, 44, 88),  # nanh dưới
        (122, 34, 54), (158, 32, 48), (192, 28, 42), (222, 26, 34), (246, 22, 28), (264, 18, 22),
    ]
    for dx, w, ln in lo_teeth:
        A(pair('<path d="%s" fill="url(#toothGu)" stroke="#2a0307" stroke-width="2.5" stroke-linejoin="round"/>' %
               tooth(LO, dx, w, ln, True, 'toothGu')))
    for dx, w, ln in up_teeth:
        A(pair('<path d="%s" fill="url(#toothG)" stroke="#2a0307" stroke-width="2.5" stroke-linejoin="round"/>' %
               tooth(UP, dx, w, ln, False, 'toothG')))
    A('</g>')
    # mép môi trên cùng đè lên chân răng (đường viền tối)
    A('<path d="%s" fill="none" stroke="#1a0206" stroke-width="5" stroke-linejoin="round"/>' % mouth_d)

    # ----------------------------------------------------------- goatee
    goatee = sym_path((300, 644), [
        L((258, 648)),
        C((236, 664), (230, 702), (242, 738)),
        C((254, 728), (264, 718), (270, 704)),
        C((272, 732), (284, 766), (300, 802)),
    ])
    A('<path d="%s" fill="url(#beardG)" stroke="#0a0102" stroke-width="4" stroke-linejoin="round"/>' % goatee)
    A('<path d="M262 654C246 672 244 700 250 722" fill="none" stroke="#ff5a3c" stroke-opacity=".35" stroke-width="2.5" stroke-linecap="round"/>'
      '<path d="M338 654C354 672 356 700 350 722" fill="none" stroke="#ff5a3c" stroke-opacity=".35" stroke-width="2.5" stroke-linecap="round"/>')

    # ----------------------------------------------------------- vignette
    A('<rect width="600" height="800" fill="url(#vig)"/>')
    A('</svg>')
    return '\n'.join(o) + '\n'


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', '..', 'public', 'img', 'devil.svg')
    out = os.path.abspath(out)
    svg = build()
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(svg)
    print('wrote %s (%d bytes)' % (out, len(svg.encode('utf-8'))))
