import sys,unittest,pathlib,sqlite3,re,json
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from smart_import import detect_pdf,detect_tabular,total_cents
class MonthlyTest(unittest.TestCase):
 def test_excel_summary(self):
  grid=[['RESUMEN DE OPERACIONES - SETIEMBRE 2026'],['Fecha de operación','Descripción','Importe en soles'],['04 de setiembre','Pago A','S/ 125.20'],['09 de setiembre','Pago B','S/ 20.80'],['TOTAL','','146.00']]
  r=detect_tabular({'name':'Mes','rows':[{'cells':g,'ref':str(i)} for i,g in enumerate(grid)]},'test.xlsx');self.assertEqual(r['kind'],'monthly');self.assertEqual(r['meta']['month'],'2026-09');self.assertEqual(total_cents(r['rows']),14600);self.assertEqual(r['rows'][0]['date'],'2026-09-04');self.assertEqual(r['declared'],146)
 def test_upsert_isolated(self):
  c=sqlite3.connect(':memory:');c.executescript((ROOT/'server/schema.sql').read_text());c.execute("INSERT INTO companies(name,code) VALUES ('A','A'),('B','B')");c.execute('ALTER TABLE budget_month_refs ADD COLUMN details_json TEXT');c.execute('ALTER TABLE budget_month_refs ADD COLUMN declared_cents INTEGER');sql=re.search(r'`(INSERT INTO budget_month_refs.*?)`',(ROOT/'server/routes/budget.js').read_text()).group(1)
  c.execute(sql,[1,'2026-01',100,'a.pdf','[]',100]);c.execute(sql,[1,'2026-01',200,'b.pdf','[]',200]);c.execute(sql,[2,'2026-01',100,'a.pdf','[]',100]);self.assertEqual(c.execute('SELECT company_id,cents FROM budget_month_refs ORDER BY company_id').fetchall(),[(1,200),(2,100)]);self.assertEqual(c.execute('SELECT count(*) FROM ops').fetchone()[0],0)
if __name__=='__main__':
 if len(sys.argv)>1:
  p=pathlib.Path(sys.argv.pop(1));d=detect_pdf(p,p.name);assert (d['kind'],d['meta']['month'],len(d['rows']),total_cents(d['rows']),d['declared'])==('monthly','2026-01',8,14806484,148064.84);print('PDF real: 8 filas, S/ 148,064.84')
 unittest.main()
