const c=document.getElementById('c'),x=c.getContext('2d');
const W=600,H=200,G=170;

// --- POLYFILL roundRect (compatibilidad) ---
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2*r) r = w/2;
    if (h < 2*r) r = h/2;
    this.beginPath();
    this.moveTo(x+r, y);
    this.arcTo(x+w, y, x+w, y+h, r);
    this.arcTo(x+w, y+h, x, y+h, r);
    this.arcTo(x, y+h, x, y, r);
    this.arcTo(x, y, x+w, y, r);
    this.closePath();
    return this;
  };
}

let st='menu',score=0,hi=0,speed=6,obs=[],clouds=[],dots=[],parts=[],frame=0,last=0,duckKey=false;
let prevSt='idle'; 
let caidaRapida = false;

// --- SISTEMA DE LOGROS AMPLIADO ---
const logrosPosibles = [
  { id: 'p1', nombre: 'Primer Salto', desc: 'Salta por primera vez', icono: '🏆' },
  { id: 's100', nombre: 'Corredor', desc: 'Alcanza 100 puntos', icono: '🌟' },
  { id: 's300', nombre: 'Viajero', desc: 'Cambia de bioma', icono: '🌍' },
  { id: 's500', nombre: 'Explorador', desc: 'Alcanza 500 puntos', icono: '🧭' },
  { id: 's1000', nombre: 'Leyenda', desc: 'Alcanza 1000 puntos', icono: '👑' },
  { id: 'd1', nombre: 'Esquivador', desc: 'Agáchate para esquivar', icono: '🦆' },
  { id: 'j10', nombre: 'Saltarín', desc: 'Salta 10 veces en una partida', icono: '🐇' },
  { id: 'night', nombre: 'Noctámbulo', desc: 'Sobrevive al bioma Lluvia', icono: '🌧️' },
  { id: 'volcano', nombre: 'Pies de Fuego', desc: 'Sobrevive al bioma Volcán', icono: '🌋' },
  { id: 'stomp', nombre: 'Pisotón', desc: 'Aplasta a un pájaro saltando', icono: '👟' },
  { id: 'biomas6', nombre: 'Trotamundos', desc: 'Visita los 6 biomas', icono: '🗺️' },
  { id: 'perfect', nombre: 'Pulcro', desc: 'Llega a 300 sin agacharte', icono: '✨' },
  { id: 'ninja', nombre: 'Ninja', desc: 'Esquiva 5 pájaros en una partida', icono: '🥷' }
];
let logrosDesbloqueados = {};
let notificacionLogro = null;
let notificacionTimer = 0;
let saltosPartida = 0;
let biomasVisitados = {}; 
let pajarosEsquivados = 0;
let usoAgacharse = false;

try {
  const saved = localStorage.getItem('dinoLogros');
  if (saved) logrosDesbloqueados = JSON.parse(saved);
} catch(e) {}

function desbloquearLogro(id) {
  if (!logrosDesbloqueados[id]) {
    logrosDesbloqueados[id] = true;
    try { localStorage.setItem('dinoLogros', JSON.stringify(logrosDesbloqueados)); } catch(e) {}
    const logro = logrosPosibles.find(l => l.id === id);
    if (logro) {
      notificacionLogro = logro;
      notificacionTimer = 180; 
    }
  }
}

