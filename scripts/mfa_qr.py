"""Generate a TOTP QR matrix locally. Never log or persist the secret."""
import json,re
from reportlab.graphics.barcode.qrencoder import QRCode,QRErrorCorrectLevel

def mfa_qr(p):
    uri=p['uri']
    if not isinstance(uri,str) or len(uri)>800 or not uri.startswith('otpauth://totp/') or not re.search(r'[?&]secret=[A-Z2-7]{32}(?:&|$)',uri):
        raise ValueError('Formato de autenticación inválido')
    q=QRCode(None,QRErrorCorrectLevel.M);q.addData(uri);q.make()
    print(json.dumps([[int(q.isDark(r,c)) for c in range(q.getModuleCount())] for r in range(q.getModuleCount())]))
