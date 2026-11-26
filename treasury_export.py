"""Treasury reports keep evidence sources separate; never sum across bank and collections."""
import io,sys
from report_style import report_table,page_frame,polish_workbook
LABEL={'bank':'Estado bancario','collection':'Sallenet – detalle','income_summary':'Resumen de ingresos','operations':'Operaciones','cash':'Caja chica','flow_entry':'Movimientos de flujo','operations_summary':'Resumen de operaciones'}
FILTER_LABEL={'kind':'Fuente','bank':'Banco','category':'Rubro','direction':'Sentido','from':'Desde','to':'Hasta','q':'Búsqueda','group':'Agrupación','status':'Estado','doc':'Documento','detail':'Contenido'}
FILTER_VALUE={'in':'Abonos / ingresos','out':'Cargos','summary':'Resumen y conciliación','full':'Con detalle','category':'Categoría','month':'Mes','date':'Fecha','due':'Vencimiento','bank':'Banco','status':'Estado','provider':'Proveedor / persona'}
def filter_text(p):
    f=p.get('filters',{});return ' · '.join(f'{FILTER_LABEL[k]}: {LABEL.get(v,FILTER_VALUE.get(v,v)) if isinstance(v,str) else v}' for k,v in f.items() if k in FILTER_LABEL and v) or 'Sin filtros adicionales'
def money(n):return '—' if n is None else f'{n/100:,.2f}'
def source(d):return LABEL[d['kind']]
def tables(p):
    docs=[['Fuente','Mes','Banco','Cuenta (final)','Filas','Saldo inicial','Abonos','Cargos','Saldo final','Total cobranza','Archivo']]
    for d in p['documents']:docs.append([source(d),d['month'],d['bank'],d['account'],d['count'],d.get('opening'),d.get('inflow'),d.get('outflow'),d.get('closing'),d['total'] if d['kind']!='bank' else None,d['filename']])
    groups=[['Fuente','Grupo','Registros','Abonos / ingresos','Cargos']]+[[source(g),g['name'],g['count'],g['inflow'],g['outflow']] for g in p['groups']]
    rows=[['Fuente','Banco','Cuenta (final)','Fecha','Fecha valor / vencimiento','Categoría','Concepto','Referencia','Persona / alumno','Estado','Abono / ingreso','Cargo','Saldo','Referencia de origen']]
    for r in p['rows']:rows.append([source(r),r['bank'],r['account'],r['date'],r.get('value_date') or r.get('due') or '',r['category'],r['concept'],r.get('reference',''),r.get('subject',''),r.get('status',''),max(0,r['cents']),max(0,-r['cents']),r.get('balance'),r['source_ref']])
    rec=[['Mes','Detalle Sallenet','Resumen por concepto','Recaudación Scotiabank','Banco menos detalle','Resumen menos detalle','Abonos de cuentas','Cargos de cuentas','Saldo final cuentas']]+[[r['month'],r['collection'],r['reference'],r['bank'],r['difference'],r['referenceDifference'],r['bankIn'],r['bankOut'],r['bankClosing']] for r in p['reconciliation']]
    daily=[['Fecha','Detalle Sallenet','Recaudación Scotiabank','Diferencia']]+[[d['date'],d['collection'],d['bank'],d['difference']] for r in p['reconciliation'] for d in r['daily']]
    payments=[['Fecha','Banco','Cargos bancarios','Comisiones e ITF incluidos','Operaciones pagadas','Diferencia por revisar']]+[[r['date'],r['bank'],r['charges'],r['commission'],r['paid'],r['difference']] for r in p.get('paymentComparison',[])]
    result=[('Documentos',docs,{5,6,7,8,9}),('Agrupación',groups,{3,4}),('Detalle',rows,{10,11,12}),('Conciliación mensual',rec,set(range(1,9))),('Conciliación diaria',daily,{1,2,3}),('Comparación de cargos',payments,{2,3,4,5})]
    return result
