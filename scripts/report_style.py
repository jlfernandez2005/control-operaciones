"""Shared presentation for SISFIA exports. No changes to financial calculations."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph,LongTable,TableStyle
from xml.sax.saxutils import escape
NAVY='#10345B'; TEAL='#087E83'; PALE='#EFF5F9'; MUTED='#50647A'
LOGO=Path(__file__).resolve().parents[1]/'public/icons/sisfia-logo-full.png'
def stamp():return datetime.now(timezone(timedelta(hours=-5))).strftime('%d/%m/%Y %H:%M (UTC-5)')
def page_frame(c,d):
    w,h=d.pagesize; c.saveState()
    if LOGO.exists():c.drawImage(str(LOGO),35,h-62,width=145,height=45,preserveAspectRatio=True,anchor='w',mask='auto')
    product=LOGO.parent/'sisfia-product.png'
    if product.exists():c.drawImage(str(product),w/2-66,h-58,width=132,height=39,preserveAspectRatio=True,anchor='c',mask='auto')
    c.setFillColor(colors.HexColor(MUTED));c.setFont('Helvetica',8);c.drawRightString(w-35,h-30,'SISTEMA FINANCIERO ADMINISTRATIVO')
    c.drawRightString(w-35,h-43,'Reporte de gestión · PEN (S/)')
    c.setStrokeColor(colors.HexColor(TEAL));c.setLineWidth(.8);c.line(35,h-68,w-35,h-68);c.line(35,32,w-35,32)
    c.setFont('Helvetica',8);c.drawString(35,19,'SISFIA · Uso administrativo | '+stamp());c.drawRightString(w-35,19,f'Página {d.page}');c.restoreState()
def paragraph(v,header=False):
    st=ParagraphStyle('reportcell',fontName='Helvetica-Bold' if header else 'Helvetica',fontSize=8,leading=10,textColor=colors.white if header else colors.HexColor(NAVY),wordWrap='CJK')
    return Paragraph(escape(str('—' if v is None else v)).replace('\n','<br/>'),st)
def report_table(headers,rows,widths,money_cols=()):
    matrix=[[paragraph(x,True) for x in headers]]+[[paragraph(x) if i not in money_cols else str(x) for i,x in enumerate(row)] for row in rows]
    t=LongTable(matrix,colWidths=widths,repeatRows=1,hAlign='LEFT');style=[('BACKGROUND',(0,0),(-1,0),colors.HexColor(NAVY)),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor(PALE)]),('VALIGN',(0,0),(-1,-1),'TOP'),('FONTSIZE',(0,1),(-1,-1),8),('TEXTCOLOR',(0,1),(-1,-1),colors.HexColor(NAVY)),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,-1),(-1,-1),.5,colors.HexColor(TEAL))]
    for i in money_cols:style.append(('ALIGN',(i,1),(i,-1),'RIGHT'))
    t.setStyle(TableStyle(style));return t
def polish_workbook(wb):
    from openpyxl.styles import Font,PatternFill,Alignment,Border,Side
    from openpyxl.utils import get_column_letter
    for ws in wb.worksheets:
        ws.sheet_view.showGridLines=False;ws.sheet_view.zoomScale=90
        ws.sheet_properties.pageSetUpPr.fitToPage=True;ws.sheet_properties.outlinePr.summaryBelow=True
        ws.sheet_properties.tabColor=TEAL[1:];ws.print_title_rows='1:3';ws.page_setup.orientation='landscape';ws.page_setup.paperSize=ws.PAPERSIZE_A4;ws.page_setup.fitToWidth=1;ws.page_setup.fitToHeight=0
        ws.oddFooter.left.text='SISFIA | '+stamp();ws.oddFooter.right.text='Página &P de &N'
        ws.row_dimensions[1].height=34;ws.row_dimensions[2].height=max(ws.row_dimensions[2].height or 0,45);ws.row_dimensions[3].height=32
        for c in ws[1]:c.fill=PatternFill('solid',fgColor=NAVY[1:]);c.font=Font(name='Calibri',size=16,bold=True,color='FFFFFF')
        for c in ws[3]:c.fill=PatternFill('solid',fgColor=TEAL[1:]);c.font=Font(name='Calibri',bold=True,color='FFFFFF');c.alignment=Alignment(wrap_text=True,vertical='center')
        for row in ws.iter_rows(min_row=4):
            height=18
            for c in row:
                if c.value is None:continue
                c.font=Font(name='Calibri',size=11,bold=c.font.bold,color=NAVY[1:]);c.alignment=Alignment(vertical='top',wrap_text=isinstance(c.value,str),horizontal='right' if isinstance(c.value,(int,float)) else 'left')
                if isinstance(c.value,str):
                    width=ws.column_dimensions[get_column_letter(c.column)].width or 14
                    height=max(height, min(100,15*(1+len(c.value)//max(10,int(width*.9)))))
            ws.row_dimensions[row[0].row].height=height
        ws.print_options.horizontalCentered=True
