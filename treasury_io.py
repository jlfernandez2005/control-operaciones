"""Extract bank statements and Sallenet collections into separate evidence ledgers."""
import re, json, base64, tempfile, subprocess, io, os, datetime, collections
from decimal import Decimal
from pathlib import Path
M=r'-?\d[\d,]*\.\d{2}'
N=r'-?\d[\d,]*(?:\.\d{2})?'
MONTHS='enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split()
def cents(s):return int(Decimal(str(s).replace(',',''))*100)
def date(s,y=None):
    a=s.split('/'); return datetime.date(int(a[2])+2000 if len(a)==3 and len(a[2])==2 else int(a[2]) if len(a)==3 else int(y),int(a[1]),int(a[0])).isoformat()
def month_end(m):
    import calendar
    y,n=map(int,m.split('-'));return f'{m}-{calendar.monthrange(y,n)[1]:02}'
def bank_category(t,a):
    t=t.upper()
    if 'ITF' in t:return 'ITF'
    if re.search(r'COMISION|COM SERV|PORTES|MANTENIMIENTO DE CUENTA|TBK-MANTENIMIENTO',t):return 'Comisiones bancarias'
    if 'AFP' in t:return 'AFP'
    if 'PLANILLA' in t:return 'Haberes'
    if 'SUNAT' in t:return 'Tributos'
    if 'SERV REC MED FISICO' in t:return 'Recaudación física'
    if 'SERV REC MED VIRTUAL' in t:return 'Recaudación virtual'
    if 'TRANSFER' in t or 'TRANSF' in t or 'TRAN TIL' in t:return 'Transferencias por conciliar'
    if 'DEP.EFECTIVO' in t:return 'Depósitos por identificar'
    return 'Otros abonos por identificar' if a>0 else 'Otros cargos por identificar'
def bank_parse(text,kind):
    if kind=='interbank':
        h=re.search(r'Mes:\s*(\w+)\s+(20\d\d)',text,re.I); y=h[2]; mo=MONTHS.index(h[1].lower().replace('setiembre','septiembre'))+1
        account=re.search(r'CUENTA:\s*([\d-]+)',text)[1]; head=next(l for l in text.splitlines() if len(re.findall(M,l))==10); v=list(map(cents,re.findall(M,head))); opening=v[0]; declared_in=sum(v[1:4])+v[7];declared_out=sum(v[4:7])+v[8];closing=v[9]
    else:
        h=re.search(r'Desde\s+\d{2}-([A-Z]{3})-\s*(20\d\d)',text);y=h[2];mo=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SET','OCT','NOV','DIC'].index(h[1])+1 if h[1] in ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SET','OCT','NOV','DIC'] else ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].index(h[1])+1
        account=re.search(r'CUENTA CORRIENTE M\.N\. SOLES No\.\s*([\d-]+)',text)[1]; totals=[l for l in text.splitlines() if 'Saldo Final al' in l];opening=cents(re.findall(M,totals[0])[-1]);declared_out,declared_in,closing=map(cents,re.findall(M,totals[-1])[-3:])
    if not re.search(r'SOLES',text,re.I):raise ValueError('Solo estados de cuenta en soles compatibles.')
    month=f'{y}-{mo:02}';rows=[];prev=opening
    for page,content in enumerate(text.split('\f'),1):
        for line in content.splitlines():
            m=re.match(r'^\s*(\d{2}/\d{2})\s+(\d{2}/\d{2})\s+(.*?)\s+('+M+r')\s+('+M+r')\s*$',line)
            if not m:continue
            d,vd,body,raw,balance=m.groups(); bal=cents(balance); delta=bal-prev; value=cents(raw)
            if abs(delta)!=abs(value) or (kind=='interbank' and delta!=value):raise ValueError(f'Saldo no coincide en página {page}, movimiento {len(rows)+1}.')
            if kind=='scotiabank':
                a=re.match(r'\d{3}\s+(.*?)\s+(\d{6,})$',body); concept=a[1].strip() if a else body;ref=a[2] if a else ''
            else:
                cols=re.split(r'\s{2,}',body.strip());concept=cols[0];ref=next((x for x in cols[1:] if re.fullmatch(r'\d{6,}',x)),'');concept=' · '.join(cols)
            dt=date(d,y)
            if not dt.startswith(month):raise ValueError('Fecha fuera del periodo del estado.')
            rows.append(dict(date=dt,value_date=date(vd,y),concept=concept,reference=ref,category=bank_category(concept,delta),cents=delta,balance=bal,source_ref=f'Página {page} · movimiento {len(rows)+1}'));prev=bal
    ins=sum(r['cents'] for r in rows if r['cents']>0);outs=-sum(r['cents'] for r in rows if r['cents']<0)
    if not rows or (ins,outs,prev)!=(declared_in,declared_out,closing):raise ValueError('Los movimientos no cuadran con los totales impresos del banco.')
    return dict(kind='bank',month=month,account=account,bank='Interbank' if kind=='interbank' else 'Scotiabank',opening=opening,closing=closing,inflow=ins,outflow=outs,total=ins-outs,rows=rows,verified=True)
