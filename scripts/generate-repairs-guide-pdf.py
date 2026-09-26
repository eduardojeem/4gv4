from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path

from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
CONTENT_PATH = ROOT / "src/components/help/repairs-guide-content.json"
TMP_DIR = ROOT / "tmp/pdfs"
OUTPUT_DIR = ROOT / "output/pdf"
PUBLIC_DIR = ROOT / "public/guides"
FILENAME = "guia-reparaciones-v1.pdf"

EMERALD = colors.HexColor("#047857")
EMERALD_LIGHT = colors.HexColor("#d1fae5")
SLATE = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#475569")
LIGHT = colors.HexColor("#f8fafc")
AMBER = colors.HexColor("#b45309")


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("Title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=28, leading=33, textColor=SLATE, alignment=TA_LEFT, spaceAfter=10),
        "subtitle": ParagraphStyle("Subtitle", parent=base["Normal"], fontSize=12, leading=18, textColor=MUTED, spaceAfter=14),
        "h1": ParagraphStyle("H1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=21, leading=26, textColor=SLATE, spaceAfter=12),
        "h2": ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=20, textColor=EMERALD, spaceBefore=8, spaceAfter=6),
        "body": ParagraphStyle("Body", parent=base["BodyText"], fontSize=10, leading=15, textColor=SLATE, spaceAfter=6),
        "small": ParagraphStyle("Small", parent=base["BodyText"], fontSize=8.5, leading=12, textColor=MUTED),
        "callout": ParagraphStyle("Callout", parent=base["BodyText"], fontSize=10, leading=15, textColor=SLATE, leftIndent=8, rightIndent=8, spaceBefore=5, spaceAfter=5),
        "center": ParagraphStyle("Center", parent=base["BodyText"], alignment=TA_CENTER, fontSize=9, leading=12, textColor=MUTED),
    }


def workflow_drawing() -> Drawing:
    drawing = Drawing(500, 190)
    labels = ["Ingreso", "Diagnóstico", "Reparación", "Listo", "Entrega"]
    for index, label in enumerate(labels):
        x = 5 + index * 100
        drawing.add(Rect(x, 115, 86, 38, 8, fillColor=EMERALD, strokeColor=colors.HexColor("#10b981")))
        drawing.add(String(x + 43, 130, label, fontName="Helvetica-Bold", fontSize=9, fillColor=colors.white, textAnchor="middle"))
        if index < len(labels) - 1:
            drawing.add(Line(x + 86, 134, x + 100, 134, strokeColor=MUTED, strokeWidth=2))
    drawing.add(Rect(105, 25, 135, 36, 8, fillColor=colors.HexColor("#f59e0b"), strokeColor=AMBER))
    drawing.add(Rect(270, 25, 145, 36, 8, fillColor=colors.HexColor("#f59e0b"), strokeColor=AMBER))
    drawing.add(String(172, 39, "Retiro sin reparar", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.white, textAnchor="middle"))
    drawing.add(String(342, 39, "Imposible reparar", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.white, textAnchor="middle"))
    drawing.add(Line(248, 115, 172, 61, strokeColor=AMBER, strokeWidth=2))
    drawing.add(Line(248, 115, 342, 61, strokeColor=AMBER, strokeWidth=2))
    return drawing


def cost_drawing() -> Drawing:
    drawing = Drawing(500, 205)
    boxes = [(5, "Repuestos", SLATE), (125, "Mano de obra", SLATE), (245, "Descuento", SLATE), (370, "Total cliente", EMERALD)]
    for x, label, color in boxes:
        drawing.add(Rect(x, 145, 105, 38, 8, fillColor=color, strokeColor=color))
        drawing.add(String(x + 52, 160, label, fontName="Helvetica-Bold", fontSize=8.5, fillColor=colors.white, textAnchor="middle"))
    drawing.add(String(117, 158, "+", fontName="Helvetica-Bold", fontSize=14, fillColor=MUTED, textAnchor="middle"))
    drawing.add(String(238, 158, "-", fontName="Helvetica-Bold", fontSize=14, fillColor=MUTED, textAnchor="middle"))
    drawing.add(Line(350, 164, 370, 164, strokeColor=EMERALD, strokeWidth=2))
    drawing.add(Rect(80, 78, 130, 36, 8, fillColor=colors.HexColor("#0284c7"), strokeColor=colors.HexColor("#0284c7")))
    drawing.add(Rect(285, 78, 130, 36, 8, fillColor=EMERALD, strokeColor=EMERALD))
    drawing.add(String(145, 92, "Adelantos", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.white, textAnchor="middle"))
    drawing.add(String(350, 92, "Saldo pendiente", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.white, textAnchor="middle"))
    drawing.add(Line(210, 96, 285, 96, strokeColor=MUTED, strokeWidth=2))
    drawing.add(Rect(120, 15, 115, 32, 8, fillColor=MUTED, strokeColor=MUTED))
    drawing.add(Rect(270, 15, 115, 32, 8, fillColor=colors.HexColor("#7c3aed"), strokeColor=colors.HexColor("#7c3aed")))
    drawing.add(String(177, 27, "Pago + Caja", fontName="Helvetica-Bold", fontSize=8.5, fillColor=colors.white, textAnchor="middle"))
    drawing.add(String(327, 27, "Crédito + Cuotas", fontName="Helvetica-Bold", fontSize=8.5, fillColor=colors.white, textAnchor="middle"))
    drawing.add(Line(350, 78, 177, 47, strokeColor=MUTED, strokeWidth=2))
    drawing.add(Line(350, 78, 327, 47, strokeColor=MUTED, strokeWidth=2))
    return drawing


