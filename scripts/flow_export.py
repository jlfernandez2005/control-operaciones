"""The official template is retained unchanged as a resource; populate a new copy per export."""
import io,sys,datetime
from pathlib import Path
from report_style import page_frame,report_table,paragraph,NAVY,TEAL
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font,PatternFill,Alignment
from openpyxl.chart import BarChart,Reference
TEMPLATE=Path(__file__).with_name('presupuesto-la-salle.xlsx')
def fmt(v):return '—' if v is None else f'{v/100:,.2f}'
def safe(ws,row,col,value):
    c=ws.cell(row,col,value); 
    if isinstance(value,str):c.data_type='s'
    return c
def flow_xlsx(p):
    wb=load_workbook(TEMPLATE,keep_links=False);ws=wb.active;ws.title='Presupuesto';actual=wb.copy_worksheet(ws);actual.title='Ejecutado registrado';year=int(p['year']);
    for sh,mat,opening,label in [(ws,p['plan'],p['config'].get('planOpening'),'Presupuesto'),(actual,p['actual'],p['config'].get('actualOpening'),'Flujo registrado')]:
        sh['B2']=f'{label} mensual de flujo de caja | Año {year} | Soles (S/)';sh['B3']='SISFIA · importes positivos; vacíos = sin dato presupuestado. Flujo registrado sujeto a conciliación.';sh['A55']='IV.'
        for i in range(12):
            c=i+3;l=get_column_letter(c);prev=get_column_letter(c-1);sh.cell(6,c,datetime.date(year,i+1,1));sh.cell(6,c).number_format='mmm-yy'
            for part in p['parts']:
                v=mat[part['id']][i];sh.cell(part['row'],c).value=None if v is None else v/100
            for row,start,end in [(9,10,14),(16,17,21),(27,28,30),(32,33,34),(40,41,43),(45,46,47)]:sh.cell(row,c,f'=SUM({l}{start}:{l}{end})')
            for row,a,b in [(23,9,16),(36,27,32),(49,40,45)]:sh.cell(row,c,f'={l}{a}-{l}{b}')
            sh.cell(52,c,f'={l}23+{l}36+{l}49');sh.cell(57,c).value=(None if opening is None else opening/100) if i==0 else f'=IF(ISNUMBER({prev}59),{prev}59,"")';sh.cell(59,c,f'=IF(ISNUMBER({l}57),{l}57+{l}52,"")')
        for row in [9,16,23,27,32,36,40,45,49,52]+[x['row'] for x in p['parts']]:sh.cell(row,15,f'=SUM(C{row}:N{row})')
        sh['O57']='=IF(ISNUMBER(C57),C57,"")';sh['O59']='=IF(ISNUMBER(N59),N59,"")';sh.freeze_panes='C7';sh.print_area='A1:O59';sh.sheet_view.showGridLines=False;sh.sheet_properties.pageSetUpPr.fitToPage=True;sh.page_setup.fitToWidth=1;sh.page_setup.fitToHeight=1;sh.page_setup.orientation='landscape'
    def tab(name,headers,rows):
        sh=wb.create_sheet(name);sh.append(headers)
        for row in rows:
            n=sh.max_row+1
            for i,v in enumerate(row,1):safe(sh,n,i,v)
        sh.freeze_panes='B2';sh.auto_filter.ref=sh.dimensions;sh.sheet_view.showGridLines=False
        for c in sh[1]:c.fill=PatternFill('solid',fgColor='10345B');c.font=Font(color='FFFFFF',bold=True);c.alignment=Alignment(wrap_text=True)
        for i in range(1,len(headers)+1):sh.column_dimensions[get_column_letter(i)].width= max(15,min(45,max(len(str(headers[i-1])),max((len(str(sh.cell(r,i).value or '')) for r in range(2,min(sh.max_row,100)+1)),default=0))+2))
        return sh
    coverage=tab('Cobertura y conciliación',['Mes','Resumen (S/)','Operaciones (S/)','Sin clasificar pagado','Pendiente sin clasificar','Transferencias internas','Caja por verificar','Mes completo'],[[c['month'],*[None if c[k] is None else c[k]/100 for k in ['reference','registered','unclassified','pendingUnknown','internal','unlinkedCash']], 'Sí' if c['complete'] else 'No'] for c in p['coverage']])
    compare=tab('Comparativo',['Mes','Partida','Presupuesto S/','Ejecutado S/','Pendiente S/','Diferencia P-E S/'],[[m,x['label'],None if p['plan'][x['id']][i] is None else p['plan'][x['id']][i]/100,p['actual'][x['id']][i]/100,p['pending'][x['id']][i]/100,None if p['plan'][x['id']][i] is None else (p['plan'][x['id']][i]-p['actual'][x['id']][i])/100] for i,m in enumerate(p['months']) for x in p['parts']])
    tab('Movimientos',['Fecha','Concepto','Rubro','Partida','Origen','Estado','Monto S/','Referencia','Observación'],[[r['date'],r['concept'],r['category'],next((x['label'] for x in p['parts'] if x['id']==r['part']),r['part'] or 'Sin clasificar'),r['source'],r['status'],r['amount']/100,r['receipt'],r['note']] for r in p['rows']]);
    trend=tab('Evolución',['Mes','Entradas previstas','Salidas previstas','Entradas registradas','Salidas registradas','Saldo previsto','Saldo registrado'],[[m,*[None if v is None else v/100 for v in [p['planFlow'][i]['inflow'],p['planFlow'][i]['outflow'],p['actualFlow'][i]['inflow'],p['actualFlow'][i]['outflow'],p['planFlow'][i]['closing'],p['actualFlow'][i]['closing']]]] for i,m in enumerate(p['months'])]);chart=BarChart();chart.title='Entradas y salidas por mes';chart.add_data(Reference(trend,min_col=2,max_col=5,min_row=1,max_row=13),titles_from_data=True);chart.set_categories(Reference(trend,min_col=1,min_row=2,max_row=13));chart.width=25;chart.height=12;trend.add_chart(chart,'A16')
    tab('Notas',['Campo','Valor'],[['Institución',p['company']],['Estado',p['config'].get('state','Borrador')],['Nota',p['config'].get('note','')],['Criterio','Solo cobros/pagos registrados; las operaciones usan su fecha registrada. Los resúmenes no se suman. Transferencias internas excluidas.'],['Cobertura','Los valores observados no acreditan que estén completos. Revisar partidas pendientes y saldos de caja.'],['Fuente de formato','Plantilla PPTO_Colegio suministrada por el usuario.']]);
    buf=io.BytesIO();wb.save(buf);sys.stdout.buffer.write(buf.getvalue())