def sallenet_parse(path,text):
    import pdfplumber
    rows=[]; numbers=[]; payments=[]
    with pdfplumber.open(path) as pdf:
        for pi,p in enumerate(pdf.pages,1):
            # Character geometry: fixed report columns, scaled to page width. Ignore subtotal and title rows.
            groups=[]
            for ch in sorted(p.chars,key=lambda c:(round(c['top'],1),c['x0'])):
                if not groups or abs(ch['top']-groups[-1][0]['top'])>2.0:groups.append([ch])
                else:groups[-1].append(ch)
            for g in groups:
                g.sort(key=lambda c:c['x0']);scale=595.28/p.width
                def col(lo,hi):return ''.join(c['text'] for c in g if lo<=((c['x0']+c['x1'])/2)*scale<hi).strip()
                idx=col(0,55); day=col(55,100)
                if not re.fullmatch(r'\d+',idx) or not re.fullmatch(r'\d{2}/\d{2}/\d{2}',day):continue
                due=col(304,347); code=col(100,135); name=col(135,304)
                # Some names extend over the due-date left boundary; extract the date from the complete middle text.
                middle=col(100,347);dm=re.search(r'\d{2}/\d{2}/\d{2}$',middle)
                if not dm:raise ValueError(f'Vencimiento ilegible en fila {idx}.')
                due=dm[0];dt=date(day);dv=date(due); vals=[cents(col(lo,hi) or '0') for lo,hi in [(347,385),(385,429),(429,468),(468,509),(509,544),(544,595.28)]]
                if any(v<0 for v in vals):raise ValueError(f'Importe negativo en fila {idx}. Revisa la devolución por separado.')
                if sum(vals[:5])!=vals[5]:raise ValueError(f'Importe inconsistente en fila {idx}.')
                numbers.append(int(idx));payments.append(vals); label='Postulante' if 'POSTULANTE' in middle else 'Alumno'; ident=code if code.isdigit() else ''
                cats=['Matrícula','Pensiones años anteriores' if dv[:4]<dt[:4] else 'Pensiones atrasadas' if dv[:7]<dt[:7] else 'Pensiones del mes' if dv[:7]==dt[:7] else 'Pensiones adelantadas','PRP','Otros ingresos','Mora']
                for j,a in enumerate(vals[:5]):
                    if a: rows.append(dict(date=dt,due=dv,concept=cats[j],category=cats[j],reference=ident,subject=name,subject_type=label,cents=a,source_ref=f'Página {pi} · fila {idx}'))
    if not numbers or numbers!=list(range(1,len(numbers)+1)):raise ValueError('La numeración de pagos tiene omisiones o duplicados.')
    month=rows[0]['date'][:7]; total=sum(r['cents'] for r in rows); match=re.findall(r'^\s*Total\s+('+M+r')\s*$',text,re.M)
    if not match or cents(match[-1])!=total or any(not r['date'].startswith(month) for r in rows):raise ValueError('El detalle Sallenet no coincide con el total mensual.')
    return dict(kind='collection',month=month,account='',bank='',total=total,rows=rows,payment_count=len(numbers),verified=True)
