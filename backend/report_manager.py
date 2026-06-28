import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

class ReportManager:
    @staticmethod
    def generate_html_report(summary: dict, schema: list, activity: list) -> str:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        schema_rows_html = ""
        for i, col in enumerate(schema):
            completeness = f"{col['missing_pct']}%"
            mean_val = f"{col['mean']:.4f}" if isinstance(col['mean'], float) else str(col['mean'])
            schema_rows_html += f"""
            <tr>
                <td>{i + 1}</td>
                <td><strong>{col['name']}</strong></td>
                <td><span style="background:#DFE8F6; padding:1px 4px; border:1px solid #A0A0A0; font-size:9px;">{col['type']}</span></td>
                <td>{100 - col['missing_pct']:.1f}%</td>
                <td>{col['unique']}</td>
                <td>{mean_val}</td>
            </tr>
            """

        activity_rows_html = ""
        if not activity:
            activity_rows_html = "<tr><td colspan='4' style='text-align:center; font-style:italic;'>No cleaning actions logged. Raw dataset loaded.</td></tr>"
        else:
            for log in activity:
                activity_rows_html += f"""
                <tr>
                    <td>#{log['id']}</td>
                    <td>{log['timestamp']}</td>
                    <td><strong>{log['title']}</strong></td>
                    <td>{log['desc']}</td>
                </tr>
                """

        health_color = "#107C41"
        if summary.get("quality_score", 100) < 60:
            health_color = "#A80000"
        elif summary.get("quality_score", 100) < 85:
            health_color = "#E86C00"

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>DataPrep Studio - Quality Audit Report</title>
    <style>
        body {{
            font-family: "Tahoma", "Verdana", Arial, sans-serif;
            font-size: 11px;
            color: #000000;
            background-color: #ECECEC;
            margin: 20px;
            padding: 0;
        }}
        .report-card {{
            background: #F4F3EE;
            border-top: 2px solid #FFFFFF;
            border-left: 2px solid #FFFFFF;
            border-right: 2px solid #808080;
            border-bottom: 2px solid #808080;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            box-shadow: 2px 2px 8px rgba(0,0,0,0.2);
        }}
        .report-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px double #808080;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }}
        .report-title h1 {{
            color: #003399;
            font-size: 18px;
            margin: 0 0 5px 0;
            font-weight: bold;
        }}
        .report-title p {{
            margin: 2px 0;
            color: #555555;
        }}
        .score-box {{
            border: 2px solid #003399;
            background-color: #DFE8F6;
            padding: 6px;
            text-align: center;
            width: 90px;
        }}
        .score-lbl {{
            font-size: 8px;
            display: block;
            font-weight: bold;
            color: #003399;
        }}
        .score-val {{
            font-size: 20px;
            font-weight: bold;
            color: {health_color};
        }}
        .section {{
            margin-bottom: 20px;
        }}
        .section h3 {{
            color: #003399;
            font-size: 12px;
            margin: 0 0 8px 0;
            border-bottom: 1px solid #A0A0A0;
            padding-bottom: 2px;
            font-weight: bold;
        }}
        .meta-grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            background: #FFFFFF;
            border-top: 1.5px solid #808080;
            border-left: 1.5px solid #808080;
            border-right: 1px solid #FFFFFF;
            border-bottom: 1px solid #FFFFFF;
            padding: 8px;
        }}
        .meta-grid div {{
            font-size: 10px;
        }}
        .meta-grid strong {{
            color: #003399;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
            background: #FFFFFF;
        }}
        th {{
            background: #ECE9D8;
            border-top: 1px solid #FFFFFF;
            border-left: 1px solid #FFFFFF;
            border-right: 1.5px solid #808080;
            border-bottom: 1.5px solid #808080;
            padding: 4px 6px;
            font-weight: bold;
            text-align: left;
        }}
        td {{
            border: 1px solid #D0D0D0;
            padding: 4px 6px;
            font-size: 10px;
        }}
        .signoff-section {{
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px;
        }}
        .sign-field {{
            border-bottom: 1px solid #000000;
            height: 35px;
            margin-bottom: 4px;
        }}
    </style>
