import io
from datetime import datetime
from pathlib import Path

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

HEADER_BLUE = colors.HexColor("#0055a4")
ACCENT_GREEN = colors.HexColor("#009e60")


def _format_date(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y")


def _format_amount(amount: float) -> str:
    return f"{amount:,.0f} F CFA".replace(",", " ")


def _make_qr_image(verify_url: str) -> Image:
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(verify_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0055a4", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return Image(buffer, width=4 * cm, height=4 * cm)


def generate_license_pdf(
    *,
    output_path: Path,
    license_number: str,
    holder_name: str,
    company_name: str | None,
    vehicle_plate: str | None,
    license_type_name: str,
    fee_amount: float,
    issued_at: datetime,
    expires_at: datetime,
    verify_url: str,
    application_reference: str,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=HEADER_BLUE,
        alignment=1,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.grey,
        alignment=1,
        spaceAfter=4,
    )
    label_style = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.grey,
    )
    value_style = ParagraphStyle(
        "Value",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.black,
        spaceAfter=8,
    )
    license_num_style = ParagraphStyle(
        "LicenseNum",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=ACCENT_GREEN,
        alignment=1,
        spaceBefore=12,
        spaceAfter=12,
    )

    story = [
        Paragraph("RÉPUBLIQUE GABONAISE", title_style),
        Paragraph("Unité — Travail — Justice", subtitle_style),
        Spacer(1, 0.3 * cm),
        Paragraph("MINISTÈRE DES TRANSPORTS", title_style),
        Paragraph("Direction Générale des Transports Terrestres (DGTT)", subtitle_style),
        Spacer(1, 0.5 * cm),
        Paragraph("LICENCE DE TRANSPORT", ParagraphStyle(
            "DocTitle", parent=styles["Heading1"], fontSize=18,
            textColor=HEADER_BLUE, alignment=1, spaceAfter=16,
        )),
        Paragraph(f"<b>N° {license_number}</b>", license_num_style),
    ]

    data = [
        [Paragraph("Titulaire", label_style), Paragraph(holder_name, value_style)],
        [Paragraph("Entreprise", label_style), Paragraph(company_name or "—", value_style)],
        [Paragraph("Immatriculation", label_style), Paragraph(vehicle_plate or "—", value_style)],
        [Paragraph("Type de licence", label_style), Paragraph(license_type_name, value_style)],
        [Paragraph("Frais réglés", label_style), Paragraph(_format_amount(fee_amount), value_style)],
        [Paragraph("Date de délivrance", label_style), Paragraph(_format_date(issued_at), value_style)],
        [Paragraph("Date d'expiration", label_style), Paragraph(_format_date(expires_at), value_style)],
        [Paragraph("Réf. dossier", label_style), Paragraph(application_reference, value_style)],
    ]

    table = Table(data, colWidths=[5 * cm, 11 * cm])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.8 * cm))

    qr_row = Table(
        [[_make_qr_image(verify_url), Paragraph(
            "<b>Vérification authentique</b><br/><br/>"
            "Scannez ce QR code pour vérifier la validité de cette licence "
            "auprès de la DGTT.<br/><br/>"
            f"<font size='8' color='#64748b'>{verify_url}</font>",
            ParagraphStyle("QRText", parent=styles["Normal"], fontSize=10, leading=14),
        )]],
        colWidths=[5 * cm, 11 * cm],
    )
    qr_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(qr_row)
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph(
        "Document généré électroniquement — Toute falsification est passible de sanctions pénales.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8,
                       textColor=colors.grey, alignment=1),
    ))

    doc.build(story)
