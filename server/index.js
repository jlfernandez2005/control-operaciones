import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {initSchema,seed} from './db.js';
import authRouter from './routes/auth.js';
import opsRouter from './routes/ops.js';
import provRouter from './routes/prov.js';
import ccRouter from './routes/cc.js';
import usersRouter from './routes/users.js';
import compRouter from './routes/companies.js';
import exportRouter from './routes/export.js';
import auditRouter from './routes/audit.js';
import financeRouter from './routes/finance.js';
import budgetRouter from './routes/budget.js';
import flowRouter from './routes/flow.js';
const app=express(), PORT=process.env.PORT||3000, pub=fileURLToPath(new URL('../public/',import.meta.url));
app.disable('x-powered-by');
if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{scriptSrc:["'self'"],scriptSrcAttr:["'none'"],styleSrc:["'self'","'unsafe-inline'"],upgradeInsecureRequests:process.env.NODE_ENV==='production'?[]:null}},strictTransportSecurity:process.env.NODE_ENV==='production'?undefined:false}));
app.use(cookieParser());
app.use('/api',(req,res,next)=>{
 res.set('Cache-Control','no-store');
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   const origin=req.get('origin'), expected=process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
   if((origin && origin!==expected)||req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'Origen no permitido'});
   if(['POST','PUT','PATCH'].includes(req.method)&&!req.is('application/json'))return res.status(415).json({error:'Se requiere JSON'});
 }next();
});
app.use('/api',rateLimit({windowMs:60_000,max:240,standardHeaders:true,legacyHeaders:false,message:{error:'Demasiadas solicitudes'}}));
const standardJson=express.json({limit:'128kb'}), importJson=express.json({limit:'2mb'});
app.use((req,res,next)=>req.path==='/api/finance/preview'?next():['/api/finance/import','/api/finance/import-cash','/api/budget/reference','/api/flow/entries'].includes(req.path)?importJson(req,res,next):standardJson(req,res,next));
// Express 4 no propaga automáticamente rechazos de handlers async.
function wrap(router){for(const l of router.stack){if(l.route){for(const h of l.route.stack){const fn=h.handle;if(fn.constructor.name==='AsyncFunction')h.handle=(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);}}}return router;}
for(const [name,router] of Object.entries({auth:authRouter,ops:opsRouter,prov:provRouter,cc:ccRouter,users:usersRouter,companies:compRouter,export:exportRouter,audit:auditRouter,finance:financeRouter,budget:budgetRouter,flow:flowRouter}))app.use('/api/'+name,wrap(router));
app.use('/api',(_req,res)=>res.status(404).json({error:'No encontrado'}));
app.use(express.static(pub,{setHeaders:(res)=>res.set('Cache-Control','no-cache')}));
app.get('/',(_req,res)=>res.sendFile(path.join(pub,'index.html')));
app.use((err,req,res,next)=>{if(res.headersSent)return next(err);console.error(err.message);res.status(err.status===400?400:err.status===413?413:500).json({error:err.status===400?'JSON inválido':err.status===413?'Solicitud demasiado grande':'Error interno'});});
await initSchema();if(process.env.ADMIN_PASS)await seed();
app.listen(PORT,()=>console.log(`[server] Puerto ${PORT}`));