def flow_pdf(p):
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak
    from reportlab.lib.pagesizes import A4,landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from xml.sax.saxutils import escape
    styles=getSampleStyleSheet();story=[];w=landscape(A4)[0]-82;left=190;cols=[left]+[(w-left)/7]*7
    story.extend([Paragraph(escape('Consolidado anual | '+p['year']),styles['Title']),Paragraph(escape(p['company']+' · Presupuesto frente a ejecución · PEN (S/)'),styles['Normal']),Spacer(1,8)])
    annual=[]
    for x in p['parts']:
        a=p['plan'][x['id']];planned=sum(v or 0 for v in a) if any(v is not None for v in a) else None;actual=sum(p['actual'][x['id']]);pending=sum(p['pending'][x['id']]);annual.append([x['group'],x['label'],fmt(planned),fmt(actual),fmt(pending),fmt(None if planned is None else planned-actual)])
    table=report_table(['Actividad','Partida','Presupuesto','Ejecutado','Pendiente','Diferencia P-E'],annual,[88,214,116,116,116,109],(2,3,4,5));from reportlab.platypus import TableStyle;table.setStyle(TableStyle([('TOPPADDING',(0,0),(-1,-1),1),('BOTTOMPADDING',(0,0),(-1,-1),1)]));story.append(table);story.append(Spacer(1,8));story.append(Paragraph('Presupuesto: '+escape(p['config'].get('state','Borrador'))+' | Meses confirmados completos: '+str(sum(c['complete'] for c in p['coverage']))+'/12. Los importes sin clasificar se informan en cobertura, no se asignan a una partida inventada.',styles['Normal']))
    for mode,mat,flow in [('Presupuesto',p['plan'],p['planFlow']),('Ejecutado registrado',p['actual'],p['actualFlow'])]:
        for start in [0,6]:
            if story:story.append(PageBreak())
            story.extend([Paragraph(escape(f'{mode} de flujo de caja | {p["year"]}'),styles['Title']),Paragraph(escape(p['company']+' · PEN · '+p['config'].get('state','Borrador')),styles['Normal']),Spacer(1,8)])
            rows=[]
            for part in p['parts']:
                vals=mat[part['id']];rows.append([part['label'],*[fmt(v) for v in vals[start:start+6]],fmt(sum(v or 0 for v in vals[start:start+6])) if any(v is not None for v in vals[start:start+6]) else '—'])
            for label,key in [('Flujo neto operativo','operation'),('Flujo neto inversión','investment'),('Flujo neto financiamiento','financing'),('Variación neta de caja','net'),('Saldo inicial','opening'),('Saldo final','closing')]:
                vals=[f[key] for f in flow[start:start+6]];total=vals[0] if key=='opening' else vals[-1] if key=='closing' else sum(v or 0 for v in vals);rows.append([label,*map(fmt,vals),fmt(total)])
            table=report_table(['Partida',*p['months'][start:start+6],'Semestre'],rows,cols,tuple(range(1,8)));from reportlab.platypus import TableStyle;table.setStyle(TableStyle([('TOPPADDING',(0,0),(-1,-1),0.7),('BOTTOMPADDING',(0,0),(-1,-1),0.7)]));story.append(table)
            story.append(Paragraph('Importes registrados sujetos a cobertura y conciliación. Vacíos de presupuesto no equivalen a partidas aprobadas.',styles['Normal']))
    story.extend([PageBreak(),Paragraph('Cobertura y conciliación',styles['Title']),report_table(['Mes','Resumen','Registrado','Sin clasificar','Caja sin vínculo','Completo'],[[c['month'],fmt(c['reference']),fmt(c['registered']),fmt(c['unclassified']),fmt(c['unlinkedCash']),'Sí' if c['complete'] else 'No'] for c in p['coverage']],[90,130,130,130,130,80],(1,2,3,4))]);buf=io.BytesIO();SimpleDocTemplate(buf,pagesize=landscape(A4),leftMargin=35,rightMargin=35,topMargin=80,bottomMargin=42,title='SISFIA | Flujo de caja').build(story,onFirstPage=page_frame,onLaterPages=page_frame);sys.stdout.buffer.write(buf.getvalue())
