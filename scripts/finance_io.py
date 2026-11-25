"""SISFIA document worker. No network access or shell interpolation."""
import sys, json, base64, io, re, csv, zipfile, tempfile, subprocess, os, datetime, unicodedata
MAX_ROWS=3000
MAX_COLS=40
MAX_BYTES=8*1024*1024

def cell(v):
    if v is None: return ''
    if isinstance(v, (datetime.datetime,datetime.date)): return v.isoformat()[:10]
    if isinstance(v, (int,float)) and not isinstance(v,bool): return v
    s=str(v)
    if len(s)>1200: raise ValueError('Una celda supera 1200 caracteres. Divide o simplifica el archivo.')
    return s

def preview(p):
    data=base64.b64decode(p['data'],validate=True)
    if len(data)>MAX_BYTES: raise ValueError('Archivo superior a 8 MB.')
    name=p['name'].lower(); sheets=[]; warnings=[]
    if name.endswith('.xlsx'):
        from openpyxl import load_workbook
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos=z.infolist()
            if len(infos)>2000 or sum(i.file_size for i in infos)>20*1024*1024: raise ValueError('Excel demasiado grande al descomprimir.')
        wb=load_workbook(io.BytesIO(data),read_only=False,data_only=True,keep_links=False)
        if len(wb.worksheets)>20: raise ValueError('Máximo 20 hojas. Divide el libro.')
        count=0
        for ws in wb.worksheets:
            if ws.max_column and ws.max_column>MAX_COLS: raise ValueError('Máximo 40 columnas por hoja. Elimina columnas vacías o divide el archivo.')
            if ws.max_row>10000: raise ValueError('Demasiadas filas en una hoja.')
            if len(ws.merged_cells.ranges)>3000:raise ValueError('Demasiadas celdas combinadas.')
            merged={}
            for m in ws.merged_cells.ranges:
                if m.max_row-m.min_row>500 or m.max_col>MAX_COLS:continue
                # Vertical merged fields belong to the same group, unlike horizontal titles.
                if m.min_col==m.max_col:
                    for rr in range(m.min_row+1,m.max_row+1):merged[(rr,m.min_col)]=ws.cell(m.min_row,m.min_col).value
            rows=[]
            for n,row in enumerate(ws.iter_rows(max_col=min(ws.max_column or MAX_COLS,MAX_COLS),values_only=True),1):
                if n>10000: raise ValueError('Demasiadas filas en una hoja. Divide el libro.')
                values=[cell(merged.get((n,j),v)) for j,v in enumerate(row,1)]
                while values and values[-1]=='': values.pop()
                if not values: continue
                count+=1
                if count>MAX_ROWS: raise ValueError('Máximo 3000 filas con datos. Divide el libro por mes.')
                rows.append({'ref':f'{ws.title} · fila {n}','cells':values})
            sheets.append({'name':ws.title,'rows':rows})
        wb.close();warnings.append('Excel: las fórmulas se leen por su último valor guardado. Revisa las celdas vacías.')
    elif name.endswith('.csv'):
        try: text=data.decode('utf-8-sig')
        except UnicodeDecodeError: text=data.decode('cp1252')
        try: dialect=csv.Sniffer().sniff(text[:8192],delimiters=',;\t')
        except csv.Error: dialect=csv.excel
        rows=[]
        for n,row in enumerate(csv.reader(io.StringIO(text),dialect),1):
            if n>MAX_ROWS or len(row)>MAX_COLS: raise ValueError('CSV superior a 3000 filas o 40 columnas.')
            if any(x.strip() for x in row): rows.append({'ref':f'Fila {n}','cells':[cell(x) for x in row]})
        sheets=[{'name':'CSV','rows':rows}]
    elif name.endswith('.pdf'):
        if not data.startswith(b'%PDF-'): raise ValueError('El archivo no contiene una cabecera PDF válida.')
        with tempfile.TemporaryDirectory() as td:
            f=os.path.join(td,'source.pdf');open(f,'wb').write(data)
            info=subprocess.run(['pdfinfo',f],capture_output=True,timeout=12,check=True).stdout.decode('utf-8','replace')
            pages=re.search(r'^Pages:\s+(\d+)',info,re.M)
            if not pages or int(pages.group(1))>100: raise ValueError('Máximo 100 páginas PDF. Divide el informe.')
            from smart_import import detect_pdf
            smart=detect_pdf(f,p['name'])
            if smart:
                print(json.dumps(smart,ensure_ascii=False));return
            # Output to a file; reject large output before reading it into memory.
            out=os.path.join(td,'text.txt')
            subprocess.run(['pdftotext','-layout','-enc','UTF-8',f,out],capture_output=True,timeout=25,check=True)
            if os.path.getsize(out)>4*1024*1024: raise ValueError('Texto PDF demasiado extenso.')
            text=open(out,encoding='utf-8').read()
        rows=[]
        for page,content in enumerate(text.split('\f'),1):
            for n,line in enumerate(content.splitlines(),1):
                if not line.strip(): continue
                # PDF columns are inferred from whitespace. No assumptions about the report format.
                values=re.split(r'\s{2,}',line.strip())
                if len(values)>MAX_COLS or len(rows)>=MAX_ROWS: raise ValueError('PDF demasiado extenso o complejo. Divide el informe.')
                rows.append({'ref':f'Página {page} · línea {n}','cells':[cell(x) for x in values]})
        if not rows: raise ValueError('PDF sin texto extraíble (probablemente escaneado). Usa OCR externo y guarda como Excel/CSV o PDF con texto.')
        sheets=[{'name':'PDF · texto por líneas','rows':rows}];warnings.append('PDF: las columnas se estiman por espacios. Revisa cada fila; las tablas complejas o escaneadas pueden requerir conversión previa a Excel.')
    else: raise ValueError('Formato no admitido. Usa XLSX, CSV o PDF con texto.')
    if not any(s['rows'] for s in sheets): raise ValueError('El archivo no tiene datos legibles.')
    from smart_import import detect_tabular
    documents=[d for sh in sheets if (d:=detect_tabular(sh,p['name']))] if not name.endswith('.pdf') else []
    print(json.dumps({'sheets':sheets,'warnings':warnings,'documents':documents},ensure_ascii=False))

