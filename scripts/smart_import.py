"""Recognize institutional summary tables by geometry and labels, not whitespace."""
import re, datetime, unicodedata
from decimal import Decimal

MONTHS='enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split()
def clean(x): return ' '.join(str(x or '').split())
def norm(x): return ''.join(c for c in unicodedata.normalize('NFD',clean(x).lower()) if not unicodedata.combining(c))
def money(x,usd=False):
    s=re.sub(r'\s+','',str(x if x is not None else ''))
    if '$' in s and not usd:return None
    s=s.removeprefix('S/').removeprefix('$')
    if re.fullmatch(r'(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?',s):s=s.replace(',','')
    elif re.fullmatch(r'(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}',s):s=s.replace('.','').replace(',','.')
    else:return None
    return float(Decimal(s))
def date_es(x,year=None):
    s=norm(x); m=re.search(r'(\d{1,2})\s+de\s+('+'|'.join(MONTHS)+r')(?:\s+(?:de\s+)?(20\d{2}))?',s)
    try:
        if m:return datetime.date(int(m[3] or year),MONTHS.index(m[2])+1,int(m[1])).isoformat()
        m=re.search(r'(\d{1,2})/(\d{1,2})/(20\d{2})',s)
        if m:return datetime.date(int(m[3]),int(m[2]),int(m[1])).isoformat()
        return datetime.date.fromisoformat(s[:10]).isoformat()
    except (ValueError,TypeError):return ''
def base_row(**kwargs):
    return dict(dict(date='',concept='',amount=None,category='',provider='',ruc='',receipt='',status='',bank='',type='',cci='',order='',usd=None,reference='',raw='',source_category=''),**kwargs)
def total_cents(rows):return sum(round(r['amount']*100) for r in rows if r['amount'] is not None)
def detect_pdf(path,name):
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        pg=pdf.pages[0]; text=pg.extract_text() or ''; tables=pg.find_tables(); data=[(t,t.extract()) for t in tables]
        warnings=[]; rows=[]; meta={}; declared=None; kind=''; found=False
        for table,grid in data:
            for hi,head in enumerate(grid):
                h=[norm(v) for v in head]
                if 'concepto' in h and 'comprobante' in h and 'monto' in h and any('cuenta bancaria' in v for v in h): kind='ops'
                elif 'item' in h and 'fecha' in h and any('monto' in v for v in h) and ('concepto' in h or 'detalle del gasto' in h):kind='cash'
                else:continue
                found=True; modern='detalle del gasto' in h
                if kind=='ops':
                    title=next((clean(r[0]) for r in grid[:hi] if re.search(r'(?i)\b(pagos|operaciones)\b',clean(r[0]))),'')
                    report_date=date_es(title)
                    filename_date=date_es(name)
                    if filename_date and report_date and filename_date!=report_date:warnings.append('La fecha del nombre del archivo difiere del encabezado. Se usa la fecha impresa del informe: '+report_date+'.')
                    meta={'report_date':report_date,'title':title}; prev_concept='';prev_order=''
                    for row in grid[hi+1:]:
                        if not clean(row[0]).isdigit():
                            if any('total a pagar' in norm(v) for v in row):declared=money(row[3])
                            continue
                        n=clean(row[0]); concept=clean(row[1]); order=clean(row[8]) if len(row)>8 else ''
                        # Only inherit fields from geometrically merged cells (None), not from empty independent cells.
                        if row[1] is None: concept=prev_concept
                        else:prev_concept=concept
                        if len(row)>8 and row[8] is None:order=prev_order
                        else:prev_order=order
                        rows.append(base_row(date=report_date,concept=concept,receipt=clean(row[2]),amount=money(row[3]),cci=clean(row[4]),bank=clean(row[5]),provider=clean(row[6]),ruc=clean(row[7]).replace('-',''),order=order,reference=f'Página 1 · operación {n}',raw=' | '.join(clean(v) for v in row)))
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
                        a=money(row[7] if modern else row[4]); date=date_es(row[1] if modern else row[3],year)
                        if not date:
                            if a is not None and (not any(clean(v) for v in row[:-1]) or 'total gastos' in norm(row[0])):declared=a
                            continue
                        if modern:
                            # Recover each identifier from its own row's date band, even when PDF grid borders are absent.
                            band=table.rows[ri].cells[1]; bounds=table.rows[hi].cells[2]; ruc=clean(pg.crop((bounds[0],band[1],bounds[2],band[3])).extract_text())
                            usd=money(row[8],usd=True) if len(row)>8 else None
                            concept=clean(row[6]); receipt=clean(row[4]); provider=clean(row[3]); src=clean(row[5]); n=len(rows)+1
                        else:
                            n=clean(row[0]);concept=clean(row[1]);receipt=clean(row[2]);provider='';ruc='';src=''
                            tail=receipt.rsplit(' - ',1)
                            if len(tail)==2 and re.search(r'[A-Za-zÁÉÍÓÚáéíóú]',tail[1]) and re.search(r'\d',tail[0]):provider=tail[1]
                            band=table.rows[ri].cells[3]; side=pg.crop((table.bbox[2],band[1],pg.width,band[3])).extract_text() or ''; m=re.search(r'\$\s*([\d,.]+)',side);usd=money(m[1]) if m else None
                        rows.append(base_row(date=date,concept=concept,receipt=receipt,provider='' if provider=='-' else provider,ruc='' if ruc=='-' else ruc,source_category=src,amount=a,usd=usd,status='Pagado',type='Caja chica',reference=f'Página 1 · ítem {n}',raw=' | '.join(clean(v) for v in row)))
                    if not modern and rows:
                        meta['from_date']=min(r['date'] for r in rows);meta['to_date']=max(r['date'] for r in rows)
                        warnings.append('El intervalo se obtuvo de las fechas de gastos. El área no figura; los proveedores identificables se sugieren desde el comprobante.')
                break
            if found:break
        if not found or not rows:return None
        if len(pdf.pages)>1:warnings.append(f'Se procesó la tabla resumen de la página 1. Las {len(pdf.pages)-1} páginas restantes son anexos no importados; verifica si incluyen otros resúmenes.')
        if declared is None:warnings.append('No se reconoció el total impreso. Revisa la suma.')
        elif round(declared*100)!=total_cents(rows):warnings.append('ALERTA: el total extraído no coincide con el total impreso. Revisa antes de importar.')
        return {'kind':kind,'meta':meta,'rows':rows,'declared':declared,'warnings':warnings,'sheets':[]}

