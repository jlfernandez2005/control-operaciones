// Limits apply before Zod to structured JSON, not to lengths of encoded files.
// Existing import schema permits up to 3000 detail rows.
export function requestShapeOK(value) {
  const maxNodes=50000, maxDepth=20, maxArray=3000, maxKeys=128;
  const stack=[[value,0]];
  let count=0;
  while(stack.length){
    const [v,depth]=stack.pop();
    if(++count>maxNodes || depth>maxDepth) return false;
    if(v===null || typeof v!=='object') continue;
    const keys=Array.isArray(v)?null:Object.keys(v);
    const n=keys?keys.length:v.length;
    if(n>(keys?maxKeys:maxArray) || count+stack.length+n>maxNodes) return false;
    if(keys){for(const k of keys)stack.push([v[k],depth+1]);}
    else{for(let i=0;i<n;i++)stack.push([v[i],depth+1]);}
  }
  return true;
}