def page_footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
    canvas.line(20 * mm, 14 * mm, 190 * mm, 14 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 9 * mm, "4G - Guía de Reparaciones")
    canvas.drawRightString(190 * mm, 9 * mm, f"Página {document.page}")
    canvas.restoreState()


def task_block(task, style_map):
    rows = []
    for index, step in enumerate(task["steps"], start=1):
        rows.append([
            Paragraph(str(index), style_map["center"]),
            Paragraph(f"<b>{step['title']}</b><br/>{step['body']}<br/><font color='#475569'>{step['fallback']}</font>", style_map["body"]),
        ])
    table = Table(rows, colWidths=[12 * mm, 150 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (0, -1), EMERALD_LIGHT),
        ("TEXTCOLOR", (0, 0), (0, -1), EMERALD),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return KeepTogether([
        Paragraph(task["title"], style_map["h2"]),
        Paragraph(task["summary"], style_map["body"]),
        table,
        Spacer(1, 5 * mm),
    ])


def generate():
    content = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    temp_pdf = TMP_DIR / FILENAME
    output_pdf = OUTPUT_DIR / FILENAME
    public_pdf = PUBLIC_DIR / FILENAME
    style_map = styles()

    doc = SimpleDocTemplate(
        str(temp_pdf), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm, title=content["title"], author="4G",
    )
    story = [
        Spacer(1, 20 * mm),
        Paragraph("GUÍA OPERATIVA", ParagraphStyle("Eyebrow", parent=style_map["small"], fontName="Helvetica-Bold", textColor=EMERALD, spaceAfter=8)),
        Paragraph(content["title"], style_map["title"]),
        Paragraph("Una guía visual para recibir, reparar, cobrar y entregar equipos con trazabilidad.", style_map["subtitle"]),
        Spacer(1, 8 * mm),
        workflow_drawing(),
        Spacer(1, 8 * mm),
        Table([
            [Paragraph("Versión", style_map["small"]), Paragraph(content["version"], style_map["body"])],
            [Paragraph("Actualizada", style_map["small"]), Paragraph(datetime.now().strftime("%d/%m/%Y"), style_map["body"])],
            [Paragraph("Uso", style_map["small"]), Paragraph("Operadores, técnicos y administradores", style_map["body"])],
        ], colWidths=[35 * mm, 120 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), EMERALD_LIGHT), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])),
        PageBreak(),
        Paragraph("Cómo usar esta guía", style_map["h1"]),
        Paragraph("Abrí el botón Guía y ayuda dentro de Reparaciones, buscá la tarea y elegí Iniciar recorrido. El sistema resalta el control real. Si el diseño cambió o el control no está disponible, muestra una alternativa textual y permite continuar.", style_map["body"]),
        Paragraph("Mapa del proceso", style_map["h2"]),
        workflow_drawing(),
        Paragraph("Reglas esenciales", style_map["h2"]),
        Table([
            ["1", Paragraph("Definí el precio antes de cobrar. Mano de obra y repuestos forman el total automático; un presupuesto acordado fija el total del cliente.", style_map["body"])],
            ["2", Paragraph("Efectivo, tarjeta y transferencia requieren caja abierta. Crédito transforma el saldo completo en cuotas.", style_map["body"])],
            ["3", Paragraph("Entregar reparado, retirar sin reparar e imposible reparar tienen cierres financieros y de inventario diferentes.", style_map["body"])],
        ], colWidths=[12 * mm, 150 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), EMERALD), ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")), ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])),
    ]

    for track in content["tracks"]:
        story.extend([PageBreak(), Paragraph(track["title"], style_map["h1"]), Paragraph(track["description"], style_map["subtitle"])])
        if track["id"] == "admin-payments":
            story.extend([cost_drawing(), Spacer(1, 4 * mm)])
        for task in track["tasks"]:
            story.append(task_block(task, style_map))

    story.extend([
        PageBreak(), Paragraph("Ejemplo financiero", style_map["h1"]), cost_drawing(),
        Paragraph("Ejemplo en PYG", style_map["h2"]),
        Table([
            ["Repuestos cobrados", "PYG 250.000"], ["Mano de obra", "PYG 350.000"], ["Descuento", "- PYG 50.000"],
            ["Total del cliente", "PYG 550.000"], ["Adelanto", "- PYG 150.000"], ["Saldo pendiente", "PYG 400.000"],
        ], colWidths=[100 * mm, 55 * mm], style=TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"), ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
            ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"), ("BACKGROUND", (0, 5), (-1, 5), EMERALD_LIGHT),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")), ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])),
        Spacer(1, 6 * mm),
        Paragraph("Control de auditoría", style_map["h2"]),
        Paragraph("Cada cobro debe poder relacionarse con la reparación, el usuario, la sucursal y el medio de pago. Efectivo, tarjeta y transferencia generan trazabilidad de caja; el crédito genera deuda y cuotas. Los repuestos consumidos o reintegrados deben coincidir con el resultado de la entrega.", style_map["callout"]),
    ])

    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    shutil.copy2(temp_pdf, output_pdf)
    shutil.copy2(temp_pdf, public_pdf)
    manifest = {
        "version": content["version"],
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "file": f"/guides/{FILENAME}",
    }
    (PUBLIC_DIR / "repairs-guide-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {output_pdf}")


if __name__ == "__main__":
    generate()