DETAIL=[('date','Fecha'),('concept','Concepto'),('category','Rubro'),('provider','Proveedor'),('ruc','RUC / DNI'),('receipt','Comprobante'),('status','Estado'),('bank','Banco'),('type','Tipo'),('area','Área / caja'),('source','Origen'),('reference','Documento / referencia'),('amount','Monto (S/)'),('cci','Cuenta / CCI'),('order','N° Orden'),('usd','Referencia USD'),('source_category','Categoría original')]

def xlsx(p):
    from openpyxl import Workbook
    from openpyxl.styles import Font,PatternFill,Alignment
    from openpyxl.utils import get_column_letter
    wb=Workbook(); ws=wb.active;ws.title='Resumen';navy='173A4C'; teal='087E83'
    def value(ws,r,c,v):
        x=ws.cell(r,c,v)
        if isinstance(v,str): x.data_type='s' # Never export user text as a spreadsheet formula.
        return x
    def table(ws,title,headers,rows,money_cols,widths):
        ws.append([title]);ws.merge_cells(start_row=1,start_column=1,end_row=1,end_column=len(headers));ws['A1'].font=Font(size=18,bold=True,color='FFFFFF');ws['A1'].fill=PatternFill('solid',fgColor=navy);ws.row_dimensions[1].height=32
        value(ws,2,1,p['context']);ws.merge_cells(start_row=2,start_column=1,end_row=2,end_column=len(headers));ws['A2'].alignment=Alignment(wrap_text=True);ws.row_dimensions[2].height=45
        ws.append(headers)
        for c in ws[3]: c.fill=PatternFill('solid',fgColor=teal);c.font=Font(bold=True,color='FFFFFF')
        for r,record in enumerate(rows,4):
            for c,v in enumerate(record,1):
                x=value(ws,r,c,v)
                if c in money_cols:x.number_format='#,##0.00;[Red](#,##0.00)'
                if r%2==0:x.fill=PatternFill('solid',fgColor='EDF5F5')
        ws.freeze_panes='A4';ws.auto_filter.ref=f'A3:{get_column_letter(len(headers))}{max(3,ws.max_row)}'
        for c,w in enumerate(widths,1):ws.column_dimensions[get_column_letter(c)].width=w
        ws.sheet_view.showGridLines=False
    summary=[(g['group'],g['count'],g['amount'],g['paid'],g['pending']) for g in p['groups']]
    table(ws,'SISFIA | '+p['title'],[p['dimension'],'Registros','Total (S/)','Pagado (S/)','Pendiente (S/)'],summary,{3,4,5},[38,14,20,20,20])
    t=p['totals'];r=ws.max_row+2
    for c,v in enumerate(['TOTAL',t['count'],t['amount'],t['paid'],t['pending']],1):
        x=value(ws,r,c,v);x.font=Font(bold=True,color=navy)
        if c>=3:x.number_format='#,##0.00'
    for key,label in p['dimensions'].items():
        if key==p['group']:continue
        rows=[(g['group'],g['count'],g['amount'],g['paid'],g['pending']) for g in p['allGroups'][key]]
        table(wb.create_sheet(label.replace('/','-')[:31]),'SISFIA | '+label,[label,'Registros','Total (S/)','Pagado (S/)','Pendiente (S/)'],rows,{3,4,5},[38,14,20,20,20])
    table(wb.create_sheet('Detalle'),'SISFIA | Detalle',[v for _,v in DETAIL],[[r.get(k,'') for k,_ in DETAIL] for r in p['rows']],{13,16},[14,65,30,35,18,22,17,22,20,25,18,55,20,28,18,18,25])
    output=io.BytesIO();wb.save(output);sys.stdout.buffer.write(output.getvalue())