</head>
<body>
    <div class="report-card">
        <div class="report-header">
            <div class="report-title">
                <h1>DATAPREP STUDIO AUDIT REPORT</h1>
                <p>Dataset: <strong>{summary['filename']}</strong></p>
                <p>Generated: <strong>{timestamp}</strong></p>
            </div>
            <div class="score-box">
                <span class="score-lbl">HEALTH SCORE</span>
                <span class="score-val">{summary['quality_score']}%</span>
            </div>
        </div>

        <div class="section">
            <h3>Structural Summary</h3>
            <div class="meta-grid">
                <div>Rows: <strong>{summary['rows']}</strong></div>
                <div>Columns: <strong>{summary['columns']}</strong></div>
                <div>Missing Cells: <strong>{summary['missing_cells']}</strong></div>
                <div>Duplicate Rows: <strong>{summary['duplicates']}</strong></div>
                <div>Memory Size: <strong>{summary['memory_usage_kb']} KB</strong></div>
                <div>Completeness: <strong>{100 - summary['missing_pct']:.2f}%</strong></div>
            </div>
        </div>

        <div class="section">
            <h3>Column Schema & Distribution</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">Idx</th>
                        <th>Column Name</th>
                        <th style="width: 80px;">Type</th>
                        <th style="width: 80px;">Complete %</th>
                        <th style="width: 70px;">Uniques</th>
                        <th>Mean Value</th>
                    </tr>
                </thead>
                <tbody>
                    {schema_rows_html}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h3>Operations Activity Log</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 50px;">Step</th>
                        <th style="width: 95px;">Time</th>
                        <th style="width: 140px;">Action</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    {activity_rows_html}
                </tbody>
            </table>
        </div>

        <div class="signoff-section">
            <div>
                <div class="sign-field"></div>
                <span>Prepared By (Signature)</span>
            </div>
            <div>
                <div class="sign-field"></div>
                <span>Quality Analyst Reviewer</span>
            </div>
        </div>
    </div>
