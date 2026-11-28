"""Institutional operation sheets. The server provides authorized, filtered rows only."""
from pathlib import Path
from datetime import date
from io import BytesIO
from xml.sax.saxutils import escape
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4,landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,LongTable,TableStyle,Spacer,KeepTogether
from openpyxl import Workbook
from openpyxl.styles import Font,Alignment,Border,Side,PatternFill
from openpyxl.drawing.image import Image as XLImage
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.pagebreak import Break
ICONS=Path(__file__).resolve().parents[1]/'public/icons'
LOGOS=['sisfia-logo-full.png','sisfia-product.png','adn-lasallista.png']
MONTHS='enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split()
NAVY='243C80'; BLUE='00B2E3'
def label(s):
    d=date.fromisoformat(s);return f'{d.day} DE {MONTHS[d.month-1].upper()} {d.year}'
def title(p):return 'OPERACIONES '+label(p['from']) if p['from']==p['to'] else f"OPERACIONES DEL {p['from']} AL {p['to']}"
def context(p):
    f=p.get('filters',{});parts=[str(p.get('company',''))]
    for k,n in [('status','Estado'),('bank','Banco'),('category','Rubro'),('type','Tipo'),('provider','Beneficiario'),('q','Búsqueda')]:
        if f.get(k):parts.append(n+': '+str(f[k]))
    if p.get('batch'):parts.append('Lote '+p['batch'][:8]+' · valores vigentes')
    parts.append('Datos completos · uso restringido' if p.get('full') else 'Cuentas y documentos enmascarados')
    return ' | '.join(parts)
def total_label(p):return 'TOTAL A PAGAR' if p['rows'] and all(r['status']=='Pendiente' for r in p['rows']) else 'TOTAL PAGADO' if p['rows'] and all(r['status']=='Pagado' for r in p['rows']) else 'TOTAL OPERACIONES'
def headers(p):return ['N° Or','Concepto','Comprobante','Monto S/','Cuenta bancaria / CCI','Banco Dest.','Empresa / Persona','RUC / DNI']+(['Fecha','Estado'] if p['from']!=p['to'] or len(set(r['status'] for r in p['rows']))>1 or any(r['date']!=p['from'] for r in p['rows']) else [])
def values(p):
    extra=len(headers(p))>8
    return [[r['order'] or i,r['concept'],r['receipt'],r['cents']/100,r['account'],r['bank'],r['provider'],r['ruc']]+([r['date'],r['status']] if extra else []) for i,r in enumerate(p['rows'],1)]
def pdf(p):
    buf=BytesIO(); w,h=landscape(A4);width=w-60;hs=headers(p);wide=len(hs)>8
    weights=[28,170,182,75,110,62,132,73]+([70,65] if wide else []);widths=[x*width/sum(weights) for x in weights]
    body=ParagraphStyle('cell',fontName='Helvetica',fontSize=7.5,leading=9.5,wordWrap='CJK',alignment=1)
    head=ParagraphStyle('head',parent=body,fontName='Helvetica-Bold',fontSize=8)
    def para(v,style=body):return Paragraph(escape(str(v if v is not None else '')).replace('\n','<br/>'),style)
    def money(v):return f'{v:,.2f}'
    rows=[[para(x,head) for x in hs]]
    for row in values(p):rows.append([money(x) if i==3 else para(x) for i,x in enumerate(row)])
    t=LongTable(rows,colWidths=widths,repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.black),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(3,1),(3,-1),'RIGHT'),('FONTNAME',(3,1),(3,-1),'Helvetica'),('FONTSIZE',(3,1),(3,-1),8),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3)]))
    end=LongTable([['','',total_label(p),'S/ '+money(p['totals']['total']/100)]+['']*(len(hs)-4)],colWidths=widths,hAlign='LEFT');end.setStyle(TableStyle([('BACKGROUND',(2,0),(3,0),colors.HexColor('#'+BLUE)),('BOX',(2,0),(3,0),.6,colors.black),('LINEBEFORE',(3,0),(3,0),.5,colors.black),('FONTNAME',(2,0),(3,0),'Helvetica-Bold'),('FONTSIZE',(2,0),(3,0),8),('ALIGN',(2,0),(3,0),'CENTER'),('BOTTOMPADDING',(2,0),(3,0),7),('TOPPADDING',(2,0),(3,0),7)]))
    small=ParagraphStyle('context',fontName='Helvetica',fontSize=8,leading=10,textColor=colors.HexColor('#'+NAVY));story=[para(context(p),small),Spacer(1,7),t,KeepTogether([end,Spacer(1,8),para(f"{p['totals']['count']} registros · Pagado: S/ {money(p['totals']['paid']/100)} · Pendiente: S/ {money(p['totals']['pending']/100)}",small),para('Documento administrativo. No acredita transferencia bancaria.',small)])]
    def frame(c,d):
        c.drawImage(str(ICONS/LOGOS[0]),24,h-93,width=162,height=81,preserveAspectRatio=True,anchor='c',mask='auto');c.drawImage(str(ICONS/LOGOS[1]),w/2-84,h-78,width=168,height=53,preserveAspectRatio=True,anchor='c',mask='auto');c.drawImage(str(ICONS/LOGOS[2]),w-120,h-96,width=96,height=84,preserveAspectRatio=True,anchor='c',mask='auto');c.setStrokeColor(colors.black);c.rect(30,h-123,width,24);c.setFont('Helvetica',12);c.drawCentredString(w/2,h-115,title(p));c.setFont('Helvetica',8);c.drawString(24,20,'SISFIA · Operaciones financieras');c.drawRightString(w-24,20,f'Página {d.page}')
    SimpleDocTemplate(buf,pagesize=landscape(A4),leftMargin=24,rightMargin=24,topMargin=131,bottomMargin=35,title=title(p)).build(story,onFirstPage=frame,onLaterPages=frame);sys.stdout.buffer.write(buf.getvalue())
