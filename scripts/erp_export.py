import io,sys
from xml.sax.saxutils import escape
LABELS={'center':'Centro de costos','purchase':'Compra','payable':'Cuenta por pagar','asset':'Activo','document':'Documento'}
def rows(p):
    a=[['Tipo','Código','Fecha','Concepto','Estado','Importe S/','Proveedor','Vencimiento','Referencia','Ubicación','Vida útil meses','Residual S/','Operación vinculada']]
    for r in p['records']:
        d=r['data']; a.append([LABELS[r['kind']],r['code'],r['date'],r['title'],r['state'],r['cents']/100,d.get('provider',''),d.get('due') or '',d.get('reference',''),d.get('location',''),d.get('lifeMonths') or '',d.get('residual',0)/100,d.get('opId') or ''])
    b=[['Centro','Fecha','Operación','Concepto','Estado','Monto S/']]+[[r['title'],r['date'],r['id'],r['concept'],r['status'],r['amount']] for r in p['allocations']]
    return a,b
def erp_xlsx(p):
    from openpyxl import Workbook
    from openpyxl.styles import Font,PatternFill,Alignment
    from openpyxl.utils import get_column_letter
    from report_style import polish_workbook
    w=Workbook();w.remove(w.active)
    for title,table,mon in zip(['Gestión administrativa','Centros de costos'],rows(p),[{6,12},{6}]):
        s=w.create_sheet(title);s.append(['SISFIA | '+title]);s.merge_cells(start_row=1,start_column=1,end_row=1,end_column=len(table[0]));s.append([p['company']+' | '+p['month']+' | Importes de fuentes distintas: no sumar compras, obligaciones y activos.']);s.merge_cells(start_row=2,start_column=1,end_row=2,end_column=len(table[0]));s['A2'].data_type='s';s['A2'].alignment=Alignment(wrap_text=True);s.row_dimensions[2].height=34
        for row in table:
            s.append(row)
            for c in s[s.max_row]:
                if isinstance(c.value,str):c.data_type='s'
                if s.max_row==3:c.fill=PatternFill('solid',fgColor='243C80');c.font=Font(bold=True,color='FFFFFF')
                elif c.column in mon:c.number_format='#,##0.00'
        for i in range(1,len(table[0])+1):s.column_dimensions[get_column_letter(i)].width=42 if i in (4,7) else 20
        s.freeze_panes='A4';s.auto_filter.ref=f'A3:{get_column_letter(len(table[0]))}{s.max_row}'
    polish_workbook(w);out=io.BytesIO();w.save(out);sys.stdout.buffer.write(out.getvalue())
def erp_pdf(p):
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4,landscape
    from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT
    out=io.BytesIO();doc=SimpleDocTemplate(out,pagesize=landscape(A4),leftMargin=28,rightMargin=28,topMargin=82,bottomMargin=45);styles=getSampleStyleSheet();body=ParagraphStyle('cell',fontName='Helvetica',fontSize=8,leading=10);right=ParagraphStyle('amount',parent=body,alignment=TA_RIGHT)
    def para(v,style=body):return Paragraph(escape(str(v if v is not None else '')),style)
    story=[];a,b=rows(p)
    for idx,(title,raw,cols,width) in enumerate([('Gestión administrativa',a,[0,1,2,3,4,5,6,7],[85,70,64,185,65,75,125,64]),('Distribución por centros de costos',b,[0,1,2,3,4,5],[150,75,65,330,85,75])]):
        if idx:story.append(PageBreak())
        story.extend([para('SISFIA | '+title,styles['Heading1']),para(p['company']+' · '+p['month']+' · PEN (S/)'),Spacer(1,8),para('No sumar compras, cuentas por pagar y activos: pueden representar el mismo movimiento. Los centros de costos desglosan operaciones existentes.'),Spacer(1,10)])
        data=[]
        for i,row in enumerate(raw):
            data.append([para(f'{row[c]:,.2f}' if c==5 and i and isinstance(row[c],(int,float)) else row[c],right if c==5 else body) for c in cols])
        t=Table(data,colWidths=width,repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#DCE6F3')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F1F5FA')]),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,0),1,colors.HexColor('#243C80'))]));story.append(t)
    def footer(c,d):c.setFont('Helvetica',8);c.drawString(28,16,'SISFIA · Uso administrativo');c.drawRightString(landscape(A4)[0]-28,16,'Página '+str(d.page))
    from report_style import page_frame
    doc.build(story,onFirstPage=page_frame,onLaterPages=page_frame);sys.stdout.buffer.write(out.getvalue())
