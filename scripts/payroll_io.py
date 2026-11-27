"""Read only the selected payroll sheet. Never execute formulas, macros or links.
All output goes over a private subprocess pipe. No original file is persisted.
"""
import sys,json,io,base64,csv,re,unicodedata,zipfile,decimal
from decimal import Decimal,ROUND_HALF_UP
MAX_ROWS=3000; MAX_COLS=180; MAX_FILE=8*1024*1024
KINDS=['planilla','gratificacion','cts','afp','quinta','prestamos','tardanzas','vacaciones','horas_extra','bonificaciones','descuentos']
FIELDS=['gross','discount','net','deposit','essalud','base']
def norm(x):return re.sub(r'[^a-z0-9]+',' ',unicodedata.normalize('NFKD',str(x or '')).encode('ascii','ignore').decode().lower()).strip()
def string(x):return str(x or '').strip()[:180]
def money(x,required=False):
    if x is None or x=='':
        if required:raise ValueError('Monto obligatorio sin valor calculado')
        return 0
    if isinstance(x,bool):raise ValueError('Monto inválido')
    d=Decimal(str(x).replace(',','').strip())
    if not d.is_finite() or abs(d)>Decimal('999999999'):raise ValueError('Monto fuera de rango')
    return int((d*100).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
def identifier(x):
    if isinstance(x,(int,float)) and float(x).is_integer():return str(int(x))
    return string(x)
def cell(row,i):return row[i] if 0<=i<len(row) else None
class Book:
    def __init__(self,p):
        data=base64.b64decode(p['data'],validate=True)
        if len(data)>MAX_FILE:raise ValueError('Archivo demasiado grande')
        name=p['name'].lower();self.raw=data;self.type=None
        if name.endswith('.xlsx'):
            if not data.startswith(b'PK'):raise ValueError('No es un XLSX')
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                info=z.infolist()
                if len(info)>1800 or sum(x.file_size for x in info)>80*1024*1024 or any(x.flag_bits&1 for x in info):raise ValueError('Archivo comprimido fuera de límites')
                if any('vbaproject' in x.filename.lower() or 'embeddings/' in x.filename.lower() for x in info):raise ValueError('Macros u objetos no admitidos')
            from openpyxl import load_workbook
            self.wb=load_workbook(io.BytesIO(data),read_only=True,data_only=True,keep_links=False);self.names=self.wb.sheetnames;self.type='xlsx'
        elif name.endswith('.xls'):
            if not data.startswith(bytes.fromhex('d0cf11e0a1b11ae1')):raise ValueError('No es un XLS clásico')
            import xlrd
            self.wb=xlrd.open_workbook(file_contents=data,on_demand=True);self.names=self.wb.sheet_names();self.type='xls'
        elif name.endswith('.csv'):
            if b'\0' in data:raise ValueError('CSV inválido')
            txt=data.decode('utf-8-sig');dialect=csv.Sniffer().sniff(txt[:4096],delimiters=',;\t');self.csv=list(csv.reader(io.StringIO(txt),dialect));self.names=['CSV'];self.type='csv'
        else:raise ValueError('Utiliza XLS, XLSX o CSV; PDF no admitido para planillas confidenciales')
        if not 1<=len(self.names)<=60:raise ValueError('Demasiadas hojas')
    def rows(self,name,preview=False):
        if name not in self.names:raise ValueError('Hoja no encontrada')
        cap=20 if preview else MAX_ROWS+30
        if self.type=='xlsx':
            w=self.wb[name]
            if not preview and (w.max_row or 0)>cap:raise ValueError('Hoja demasiado extensa; exporta una copia con filas utilizadas')
            if (w.max_column or 0)>MAX_COLS:raise ValueError('Demasiadas columnas')
            return list(w.iter_rows(min_row=1,max_row=min(w.max_row or cap,cap),max_col=min(w.max_column or MAX_COLS,MAX_COLS),values_only=True))
        if self.type=='xls':
            w=self.wb.sheet_by_name(name)
            if w.ncols>MAX_COLS or (not preview and w.nrows>cap):raise ValueError('Hoja fuera de límites')
            import xlrd
            def value(c):
                if c.ctype==xlrd.XL_CELL_ERROR:return xlrd.error_text_from_code.get(c.value,'#ERROR!')
                if c.ctype==xlrd.XL_CELL_DATE:return xlrd.xldate_as_datetime(c.value,self.wb.datemode).date().isoformat()
                return c.value
            # During discovery, formulas outside the header are not evaluated or returned.
            return [[value(c) for c in w.row(i)] for i in range(min(w.nrows,cap if not preview else 12))]
        if len(self.csv)>cap and not preview:raise ValueError('Demasiadas filas')
        if any(len(x)>MAX_COLS for x in self.csv):raise ValueError('Demasiadas columnas')
        return self.csv[:cap]
def metadata(rows):
    period='';header=-1;layout='unknown'
    for i,row in enumerate(rows[:20]):
        for v in row[:15]:
            m=re.search(r'periodo\s*:?\s*(0[1-9]|1[0-2])\s*/\s*(20\d{2})',str(v or ''),re.I)
            if m:period=m[2]+'-'+m[1]
        keys=[norm(v) for v in row]
        if {'dni','cargo','banco','remuneracion','descuento','pagar','depositar'}.issubset(keys) and i>0:
            header=i;layout='lasalle';break
        if {'codigo','bruto','descuentos','neto','deposito','essalud'}.issubset(keys):header=i;layout='standard';break
        if {'codigo','concepto','monto'}.issubset(keys):header=i;layout='auxiliary';break
        if {'monto','marzo','diciembre','monto descontado','saldo pendiente'}.issubset(keys):header=i;layout='loans';break
        if {'nombres','dni','total tardanzas','total minutos','t a descont'}.issubset(keys):header=i;layout='tardiness';break
    return {'period':period,'header':header,'layout':layout}
def parse(book,p):
    rows=book.rows(p['sheet']);m=metadata(rows);period=p['period'];kind=p['kind']
    if m['period'] and m['period']!=period:raise ValueError('El periodo de la hoja no coincide con el seleccionado')
    if kind not in KINDS or m['header']<0:raise ValueError('Plantilla no reconocida')
    if (kind in ['planilla','gratificacion','cts'])!=(m['layout'] in ['lasalle','standard']):raise ValueError('El tipo seleccionado no corresponde a la hoja')
    if m['layout']=='loans' and kind!='prestamos' or m['layout']=='tardiness' and kind!='tardanzas':raise ValueError('Tipo no corresponde a la hoja auxiliar')
    h=m['header'];keys=[norm(v) for v in rows[h]];prev=rows[h-1] if h else [];above=rows[h-2] if h>1 else []
    def idx(k,required=True):
        if k not in keys:
            if required:raise ValueError('Falta columna obligatoria: '+k)
            return -1
        return keys.index(k)
    details=[];declared={};warnings=[];numbers=[]
    if m['layout']=='lasalle':
        cols={k:idx(v) for k,v in {'gross':'remuneracion','discount':'descuento','net':'pagar','deposit':'depositar','base':'base','position':'cargo','bank':'banco','pension':'pensionario','dni':'dni','num':'no'}.items()}
        cols['essalud']=next((j for j,v in enumerate(above) if norm(v)=='essalud'),-1)
        if cols['essalud']<0:raise ValueError('Falta columna EsSalud')
        # Validate the boundaries instead of assuming a rigid column number.
        if not cols['base']<cols['gross']<cols['discount']<cols['net']<cols['deposit']<cols['essalud']:raise ValueError('Estructura de totales no reconocida')
        # Detailed labels retain exact original wording; columns before remuneration include adjustments and subtotals.
        start=idx('computable'); components=[]
        for j in range(start,cols['discount']):
            if j==cols['gross']:continue
            label=' '.join(dict.fromkeys(x for x in [string(cell(prev,j)),string(cell(rows[h],j))] if x)) or f'Columna {j+1}'
            group='ingreso' if j<cols['gross'] else 'descuento';components.append((j,group,label))
        for i,row in enumerate(rows[h+1:],h+2):
            n=cell(row,cols['num']);tag=norm(cell(row,cols['discount']))
            if tag.startswith('total'):
                for k in FIELDS:
                    v=cell(row,cols[k]);
                    try:
                        if v not in (None,''):declared[k]=money(v)
                    except (ValueError,decimal.InvalidOperation):pass
                break
            if not re.fullmatch(r'\d+(?:\.0+)?',str(n or '')):
                if any(isinstance(cell(row,cols[k]),(int,float)) and cell(row,cols[k])!=0 for k in ['gross','net','deposit']):raise ValueError('Fila monetaria sin número antes del total')
                continue
            num=int(float(n));numbers.append(num)
            d={k:money(cell(row,cols[k]),required=True) for k in FIELDS};name=string(cell(row,idx('nombre',False)))
            if not name:name=' '.join(string(cell(row,idx(k,False))) for k in ['paterno','materno','nombres']).strip()
            c=[{'group':g,'label':label,'cents':money(cell(row,j))} for j,g,label in components if cell(row,j) not in (None,'',0)]
            d.update(row=i,number=num,dni=identifier(cell(row,cols['dni'])),code='',name=name,position=string(cell(row,cols['position'])),area='',bank=string(cell(row,cols['bank'])),pension=string(cell(row,cols['pension'])),hire_date=string(cell(row,idx('ingreso',False)))[:10],status=string(cell(row,idx('sit',False))),account_last=identifier(cell(row,idx('cuentas',False)))[-4:],components=c)
            details.append(d)
        if numbers and numbers!=list(range(numbers[0],numbers[0]+len(numbers))):warnings.append('Numeración de filas no consecutiva; verifica omisiones o duplicados.')
    elif m['layout']=='standard':
        cols={k:idx(v) for k,v in {'gross':'bruto','discount':'descuentos','net':'neto','deposit':'deposito','essalud':'essalud'}.items()};cols['base']=idx('sueldo base',False)
        for i,row in enumerate(rows[h+1:],h+2):
            code=identifier(cell(row,idx('codigo')))
            if not code:
                if any(v not in (None,'') for v in row):raise ValueError('Fila sin código')
                continue
            if norm(code)=='total':continue
            d={k:money(cell(row,cols[k]),required=k!='base') for k in FIELDS};d.update(row=i,number=len(details)+1,dni='',code=code,name=string(cell(row,idx('nombre',False))),position=string(cell(row,idx('cargo',False))),area=string(cell(row,idx('area',False))),bank=string(cell(row,idx('banco',False))),pension=string(cell(row,idx('sistema pensionario',False))),hire_date='',status='',account_last='',components=[]);details.append(d)
    elif m['layout'] in ['loans','tardiness']:
        for i,row in enumerate(rows[h+1:],h+2):
            cs=[];units='';name='';dni='';code=''
            if m['layout']=='loans':
                num=cell(row,0);v=cell(row,idx('monto'))
                if not re.fullmatch(r'\d+(?:\.0+)?',str(num or '')) or v in (None,'',0):continue
                # Values represent a schedule and balances, not a new payment.
                for label in ['monto','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre','monto descontado','saldo pendiente']:
                    v=cell(row,idx(label,False))
                    if v not in (None,'',0):cs.append(dict(group='auxiliar',label=label.title(),cents=money(v)))
            else:
                name=string(cell(row,idx('nombres')));dni=identifier(cell(row,idx('dni')))
                if not name or norm(name).startswith('total'):continue
                units=string(cell(row,idx('total minutos')))+' min'
                v=cell(row,idx('t a descont'))
                if v not in (None,''):
                    if isinstance(v,str) and v.startswith('#'):
                        if 'Hay descuentos de tardanza sin cálculo válido en origen; no se imputaron como cero.' not in warnings:warnings.append('Hay descuentos de tardanza sin cálculo válido en origen; no se imputaron como cero.')
                    else:cs.append(dict(group='auxiliar',label='Descuento por tardanza registrado',cents=money(v)))
            details.append(dict(row=i,number=len(details)+1,dni=dni,code=code,name=name,position='',area='',bank='',pension='',hire_date='',status='',account_last='',gross=0,discount=0,net=0,deposit=0,essalud=0,base=0,components=cs,units=units,note='Importe de referencia; no genera movimiento financiero'))
        warnings.append('Hoja auxiliar: confirmar periodo manualmente. No sumar montos de cronograma, saldos ni subtotales entre sí.')
    else:
        for i,row in enumerate(rows[h+1:],h+2):
            code=identifier(cell(row,idx('codigo')))
            if not code:
                if any(v not in (None,'') for v in row):raise ValueError('Fila sin código')
                continue
            if norm(code)=='total':continue
            concept=string(cell(row,idx('concepto')))
            if not concept:raise ValueError('Concepto vacío')
            details.append(dict(row=i,number=len(details)+1,dni='',code=code,name=string(cell(row,idx('nombre',False))),position=string(cell(row,idx('cargo',False))),area=string(cell(row,idx('area',False))),bank='',pension='',hire_date='',status='',account_last='',gross=0,discount=0,net=0,deposit=0,essalud=0,base=0,components=[dict(group='auxiliar',label=concept,cents=money(cell(row,idx('monto')),True))],units=string(cell(row,idx('unidades',False))),note=string(cell(row,idx('nota',False)))))
    if not details or len(details)>MAX_ROWS:raise ValueError('No hay filas válidas o se excedió el límite')
    if not declared:warnings.append('No se encontró un total explícito de control; revisa los importes antes de guardar.')
    if any(not x['dni'] and not x['code'] for x in details):warnings.append('Hay filas sin DNI ni código: no se asociarán automáticamente a otros periodos.')
    return dict(period=period,kind=kind,sheet=p['sheet'],layout=m['layout'],rows=details,declared=declared,warnings=warnings)
def export(p,fmt):
    from report_style import report_table,page_frame,polish_workbook
    rows=p['rows'];headers=['Periodo','Tipo','Código','Nombre','Cargo','Área','Banco','Sistema','Bruto','Descuentos','Neto','Depósito','EsSalud','Costo ref.']
    matrix=[[r['period'],r['kind'],r['code'],r['name'],r['position'],r['area'],r['bank'],r['pension']]+[r[k]/100 for k in ['gross','discount','net','deposit','essalud']]+[(r['gross']+r['essalud'])/100] for r in rows]
    if fmt=='csv':
        buf=io.StringIO();w=csv.writer(buf)
        def clean(v):return "'"+v if isinstance(v,str) and re.match(r'^\s*[=+@-]|^[\t\r\n]',v) else v
        if p['detail']:
            w.writerow(['Periodo','Tipo','Código','Nombre','Cargo','Área','Banco','Sistema','Bruto','Descuentos','Neto','Depósito','EsSalud','Costo ref.','Grupo concepto','Concepto','Monto concepto','Unidades'])
            for r,line in zip(rows,matrix):
                # One row per employee; concepts in separate labeled rows to avoid repeating totals.
                w.writerow([clean(v) for v in line]+['','','',''])
                for c in r['components']:w.writerow([clean(r['period']),clean(r['kind']),clean(r['code'])]+['']*11+[clean(c['group']),clean(c['label']),c['cents']/100,clean(r.get('units',''))])
        else:
            w.writerow(['Grupo','Filas','Bruto','Descuentos','Neto','Depósito','EsSalud','Costo referencial'])
            for g in p['groups']:w.writerow([clean(g['label']),g['count']]+[g[k]/100 for k in ['gross','discount','net','deposit','essalud']]+[(g['gross']+g['essalud'])/100])
            w.writerow([]);w.writerow(['Concepto (no sumar subtotales)','Registros','Monto S/'])
            for c in p['concepts']:w.writerow([clean(c['label']),c['count'],c['cents']/100])
        return buf.getvalue().encode('utf-8-sig')
    if fmt=='xlsx':
        from openpyxl import Workbook
        from openpyxl.utils import get_column_letter
        wb=Workbook();w=wb.active;w.title='Resumen';w.append(['SISFIA | Planillas confidenciales']);w.append([p['period']+' · '+p['group']+' · Solo referencia, no flujo efectivo']);w.append(['Grupo','Filas','Bruto','Descuentos','Neto','Depósito','EsSalud','Costo referencial'])
        for g in p['groups']:w.append([g['label'],g['count']]+[g[k]/100 for k in ['gross','discount','net','deposit','essalud']]+[(g['gross']+g['essalud'])/100])
        g=wb.create_sheet('Conceptos agrupados');g.append(['SISFIA | Conceptos por grupo']);g.append(['No sumar conceptos de distinta naturaleza ni subtotales']);g.append(['Concepto','Registros','Monto S/']);
        for x in p['concepts']:g.append([x['label'],x['count'],x['cents']/100])
        if p['detail']:
            d=wb.create_sheet('Detalle');d.append(['SISFIA | Detalle laboral confidencial']);d.append(['Acceso restringido']);d.append(headers)
            for row in matrix:d.append(row)
            c=wb.create_sheet('Conceptos');c.append(['SISFIA | Conceptos de origen']);c.append(['No sumar a los totales de planilla']);c.append(['Periodo','Tipo','Código','Grupo','Concepto','Monto S/','Unidades','Nota'])
            for r in rows:
                for x in r['components']:c.append([r['period'],r['kind'],r['code'],x['group'],x['label'],x['cents']/100,r.get('units',''),r.get('note','')])
        for ws in wb:
            for row in ws.iter_rows():
                for c in row:
                    if isinstance(c.value,str):c.data_type='s' # never emit user-controlled formulas
                    elif isinstance(c.value,(float,int)) and c.row>3:c.number_format='#,##0.00;[Red](#,##0.00)' if ws.title!='Resumen' or c.column!=2 else '0'
            ws.freeze_panes='C4';ws.auto_filter.ref=f'A3:{get_column_letter(ws.max_column)}{ws.max_row}'
            for j in range(1,ws.max_column+1):ws.column_dimensions[get_column_letter(j)].width=24 if j in [1,4,5,6] else 18
        polish_workbook(wb);out=io.BytesIO();wb.save(out);return out.getvalue()
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer
    from reportlab.lib.pagesizes import A4,landscape
    from reportlab.lib.styles import getSampleStyleSheet
    out=io.BytesIO();doc=SimpleDocTemplate(out,pagesize=landscape(A4),leftMargin=36,rightMargin=36,topMargin=82,bottomMargin=45);st=getSampleStyleSheet();story=[Paragraph('Planillas y costos de personal · CONFIDENCIAL',st['Title']),Paragraph(p['period']+' | Importes en soles. Costo referencial: bruto + EsSalud. No equivale a flujo de caja.',st['Normal']),Spacer(1,12)]
    moneyf=lambda n:f'{n/100:,.2f}'
    story.append(report_table(['Grupo','Filas','Bruto','Descuentos','Neto','Depósito','EsSalud','Costo ref.'],[[g['label'],g['count']]+[moneyf(g[k]) for k in ['gross','discount','net','deposit','essalud']]+[moneyf(g['gross']+g['essalud'])] for g in p['groups']],[185,42,90,90,90,90,90,90],tuple(range(2,8))))
    story.extend([Spacer(1,12),Paragraph('Conceptos agrupados (no sumar subtotales)',st['Heading2']),report_table(['Concepto','Registros','Monto S/'],[[x['label'],x['count'],moneyf(x['cents'])] for x in p['concepts']],[520,110,135],(2,))])
    if p['detail']:
        story.extend([Spacer(1,12),Paragraph('Detalle de trabajadores',st['Heading2']),report_table(['Periodo','Código','Nombre / cargo','Banco','Bruto','Neto','Depósito','EsSalud'],[[r['period'],r['code'],r['name']+' / '+r['position'],r['bank']]+[moneyf(r[k]) for k in ['gross','net','deposit','essalud']] for r in rows],[61,105,190,65,80,80,80,80],(4,5,6,7)),Spacer(1,12),Paragraph('Conceptos y registros auxiliares (no sumar a la planilla)',st['Heading2']),report_table(['Periodo','Código','Grupo','Concepto','Monto','Unidades / nota'],[[r['period'],r['code'],c['group'],c['label'],moneyf(c['cents']),r.get('units','')+' '+r.get('note','')] for r in rows for c in r['components']],[65,105,76,220,85,190],(4,))])
    doc.build(story,onFirstPage=page_frame,onLaterPages=page_frame);return out.getvalue()
def individual(p):
    from report_style import report_table,page_frame
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from xml.sax.saxutils import escape
    out=io.BytesIO();doc=SimpleDocTemplate(out,pagesize=A4,leftMargin=35,rightMargin=35,topMargin=82,bottomMargin=45);st=getSampleStyleSheet();r=p['row']
    def para(v,style='Normal'):return Paragraph(escape(str(v)),st[style])
    money=lambda n:f'{n/100:,.2f}'
    story=[para('Ficha individual de remuneraciones','Title'),para('CONFIDENCIAL · Documento interno de consulta, no boleta oficial.'),Spacer(1,8),para(p['company']),para(p['period']+' · '+p['kind']),Spacer(1,8),report_table(['Identificación','Detalle'],[['Código protegido',r['code']],['Nombre registrado',r['name']],['Cargo',r['position']],['Área',r['area']],['Sistema pensionario',r['pension']],['Banco',r['bank']]],[150,375]),Spacer(1,10),report_table(['Indicador','Importe S/'],[[label,money(r[k])] for k,label in [('gross','Bruto'),('discount','Descuentos'),('net','Neto'),('deposit','Depósito'),('essalud','EsSalud'),('base','Base')]], [375,150],(1,)),Spacer(1,10),para('Conceptos registrados (no sumar subtotales)','Heading2'),report_table(['Grupo','Concepto','Importe S/'],[[x['group'],x['label'],money(x['cents'])] for x in r['components']],[100,315,110],(2,)),Spacer(1,10),para('Se reproducen los valores de la planilla importada. No se certifica el pago ni se calculan obligaciones legales.')]
    doc.build(story,onFirstPage=page_frame,onLaterPages=page_frame);return out.getvalue()
def main():
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS,(384*1024*1024,384*1024*1024));resource.setrlimit(resource.RLIMIT_CPU,(65,70))
    except ImportError:pass
    p=json.load(sys.stdin);mode=sys.argv[1]
    if mode=='payroll-individual':sys.stdout.buffer.write(individual(p));return
    if mode in ('payroll-xlsx','payroll-pdf','payroll-csv'):sys.stdout.buffer.write(export(p,mode.split('-')[1]));return
    book=Book(p)
    if mode=='payroll-inspect':
        result=[]
        for s in book.names:
            try:m=metadata(book.rows(s,True));result.append({'name':s,**m})
            except Exception:result.append({'name':s,'period':'','layout':'unknown','header':-1})
    elif mode=='payroll-read':result=parse(book,p)
    else:raise ValueError('Modo inválido')
    sys.stdout.write(json.dumps(result,ensure_ascii=False,allow_nan=False))
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Documento no procesado.\n');sys.exit(1)
