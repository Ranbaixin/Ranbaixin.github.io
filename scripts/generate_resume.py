"""Generate the public PDF from the website's single approved content source."""
from pathlib import Path
import hashlib
import json
import os
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether

root = Path(__file__).resolve().parent.parent
source = (root / "src/data/content.json").read_bytes()
data = json.loads(source)
digest = hashlib.sha256(source).hexdigest()
font_candidates = [
    os.environ.get("PORTFOLIO_CJK_FONT", ""),
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simsun.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]
for candidate in font_candidates:
    if not candidate or not Path(candidate).is_file():
        continue
    try:
        pdfmetrics.registerFont(TTFont("PortfolioCJK", candidate, subfontIndex=0))
        break
    except Exception:
        continue
else:
    raise RuntimeError("Set PORTFOLIO_CJK_FONT to an embeddable Chinese TrueType font.")

blue = colors.HexColor("#275fe7")
ink = colors.HexColor("#192c49")
muted = colors.HexColor("#596b86")
styles = {
    "name": ParagraphStyle("name", fontName="PortfolioCJK", fontSize=27, leading=37, textColor=ink),
    "tag": ParagraphStyle("tag", fontName="PortfolioCJK", fontSize=10, leading=17, textColor=blue),
    "contact": ParagraphStyle("contact", fontName="PortfolioCJK", fontSize=8, leading=14, textColor=muted),
    "heading": ParagraphStyle("heading", fontName="PortfolioCJK", fontSize=11, leading=17, textColor=blue, spaceBefore=13, spaceAfter=6),
    "title": ParagraphStyle("title", fontName="PortfolioCJK", fontSize=9.5, leading=16, textColor=ink, spaceBefore=4),
    "body": ParagraphStyle("body", fontName="PortfolioCJK", fontSize=8.5, leading=14, textColor=ink, wordWrap="CJK", alignment=TA_LEFT),
    "muted": ParagraphStyle("muted", fontName="PortfolioCJK", fontSize=8, leading=13, textColor=muted, wordWrap="CJK"),
}

def para(text, style="body"):
    return Paragraph(escape(text), styles[style])

story = [para(data["profile"]["name"], "name"), para(data["profile"]["nicknameEn"] + " · " + data["profile"]["nicknameZh"], "tag"), para(data["profile"]["tagline"], "tag")]
story += [para(data["profile"]["email"] + "  |  " + data["profile"]["location"], "contact"), Spacer(1, 10)]
story += [para("个人介绍", "heading"), para(data["profile"]["intro"])]
education = data["education"]
story += [para("教育与研究", "heading"), para(f'{education["school"]} · {education["college"]} · {education["major"]}', "title")]
story += [para(f'{education["enrolled"]} 级 · 预计 {education["expectedGraduation"]} 年毕业', "muted"), para(education["description"])]
story += [para("项目经历", "heading")]
for project in data["projects"]:
    block = [para(project["title"], "title"), para(project["period"] + "  |  " + project["role"], "muted")]
    block += [para("• " + responsibility) for responsibility in project["responsibilities"]]
    block += [para("实践收获：" + project["reflection"], "muted"), Spacer(1, 7)]
    story.append(KeepTogether(block))
story += [para("荣誉", "heading")]
story += [para(honor["title"] + "  |  " + honor["level"]) for honor in data["honors"]]
story += [Spacer(1, 12), para("项目持续推进中。团队产出、个人职责与验证阶段分别表述；阶段测试不代表完整生产或现场验收。", "muted")]

output = root / "public/resume.pdf"
output.parent.mkdir(parents=True, exist_ok=True)

def decorate(canvas, doc):
    canvas.setTitle(data["profile"]["name"] + " - 公开简历")
    canvas.setAuthor(data["profile"]["name"])
    canvas.setSubject("content-sha256:" + digest)
    canvas.setCreator("Personal portfolio resume generator")
    canvas.setStrokeColor(blue)
    canvas.setLineWidth(1.5)
    canvas.line(45, A4[1] - 28, A4[0] - 45, A4[1] - 28)
    canvas.setFont("PortfolioCJK", 7)
    canvas.setFillColor(muted)
    canvas.drawString(45, 24, data["profile"]["name"] + " · 公开简历")
    canvas.drawRightString(A4[0] - 45, 24, str(doc.page))

document = SimpleDocTemplate(str(output), pagesize=A4, topMargin=40, bottomMargin=40, leftMargin=45, rightMargin=45)
document.build(story, onFirstPage=decorate, onLaterPages=decorate)
print(json.dumps({"output": str(output), "contentSha256": digest}, ensure_ascii=False))