def treasury_xlsx(p):
    from openpyxl import Workbook
    from openpyxl.utils import get_column_letter
    wb=Workbook();wb.remove(wb.active)
    for title,rows,mon in tables(p):
        if title=='Detalle' and p.get('filters',{}).get('detail')=='summary':continue
        ws=wb.create_sheet(title);n=len(rows[0]);ws.append(['SISFIA | '+title]);ws.merge_cells(start_row=1,start_column=1,end_row=1,end_column=n);ws.append([f"Institución: {p['company']} · {p['period']} · PEN (S/) · Fuentes independientes; no sumar entre ellas."+(' Filtros: '+filter_text(p) if title in ('Detalle','Agrupación') else ' Periodo completo.')]);ws.merge_cells(start_row=2,start_column=1,end_row=2,end_column=n)
        for i,row in enumerate(rows):
            ws.append([v/100 if j in mon and isinstance(v,(int,float)) and i else v for j,v in enumerate(row)])
            # Excel formula injection guard: all user-supplied text remains literal.
            for c in ws[ws.max_row]:
                if c.data_type=='f':c.data_type='s'
        for j,h in enumerate(rows[0],1):ws.column_dimensions[get_column_letter(j)].width=42 if h in ['Concepto','Persona / alumno','Archivo','Grupo'] else 24 if h in ['Fuente','Categoría','Referencia de origen','Referencia'] else 17
        for i in range(4,ws.max_row+1):
            for j in mon:ws.cell(i,j+1).number_format='#,##0.00;[Red](#,##0.00);0.00'
        ws.freeze_panes='C4';ws.auto_filter.ref=f'A3:{get_column_letter(n)}{ws.max_row}';ws.print_area=f'A1:{get_column_letter(n)}{ws.max_row}'
    polish_workbook(wb);buf=io.BytesIO();wb.save(buf);sys.stdout.buffer.write(buf.getvalue())
def treasury_pdf(p):
    from reportlab.lib.pagesizes import landscape,A4
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak
    from reportlab.lib.styles import getSampleStyleSheet
    from xml.sax.saxutils import escape
    styles=getSampleStyleSheet();story=[Paragraph('Tesorería y cobranza',styles['Title']),Paragraph(escape(f"Institución: {p['company']} · {p['period']} · Importes en soles"),styles['Normal']),Spacer(1,8),Paragraph('Los estados bancarios, el detalle Sallenet y el resumen por concepto son fuentes independientes. No sumar sus importes. Las coincidencias por fecha e importe no prueban por sí solas la identidad de cada pago.',styles['Normal']),Spacer(1,12)]
    filters=p.get('filters',{});story.append(Paragraph(escape('Detalle y agrupación filtrados: '+filter_text(p)+'. Documentos y conciliaciones: periodo completo.'),styles['Normal']));story.append(Spacer(1,8))
    width=landscape(A4)[0]-70
    ts=tables(p)
    # Compact document summary, grouped rows and both conciliations, then the filtered detail.
    for title,rows,mon in [ts[i] for i in (0,1,3,4,5,2)]:
        if title=='Detalle' and p.get('filters',{}).get('detail')=='summary':continue
        if title=='Detalle':story.append(PageBreak())
        story.append(Paragraph(title,styles['Heading2']))
        if len(rows)==1:story.append(Paragraph('Sin registros.',styles['Normal']));continue
        headers=rows[0]
        if title=='Documentos':keep=[0,1,2,4,5,6,7,8,9]
        elif title=='Detalle':keep=[0,1,3,4,5,6,7,9,10,11,12]
        else:keep=list(range(len(headers)))
        h=[headers[j] for j in keep];data=[[money(r[j]) if j in mon else r[j] for j in keep] for r in rows[1:]]
        weights=[1.6 if x in ['Concepto','Grupo','Fuente','Categoría'] else 1 for x in h];widths=[width*w/sum(weights) for w in weights];story.append(report_table(h,data,widths,{i for i,j in enumerate(keep) if j in mon}));story.append(Spacer(1,10))
    buf=io.BytesIO();SimpleDocTemplate(buf,pagesize=landscape(A4),leftMargin=35,rightMargin=35,topMargin=80,bottomMargin=42,title='SISFIA | Tesorería').build(story,onFirstPage=page_frame,onLaterPages=page_frame);sys.stdout.buffer.write(buf.getvalue())
