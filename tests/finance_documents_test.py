import base64, io, json, subprocess, sys, unittest, pathlib, sqlite3, re, tempfile, os
from openpyxl import Workbook,load_workbook
from reportlab.pdfgen import canvas
ROOT=pathlib.Path(__file__).resolve().parents[1]
def worker(mode,data,ok=True):
    p=subprocess.run([sys.executable,str(ROOT/'scripts/finance_io.py'),mode],input=json.dumps(data).encode(),capture_output=True)
    if ok: assert p.returncode==0,p.stderr.decode()
    return p
class FinanceTest(unittest.TestCase):
    def preview(self,name,raw): return json.loads(worker('preview',{'name':name,'data':base64.b64encode(raw).decode()}).stdout)
    def test_inputs(self):
        wb=Workbook();ws=wb.active;ws.title='Enero';ws.append(['Fecha','Concepto','Monto']);ws.append(['2026-01-10','Limpieza',42.5]);wb.create_sheet('Febrero').append(['Concepto']);b=io.BytesIO();wb.save(b)
        x=self.preview('informe.xlsx',b.getvalue());self.assertEqual(x['sheets'][0]['rows'][1]['cells'][2],42.5);self.assertEqual(len(x['sheets']),2)
        p=io.BytesIO();c=canvas.Canvas(p);c.drawString(40,780,'Fecha');c.drawString(180,780,'Concepto');c.drawString(450,780,'Monto');c.drawString(40,755,'10/01/2026');c.drawString(180,755,'Limpieza');c.drawString(450,755,'42.50');c.save();r=self.preview('informe.pdf',p.getvalue());self.assertEqual(r['sheets'][0]['rows'][1]['cells'],['10/01/2026','Limpieza','42.50'])
        c=io.BytesIO();pdf=canvas.Canvas(c);pdf.rect(30,30,20,20);pdf.showPage();pdf.save();self.assertNotEqual(worker('preview',{'name':'escaneado.pdf','data':base64.b64encode(c.getvalue()).decode()},False).returncode,0)
    def test_exports(self):
        row={'date':'2026-01-10','concept':'=1+1','category':'Limpieza e higiene','provider':'Proveedor de prueba','ruc':'12345678','receipt':'B001','status':'Pagado','bank':'BCP','type':'General','area':'','source':'Importado','reference':'archivo.xlsx · fila 2','amount':42.5}
        g={'group':'Limpieza e higiene','count':1,'amount':42.5,'paid':42.5,'pending':0}
        p={'title':'Operaciones por rubro','context':'Datos ficticios · prueba','dimension':'Rubro','dimensions':{'category':'Rubro','year':'Año'},'group':'category','groups':[g],'allGroups':{'category':[g],'year':[dict(g,group='2026')]},'totals':g,'rows':[row]}
        out=worker('xlsx',p).stdout;wb=load_workbook(io.BytesIO(out));self.assertEqual(wb['Detalle']['B4'].data_type,'s');self.assertEqual(wb['Detalle']['M4'].value,42.5);self.assertEqual(wb['Resumen']['C4'].value,42.5)
        pdf=worker('pdf',p).stdout;self.assertTrue(pdf.startswith(b'%PDF'));f=tempfile.NamedTemporaryFile(suffix='.pdf',delete=False);f.write(pdf);f.close()
        try:
            txt=subprocess.check_output(['pdftotext',f.name,'-']).decode();self.assertIn('SISFIA',txt);self.assertIn('42.50',txt)
        finally:os.unlink(f.name)
    def test_migration_and_duplicate_sql(self):
        c=sqlite3.connect(':memory:');c.executescript((ROOT/'server/schema.sql').read_text());c.execute("INSERT INTO companies(name,code) VALUES ('Prueba','TEST')");c.execute("INSERT INTO companies(name,code) VALUES ('Otra','OTHER')");c.execute("INSERT INTO ops(company_id,date,concept,amount,ruc,receipt) VALUES(1,'2026-01-10','Limpieza',42.5,'12345678','B001')");c.execute('ALTER TABLE ops ADD COLUMN deleted_at TEXT');
        for name,definition in {'category':"TEXT NOT NULL DEFAULT 'Sin clasificar'",'provider_name':"TEXT NOT NULL DEFAULT ''",'import_batch':'TEXT','source_file':'TEXT','source_ref':'TEXT'}.items(): c.execute(f'ALTER TABLE ops ADD COLUMN {name} {definition}')
        self.assertEqual(c.execute('SELECT category,amount FROM ops').fetchone(),('Sin clasificar',42.5));s=(ROOT/'server/routes/finance.js').read_text();sql=re.search(r'`(INSERT INTO ops\(company_id,date,concept.*?WHERE NOT EXISTS.*?)`',s,re.S).group(1)
        def insert(cid):return c.execute(sql,[cid,'2026-01-10','Limpieza','B001',42.5,'12345678','Pagado','BCP','General','test',None,'Limpieza','Proveedor','batch','file','row',cid,'2026-01-10',4250,'12345678','B001','Limpieza','B001','12345678']).rowcount
        self.assertEqual(insert(1),0);self.assertEqual(insert(2),1);self.assertEqual(insert(2),0)
if __name__=='__main__':unittest.main()
