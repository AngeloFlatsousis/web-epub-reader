#!/usr/bin/env python3
"""Generate two sample EPUBs for validation:
- alice.epub: standard novel (Alice in Wonderland excerpt, text only)
- illustrated.epub: book with images (cover + inline illustrations)
Both are public-domain excerpts bundled for testing.
"""
import zipfile
import io
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "samples"
OUT.mkdir(parents=True, exist_ok=True)

MIMETYPE = b"application/epub+zip"

CONTAINER = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""

def make_png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    """Minimal valid PNG with solid color (for covers/illustrations)."""
    def chunk(typ: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + typ + data
        c += struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
        return c
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes(rgb) * width
    idat = zlib.compress(raw)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

def write_epub(path: Path, files: dict[str, bytes | str]):
    with zipfile.ZipFile(path, "w") as z:
        # mimetype must be first and stored uncompressed
        info = zipfile.ZipInfo("mimetype")
        info.compress_type = zipfile.ZIP_STORED
        z.writestr(info, MIMETYPE)
        for name, data in files.items():
            if isinstance(data, str):
                data = data.encode("utf-8")
            z.writestr(name, data)
    print(f"Wrote {path} ({path.stat().st_size} bytes)")

# ---------- Alice (text novel) ----------
alice_opf = """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookID">urn:uuid:alice-sample-001</dc:identifier>
    <dc:title>Alice's Adventures in Wonderland (Sample)</dc:title>
    <dc:creator>Lewis Carroll</dc:creator>
    <dc:language>en</dc:language>
    <dc:description>Public-domain excerpt for OpenBook validation — Chapter 1 and 2.</dc:description>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="ch3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>
"""

alice_nav = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><title>Contents</title></head>
<body>
<nav epub:type="toc">
  <h1>Contents</h1>
  <ol>
    <li><a href="ch1.xhtml">Chapter 1 — Down the Rabbit-Hole</a></li>
    <li><a href="ch2.xhtml">Chapter 2 — The Pool of Tears</a></li>
    <li><a href="ch3.xhtml">Chapter 3 — A Caucus-race and a Long Tale</a></li>
  </ol>
</nav>
</body>
</html>
"""

alice_ch1 = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><title>Chapter 1</title></head>
<body>
<h1>Chapter 1 — Down the Rabbit-Hole</h1>
<p>Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”</p>
<p>So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.</p>
<p>There was nothing so <em>very</em> remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually <em>took a watch out of its waistcoat-pocket</em>, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.</p>
<p>In another moment down went Alice after it, never once considering how in the world she was to get out again.</p>
<p>The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.</p>
<p>Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs. She took down a jar from one of the shelves as she passed; it was labelled “ORANGE MARMALADE”, but to her great disappointment it was empty: she did not like to drop the jar for fear of killing somebody underneath, so managed to put it into one of the cupboards as she fell past it.</p>
<p>“Well!” thought Alice to herself, “after such a fall as this, I shall think nothing of tumbling down stairs! How funny you’ll think me telling you my adventures one day!”</p>
<p>“I wonder if I shall ever see such a place as this beautiful garden!” thought Alice. “How queer everything is to-day!”</p>
</body>
</html>
"""

alice_ch2 = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><title>Chapter 2</title></head>
<body>
<h1>Chapter 2 — The Pool of Tears</h1>
<p>“Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English); “now I’m opening out like the largest telescope that ever was! Good-bye, feet!” (for when she looked down at her feet, they seemed almost out of sight, they were getting so far off). “Oh, my poor little feet, I wonder who will put on your shoes and stockings for you?”</p>
<p>“I’m sure <em>that</em> will be much <em>less</em> trouble than it’s worth to <em>you</em>!”</p>
<p>“How can I help it?” said Alice very meekly: “I <em>can</em>’t manage <em>all</em> the things <em>I</em> used to do. Oh, <em>best</em> to go comfortably <em>alone</em> now!”</p>
<p>“And what an ignorant little girl she thinks I am!” said Alice, “I <em>must</em> be growing small again.”</p>
<p>She soon got to the pool of tears, where the little creatures were swimming about, and Alice joined them. They swam for a while, and then the Dodo, who was presiding over the race, called out that it was time to come out, and they all scrambled up the bank, and sat down to dry themselves.</p>
<blockquote><p>“I wonder if I shall ever see such a place as this beautiful garden!” thought Alice. “How queer everything is to-day!”</p></blockquote>
<p>“The Mouse gave a sudden leap out of the water, and seemed to quiver all over with fright. ‘Oh, I beg your pardon!’ cried Alice, ‘I quite forgot you didn’t like cats.’”</p>
</body>
</html>
"""

alice_ch3 = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><title>Chapter 3</title></head>
<body>
<h1>Chapter 3 — A Caucus-race and a Long Tale</h1>
<p>They were just beginning to think this really <em>was</em> a Caucus-race, when the Dodo suddenly called out “The race is over!” and they all crowded round it, panting, and asking, “But who has won?”</p>
<p>This question the Dodo could not answer without a great deal of thought, and it sat for a long time with one finger pressed upon its forehead (the position in which you usually see Shakespeare, in the pictures of him), while the rest waited.</p>
<p>“I <em>think</em>,” said the Dodo, “that <em>everybody</em> has won, and that <em>all</em> ought to have prizes.”</p>
<p>“How shall we try who is to have the <em>first</em> prize?” said the Mouse.</p>
<p>“Why, the best way is to begin in the beginning, and end in the ending, and then to stop.”</p>
<p>“Tales, tales, tales!” cried the Mouse. “Come, I’ll take you to the seashore.”</p>
<pre>“You are old, Father William,” the young man said,
“And your hair has become very white;
And yet you incessantly stand on your head—
Do you think, at your age, it is right?”</pre>
<p>“In my youth,” said the sage, to his son, “I did diligently learn how to make each nail fit into its hole.”</p>
</body>
</html>
"""

