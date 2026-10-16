/* Browser-local color engine; shared by the worker, fallback and asset builder. */
(function(root){'use strict';
const clamp=x=>Math.max(0,Math.min(1,x));
function curve(x,a){x=clamp(x)*4;const i=Math.min(3,x|0);return a[i]+(a[i+1]-a[i])*(x-i)}
function channel(h,s,l,n){const a=s*Math.min(l,1-l),k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))}
function color(h){return[channel(h,1,.5,0)-.5,channel(h,1,.5,8)-.5,channel(h,1,.5,4)-.5]}
function blur(data,w,h,r){r=Math.max(0,Math.round(r));if(!r)return new Uint8ClampedArray(data);const temp=new Uint8ClampedArray(data.length),out=new Uint8ClampedArray(data.length),div=2*r+1;
for(let y=0;y<h;y++){for(let k=0;k<3;k++){let sum=0;for(let q=-r;q<=r;q++)sum+=data[(y*w+Math.max(0,Math.min(w-1,q)))*4+k];for(let x=0;x<w;x++){const i=(y*w+x)*4+k;temp[i]=sum/div;sum+=data[(y*w+Math.min(w-1,x+r+1))*4+k]-data[(y*w+Math.max(0,x-r))*4+k]}}}
for(let x=0;x<w;x++){for(let k=0;k<3;k++){let sum=0;for(let q=-r;q<=r;q++)sum+=temp[(Math.max(0,Math.min(h-1,q))*w+x)*4+k];for(let y=0;y<h;y++){const i=(y*w+x)*4+k;out[i]=sum/div;sum+=temp[(Math.min(h-1,y+r+1)*w+x)*4+k]-temp[(Math.max(0,y-r)*w+x)*4+k]}}}for(let i=3;i<out.length;i+=4)out[i]=255;return out}
function gaussian(data,w,h,sigma){if(sigma<.4)return new Uint8ClampedArray(data);const radius=Math.max(1,Math.round(sigma*.58));let d=data;for(let i=0;i<3;i++)d=blur(d,w,h,radius);return d}
function colorPass(image,v,cv){const {width:w,height:h}=image,src=image.data,out=new Uint8ClampedArray(src.length),scale=w/1440;
const small=(v.texture||v.sharp||v.noise)?gaussian(src,w,h,Math.max(.6,1.2*scale)):null,large=v.clarity?gaussian(src,w,h,14*scale):null;
const detail=v.texture*.006+v.sharp*.012-v.noise*.009,local=v.clarity*.012,exposure=2**v.exposure,contrast=1+v.contrast*.008+v.dehaze*.005,offset=.5-v.dehaze*.0008;
const wbR=v.temp*.0015+v.tint*.0005,wbG=-v.tint*.001,wbB=-v.temp*.0015,grade=['sh','mid','hi','global'].map(z=>({color:color(v[z+'Hue']),sat:v[z+'Sat']*.004,lum:v[z+'Lum']*.002}));
const centers=[0,30,60,120,180,240,275,315],hsl=[];for(let j=0;j<8;j++){const dh=v['hsl'+j+'_0'],ds=v['hsl'+j+'_1'],dl=v['hsl'+j+'_2'];if(dh||ds||dl)hsl.push([centers[j],j<3?40:65,dh*.35,ds*.01,dl*.003])}
const baseSat=1+v.saturation*.01,vibrance=v.vibrance*.015,balance=v.balance/200,exp=1+v.blend/50,gs=1+Math.floor(v.grainSize/15),grain=v.grain*.0007;
for(let i=0,p=0;i<src.length;i+=4,p++){let r=src[i]/255,g=src[i+1]/255,b=src[i+2]/255;const y=.2126*r+.7152*g+.0722*b;
if(small){r+=(r-small[i]/255)*detail;g+=(g-small[i+1]/255)*detail;b+=(b-small[i+2]/255)*detail}if(large){r+=(r-large[i]/255)*local;g+=(g-large[i+1]/255)*local;b+=(b-large[i+2]/255)*local}
const om=1-y,yy=y*y,ss=om*om,tone=(v.shadows*ss+v.highlights*yy+v.blacks*ss*ss*om+v.whites*yy*yy*y)*.003;
r=clamp(((r+wbR)*exposure+tone-.5)*contrast+offset);g=clamp(((g+wbG)*exposure+tone-.5)*contrast+offset);b=clamp(((b+wbB)*exposure+tone-.5)*contrast+offset);
const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;let l=(max+min)/2,s=delta?delta/(1-Math.abs(2*l-1)):0,hu=0;if(delta){hu=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;hu=(hu*60+360)%360}
let dh=0,ds=0,dl=0;for(let j=0;j<hsl.length;j++){const a=hsl[j];let d=Math.abs(hu-a[0]);d=Math.min(d,360-d);const weight=Math.max(0,1-d/a[1]);dh+=a[2]*weight;ds+=a[3]*weight;dl+=a[4]*weight}hu=(hu+dh+360)%360;s=clamp(s*(baseSat+ds+vibrance*(1-s)));l=clamp(l+dl);r=channel(hu,s,l,0);g=channel(hu,s,l,8);b=channel(hu,s,l,4);
const by=clamp(y+balance),weights=[(1-by)**exp,4*by*(1-by),by**exp,1];for(let j=0;j<4;j++){const z=grade[j],weight=weights[j];if(!z.sat&&!z.lum)continue;r+=(z.color[0]*z.sat+z.lum)*weight;g+=(z.color[1]*z.sat+z.lum)*weight;b+=(z.color[2]*z.sat+z.lum)*weight}
r=curve(curve(r,cv.RGB),cv.R);g=curve(curve(g,cv.RGB),cv.G);b=curve(curve(b,cv.RGB),cv.B);
const nx=(p%w)/w-.5,ny=Math.floor(p/w)/h-.5,shade=(nx*nx+ny*ny)*v.vignette*.004,seed=Math.floor((p%w)/gs)+Math.floor(Math.floor(p/w)/gs)*7919,noise=grain?((Math.sin(seed*12.9898)*43758.5453)%1)*grain:0;out[i]=clamp(r-shade+noise)*255;out[i+1]=clamp(g-shade+noise)*255;out[i+2]=clamp(b-shade+noise)*255;out[i+3]=255}
return{data:out,width:w,height:h}}
function effects(image,fx){const {width:w,height:h}=image,src=image.data,scale=w/1440,out=new Uint8ClampedArray(src);if(fx.blur){const blurred=gaussian(src,w,h,fx.blur/100*9*scale),a=Math.min(.95,fx.blur/100);for(let i=0;i<out.length;i+=4)for(let k=0;k<3;k++)out[i+k]+=(blurred[i+k]-out[i+k])*a}
if(fx.diffusion){const blurred=gaussian(src,w,h,14*scale),a=fx.diffusion/100*.32;for(let i=0;i<out.length;i+=4)for(let k=0;k<3;k++)out[i+k]+=((255-out[i+k])*blurred[i+k]/255)*a}
if(fx.bloom){const mask=new Uint8ClampedArray(src.length);for(let i=0;i<src.length;i+=4){const lum=(.2126*src[i]+.7152*src[i+1]+.0722*src[i+2])/255,m=Math.max(0,(lum-.58)/.42)**1.5;mask[i]=src[i]*m;mask[i+1]=src[i+1]*m;mask[i+2]=src[i+2]*m;mask[i+3]=255}const blurred=gaussian(mask,w,h,22*scale),a=fx.bloom/100*.9;for(let i=0;i<out.length;i+=4)for(let k=0;k<3;k++)out[i+k]+=((255-out[i+k])*blurred[i+k]/255)*a}return{data:out,width:w,height:h}}
function resize(image,maxEdge){const ratio=Math.min(1,maxEdge/Math.max(image.width,image.height));if(ratio===1)return image;const w=Math.round(image.width*ratio),h=Math.round(image.height*ratio),out=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(image.width-1,Math.floor(x/ratio)),sy=Math.min(image.height-1,Math.floor(y/ratio)),a=(sy*image.width+sx)*4,b=(y*w+x)*4;out[b]=image.data[a];out[b+1]=image.data[a+1];out[b+2]=image.data[a+2];out[b+3]=255}return{data:out,width:w,height:h}}
root.CinemaEngine={colorPass,effects,resize,render:(image,v,cv,fx)=>effects(colorPass(image,v,cv),fx)};
})(typeof self!=='undefined'?self:globalThis);