# Tabular Excel/CSV: label-driven detection, including documents without a per-row date.
HEADER_ALIASES={
 'concept':['concepto','detalle del gasto','detalle','descripcion','glosa','concept'],
 'date':['fecha','fecha de pago','fecha operacion','fecha de operacion','date'],
 'amount':['monto','monto s/','monto (s/)','importe','monto soles','amount'],
 'provider':['empresa / persona','proveedor / razon social','proveedor','razon social','beneficiario'],
 'ruc':['ruc / dni','ruc/dni','ruc','dni'], 'receipt':['comprobante','n° comprobante','nro comprobante'],
 'category':['categoria','rubro','grupo'], 'bank':['banco','banco dest.'], 'cci':['cuenta bancaria -cci','cuenta bancaria - cci','cci'],
 'order':['n° orden','numero de orden'], 'status':['estado','situacion'],'usd':['usd','monto usd','monto $'], 'item':['item','n°or','n° or']}

def detect_tabular(sheet,name):
    grid=[r['cells'] for r in sheet['rows']]
    for hi,h in enumerate(grid[:80]):
        header=[norm(v) for v in h]; cols={k:next((i for i,x in enumerate(header) if x in aliases),None) for k,aliases in HEADER_ALIASES.items()}
        if cols['concept'] is None or cols['amount'] is None:continue
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
            concept=val('concept');a=money(val('amount'));j=cols['amount']
            if val('amount')=='S/' and j+1<len(rr):a=money(rr[j+1])
            if any(re.match(r'^(total a pagar|total gastos sustentados|subtotal|total general|saldo a favor|saldo en contra|total)$',norm(v)) or norm(v).startswith('total gastos sustentados (') for v in rr):
                if a is not None:declared=a
                break
            if not concept:continue
            # Do not turn explicit header rows into payments; preserve invalid amounts for review.
            if norm(concept) in HEADER_ALIASES['concept']:continue
            if cols['item'] is not None and not val('item').isdigit():continue
            dt=date_es(val('date'),year) if cols['date'] is not None else meta.get('report_date','')
            status={'pagado':'Pagado','pendiente':'Pendiente','por pagar':'Pendiente'}.get(norm(val('status')),'')
            ruc=val('ruc');ruc='' if ruc=='-' else ruc
            # Excel may store numeric IDs: preserve leading zeros when stored as text; do not infer missing zeros.
            rows.append(base_row(date=dt,concept=concept,amount=a,category=val('category') if kind=='ops' else '',source_category=val('category') if kind=='cash' else '',provider='' if val('provider')=='-' else val('provider'),ruc=ruc,receipt=val('receipt'),status='Pagado' if kind=='cash' else status,bank=val('bank'),type='Caja chica' if kind=='cash' else '',cci=val('cci'),order=val('order'),usd=money(val('usd'),usd=True),reference=sheet['rows'][i]['ref'],raw=' | '.join(clean(v) for v in rr)))
        if not rows:continue
        if kind=='cash':
            dates=[r['date'] for r in rows if r['date']]
            if dates:meta.setdefault('from_date',min(dates));meta.setdefault('to_date',max(dates))
        if declared is not None and round(declared*100)!=total_cents(rows):warnings.append('ALERTA: el total extraído no coincide con el total impreso.')
        if kind=='ops':warnings.append('Confirma el estado de las operaciones antes de guardar.')
        return {'kind':kind,'meta':meta,'rows':rows,'declared':declared,'warnings':warnings,'sheet':sheet['name']}
    return None