def summary_parse(text):
    h=re.search(r'DEL\s+(20\d\d-\d\d-\d\d)\s+AL\s+(20\d\d-\d\d-\d\d)',text,re.I);month=h[1][:7]
    if h[1]!=month+'-01' or h[2]!=month_end(month):raise ValueError('El resumen debe cubrir el mes completo.')
    rows=[];section=''
    for l in text.splitlines():
        if re.fullmatch(r'\s*(PENSIÓN|DERECHO DE INSCRIPCIÓN|MORA|MATRÍCULA|OTROS INGRESOS)\s*',l,re.I):section=l.strip();continue
        m=re.match(r'^\s*(.*?)\s{2,}('+N+r')\s*$',l)
        if not m or not section or m[1].upper().startswith('TOTAL'):continue
        concept=m[1];a=cents(m[2]);category=section;due=''
        if section=='PENSIÓN':
            x=re.search(r'(\w+)\s+(20\d\d)',concept);mn=MONTHS.index(x[1].lower().replace('setiembre','septiembre'))+1;due=f'{x[2]}-{mn:02}';category='Pensiones años anteriores' if due[:4]<month[:4] else 'Pensiones atrasadas' if due<month else 'Pensiones del mes' if due==month else 'Pensiones adelantadas'
        elif section=='MORA':category='Mora'
        elif section=='DERECHO DE INSCRIPCIÓN':category='Derecho de inscripción'
        rows.append(dict(date=h[2],concept=concept,category=category,cents=a,due=due,reference='',source_ref=f'Fila {len(rows)+1}'))
    total=sum(r['cents'] for r in rows);decl=re.search(r'TOTAL GENERAL\s+('+M+r')',text)
    if not rows or not decl or total!=cents(decl[1]):raise ValueError('El resumen por concepto no cuadra con el total impreso.')
    return dict(kind='income_summary',month=month,account='',bank='',total=total,rows=rows,verified=True)
def parse(path):
    text=subprocess.run(['pdftotext','-layout',str(path),'-'],capture_output=True,check=True,timeout=30).stdout.decode('utf-8','replace')
    if len(text)>4_000_000:raise ValueError('Texto demasiado extenso.')
    if 'PENSIONES PAGADAS' in text:return sallenet_parse(path,text)
    if 'RESUMEN DE INGRESOS POR CONCEPTO' in text:return summary_parse(text)
    if 'ESTADO DE CUENTA CORRIENTE PJ' in text:return bank_parse(text,'interbank')
    if 'CUENTA CORRIENTE M.N. SOLES' in text:return bank_parse(text,'scotiabank')
    raise ValueError('Formato no reconocido. Se admiten estados Interbank, Scotiabank y reportes Sallenet con texto.')
def preview(p):
    data=base64.b64decode(p['data'],validate=True)
    if len(data)>25*1024*1024 or not data.startswith(b'%PDF-'):raise ValueError('PDF inválido o mayor de 25 MB.')
    with tempfile.TemporaryDirectory() as td:
        f=Path(td)/'source.pdf';f.write_bytes(data)
        info=subprocess.run(['pdfinfo',str(f)],capture_output=True,check=True,timeout=10).stdout.decode(); n=int(re.search(r'^Pages:\s+(\d+)',info,re.M)[1]);
        if n>100:raise ValueError('Máximo 100 páginas.')
        print(json.dumps(parse(f),ensure_ascii=False))
if __name__=='__main__':
    import sys
    for f in sys.argv[1:]:
        try:
            d=parse(f);print(Path(f).name,{k:v for k,v in d.items() if k not in ('rows','account')},len(d['rows']),dict(collections.Counter(r['category'] for r in d['rows'])))
        except Exception as e:print(type(e).__name__,e)