</body>
</html>
"""
        return html_content

    @staticmethod
    def generate_pdf_report(summary: dict, schema: list, activity: list) -> bytes:
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Modify existing styles to avoid crash on adding duplicates
        styles['Normal'].fontName = 'Helvetica'
        styles['Normal'].fontSize = 9
        styles['Normal'].leading = 12

        # Create custom styles
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=16,
            leading=20,
            textColor=colors.HexColor('#003399'),
            spaceAfter=6
        )

        meta_style = ParagraphStyle(
            'ReportMeta',
            parent=styles['Normal'],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor('#444444')
        )

        section_heading = ParagraphStyle(
            'SectionHeading',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor('#003399'),
            spaceBefore=12,
            spaceAfter=6
        )

        cell_style = ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontSize=8,
            leading=9
        )

        cell_header_style = ParagraphStyle(
            'TableHeaderCell',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=10,
            textColor=colors.HexColor('#000000')
        )

        elements = []

        # Document Header Layout
        header_data = [
            [
                Paragraph(f"<b>DATAPREP STUDIO QUALITY AUDIT REPORT</b><br/><font size='8' color='#555555'>Dataset: <b>{summary['filename']}</b><br/>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</font>", title_style),
                Paragraph(f"<font size='7' color='#003399'><b>HEALTH SCORE</b></font><br/><font size='18' color='#107C41'><b>{summary['quality_score']}%</b></font>", ParagraphStyle('ScoreVal', parent=styles['Normal'], alignment=1))
            ]
        ]
        
        header_table = Table(header_data, colWidths=[400, 140])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BACKGROUND', (1,0), (1,0), colors.HexColor('#DFE8F6')),
            ('BOX', (1,0), (1,0), 1.5, colors.HexColor('#003399')),
            ('PADDING', (1,0), (1,0), 6),
            ('ALIGN', (1,0), (1,0), 'CENTER')
        ]))
        
        elements.append(header_table)
        elements.append(Spacer(1, 10))

        # Horizontal Divider line
        elements.append(Table([[""]], colWidths=[540], rowHeights=[2], style=TableStyle([
            ('LINEBELOW', (0,0), (-1,-1), 1.5, colors.HexColor('#808080')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0)
        ])))
        elements.append(Spacer(1, 10))

        # 1. Structural Summary
        elements.append(Paragraph("Structural Summary", section_heading))
        summary_data = [
            [Paragraph(f"Rows: <b>{summary['rows']}</b>", cell_style), Paragraph(f"Columns: <b>{summary['columns']}</b>", cell_style), Paragraph(f"Missing Cells: <b>{summary['missing_cells']}</b>", cell_style)],
            [Paragraph(f"Duplicate Rows: <b>{summary['duplicates']}</b>", cell_style), Paragraph(f"Memory Size: <b>{summary['memory_usage_kb']} KB</b>", cell_style), Paragraph(f"Completeness: <b>{100 - summary['missing_pct']:.2f}%</b>", cell_style)]
        ]
        summary_table = Table(summary_data, colWidths=[180, 180, 180])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FFFFFF')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#808080')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E0E0E0')),
            ('PADDING', (0,0), (-1,-1), 6)
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 15))

        # 2. Column Schema
        elements.append(Paragraph("Column Schema Definitions", section_heading))
        schema_data = [
            [Paragraph("Idx", cell_header_style), Paragraph("Column Name", cell_header_style), Paragraph("Type", cell_header_style), Paragraph("Complete %", cell_header_style), Paragraph("Uniques", cell_header_style), Paragraph("Mean Value", cell_header_style)]
        ]
        
        for i, col in enumerate(schema):
            completeness = f"{100 - col['missing_pct']:.1f}%"
            mean_val = f"{col['mean']:.4f}" if isinstance(col['mean'], float) else str(col['mean'])
            schema_data.append([
                Paragraph(str(i+1), cell_style),
                Paragraph(f"<b>{col['name']}</b>", cell_style),
                Paragraph(col['type'], cell_style),
                Paragraph(completeness, cell_style),
                Paragraph(str(col['unique']), cell_style),
                Paragraph(mean_val, cell_style)
            ])
            
        schema_table = Table(schema_data, colWidths=[30, 180, 80, 70, 60, 120])
        schema_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#ECE9D8')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#808080')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D0D0D0')),
            ('PADDING', (0,0), (-1,-1), 4),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE')
        ]))
        elements.append(schema_table)
        elements.append(Spacer(1, 15))

        # 3. Actions Log
        elements.append(Paragraph("Cleaning Actions Log", section_heading))
        activity_data = [
            [Paragraph("Step", cell_header_style), Paragraph("Time", cell_header_style), Paragraph("Action", cell_header_style), Paragraph("Description", cell_header_style)]
        ]
        
        if not activity:
            activity_data.append([Paragraph("-", cell_style), Paragraph("-", cell_style), Paragraph("No actions logged", cell_style), Paragraph("Dataset is in raw state.", cell_style)])
        else:
            for log in activity:
                activity_data.append([
                    Paragraph(f"#{log['id']}", cell_style),
                    Paragraph(log['timestamp'], cell_style),
                    Paragraph(f"<b>{log['title']}</b>", cell_style),
                    Paragraph(log['desc'], cell_style)
                ])

        activity_table = Table(activity_data, colWidths=[40, 90, 130, 280])
        activity_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#ECE9D8')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#808080')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D0D0D0')),
            ('PADDING', (0,0), (-1,-1), 4),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE')
        ]))
        elements.append(activity_table)
        elements.append(Spacer(1, 20))

        # Sign-off line elements
        sign_data = [
            [Paragraph("", cell_style), Paragraph("", cell_style)],
            [Paragraph("_____________________________<br/>Prepared By (Signature)", cell_style),
             Paragraph("_____________________________<br/>Quality Analyst Reviewer", cell_style)]
        ]
        sign_table = Table(sign_data, colWidths=[270, 270])
        sign_table.setStyle(TableStyle([
            ('PADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,0), 30), # spacing for signature
            ('ALIGN', (0,0), (-1,-1), 'LEFT')
        ]))
        elements.append(sign_table)

        doc.build(elements)
        pdf_buffer.seek(0)
        return pdf_buffer.read()
