"""Recognize institutional summary tables by geometry and labels, not whitespace."""
import re, datetime, unicodedata
from decimal import Decimal

MONTHS='enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split()
def clean(x): return ' '.join(str(x or '').split())
def norm(x): return ''.join(c for c in unicodedata.normalize('NFD',clean(x).lower()) if not unicodedata.combining(c))
def money(x,usd=False):
    s=re.sub(r'\s+','',str(x if x is not None else ''))
    if re.search(r'\$|USD',s,re.I) and not usd:return None
    s=re.sub(r'^(?:US\$|USD|PEN|S/\.?|\$)', '', s, flags=re.I)
    if re.fullmatch(r'(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?',s):s=s.replace(',','')
    elif re.fullmatch(r'(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}',s):s=s.replace('.','').replace(',','.')
    else:return None
    return float(Decimal(s))
def date_es(x,year=None):
    s=re.sub(r'\bsetiembre\b','septiembre',norm(x)); m=re.search(r'(\d{1,2})\s+de\s+('+'|'.join(MONTHS)+r')(?:\s+(?:de\s+)?(20\d{2}))?',s)
    try:
        if m:return datetime.date(int(m[3] or year),MONTHS.index(m[2])+1,int(m[1])).isoformat()
        m=re.search(r'(\d{1,2})/(\d{1,2})/(20\d{2})',s)
        if m:return datetime.date(int(m[3]),int(m[2]),int(m[1])).isoformat()
        return datetime.date.fromisoformat(s[:10]).isoformat()
    except (ValueError,TypeError):return ''
def base_row(**kwargs):
    if kwargs.get('usd')==0:kwargs['usd']=None
    return dict(dict(date='',concept='',amount=None,category='',provider='',ruc='',receipt='',status='',bank='',type='',cci='',order='',usd=None,reference='',raw='',source_category=''),**kwargs)
def total_cents(rows):return sum(round(r['amount']*100) for r in rows if r['amount'] is not None)
def reconcile_cash_period(meta,rows,warnings):
    dates=[r['date'] for r in rows if r['date']]
    if not dates:return
    start,end=min(dates),max(dates)
    original_start,original_end=meta.get('from_date'),meta.get('to_date')
    if original_start and original_end and (start<original_start or end>original_end):
        meta['declared_from_date'],meta['declared_to_date']=original_start,original_end
        meta['from_date'],meta['to_date']=start,end
        warnings.append(f'ATENCIÓN: el periodo impreso ({original_start} a {original_end}) no coincide con los gastos ({start} a {end}). Se propone el intervalo de los gastos; revisa antes de guardar.')
    else:
        meta.setdefault('from_date',start);meta.setdefault('to_date',end)

def monthly_period(title):
    t=re.sub(r'\bsetiembre\b','septiembre',norm(title))
    if not re.search(r'\b(?:resumen|consolidado)\s+(?:(?:mensual|general)\s+(?:de\s+)?)?(?:de\s+)?operaciones\b|\b(?:resumen|consolidado)\s+mensual\b',t):return ''
    m=re.search(r'\b('+'|'.join(MONTHS)+r')\s+(?:de\s+)?(20\d{2})\b',t)
    return f'{m[2]}-{MONTHS.index(m[1])+1:02d}' if m else ''

