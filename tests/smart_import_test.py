"""Regression checks; actual institution reports stay outside the deliverable.
Optional argument: directory containing the six original PDF examples.
"""
import sys, pathlib, sqlite3, re, unittest, os, io, json, base64, subprocess
from openpyxl import Workbook
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from smart_import import detect_pdf, total_cents, money
class SmartTest(unittest.TestCase):
    def test_amount_formats(self):
        self.assertEqual(money('S/ 1 ,500.00'),1500)
        self.assertEqual(money('12,50'),12.5)
        self.assertEqual(money('1.234,56'),1234.56)
        self.assertEqual(money(42.5),42.5)
        self.assertIsNone(money('$ 19.60'))
        self.assertEqual(money('$ 19.60',usd=True),19.6)
    def test_excel_recognition(self):
        wb=Workbook();w=wb.active;w.title='Pagos';w.append(['PAGOS 12 DE ENERO 2026']);w.merge_cells('A1:I1');w.append(['N°Or','Concepto','Comprobante','monto','Cuenta Bancaria -CCI','Banco','Empresa / Persona','RUC / DNI','N° Orden']);w.append([1,'Compras','B1',42.5,'001','BCP','Proveedor','01234567','123']);w.append([2,None,'B2',7.5,'001','BCP','Proveedor','01234567',None]);w.merge_cells('B3:B4');w.merge_cells('I3:I4');w.append([None,None,'TOTAL A PAGAR',50]);f=io.BytesIO();wb.save(f)
        p=subprocess.run([sys.executable,str(ROOT/'scripts/finance_io.py'),'preview'],input=json.dumps({'name':'pagos.xlsx','data':base64.b64encode(f.getvalue()).decode()}).encode(),capture_output=True,check=True)
        d=json.loads(p.stdout)['documents'][0];self.assertEqual(d['kind'],'ops');self.assertEqual(total_cents(d['rows']),5000);self.assertEqual(d['declared'],50);self.assertEqual([r['date'] for r in d['rows']],['2026-01-12']*2);self.assertEqual(d['rows'][1]['order'],'123');self.assertEqual(d['rows'][1]['concept'],'Compras');self.assertEqual(d['rows'][0]['ruc'],'01234567')
    def test_cash_duplicate_sql(self):
        c=sqlite3.connect(':memory:');c.executescript((ROOT/'server/schema.sql').read_text());c.execute("INSERT INTO companies(name,code) VALUES ('A','A'),('B','B')")
        for table,fields in {'petty_cash':['import_batch','report_date','source_file'],'petty_items':['source_ref','source_category']}.items():
            for k in fields:c.execute(f'ALTER TABLE {table} ADD COLUMN {k} TEXT')
        src=(ROOT/'server/routes/finance.js').read_text();header=re.search(r'`(INSERT INTO petty_cash\(company_id.*?\)\s*SELECT.*?)`',src,re.S).group(1);row=re.search(r'`(INSERT INTO petty_items\(cc_id.*?\)\s*SELECT.*?)`',src,re.S).group(1)
        def save(cid,batch):
            with c:
                n=c.execute(header,[cid,'001-2026','Prueba','','','2026-01-01','2026-01-31',1500,batch,None,'f.pdf',cid,'001-2026']).rowcount
                for ref,amount in [('1',25),('2',50)]:c.execute(row,['2026-01-05','','','','Otros','Prueba',amount,None,ref,'',cid,batch])
                return n
        self.assertEqual(save(1,'a'),1);self.assertEqual(save(1,'b'),0);self.assertEqual(save(2,'c'),1);self.assertEqual(c.execute('SELECT count(*),sum(amount) FROM petty_items').fetchone(),(4,150))
if __name__=='__main__':
    if len(sys.argv)>1 and pathlib.Path(sys.argv[1]).is_dir():
        directory=pathlib.Path(sys.argv.pop(1));expected={
        'OPERACIONES 24 DE NOVIEMBRE 2026.pdf':('ops',7,1736809),
        'PAGOS 06 DE ENERO 2025.pdf':('ops',3,3605237),
        'PAGOS 12 DE ENERO 2026.pdf':('ops',7,1626650),
        'INFORME DE CAJA CHICA 001-26 1.pdf':('cash',15,149999),
        'INFORME DE CAJA CHICA 001-26.pdf':('cash',15,149999),
        'INFORME CAJA CHICA 012 - 2026.pdf':('cash',27,150000)}
        for name,(kind,n,total) in expected.items():
            d=detect_pdf(directory/name,name);assert (d['kind'],len(d['rows']),total_cents(d['rows']))==(kind,n,total);assert round(d['declared']*100)==total
            if name.startswith('PAGOS 06'):assert d['meta']['report_date']=='2026-01-06'
            if name.startswith('PAGOS 12'):assert [r['order'] for r in d['rows'][-3:]]==['1524']*3 and len(set(r['concept'] for r in d['rows'][-3:]))==1
            if kind=='cash':assert d['meta']['fund']==1500;assert [r['usd'] for r in d['rows'] if r['usd']]==([28] if '012' in name else [19.6])
            print(f'{name}: {n} filas / S/ {total/100:,.2f} — coincide')
    unittest.main()