def pdf(p):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4,landscape
    from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,LongTable
    from xml.sax.saxutils import escape
    buf=io.BytesIO();navy=colors.HexColor('#173A4C');teal=colors.HexColor('#087E83');styles=getSampleStyleSheet()
    body=ParagraphStyle('cell',fontName='Helvetica',fontSize=8,leading=10,textColor=navy,wordWrap='CJK')
    h=ParagraphStyle('heading',fontName='Helvetica-Bold',fontSize=20,leading=24,textColor=navy)
    def para(x):return Paragraph(escape(str(x or '')).replace('\n',' '),body)
    def money(n):return f'{n:,.2f}'
    def grid(rows,widths):
        t=LongTable(rows,colWidths=widths,repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),teal),('TEXTCOLOR',(0,0),(-1,0),colors.white),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTNAME',(0,1),(-1,-1),'Helvetica'),('FONTSIZE',(0,0),(-1,-1),8),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#EDF5F5')]),('BOTTOMPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('ALIGN',(-1,1),(-1,-1),'RIGHT') ]));return t
    story=[Paragraph('SISFIA | '+escape(p['title']),h),Spacer(1,8),para(p['context']),Spacer(1,10)]
    t=p['totals'];story.append(Paragraph(f"Total S/ {money(t['amount'])} &nbsp; | &nbsp; {t['count']} registros &nbsp; | &nbsp; Pagado S/ {money(t['paid'])} &nbsp; | &nbsp; Pendiente S/ {money(t['pending'])}",styles['Heading3']));story.append(Spacer(1,6))
    story.append(grid([[p['dimension'],'Registros','Total (S/)','Pagado (S/)','Pendiente (S/)']]+[[para(g['group']),str(g['count']),money(g['amount']),money(g['paid']),money(g['pending'])] for g in p['groups']],[300,70,110,110,110]));story.append(Spacer(1,16));story.append(Paragraph('Detalle de registros',styles['Heading2']))
    if not p['rows']:story.append(para('Sin registros para los filtros seleccionados.'))
    else:
        # Wrap all text instead of truncating references or monetary values.
        rows=[['Fecha','Concepto / comprobante','Rubro','Proveedor / RUC','Estado / origen','Monto (S/)']]
        for r in p['rows']:
            rows.append([para(r['date']),para(r['concept']+' | '+r['receipt']+' | '+r['reference']+(' | Orden '+str(r['order']) if r.get('order') else '')+(' | USD '+str(r['usd']) if r.get('usd') else '')),para(r['category']),para(r['provider']+' | '+r['ruc']),para(r['status']+' | '+r['source']),money(r['amount'])])
        story.append(grid(rows,[67,250,123,130,85,75]))
    def footer(c,d):
        c.setStrokeColor(teal);c.line(35,31,landscape(A4)[0]-35,31);c.setFont('Helvetica',8);c.setFillColor(navy);c.drawString(35,18,'SISFIA · Gestión financiera institucional');c.drawRightString(landscape(A4)[0]-35,18,f'Página {d.page}')
    SimpleDocTemplate(buf,pagesize=landscape(A4),leftMargin=35,rightMargin=35,topMargin=28,bottomMargin=42,title='SISFIA | '+p['title']).build(story,onFirstPage=footer,onLaterPages=footer);sys.stdout.buffer.write(buf.getvalue())

if __name__=='__main__':
    try:
        mode=sys.argv[1];p=json.load(sys.stdin)
        {'preview':preview,'xlsx':xlsx,'pdf':pdf}[mode](p)
    except (ValueError,KeyError) as e: print(str(e),file=sys.stderr);sys.exit(2)
    except Exception as e: print('No se pudo leer o generar el documento ('+type(e).__name__+'). Verifica el formato y sus límites.',file=sys.stderr);sys.exit(2)