def detect_monthly(grid,refs,heading,name):
    # Explicit consolidated heading prevents treating ordinary payment reports as totals.
    month=monthly_period(heading) or monthly_period(name)
    if not month:return None
    for hi,head in enumerate(grid):
        cols=header_columns(head)
        if any(cols[k] is None for k in ('concept','date','amount')):continue
        rows=[];declared=None;warnings=[]
        for i,row in enumerate(grid[hi+1:],hi+1):
            def val(k):
                j=cols[k];return clean(row[j]) if j is not None and j<len(row) else ''
            a=money(val('amount'));j=cols['amount']
            if val('amount')=='S/' and j+1<len(row) and j+1 not in cols.values():a=money(row[j+1])
            if is_summary(row):
                declared=a;break
            if not any(clean(v) for v in row):continue
            rows.append(base_row(date=date_es(val('date'),month[:4]),concept=val('concept'),amount=a,reference=refs[i]))
        if not rows:continue
        if declared is None:warnings.append('No se reconoció el total impreso; verifica el importe.')
        elif round(declared*100)!=total_cents(rows):warnings.append('La suma difiere del total impreso. Corrige las filas antes de guardar.')
        if monthly_period(name) and monthly_period(heading) and monthly_period(name)!=month:warnings.append('El periodo del nombre difiere del encabezado; se usa el encabezado.')
        if any(not r['date'].startswith(month) for r in rows):warnings.append('Hay fechas fuera del mes del resumen; revisa antes de guardar.')
        return {'kind':'monthly','meta':{'month':month,'title':clean(heading)[:200]},'rows':rows,'declared':declared,'warnings':warnings,'sheets':[]}
    return None

