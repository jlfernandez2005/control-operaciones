import unittest,sqlite3,re,json,io,subprocess,sys,pathlib
from openpyxl import load_workbook
ROOT=pathlib.Path(__file__).resolve().parents[1]
class TestReferenceManagement(unittest.TestCase):
 def test_delete_only_reference(self):
  c=sqlite3.connect(':memory:');c.executescript((ROOT/'server/schema.sql').read_text());c.execute("INSERT INTO companies(name,code) VALUES ('A','A'),('B','B')")
  c.execute('ALTER TABLE budget_month_refs ADD COLUMN details_json TEXT');c.execute('ALTER TABLE budget_month_refs ADD COLUMN declared_cents INTEGER')
  route=(ROOT/'server/routes/budget.js').read_text();sql=re.search(r'`(INSERT INTO budget_month_refs.*?)`',route).group(1)
  c.execute(sql,[1,'2026-01',100,'a.pdf','[]',100]);c.execute(sql,[2,'2026-01',200,'b.pdf','[]',200]);c.execute(sql,[1,'2026-01',150,'a.pdf','[]',100]);
  deletion=re.search(r"'(DELETE FROM budget_month_refs WHERE company_id=\? AND month=\?)'",route).group(1);c.execute(deletion,[1,'2026-01']);self.assertEqual(c.execute('SELECT company_id,cents FROM budget_month_refs').fetchall(),[(2,200)])
 def test_exports(self):
  p={'month':'2026-01','company':'Empresa de prueba','filename':'Resumen de prueba','amount':125.25,'declared':125,'rows':[{'date':'2026-01-01','concept':'Pago A','amount':100,'reference':'Fila 1'},{'date':'2026-01-02','concept':'=1+1','amount':25.25,'reference':'Fila 2'}],'reconciliation':{'registered':100,'difference':-25.25,'directSuggested':0,'adjustedDifference':-25.25},'days':[]}
  for fmt in ['pdf','xlsx']:
   result=subprocess.run([sys.executable,str(ROOT/'scripts/finance_io.py'),'reference-'+fmt],input=json.dumps(p).encode(),capture_output=True,check=True).stdout
   if fmt=='pdf':self.assertTrue(result.startswith(b'%PDF'))
   else:
    w=load_workbook(io.BytesIO(result));self.assertEqual(w.sheetnames,['Resumen','Detalle','Conciliación']);self.assertEqual(w['Resumen']['B4'].value,125.25);self.assertEqual(w['Detalle']['B5'].data_type,'s');self.assertEqual(sum(w['Detalle'].cell(i,4).value for i in (4,5)),125.25)
if __name__=='__main__':unittest.main()