function actualizarVentanaLogros() {
  const container = document.getElementById('achievements-list');
  if (!container) return;
  container.innerHTML = '';

  logrosPosibles.forEach(logro => {
    const isUnlocked = logrosDesbloqueados[logro.id];
    const item = document.createElement('div');
    item.className = 'achievement-item' + (isUnlocked ? '' : ' achievement-locked');
    
    item.innerHTML = `
      <div class="achievement-icon">${logro.icono}</div>
      <div class="achievement-info">
        <div class="achievement-title">${logro.nombre}</div>
        <div class="achievement-desc">${logro.desc}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

// --- SISTEMA DE BIOMAS ---
const biomas = [
  { nombre: 'Bosque', sky: '#eef2f7', ground: '#cfcfcf', fg: '#3a3a3a', accent: '#e05a3a', bg: '#eef2f7' },
  { nombre: 'Nieve',  sky: '#d0e8f2', ground: '#f0f8ff', fg: '#4a6d8c', accent: '#8cb6d9', bg: '#d0e8f2' },
  { nombre: 'Selva',  sky: '#95d5b2', ground: '#52b788', fg: '#1b4332', accent: '#74c69d', bg: '#95d5b2' },
  { nombre: 'Desierto', sky: '#f4d35e', ground: '#e0a96d', fg: '#6b4c3a', accent: '#ee964b', bg: '#f4d35e' },
  { nombre: 'Lluvia', sky: '#4a5568', ground: '#2d3748', fg: '#e2e8f0', accent: '#63b3ed', bg: '#4a5568' },
  { nombre: 'Volcán', sky: '#1a0505', ground: '#0a0000', fg: '#ff6b6b', accent: '#ffaa00', bg: '#1a0505' }
];
let biomaActual = 0;
let biomaAnterior = 0;
let mazoBiomas = [];
let colorSky, colorGround, colorFg, colorAccent;

let transicionProgreso = 1; 
const VELOCIDAD_TRANSICION = 0.02; 
let climaTimer = 0;

let fondoXCerca = 0;
let fondoXLejos = 0;

function generarFondoRocoso() {
  const arr = [];
  let currentX = 0;
  while(currentX < 2000) {
    currentX += 60 + Math.random() * 100; 
    arr.push({
      x: currentX, w: 60 + Math.random() * 80, h: 30 + Math.random() * 90,
      p1: Math.random() * 0.3 + 0.1, p2: Math.random() * 0.3 + 0.3, p3: Math.random() * 0.3 + 0.6,
      lavaOff1: Math.random() * 10, lavaOff2: Math.random() * 10
    });
  }
  return arr;
}

function generarFondoAleatorio() {
  const arr = [];
  let currentX = 0;
  while(currentX < 2000) {
    currentX += 100 + Math.random() * 150; 
    arr.push({ x: currentX, w: 40 + Math.random() * 50, h: 40 + Math.random() * 80 });
  }
  return arr;
}

const fondoLejano = generarFondoAleatorio();
const fondoCercano = generarFondoAleatorio();
const fondoRocoso = generarFondoRocoso();

function actualizarColores() {
  const b = biomas[biomaActual];
  colorSky = b.sky; colorGround = b.ground; colorFg = b.fg; colorAccent = b.accent;
}
actualizarColores();

function mixColor(c1, c2, t) {
  const hex = (c) => parseInt(c.replace('#',''), 16);
  const r1 = (hex(c1) >> 16) & 255, g1 = (hex(c1) >> 8) & 255, b1 = hex(c1) & 255;
  const r2 = (hex(c2) >> 16) & 255, g2 = (hex(c2) >> 8) & 255, b2 = hex(c2) & 255;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

try{hi=+localStorage.getItem('dinoHi')||0}catch(e){}
const d={y:0,vy:0,duck:false};

// --- MENÚ ---
const menu = document.getElementById('menu');
const opts = document.getElementById('opts');
const credits = document.getElementById('credits');
const achievementsScreen = document.getElementById('achievements-screen');

c.style.opacity = 0;

document.getElementById('btn-play').addEventListener('click', () => {
  menu.classList.remove('active');
  c.style.opacity = 1;
  st = 'idle'; 
  reset();
});

document.getElementById('btn-opts').addEventListener('click', () => {
  menu.classList.remove('active');
  opts.classList.add('active');
});

document.getElementById('btn-back-opts').addEventListener('click', () => {
  opts.classList.remove('active');
  menu.classList.add('active');
});

document.getElementById('btn-credits').addEventListener('click', () => {
  menu.classList.remove('active');
  credits.classList.add('active');
});

document.getElementById('btn-back-credits').addEventListener('click', () => {
  credits.classList.remove('active');
  menu.classList.add('active');
});

document.getElementById('btn-back-achievements').addEventListener('click', () => {
  achievementsScreen.classList.remove('active');
  st = 'pause';
});

let coyote=0,jumpBuf=0;

function reset(){
  score=0;speed=6;obs=[];d.y=0;d.vy=0;frame=0;parts=[];
  
  mazoBiomas = [0,1,2,3,4,5]; 
  mazoBiomas.sort(() => Math.random() - 0.5);
  biomaActual = mazoBiomas.pop();
  biomaAnterior = biomaActual;
  
  actualizarColores();
  transicionProgreso = 1; 
  fondoXCerca = 0;
  fondoXLejos = 0;
  saltosPartida = 0;
  biomasVisitados = {};
  biomasVisitados[biomaActual] = true;
  pajarosEsquivados = 0;
  usoAgacharse = false;
  
  clouds=[{x:150,y:40},{x:420,y:70}];
  dots=Array.from({length:12},()=>({x:Math.random()*W,y:G+6+Math.random()*14}));
}
reset();

function action(){
  if(st==='menu') return; 
  
  if(st!=='run'){ 
    if(st==='over'&&frame<20)return; 
    reset();
    st='run'; 
  }
  
  if (st === 'run') {
    desbloquearLogro('p1');
    if(d.y===0&&!d.duck){ 
      d.vy=10.5; burst(6);
      saltosPartida++;
      if (saltosPartida >= 10) desbloquearLogro('j10');
    }
    else if(d.y>0&&coyote>0&&!d.duck){d.vy=10.5;coyote=0;burst(4);}
    else jumpBuf=6;
  }
}

addEventListener('keydown',e=>{
  if(e.code==='Space'||e.code==='ArrowUp'){
    e.preventDefault();
    if(!e.repeat)action();
  }
  if(e.code==='ArrowDown'){
    e.preventDefault();
    duckKey=true;
    caidaRapida=true;
    usoAgacharse = true;
  }
  if(e.code==='Escape'){
    if(st==='run'){ 
      prevSt=st; st='pause'; 
      if (achievementsScreen.classList.contains('active')) {
        achievementsScreen.classList.remove('active');
      }
    } else if(st==='pause'){ 
      if (achievementsScreen.classList.contains('active')) {
        achievementsScreen.classList.remove('active');
      } else {
        st=prevSt; 
      }
    }
  }
});

addEventListener('keyup',e=>{
  if(e.code==='ArrowDown'){
    duckKey=false;
    caidaRapida=false;
  }
});
addEventListener('blur',()=>{last=performance.now();});

c.addEventListener('pointerdown', e=>{
  if (st === 'pause') {
    actualizarVentanaLogros();
    achievementsScreen.classList.add('active');
    return;
  }
  action();
});

const b=document.getElementById('duck');
b.addEventListener('pointerdown',e=>{e.stopPropagation();duckKey=true;caidaRapida=true;usoAgacharse=true;});
['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>{duckKey=false;caidaRapida=false;}));
b.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();duckKey=true;caidaRapida=true;usoAgacharse=true;}});
b.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){duckKey=false;caidaRapida=false;}});

function burst(n, isLanding = false){
  for(let i=0;i<n;i++){
    if (isLanding) {
      const side = Math.random() > 0.5 ? 1 : -1;
      parts.push({
        x: 44 + (side > 0 ? 30 : 10), y: G - 2,
        vx: side * (1 + Math.random() * 3), vy: -1 - Math.random() * 2,
        life: 15 + Math.random() * 10, max: 25, size: 1 + Math.random() * 2
      });
    } else {
      parts.push({
        x: 44 + Math.random() * 20, y: G - d.y - 2,
        vx: (Math.random() - .5) * 3, vy: -Math.random() * 2.5,
        life: 20 + Math.random() * 15, max: 35, size: 1 + Math.random() * 2
      });
    }
  }
}

function spawn(){
  if(st==='run'&&score<15&&obs.length===0){ if(frame<90)return; }
  const lastO=obs[obs.length-1];
  const gap=Math.max(300,260+Math.random()*260+speed*14);
  if(lastO&&W-lastO.x<gap)return;
  
  if(score>300&&Math.random()<.3){
    obs.push({t:'b',x:W+20,w:34,h:24,h0:20});
  }else{
    const n=Math.random()<.35?2:1;
    obs.push({t:'c',x:W+20,w:n*18+(n-1)*4,h:32+Math.random()*20,n});
  }
}

function hit(){
  const dw=d.duck?56:44, dh=d.duck?16:34;
  const slimeBox = {l:40, r:40+dw-2, t:G-d.y-dh+2, b:G-d.y-2};
  
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    if (o.t === 'b') {
      const birdBottom = G - o.h0;
      const birdTop = birdBottom - o.h;
      const r = {l:o.x+2, r:o.x+o.w-2, t:birdTop, b:birdBottom};
      
      if (slimeBox.l < r.r && slimeBox.r > r.l && slimeBox.t < r.b && slimeBox.b > r.t) {
        if (d.vy < 0 && d.y > 15 && (G - d.y) < r.t + 10) {
          desbloquearLogro('stomp');
          obs.splice(i, 1); 
          d.vy = 12; 
          burst(10); 
          return false; 
        } else {
          if (d.duck) {
            pajarosEsquivados++;
            if (pajarosEsquivados >= 5) desbloquearLogro('ninja');
          }
          return true; 
        }
      }
    } else {
      const oy = G - o.h;
      const r = {l:o.x+3, r:o.x+o.w-3, t:oy+3, b:oy+o.h-3};
      if (slimeBox.l < r.r && slimeBox.r > r.l && slimeBox.t < r.b && slimeBox.b > r.t) {
        return true; 
      }
    }
  }
  return false;
}

function update(dt){
  if(st==='pause') return; 

  if (transicionProgreso < 1) {
    transicionProgreso += VELOCIDAD_TRANSICION * dt;
    if (transicionProgreso >= 1) transicionProgreso = 1;
  }

  if (notificacionTimer > 0) {
    notificacionTimer -= dt;
    if (notificacionTimer <= 0) notificacionLogro = null;
  }

  let estabaEnAire = d.y > 0;
  d.duck=duckKey&&d.y===0;
  d.y+=d.vy*dt;

  // --- GRAVEDAD SEGURA ---
  let gravedad = 0.6;
  if (caidaRapida && d.y > 0) {
    gravedad = 1.6;
  }
  d.vy -= gravedad * dt;
  // Clamp de velocidad vertical: evita deformaciones extremas y NaNs
  d.vy = Math.max(-18, Math.min(14, d.vy));

  if(d.y<=0){
    d.y=0;
    if (estabaEnAire && d.vy < -1) burst(8, true);
    d.vy=0;
  }
  // Clamp extra por si acaso
  if (d.y < 0) d.y = 0;

  if(d.y===0)coyote=5;else coyote=Math.max(0,coyote-dt);
  if(jumpBuf>0){jumpBuf-=dt;if(d.y===0&&!d.duck){d.vy=10.5;jumpBuf=0;burst(4);}}

  speed=Math.min(16,6+score/600);
  score+=dt*speed*.025;
  
  if (score >= 100) desbloquearLogro('s100');
  if (score >= 500) desbloquearLogro('s500');
  if (score >= 1000) desbloquearLogro('s1000');
  if (score >= 300 && !usoAgacharse) desbloquearLogro('perfect');

  if(st === 'run') {
    fondoXCerca -= speed * 0.4 * dt; 
    fondoXLejos -= speed * 0.1 * dt; 
  }

  // --- CAMBIO DE BIOMA ---
  let nuevoBioma = Math.floor(score / 300);
  if (nuevoBioma > 0 && score % 300 < 5) {
    if (!window._ultimoCambio || score - window._ultimoCambio > 50) {
      window._ultimoCambio = score;
      
      if (mazoBiomas.length === 0) {
        for(let i=0; i<biomas.length; i++) {
          if (i !== biomaActual) mazoBiomas.push(i);
        }
        mazoBiomas.sort(() => Math.random() - 0.5);
      }

      biomaAnterior = biomaActual;
      biomaActual = mazoBiomas.pop();
      
      transicionProgreso = 0;
      actualizarColores();
      
      biomasVisitados[biomaActual] = true;
      if (Object.keys(biomasVisitados).length >= biomas.length) desbloquearLogro('biomas6');

      if (biomaActual === 4) desbloquearLogro('night');
      if (biomaActual === 5) desbloquearLogro('volcano');

      for(let i=0; i<20; i++){
        parts.push({x: W/2, y: H/2, vx: (Math.random()-.5)*10, vy: (Math.random()-.5)*10, life: 40, max: 40, size: 2, color: colorAccent});
      }
    }
  }

  obs.forEach(o=>o.x-=speed*dt);
  obs=obs.filter(o=>o.x+o.w>-10);
  clouds.forEach(k=>{k.x-=.5*dt;if(k.x<-50){k.x=W+40;k.y=25+Math.random()*60;}});
  dots.forEach(p=>{p.x-=speed*dt;if(p.x<0){p.x=W;p.y=G+6+Math.random()*14;}});
  
  parts.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=0.25*dt;p.life-=dt;});
  parts=parts.filter(p=>p.life>0);
  
  // --- CLIMAS ---
  if (biomaActual === 1 && st === 'run') {
    for(let i=0; i<3; i++) {
      if(Math.random() < 0.6) {
        parts.push({
          x: Math.random() * W, y: -10, 
          vx: -speed * 0.2 + (Math.random() - 0.5), vy: 1 + Math.random() * 2,
          life: 400, max: 400, size: 1 + Math.random() * 3, color: '#ffffff', esNieve: true 
        });
      }
    }
  }

  if (biomaActual === 4 && st === 'run') {
    for(let i=0; i<6; i++) {
      if(Math.random() < 0.8) {
        parts.push({
          x: Math.random() * W, y: -20, vx: -speed * 0.3, vy: 15 + Math.random()*10,
          life: 30, max: 30, size: 1.5, color: '#a0aec0', esLluvia: true
        });
      }
    }
  }

  if (biomaActual === 5 && st === 'run') {
    for(let i=0; i<2; i++) {
      if(Math.random() < 0.4) {
        parts.push({
          x: Math.random() * W, y: -10, 
          vx: -speed * 0.1, vy: 0.5 + Math.random(), 
          life: 400, max: 400, size: 1 + Math.random() * 2, color: '#884444', esCeniza: true 
        });
      }
    }
  }
  
  climaTimer -= dt;
  if(climaTimer <= 0 && st === 'run') {
    climaTimer = 0.3; 
    if(biomaActual === 3) { parts.push({x: W, y: Math.random()*G, vx: -speed*0.8, vy: 0, life: 150, max: 150, size: 1, color: '#e0a96d'}); }
  }

  spawn();
  if(hit()){
    st='over';frame=0;
    if(score>hi){hi=Math.floor(score);try{localStorage.setItem('dinoHi',hi)}catch(e){}}
  }
}

function drawFondo(anterior, actual, t) {
  const dibujarCapa = (idBioma, opacidad, esCercano) => {
    x.globalAlpha = opacidad;
    const b = biomas[idBioma];
    const arr = esCercano ? fondoCercano : fondoLejano;
    const xOffset = esCercano ? fondoXCerca : fondoXLejos;
    const anchoTotal = 2000; 
    const escala = esCercano ? 1 : 0.6;

    for (let loop = -1; loop <= 1; loop++) {
      arr.forEach(item => {
        let posX = item.x + (xOffset % anchoTotal) + (loop * anchoTotal);
        if (posX < -200 || posX > W + 200) return;

        const h = item.h * escala;
        const w = item.w * escala;
        const y = G;

        if (idBioma === 1) { 
          x.fillStyle = esCercano ? b.ground : b.sky;
          x.beginPath(); x.moveTo(posX, y); x.lineTo(posX + w/2, y - h); x.lineTo(posX + w, y); x.fill();
          x.fillStyle = esCercano ? '#ffffff' : b.sky;
          x.beginPath(); x.moveTo(posX + w*0.3, y - h*0.6); x.lineTo(posX + w/2, y - h); x.lineTo(posX + w*0.7, y - h*0.6); x.fill();
        } else if (idBioma === 2) { 
          x.fillStyle = esCercano ? b.ground : b.sky;
          x.fillRect(posX + w/2 - 6*escala, y - h, 12*escala, h);
          x.beginPath(); x.arc(posX + w/2, y - h, w/2, 0, Math.PI*2); x.fill();
        } else if (idBioma === 3) { 
          x.fillStyle = esCercano ? b.ground : b.sky;
          const alturaEquilatera = (w * Math.sqrt(3)) / 2;
          x.beginPath(); x.moveTo(posX, y); x.lineTo(posX + w/2, y - alturaEquilatera); x.lineTo(posX + w, y); x.fill();
          x.fillStyle = 'rgba(0,0,0,0.1)';
          x.beginPath(); x.moveTo(posX + w/2, y - alturaEquilatera); x.lineTo(posX + w, y); x.lineTo(posX + w/2, y); x.fill();
        } else if (idBioma === 4) { 
          x.fillStyle = esCercano ? '#1a202c' : '#2d3748';
          x.fillRect(posX + w/2 - 5*escala, y - h, 10*escala, h);
          x.beginPath(); x.arc(posX + w/2, y - h, w/2.5, 0, Math.PI*2); x.fill();
        } else if (idBioma === 5) { 
          fondoRocoso.forEach(roca => {
            let rx = roca.x + (xOffset % anchoTotal) + (loop * anchoTotal);
            if (rx < -200 || rx > W + 200) return;
            const rh = roca.h * escala;
            const rw = roca.w * escala;
            x.fillStyle = esCercano ? '#2a0a0a' : '#140000';
            x.beginPath();
            x.moveTo(rx, y);
            x.lineTo(rx + rw * roca.p1, y - rh * 0.6);
            x.lineTo(rx + rw * roca.p2, y - rh);
            x.lineTo(rx + rw * roca.p3, y - rh * 0.7);
            x.lineTo(rx + rw, y);
            x.fill();
            
            if (rh > 50) {
              const lavaT = (Math.sin(frame * 0.05 + roca.lavaOff1) + 1) / 2; 
              const startX = rx + rw * roca.p2;
              const startY = y - rh + 2;
              const endY = y - rh * 0.2;
              
              x.fillStyle = '#ff4d4d';
              x.beginPath();
              x.moveTo(startX - 3, startY);
              x.quadraticCurveTo(startX - 4 + Math.sin(frame*0.1 + roca.lavaOff2)*2, startY + (endY-startY)*0.5, startX - 2, endY);
              x.lineTo(startX + 2, endY);
              x.quadraticCurveTo(startX + 4 + Math.cos(frame*0.1 + roca.lavaOff2)*2, startY + (endY-startY)*0.5, startX + 3, startY);
              x.fill();
              
              if (lavaT > 0.7) {
                x.beginPath();
                x.arc(startX - 2 + Math.sin(frame*0.1)*2, startY + (endY-startY)*0.8, 2, 0, Math.PI*2);
                x.fill();
              }
            }
          });
        } else { 
          x.fillStyle = esCercano ? b.ground : b.sky;
          x.fillRect(posX + w/2 - 5*escala, y - h, 10*escala, h);
          x.beginPath(); x.arc(posX + w/2, y - h, w/2, 0, Math.PI*2); x.fill();
        }
      });
    }
    x.globalAlpha = 1;
  };

  if (t < 1) {
    dibujarCapa(anterior, (1 - t) * 0.5, false);
    dibujarCapa(anterior, (1 - t) * 0.8, true);
    dibujarCapa(actual, t * 0.5, false);
    dibujarCapa(actual, t * 0.8, true);
  } else {
    dibujarCapa(actual, 0.4, false); 
    dibujarCapa(actual, 0.8, true);  
  }
}

function draw(){
  const t = transicionProgreso;
  const cSky = mixColor(biomas[biomaAnterior].sky, biomas[biomaActual].sky, t);
  const cGround = mixColor(biomas[biomaAnterior].ground, biomas[biomaActual].ground, t);
  const cFg = mixColor(biomas[biomaAnterior].fg, biomas[biomaActual].fg, t);
  const cAccent = mixColor(biomas[biomaAnterior].accent, biomas[biomaActual].accent, t);

  x.clearRect(0,0,W,H);
  x.fillStyle = cSky; x.fillRect(0,0,W,G);
  x.globalAlpha=.15;x.fillStyle=cFg;
  x.beginPath();x.arc(W-70,40,22,0,Math.PI*2);x.fill();x.globalAlpha=1;
  
  drawFondo(biomaAnterior, biomaActual, t);

  x.fillStyle = cGround; x.fillRect(0,G,W,H-G);
  x.fillStyle = cFg; x.fillRect(0,G,W,1);
  dots.forEach(p=>x.fillRect(p.x,p.y,3,2));
  
  parts.forEach(p=>{
    x.globalAlpha=p.life/p.max;
    
    if (p.esLluvia) {
      x.fillStyle = p.color;
      x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - 2, p.y + 8);
      x.lineWidth = 1.5; x.strokeStyle = x.fillStyle; x.stroke();
    } else if (p.esNieve || p.esCeniza) {
      x.fillStyle = p.color;
      x.beginPath(); x.arc(p.x, p.y, p.size, 0, Math.PI * 2); x.fill();
    } else {
      x.fillStyle = p.color || cFg;
      x.fillRect(p.x,p.y,p.size,p.size);
    }
  });
  x.globalAlpha=1;
  
  const dx=40,gy=G-d.y;
  
  x.globalAlpha=.15;x.fillStyle='#000';
  x.beginPath();x.ellipse(dx+20,gy-1,d.y>0?14:18,3,0,0,Math.PI*2);x.fill();
  x.globalAlpha=1;

  // --- SLIME (con radios seguros) ---
  const cx = dx + 20;
  const cy = gy - (d.duck ? 10 : 16);
  let rx = d.duck ? 26 : 18; 
  let ry = d.duck ? 10 : 16; 
  
  if (d.y > 0) { 
    const deform = Math.max(-6, Math.min(6, d.vy * 0.6));
    ry += deform; 
    rx -= deform; 
  } else { 
    const squash = Math.sin(frame * 0.3) * 1.5; 
    ry -= squash; rx += squash; 
  }
  // Seguridad: radios siempre positivos y acotados
  rx = Math.max(6, Math.min(40, rx));
  ry = Math.max(6, Math.min(30, ry));

  x.fillStyle = cFg;
  x.beginPath();
  x.moveTo(cx - rx, cy + ry);
  x.quadraticCurveTo(cx - rx, cy - ry, cx, cy - ry);
  x.quadraticCurveTo(cx + rx, cy - ry, cx + rx, cy + ry);
  x.quadraticCurveTo(cx, cy + ry + 4, cx - rx, cy + ry);
  x.fill();

  x.fillStyle = cSky; x.globalAlpha = 0.5;
  x.beginPath(); x.ellipse(cx - rx*0.4, cy - ry*0.4, rx*0.25, ry*0.15, -Math.PI/4, 0, Math.PI*2); x.fill();
  x.globalAlpha = 1;
  x.fillStyle = '#ffffff'; x.globalAlpha = 0.7; x.fillRect(cx - rx*0.5, cy - ry*0.6, 3, 3); x.globalAlpha = 1;

  // --- OBSTÁCULOS ---
  obs.forEach(o=>{
    if(o.t==='c'){
      for(let i=0;i<o.n;i++){
        const ox=o.x+i*22,h=o.h-(i?8:0);
        x.fillStyle=cFg;
        
        if(biomaActual === 1) { 
          x.beginPath(); x.moveTo(ox+9, G-h); x.lineTo(ox-2, G-h*0.3); x.lineTo(ox+20, G-h*0.3); x.fill();
          x.fillRect(ox+7, G-h*0.3, 4, h*0.3);
          x.fillStyle = '#ffffff'; x.fillRect(ox-2, G-h*0.3, 22, 3);
        } else if(biomaActual === 3) { 
          x.fillRect(ox+6, G-h, 6, h);
          x.fillRect(ox, G-h*0.6, 6, 4); x.fillRect(ox, G-h*0.6-8, 4, 8);
          x.fillStyle = cGround; x.fillRect(ox+6, G-h, 2, h);
        } else if(biomaActual === 5) { 
          x.beginPath();
          x.moveTo(ox+2, G); x.lineTo(ox-2, G-h*0.4); x.lineTo(ox+6, G-h);
          x.lineTo(ox+18, G-h*0.9); x.lineTo(ox+24, G-h*0.5); x.lineTo(ox+22, G);
          x.fill();
          x.fillStyle = 'rgba(0,0,0,0.3)';
          x.beginPath();
          x.moveTo(ox+4, G); x.lineTo(ox+6, G-h*0.3); x.lineTo(ox+18, G-h*0.4); x.lineTo(ox+22, G);
          x.fill();
          x.fillStyle = cAccent;
          x.fillRect(ox+8, G-h*0.7, 2, h*0.5);
          x.fillRect(ox+14, G-h*0.5, 2, h*0.3);
          x.fillStyle = cFg; 
        } else {
          x.beginPath();
          x.moveTo(ox+2, G);
          x.lineTo(ox-2, G-h*0.4);
          x.lineTo(ox+6, G-h);
          x.lineTo(ox+18, G-h*0.9);
          x.lineTo(ox+24, G-h*0.5);
          x.lineTo(ox+22, G);
          x.fill();
          x.fillStyle = 'rgba(0,0,0,0.2)';
          x.beginPath();
          x.moveTo(ox+4, G); x.lineTo(ox+6, G-h*0.3); x.lineTo(ox+18, G-h*0.4); x.lineTo(ox+22, G);
          x.fill();
          x.fillStyle = 'rgba(255,255,255,0.15)';
          x.beginPath();
          x.moveTo(ox+6, G-h); x.lineTo(ox+18, G-h*0.9); x.lineTo(ox+14, G-h*0.7); x.lineTo(ox+4, G-h*0.8);
          x.fill();
          x.fillStyle = cFg; 
        }
      }
    } else {
      const up=Math.floor(frame/8)%2;
      const px=o.x, py=G-o.h0-o.h/2; 
      x.fillStyle=cFg;
      x.fillRect(px+4,py-4,26,10); 
      x.fillRect(px+2,py-8,12,8);  
      x.fillRect(px-4,py-6,8,4);   
      x.fillRect(px-6,py-5,3,2);   
      x.fillStyle=cSky;x.fillRect(px+5,py-6,2,2);x.fillStyle=cFg; 
      if(up){ 
        x.fillRect(px+8,py-16,16,12);
        x.fillRect(px+10,py-18,10,4);
      }else{ 
        x.fillRect(px+8,py+4,16,10);
        x.fillRect(px+10,py+12,10,4);
      }
      x.fillRect(px+28,py-2,10,6); 
      x.fillRect(px+36,py-6,6,4);
    }
  });

  // UI
  x.font='bold 15px "Courier New",monospace';x.textAlign='right';
  const f=n=>String(Math.floor(n)).padStart(5,'0');
  x.fillStyle=cFg;x.globalAlpha=0.6; x.fillText('HI '+f(hi)+'  ',W-52,24); x.globalAlpha=1;
  x.fillStyle=cFg;x.fillText(f(score),W-10,24);
  x.textAlign='center';

  // --- NOTIFICACIÓN DE LOGRO ---
  if (notificacionLogro && notificacionTimer > 0) {
    const alpha = Math.min(1, notificacionTimer / 30);
    x.globalAlpha = alpha;
    const wBox = 160;
    const hBox = 26;
    const xBox = W/2 - wBox/2;
    const yBox = 10;

    x.fillStyle = 'rgba(30,30,30,0.9)';
    x.beginPath();
    x.roundRect(xBox, yBox, wBox, hBox, 6);
    x.fill();
    x.strokeStyle = colorAccent;
    x.lineWidth = 2;
    x.stroke();

    x.fillStyle = '#ffffff';
    x.font = '12px "Courier New",monospace';
    x.textAlign = 'left';
    x.fillText(notificacionLogro.icono + ' ' + notificacionLogro.nombre, xBox + 8, yBox + 17);
    x.globalAlpha = 1;
  }

  if(st==='idle'){
    x.fillStyle=cFg;x.font='bold 18px "Courier New",monospace';
    x.fillText('SLIME RUN',W/2,95);
    x.fillStyle=cFg;x.globalAlpha=0.7;x.font='13px "Courier New",monospace';
    x.fillText('Espacio / toca para empezar',W/2,118); x.globalAlpha=1;
  }
  if(st==='over'){
    x.fillStyle=cSky;x.globalAlpha=.85;x.fillRect(0,0,W,H);x.globalAlpha=1;
    x.fillStyle=cAccent;x.font='bold 24px "Courier New",monospace';
    x.fillText('FIN DEL JUEGO',W/2,86);
    x.fillStyle=cFg;x.font='bold 15px "Courier New",monospace';
    x.fillText('PUNTOS: '+Math.floor(score),W/2,110);
    x.fillStyle=cFg;x.globalAlpha=0.7;x.font='13px "Courier New",monospace';
    x.fillText('Espacio / toca para reiniciar',W/2,132); x.globalAlpha=1;
  }
  
  if(st==='pause'){
    x.fillStyle=cSky;x.globalAlpha=.85;x.fillRect(0,0,W,H);x.globalAlpha=1;
    x.fillStyle=cFg;x.font='bold 24px "Courier New",monospace';
    x.textAlign = 'center';
    x.fillText('PAUSA',W/2,60);
    x.fillStyle=cFg;x.font='13px "Courier New",monospace';
    x.fillText('Pulsa Escape para continuar',W/2,85);
    
    x.fillStyle = 'rgba(255,255,255,0.1)';
    x.beginPath(); x.roundRect(W/2 - 60, 130, 120, 25, 4); x.fill();
    x.strokeStyle = cFg; x.lineWidth = 1; x.stroke();
    x.fillStyle = cFg; x.font = 'bold 12px "Courier New",monospace';
    x.fillText('VER LOGROS', W/2, 147);
    x.globalAlpha = 1;
  }
}

function loop(t){
  // dt acotado para evitar saltos enormes en caída rápida
  let dt = (t - last) / 16.67 || 1;
  if (!isFinite(dt) || dt <= 0) dt = 1;
  dt = Math.min(2.0, dt); // más seguro que 2.5
  last = t;
  if(st==='run'||st==='pause')update(dt); 
  if(st!=='pause') frame+=dt; 
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);