def detect_pdf(path,name,_page=0,_scan=True):
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        pg=pdf.pages[_page]; page_no=_page+1; text=pg.extract_text() or ''; tables=pg.find_tables(); data=[(t,t.extract()) for t in tables]
        warnings=[]; rows=[]; meta={}; declared=None; kind=''; found=False
        for _,grid in data:
            monthly=detect_monthly(grid,[f'Página {page_no} · fila {i+1}' for i in range(len(grid))],text,name)
            if monthly:return monthly
        for table,grid in data:
            for hi,head in enumerate(grid):
                h=[norm(v) for v in head]
                cols=header_columns(head)
                if cols['concept'] is not None and cols['amount'] is not None and cols['date'] is not None and cols['item'] is not None and 'caja chica' in norm(text):kind='cash'
                elif cols['concept'] is not None and (cols['amount'] is not None or cols['usd'] is not None) and (cols['item'] is not None or cols['date'] is not None) and (cols['receipt'] is not None or cols['provider'] is not None) and re.search(r'\b(pagos|operaciones)\b',norm(text)):kind='ops'
                else:continue
                found=True; modern='detalle del gasto' in h
                if kind=='ops':
                    title=next((clean(v) for r in grid[:hi] for v in r if re.search(r'(?i)\b(pagos|operaciones)\b',clean(v)) and date_es(v)), '')
                    if not title: title=next((line for line in text.splitlines() if re.search(r'\b(pagos|operaciones)\b',norm(line)) and date_es(line)), '')
                    report_date=date_es(title)
                    filename_date=date_es(name)
                    if filename_date and report_date and filename_date!=report_date:warnings.append('La fecha del nombre del archivo difiere del encabezado. Se usa la fecha impresa del informe: '+report_date+'.')
                    if not report_date and cols['date'] is None and filename_date:
                        report_date=filename_date; warnings.append('No se reconoció fecha impresa; se propone la fecha del nombre del archivo. Verifícala.')
                    meta={'report_date':report_date,'title':title}; prev={}; nums=[]
                    for ri,row in enumerate(grid[hi+1:],hi+1):
                        def val(k,inherit=False):
                            j=cols[k]; v=row[j] if j is not None and j<len(row) else ''
                            if v is None and inherit:return prev.get(k,'')
                            out=clean(v)
                            if inherit:prev[k]=out
                            return out
                        a,usd=read_amounts(val)
                        if is_summary(row):
                            if a is not None:declared=a
                            if usd is not None:meta['declared_usd']=usd
                            break
                        n=val('item')
                        if cols['item'] is not None and not n.isdigit():continue
                        if cols['item'] is None and not any(val(k) for k in ('concept','receipt','provider','amount','usd')):continue
                        if n.isdigit():nums.append(int(n))
                        concept=val('concept',True); order=val('order',True)
                        dt=date_es(val('date'),report_date[:4] or None) if cols['date'] is not None else report_date
                        rows.append(base_row(date=dt,concept=concept,receipt=val('receipt'),amount=a,usd=usd,cci=val('cci'),bank=val('bank'),provider=val('provider'),ruc='' if val('ruc')=='-' else val('ruc'),order=order,category=val('category'),status=val('status'),reference=f'Página {page_no} · operación {n or ri+1}',raw=' | '.join(clean(v) for v in row)))
                    if nums and nums!=list(range(nums[0],max(nums)+1)):warnings.append('ATENCIÓN: faltan números de operación o hay números repetidos.')
                    if any(r['usd'] is not None for r in rows):warnings.append('Se identificaron importes en dólares. El sistema consolida en soles: verifica el equivalente en soles y confirma cada fila con USD. No se aplica un tipo de cambio inventado.')
                    if meta.get('declared_usd') is not None and round(meta['declared_usd']*100)!=sum(round((r['usd'] or 0)*100) for r in rows):warnings.append('ALERTA: la suma en dólares no coincide con el total impreso en dólares.')
                    warnings.append('Fecha del informe, no necesariamente fecha efectiva de pago. Confirma el estado de pago; el total a pagar no acredita que se pagó.')
                else:
                    # Metadata can be a separate table or rows above the detail header.
                    for _,g in data:
                        for rr in g:
                            for j,v in enumerate(rr):
                                k=norm(v); following=next((clean(a) for a in rr[j+1:] if clean(a)), '')
                                if k in ('caja chica n°','n° informe caja chica:'):meta['num']=following
                                if k in ('informe realizado por:','responsable / custodio:'):meta['resp']=following
                                if k=='area / centro de costos:':meta['area']=following
                                if k in ('orden n°','n° transf. / orden pago:'):meta['ord']=following
                                if k in ('monto s/','monto fondo asignado (s/):') and rr not in grid[hi:]:meta['fund']=money(following)
                                if k=='fecha del informe:':meta['report_date']=date_es(following)
                                if k=='periodo de liquidacion:':
                                    dates=re.findall(r'\d{1,2}/\d{1,2}/20\d{2}',following)
                                    if len(dates)==2:meta['from_date'],meta['to_date']=map(date_es,dates)
                    y=re.search(r'20\d{2}',meta.get('num','')) or re.search(r'20\d{2}',meta.get('report_date',''))
                    year=y[0] if y else None
                    for ri,row in enumerate(grid[hi+1:],hi+1):
                        def val(k):
                            j=cols[k];return clean(row[j]) if j is not None and j<len(row) else ''
                        a=money(val('amount')); date=date_es(val('date'),year)
                        # Identify actual numbered items, even if the item's grid cell is vertically merged.
                        band=table.rows[ri].cells[cols['date']]
                        bounds=table.rows[hi].cells[cols['item']]
                        n=val('item')
                        if band and bounds:
                            item=clean(pg.crop((bounds[0],band[1],bounds[2],band[3])).extract_text())
                            if item.isdigit():n=item
                        if not n.isdigit():
                            if a is not None and (is_summary(row) or not any(clean(v) for j,v in enumerate(row) if j!=cols['amount'])):
                                declared=a
                                continue
                            # A detail line can have an empty item number, especially in reimbursements.
                            # Keep it only when its own concept, amount and date are present.
                            if n or not val('concept') or a is None or not val('date'):continue
                            warnings.append(f'Fila {ri+1}: gasto sin número de ítem, conservado para revisión.')
                        if not date:warnings.append(f'Ítem {n or "sin número"}: fecha no reconocida; corrígela antes de guardar.')
                        concept=val('concept');receipt=val('receipt');provider=val('provider');ruc=val('ruc');src=val('category')
                        if cols['ruc'] is not None:
                            bounds=table.rows[hi].cells[cols['ruc']]
                            if band and bounds:ruc=clean(pg.crop((bounds[0],band[1],bounds[2],band[3])).extract_text())
                        usd=money(val('usd'),usd=True)
                        if usd is None:
                            # The original reports sometimes put USD outside the main grid.
                            side=(pg.crop((table.bbox[2],band[1],pg.width,band[3])).extract_text() or '') if band and table.bbox[2]<pg.width else ''
                            m=re.search(r'\$\s*([\d,.]+)',side);usd=money(m[1]) if m else None
                            if usd is None and modern and cols['amount']==7 and len(row)>8 and not clean(head[8] if len(head)>8 else ''):usd=money(row[8],usd=True)
                        if not provider and cols['provider'] is None:
                            tail=receipt.rsplit(' - ',1)
                            if len(tail)==2 and re.search(r'[A-Za-zÁÉÍÓÚáéíóú]',tail[1]) and re.search(r'\d',tail[0]):provider=tail[1]
                        rows.append(base_row(date=date,concept=concept,receipt=receipt,provider='' if provider=='-' else provider,ruc='' if ruc=='-' else ruc,source_category=src,amount=a,usd=usd,status='Pagado',type='Caja chica',reference=f'Página {page_no} · ítem {n}' if n.isdigit() else f'Página {page_no} · gasto sin número · fila {ri+1}',raw=' | '.join(clean(v) for v in row)))
                    if not modern and rows:
                        warnings.append('El intervalo se obtuvo de las fechas de gastos. El área no figura; los proveedores identificables se sugieren desde el comprobante.')
                    reconcile_cash_period(meta,rows,warnings)
                    nums=[int(r['reference'].rsplit(' ',1)[-1]) for r in rows if ' · ítem ' in r['reference']]
                    if nums and nums!=list(range(1,max(nums)+1)):
                        warnings.append('ATENCIÓN: la numeración de ítems no es consecutiva. Revisa los registros faltantes o repetidos.')
                break
            if found:break
        if not found or not rows:return None
        if _scan and len(pdf.pages)>1:warnings.append(f'Se procesó la tabla resumen de la página {page_no}. Las {len(pdf.pages)-1} páginas restantes no se importan como operaciones adicionales.')
        if declared is None:warnings.append('No se reconoció el total impreso. Revisa la suma.')
        elif round(declared*100)!=total_cents(rows):warnings.append('ALERTA: el total extraído no coincide con el total impreso. Revisa antes de importar.')
        result={'kind':kind,'meta':meta,'rows':rows,'declared':declared,'warnings':warnings,'sheets':[]}
        # Inspect likely supporting liquidation pages, but NEVER expose them as independently
        # importable movements in a payments document. Their transfer is already in the main table.
        if _scan and kind=='ops':
            annexes=[]
            for j in range(1,min(len(pdf.pages),20)):
                page=pdf.pages[j]
                try:
                    heading=norm((page.extract_text() or '')[:1800])
                    if not (re.search(r'\binforme de (?:dinero|liquidacion de caja chica|caja chica)\b',heading) and 'caja chica' in heading):continue
                    annex=detect_pdf(path,name,_page=j,_scan=False)
                    if not annex or annex['kind']!='cash':continue
                    am=annex['meta']; fund=am.get('fund'); spent=total_cents(annex['rows'])/100
                    order=re.search(r'\b\d{4,}\b',am.get('ord',''))
                    matches=[r for r in rows if order and r['order']==order[0] and fund is not None and r['amount'] is not None and round(r['amount']*100)==round(fund*100)]
                    annexes.append({'page':j+1,'num':am.get('num',''),'order':am.get('ord',''),'fund':fund,'spent':spent,'declared':annex['declared'],'difference':round(spent-fund,2) if fund is not None else None,'matched':len(matches)==1,'rows':[{'date':r['date'],'concept':r['concept'],'amount':r['amount'],'reference':r['reference']} for r in annex['rows']], 'warnings':annex['warnings']})
                except (ValueError,IndexError,TypeError):
                    warnings.append(f'No se pudo verificar el anexo de la página {j+1}. Revísalo por separado.')
                finally:
                    page.close()
            if annexes:warnings.append('Se detectaron liquidaciones anexas: consulta su detalle informativo. No se suman al total ni se guardan como cajas automáticamente.')
            if len(pdf.pages)>20:warnings.append('La búsqueda de liquidaciones anexas revisó las primeras 20 páginas; los demás anexos no se analizaron.')
            result['annexes']=annexes
        return result

