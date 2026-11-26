"""Budget exports, sourced from the same reconciliation as the dashboard."""
import io,sys
from xml.sax.saxutils import escape
FIELDS=[('month','Mes'),('planned','Presupuesto'),('paid','Pagado'),('pending','Pendiente'),('registered','Registrado'),('balance','Saldo plan'),('cashDetail','Detalle caja (no sumar)'),('reference','Referencia mensual'),('difference','Diferencia bruta'),('directSuggested','SUNAT por confirmar'),('adjustedDifference','Diferencia ajustada'),('missing','Faltantes por fecha'),('excess','Excesos por fecha'),('referenceFile','Archivo referencia')]
DETAIL=[('month','Mes'),('category','Rubro'),('planned','Presupuesto'),('paid','Pagado'),('pending','Pendiente'),('registered','Registrado'),('balance','Saldo plan')]
CASH=[('num','Caja'),('ord','Orden'),('period','Periodo'),('fund','Fondo'),('spent','Gastos'),('state','Conciliación'),('opId','Operación vinculada')]
REFDAYS=[('date','Fecha'),('concept','Concepto del resumen'),('reference','Importe resumen'),('registered','Registrado'),('difference','Dif. bruta'),('directSuggested','SUNAT por confirmar'),('adjustedDifference','Dif. ajustada'),('status','Estado'),('fiscalPeriod','Periodo fiscal')]
ANNUAL=[('category','Rubro'),('planned','Presupuesto'),('paid','Pagado'),('pending','Pendiente'),('registered','Registrado'),('balance','Saldo plan')]
def consolidated(p):
 from decimal import Decimal
 def sums(records,label):
  def total(k):return float(sum((Decimal(str(r.get(k) or 0)) for r in records),Decimal(0)))
  planned=total('planned') if any(r.get('planned') is not None for r in records) else None
  registered=total('registered');return dict(category=label,planned=planned,paid=total('paid'),pending=total('pending'),registered=registered,balance=None if planned is None else round(planned-registered,2))
 cats=sorted(set(r['category'] for r in p['detail']));return [sums(p['detail'],'TOTAL DEL PERIODO')]+[sums([r for r in p['detail'] if r['category']==c],c) for c in cats]
NOTE='SUNAT sugerido no es un pago registrado hasta confirmación. Total basado exclusivamente en operaciones activas. Caja chica y referencia mensual no se suman. Importes en soles. Plan vacío = no definido. Distribución de caja vinculada por fecha de transferencia.'
def budget_xlsx(p):
 from openpyxl import Workbook
 from openpyxl.styles import Font, PatternFill, Alignment
 from openpyxl.utils import get_column_letter
 wb=Workbook();wb.remove(wb.active)
 for title,fields,records in [('Consolidado por rubro',ANNUAL,consolidated(p)),('Resumen mensual',FIELDS,p['months']),('Rubros por mes',DETAIL,p['detail']),('Conciliación caja',CASH,p['cash']),('Conciliación diaria',REFDAYS,p.get('referenceDays',[]))]:
  ws=wb.create_sheet(title);ws.append(['SISFIA | '+title+' · '+p.get('period',p['year'])]);ws.merge_cells(start_row=1,start_column=1,end_row=1,end_column=len(fields));ws['A1'].font=Font(bold=True,size=16,color='FFFFFF');ws['A1'].fill=PatternFill('solid',fgColor='173A4C');ws.row_dimensions[1].height=30
  ws.append([p.get('company','')+' | '+NOTE]);ws.merge_cells(start_row=2,start_column=1,end_row=2,end_column=len(fields));ws['A2'].alignment=Alignment(wrap_text=True);ws.row_dimensions[2].height=32
  ws.append([label for _,label in fields]);
  for c in ws[3]:c.font=Font(bold=True,color='FFFFFF');c.fill=PatternFill('solid',fgColor='087E83')
  for record in records:
   ws.append([record.get(k) for k,_ in fields]);
   for c in ws[ws.max_row]:
    if isinstance(c.value,str):c.data_type='s'
    elif isinstance(c.value,(int,float)) and fields[c.column-1][0]!='opId':c.number_format='#,##0.00;[Red](#,##0.00)'
    if ws.max_row%2==0:c.fill=PatternFill('solid',fgColor='EDF5F5')
  for j,(k,label) in enumerate(fields,1):ws.column_dimensions[get_column_letter(j)].width=42 if k in ('category','state','referenceFile','ord') else max(18,len(label)+3)
  ws.freeze_panes='B4';ws.auto_filter.ref=f'A3:{get_column_letter(len(fields))}{ws.max_row}'
 from report_style import polish_workbook
 polish_workbook(wb);buf=io.BytesIO();wb.save(buf);sys.stdout.buffer.write(buf.getvalue())
def budget_pdf(p):
 from reportlab.lib import colors
 from reportlab.lib.pagesizes import A4,landscape
 from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
 from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,LongTable,TableStyle
 styles=getSampleStyleSheet();styles['Title'].textColor=colors.HexColor('#173A4C');small=ParagraphStyle('cell',fontName='Helvetica',fontSize=8,leading=10);buf=io.BytesIO();story=[Paragraph('SISFIA | Presupuesto '+escape(p.get('period',p['year'])),styles['Title']),Paragraph(escape(p.get('company','')+' | '+NOTE),styles['BodyText']),Spacer(1,10)]
 def table(title,fields,rows,widths):
  story.append(Paragraph(title,styles['Heading2']));matrix=[[Paragraph(escape(label),small) for _,label in fields]]
  for r in rows:
   matrix.append([Paragraph(escape('—' if r.get(k) is None else f'{r[k]:,.2f}' if isinstance(r.get(k),(int,float)) and k!='opId' else str(r[k])),small) for k,_ in fields])
  widths=[w*min(1,760/sum(widths)) for w in widths];t=LongTable(matrix,colWidths=widths,repeatRows=1);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#D9E9EB')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F0F5F5')]),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),6)]));story.extend([t,Spacer(1,12)])
 table('Consolidado del periodo',ANNUAL,consolidated(p),[240,105,105,105,105,100]);table('Resumen mensual',FIELDS[:9],p['months'],[61,87,77,77,83,81,95,94,76]);table('Conciliación por mes',[FIELDS[0],*FIELDS[7:13]],p['months'],[70,110,110,115,115,110,110]);table('Detalle por rubros',DETAIL,p['detail'],[65,220,90,90,90,90,90]);table('Conciliación de caja chica',CASH,p['cash'],[70,125,85,85,85,205,75]);
 if p.get('referenceDays'):table('Conciliación diaria de resúmenes',REFDAYS,p['referenceDays'],[65,170,72,72,72,75,75,110,65]);
 def foot(c,d):c.setFont('Helvetica',8);c.drawString(32,20,'SISFIA · Sistema Financiero Administrativo');c.drawRightString(landscape(A4)[0]-32,20,str(d.page))
 from report_style import page_frame
 SimpleDocTemplate(buf,pagesize=landscape(A4),leftMargin=30,rightMargin=30,topMargin=80,bottomMargin=42).build(story,onFirstPage=page_frame,onLaterPages=page_frame);sys.stdout.buffer.write(buf.getvalue())
