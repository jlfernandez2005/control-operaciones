"""Exports a saved monthly reference and its reconciliation, without counting it twice."""
import io,sys
from report_style import page_frame,report_table,polish_workbook,NAVY,TEAL,stamp
from xml.sax.saxutils import escape
NOTE='Resumen de control: no constituye una operación adicional ni acredita por sí solo el pago. Diferencia = registrado menos resumen. Caja chica no se suma nuevamente.'
def fmt(n):return '—' if n is None else f'{n:,.2f}'
def reference_data(p):
 r=p.get('reconciliation') or {};return [('Total de referencia',p['amount']),('Total impreso',p.get('declared')),('Operaciones registradas',r.get('registered')),('Diferencia bruta',r.get('difference')),('SUNAT por confirmar',r.get('directSuggested')),('Diferencia ajustada',r.get('adjustedDifference'))]
def reference_pdf(p):
 from reportlab.lib.pagesizes import A4,landscape
 from reportlab.lib.styles import getSampleStyleSheet
 from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer
 from reportlab.lib import colors
 b=io.BytesIO();styles=getSampleStyleSheet();styles['Title'].textColor=colors.HexColor(NAVY)
 story=[Paragraph('Resumen de operaciones · '+escape(p['month']),styles['Title']),Paragraph(escape(p.get('company','')+' | '+p['filename']),styles['BodyText']),Spacer(1,8),report_table(['Indicador','Importe (S/)'],[(k,fmt(v)) for k,v in reference_data(p)],[440,140],{1}),Spacer(1,8),Paragraph(NOTE,styles['BodyText']),Spacer(1,10),Paragraph('Detalle del informe original',styles['Heading2'])]
 if p['rows']:story.append(report_table(['Fecha','Concepto','Referencia','Monto (S/)'],[(x['date'],x['concept'],x.get('reference',''),fmt(x['amount'])) for x in p['rows']],[85,375,185,115],{3}))
 else:story.append(Paragraph('Solo se registró el total mensual; no hay detalle por fecha.',styles['BodyText']))
 if p.get('days'):
  story.extend([Spacer(1,12),Paragraph('Conciliación por fecha',styles['Heading2']),report_table(['Fecha','Concepto','Resumen','Registrado','SUNAT por confirmar','Dif. ajustada','Estado'],[(x['date'],x['concept'],fmt(x['reference']),fmt(x['registered']),fmt(x['directSuggested']),fmt(x['adjustedDifference']),x['status']) for x in p['days']],[72,225,90,90,90,88,105],{2,3,4,5})])
 SimpleDocTemplate(b,pagesize=landscape(A4),leftMargin=35,rightMargin=35,topMargin=80,bottomMargin=42,title='SISFIA | Resumen de operaciones '+p['month']).build(story,onFirstPage=page_frame,onLaterPages=page_frame);sys.stdout.buffer.write(b.getvalue())
def reference_xlsx(p):
 from openpyxl import Workbook
 from openpyxl.styles import Font,PatternFill,Alignment
 from openpyxl.utils import get_column_letter
 wb=Workbook();wb.remove(wb.active)
 def sheet(name,headers,records,widths,money):
  ws=wb.create_sheet(name);ws.append(['SISFIA | '+name+' · '+p['month']]);ws.merge_cells(start_row=1,start_column=1,end_row=1,end_column=len(headers));ws.append([p.get('company','')+' | '+p['filename']+' | '+NOTE]);ws.merge_cells(start_row=2,start_column=1,end_row=2,end_column=len(headers));ws['A2'].data_type='s';ws['A2'].alignment=Alignment(wrap_text=True);ws.append(headers)
  for row in records:
   ws.append(row)
   for c in ws[ws.max_row]:
    if isinstance(c.value,str):c.data_type='s'
    if c.column in money:c.number_format='#,##0.00;[Red](#,##0.00)'
    if ws.max_row%2==0:c.fill=PatternFill('solid',fgColor='EFF5F9')
  for i,w in enumerate(widths,1):ws.column_dimensions[get_column_letter(i)].width=w
  ws.freeze_panes='A4';ws.auto_filter.ref=f'A3:{get_column_letter(len(headers))}{ws.max_row}'
 sheet('Resumen',['Indicador','Importe (S/)'],reference_data(p),[72,28],{2})
 sheet('Detalle',['Fecha','Concepto','Referencia','Monto (S/)'],[(x['date'],x['concept'],x.get('reference',''),x['amount']) for x in p['rows']],[16,65,35,20],{4})
 sheet('Conciliación',['Fecha','Concepto','Resumen','Registrado','SUNAT por confirmar','Diferencia ajustada','Estado'],[(x['date'],x['concept'],x['reference'],x['registered'],x['directSuggested'],x['adjustedDifference'],x['status']) for x in p.get('days',[])],[16,65,22,22,24,24,32],{3,4,5,6})
 polish_workbook(wb);b=io.BytesIO();wb.save(b);sys.stdout.buffer.write(b.getvalue())