# Tabular Excel/CSV: label-driven detection, including documents without a per-row date.
HEADER_ALIASES={
 'concept':['concepto','detalle del gasto','detalle','descripcion','glosa','concept','concepto de pago','motivo','descripcion del gasto'],
 'date':['fecha','fecha de pago','fecha operacion','fecha de operacion','date','fecha del gasto','fecha movimiento','fecha de movimiento'],
 'amount':['monto','monto s/','monto (s/)','importe','monto soles','amount','importe s/','importe en soles','monto en soles','monto pen','importe pen','total s/','monto pagado','monto moneda nacional','monto en moneda nacional','monto s/.'],
 'provider':['empresa / persona','proveedor / razon social','proveedor','razon social','beneficiario','empresa','persona','nombre proveedor','empresa beneficiaria','nombre del proveedor'],
 'ruc':['ruc / dni','ruc/dni','ruc','dni','documento de identidad','ruc o dni'], 'receipt':['comprobante','n° comprobante','nro comprobante','nro. comprobante','numero de comprobante','documento','factura / boleta','n° de comprobante'],
 'category':['categoria','rubro','grupo','clasificacion'], 'bank':['banco','banco dest.','banco destino','banco de destino','entidad bancaria'], 'cci':['cuenta bancaria -cci','cuenta bancaria - cci','cci','cuenta bancaria','cuenta / cci','cuenta de destino','cuenta bancaria cci','n° cuenta'],
 'order':['n° orden','numero de orden','nro orden','n° de orden','orden de pago','n° orden de pago'], 'status':['estado','situacion','estado de pago'], 'currency':['moneda','divisa','tipo de moneda','currency'], 'usd':['usd','monto usd','monto $','monto dolares','monto en dolares','monto us$','importe usd','importe dolares','importe en dolares','importe $','total usd','total $','dolares','referencia usd','monto moneda extranjera'], 'item':['item','n°or','n° or','nro','n°','numero','n° item','nro item','n° operacion','nro operacion','correlativo']}
