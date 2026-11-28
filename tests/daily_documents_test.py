import unittest,sys,subprocess,json,io
from pathlib import Path
from openpyxl import load_workbook
class DailyDocs(unittest.TestCase):
 def setUp(self):
  self.p={'from':'2026-11-27','to':'2026-11-27','company':'Institución de prueba','rows':[dict(id=1,date='2026-11-27',concept='=1+1',receipt='F001-001',cents=10005,account='00000000000000000001',bank='BCP',provider='Proveedor ficticio',ruc='00000001',order='1',status='Pendiente'),dict(id=2,date='2026-11-27',concept='Servicio ficticio',receipt='F002',cents=20010,account='••••1234',bank='Interbank',provider='Ejemplo',ruc='',order='2',status='Pendiente')],'totals':{'count':2,'total':30015,'paid':0,'pending':30015},'full':False,'filters':{}}
 def export(self,fmt):return subprocess.check_output([sys.executable,'scripts/finance_io.py','daily-'+fmt],input=json.dumps(self.p).encode())
 def test_pdf(self):
  raw=self.export('pdf');self.assertTrue(raw.startswith(b'%PDF'));text=subprocess.check_output(['pdftotext','-layout','-','-'],input=raw).decode();self.assertIn('TOTAL A PAGAR',text);self.assertIn('300.15',text);self.assertIn('NOVIEMBRE 2026',text)
 def test_excel(self):
  wb=load_workbook(io.BytesIO(self.export('xlsx')));s=wb.active;self.assertEqual(s['B9'].data_type,'s');self.assertEqual(s['B9'].value,'=1+1');self.assertEqual(s['E9'].value,'00000000000000000001');self.assertEqual(s['D11'].value,300.15);self.assertEqual(len(s._images),3);self.assertEqual(s.page_setup.orientation,'landscape');self.assertEqual(s['C11'].value,'TOTAL A PAGAR')
if __name__=='__main__':unittest.main()