def xlsx(p):
    wb=Workbook();ws=wb.active;ws.title='Operaciones';hs=headers(p);n=len(hs);last=get_column_letter(n)
    for imgname,anchor,ww,hh in [(LOGOS[0],'A1',180,99),(LOGOS[1],'D1',173,65),(LOGOS[2],last+'1',90,79)]:
        img=XLImage(ICONS/imgname);img.width=ww;img.height=hh;ws.add_image(img,anchor)
    for i in range(1,6):ws.row_dimensions[i].height=18
    ws.merge_cells(start_row=6,start_column=1,end_row=6,end_column=n);ws.cell(6,1,title(p)).font=Font(name='Calibri',size=15,bold=True,color=NAVY);ws.cell(6,1).alignment=Alignment(horizontal='center',vertical='center');ws.row_dimensions[6].height=26
    ws.merge_cells(start_row=7,start_column=1,end_row=7,end_column=n);ws.cell(7,1,context(p)).alignment=Alignment(wrap_text=True,vertical='center');ws.row_dimensions[7].height=32
    widths=[9,45,48,18,28,20,38,20]+([15,15] if n>8 else [])
    for i,w in enumerate(widths,1):ws.column_dimensions[get_column_letter(i)].width=w
    line=Side(style='thin',color='000000');border=Border(left=line,right=line,top=line,bottom=line)
    for i,v in enumerate(hs,1):c=ws.cell(8,i,v);c.font=Font(name='Calibri',bold=True,color=NAVY);c.alignment=Alignment(horizontal='center',wrap_text=True);c.border=border
    ws.row_dimensions[8].height=30
    for ri,row in enumerate(values(p),9):
        height=20
        for i,v in enumerate(row,1):
            c=ws.cell(ri,i,v)
            if isinstance(v,str):c.data_type='s';height=max(height, min(135,15*(1+len(v)//max(8,int(widths[i-1]*.85)))))
            c.font=Font(name='Calibri',size=10);c.alignment=Alignment(horizontal='right' if i==4 else 'center',vertical='center',wrap_text=True);c.border=border
            if i==4:c.number_format='"S/" #,##0.00'
        ws.row_dimensions[ri].height=height
    end=9+len(p['rows']);ws.cell(end,3,total_label(p));ws.cell(end,4,p['totals']['total']/100).number_format='"S/" #,##0.00'
    for c in ws[end][2:4]:c.fill=PatternFill('solid',fgColor=BLUE);c.font=Font(bold=True);c.border=border
    ws.cell(end+2,1,'Pagado');ws.cell(end+2,2,p['totals']['paid']/100).number_format='"S/" #,##0.00';ws.cell(end+3,1,'Pendiente');ws.cell(end+3,2,p['totals']['pending']/100).number_format='"S/" #,##0.00'
    ws.freeze_panes='B9';ws.sheet_view.showGridLines=False;ws.auto_filter.ref=f'A8:{last}{max(8,end-1)}';ws.print_title_rows='8:8';ws.print_area=f'A1:{last}{end+3}';ws.sheet_properties.pageSetUpPr.fitToPage=True;ws.page_setup.orientation='landscape';ws.page_setup.paperSize=ws.PAPERSIZE_A4;ws.page_setup.fitToWidth=1;ws.page_setup.fitToHeight=0;ws.oddFooter.right.text='Página &P de &N';ws.oddFooter.left.text='SISFIA · Documento administrativo'
    b=BytesIO();wb.save(b);sys.stdout.buffer.write(b.getvalue())