def header_key(v):
    return re.sub(r'[^a-z0-9$/]+','',norm(v).replace('nº','n°'))
def header_columns(head):
    h=[header_key(v) for v in head]
    return {k:next((i for i,x in enumerate(h) if x and x in {header_key(a) for a in aliases}),None) for k,aliases in HEADER_ALIASES.items()}
def is_usd(value):
    return bool(re.search(r'\$|\busd\b|dolares',norm(value)))
def read_amounts(val):
    raw=val('amount'); pen=money(raw); usd=money(val('usd'),usd=True)
    if is_usd(raw) or is_usd(val('currency')):
        foreign=money(raw,usd=True);pen=None
        if usd is None:usd=foreign
    return pen,usd
def is_summary(row):
    return any(re.match(r'^(?:total a pagar|total gastos sustentados|subtotal|total general|total del informe|total operaciones|saldo a favor|saldo en contra|total)(?:\s*\(.*\)|\s+s/|\s*:?$)',norm(v)) for v in row)

def detect_tabular(sheet,name):
    grid=[r['cells'] for r in sheet['rows']]
    heading=' '.join(clean(v) for row in grid[:3] for v in row)
    monthly=detect_monthly(grid,[r['ref'] for r in sheet['rows']],heading,name)
    if monthly:return {**monthly,'sheet':sheet['name']}
    for hi,h in enumerate(grid[:80]):
        cols=header_columns(h)
        if cols['concept'] is None or (cols['amount'] is None and cols['usd'] is None):continue
        pre=grid[:hi]; heading=' '.join(clean(v) for r in pre for v in r); kind='cash' if 'caja chica' in norm(heading) else 'ops'; meta={}; warnings=[]; rows=[]; declared=None
        if kind=='cash':
            for rr in pre:
                for j,v in enumerate(rr):
                    k=norm(v); after=[clean(a) for a in rr[j+1:] if clean(a)]; following=after[0] if after else ''
                    if k in ('caja chica n°','n° informe caja chica:'):meta['num']=following
                    if k in ('informe realizado por:','responsable / custodio:'):meta['resp']=following
                    if k=='area / centro de costos:':meta['area']=following
                    if k in ('orden n°','n° transf. / orden pago:'):meta['ord']=following
                    if k in ('monto s/','monto fondo asignado (s/):'):meta['fund']=money(after[1] if following=='S/' and len(after)>1 else following)
                    if k=='fecha del informe:':meta['report_date']=date_es(following)
                    if k=='periodo de liquidacion:':
                        dates=re.findall(r'\d{1,2}/\d{1,2}/20\d{2}',following)
                        if len(dates)==2:meta['from_date'],meta['to_date']=map(date_es,dates)
            year=re.search(r'20\d{2}',meta.get('num','') or meta.get('report_date',''));year=year[0] if year else None
        else:
            title=next((clean(v) for rr in pre for v in rr if re.search(r'(?i)\b(pagos|operaciones)\b',clean(v)) and date_es(v)), '')
            meta={'report_date':date_es(title),'title':title};year=None
            if date_es(name) and meta['report_date'] and date_es(name)!=meta['report_date']:warnings.append('Fecha del archivo distinta del encabezado; se usa el encabezado.')
            if cols['date'] is None and not meta['report_date']:continue
            if cols['date'] is None:warnings.append('Se usa la fecha del encabezado; verifica la fecha efectiva de pago.')
        for i,rr in enumerate(grid[hi+1:],hi+1):
            def val(k):
                j=cols[k];return clean(rr[j]) if j is not None and j<len(rr) else ''
            concept=val('concept');a,usd=read_amounts(val);j=cols['amount']
            if j is not None and val('amount')=='S/' and j+1<len(rr) and j+1 not in [v for k,v in cols.items() if k!='amount']:a=money(rr[j+1])
            if is_summary(rr):
                if a is not None:declared=a
                if usd is not None:meta['declared_usd']=usd
                break
            if not concept and not (cols['item'] is not None and val('item').isdigit()):continue
            # Do not turn explicit header rows into payments; preserve invalid amounts for review.
            if norm(concept) in HEADER_ALIASES['concept']:continue
            if cols['item'] is not None and not val('item').isdigit():continue
            dt=date_es(val('date'),year) if cols['date'] is not None else meta.get('report_date','')
            status={'pagado':'Pagado','pendiente':'Pendiente','por pagar':'Pendiente'}.get(norm(val('status')),'')
            ruc=val('ruc');ruc='' if ruc=='-' else ruc
            # Excel may store numeric IDs: preserve leading zeros when stored as text; do not infer missing zeros.
            rows.append(base_row(date=dt,concept=concept,amount=a,category=val('category') if kind=='ops' else '',source_category=val('category') if kind=='cash' else '',provider='' if val('provider')=='-' else val('provider'),ruc=ruc,receipt=val('receipt'),status='Pagado' if kind=='cash' else status,bank=val('bank'),type='Caja chica' if kind=='cash' else '',cci=val('cci'),order=val('order'),usd=usd,reference=sheet['rows'][i]['ref'],raw=' | '.join(clean(v) for v in rr)))
        if not rows:continue
        if kind=='cash':
            reconcile_cash_period(meta,rows,warnings)
        if declared is not None and round(declared*100)!=total_cents(rows):warnings.append('ALERTA: el total extraído no coincide con el total impreso.')
        if kind=='ops':
            if any(r['usd'] is not None for r in rows):warnings.append('Se identificaron dólares; verifica y confirma el equivalente en soles antes de guardar.')
            warnings.append('Confirma el estado de las operaciones antes de guardar.')
        return {'kind':kind,'meta':meta,'rows':rows,'declared':declared,'warnings':warnings,'sheet':sheet['name']}
    return None