write_epub(OUT / "alice.epub", {
    "META-INF/container.xml": CONTAINER,
    "OEBPS/content.opf": alice_opf,
    "OEBPS/nav.xhtml": alice_nav,
    "OEBPS/ch1.xhtml": alice_ch1,
    "OEBPS/ch2.xhtml": alice_ch2,
    "OEBPS/ch3.xhtml": alice_ch3,
})

# ---------- Illustrated (images) ----------
cover_png = make_png(600, 900, (99, 102, 241))
fig1_png = make_png(800, 500, (16, 185, 129))
fig2_png = make_png(800, 500, (245, 158, 11))

ill_opf = """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookID">urn:uuid:illustrated-sample-002</dc:identifier>
    <dc:title>The Illustrated Garden (Sample)</dc:title>
    <dc:creator>OpenBook Samples</dc:creator>
    <dc:language>en</dc:language>
    <dc:description>An illustrated sample book with a cover and inline figures, for validating image rendering in the reader.</dc:description>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-img" href="images/cover.png" media-type="image/png" properties="cover-image"/>
    <item id="fig1" href="images/fig1.png" media-type="image/png"/>
    <item id="fig2" href="images/fig2.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="cover"/>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>
"""

ill_nav = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><title>Contents</title></head>
<body>
<nav epub:type="toc">
  <h1>Contents</h1>
  <ol>
    <li><a href="cover.xhtml">Cover</a></li>
    <li><a href="ch1.xhtml">Chapter 1 — The Garden Gate</a></li>
    <li><a href="ch2.xhtml">Chapter 2 — Lanterns at Dusk</a></li>
  </ol>
</nav>
</body>
</html>
"""

ill_cover = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><title>Cover</title></head>
<body>
<div style="text-align:center">
  <img src="images/cover.png" alt="Cover illustration: indigo gradient panel" width="600" height="900"/>
  <h1>The Illustrated Garden</h1>
  <p>A sample book with images — use it to validate cover extraction and inline figure rendering.</p>
</div>
</body>
</html>
"""

ill_ch1 = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><title>Chapter 1</title></head>
<body>
<h1>Chapter 1 — The Garden Gate</h1>
<p>Morning came through the garden gate in a wash of green light. Mara pushed the gate open and stepped onto the path, where dew still beaded on every leaf.</p>
<figure>
  <img src="images/fig1.png" alt="Illustration: emerald panel representing the morning garden" width="800" height="500"/>
  <figcaption>Figure 1 — Morning in the garden. Inline images should scale to the column width and never overflow.</figcaption>
</figure>
<p>“You are early,” said the keeper, handing her a basket. “The lanterns were lit at dawn, but the path is still wet. Mind the stones.”</p>
<p>Mara laughed. “I have walked this path a hundred times. The garden always looks different after rain — the colours deepen, and every scent is sharper.”</p>
<table>
  <tr><th>Season</th><th>First bloom</th><th>Notes</th></tr>
  <tr><td>Spring</td><td>March</td><td>Blossom along the north wall</td></tr>
  <tr><td>Summer</td><td>June</td><td>Long evenings, lanterns at dusk</td></tr>
  <tr><td>Autumn</td><td>September</td><td>Harvest baskets by the gate</td></tr>
</table>
</body>
</html>
"""

ill_ch2 = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><title>Chapter 2</title></head>
<body>
<h1>Chapter 2 — Lanterns at Dusk</h1>
<p>By evening the garden had changed again. The lanterns along the path glowed amber, and the air smelled of woodsmoke and ripe apples.</p>
<figure>
  <img src="images/fig2.png" alt="Illustration: amber panel representing lantern light at dusk" width="800" height="500"/>
  <figcaption>Figure 2 — Lanterns at dusk. Try switching themes and font sizes; figures should remain legible in every theme.</figcaption>
</figure>
<p>“Stay for tea,” the keeper said. “The last train does not leave until the moon is high.”</p>
<p>Mara stayed. She listened to the night insects, watched the lanterns sway, and thought that some places are best visited twice — once in the morning, and once at dusk.</p>
<blockquote><p>“The garden always looks different after rain — the colours deepen, and every scent is sharper.”</p></blockquote>
</body>
</html>
"""

write_epub(OUT / "illustrated.epub", {
    "META-INF/container.xml": CONTAINER,
    "OEBPS/content.opf": ill_opf,
    "OEBPS/nav.xhtml": ill_nav,
    "OEBPS/cover.xhtml": ill_cover,
    "OEBPS/ch1.xhtml": ill_ch1,
    "OEBPS/ch2.xhtml": ill_ch2,
    "OEBPS/images/cover.png": cover_png,
    "OEBPS/images/fig1.png": fig1_png,
    "OEBPS/images/fig2.png": fig2_png,
})

print("Done.")
