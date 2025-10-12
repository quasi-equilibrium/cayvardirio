/* ============= Storm Night: Tea Runner — FILE-BASED ASSETS (L1+L2) =============
   Klasör yapısı:
   /index.html
   /sketch.js
   /assets/
     /img/ (splash.png, bg1.png, bg1_alt.png, l2_bg1.png, l2_bg2.png,
            player.png, spoon.png, ghost.png, alien.png, key.png, coin.png,
            chest_closed.png, chest_open.png,
            l2_trap.png, l2_finger.png, l2_nazar.png, l2_honey.png,
            l2_mirror.png, l2_swing.png, l2_beak.png, l2_player.png,
            l2_death.png (ya da .gif), l2_flask_closed.png, l2_flask_open.png,
            death_l1.gif)
     /audio/ (bg_music.wav, shoot.wav, door.wav, lightning.wav,
              l2_bg_music.wav, l2_shoot.wav, l2_door.wav, l2_finger.wav)
============================================================================== */

const PATH = { img: "assets/img/", audio: "assets/audio/" };

/* === (1) Sabitler & Tema === */
const WORLD_W = 2000, WORLD_H = 1400;
const VIEW_W  = 960,  VIEW_H  = 540;

const PLAYER_W = 36*1.3, PLAYER_H = 36*1.3; // %30 büyütme (oyuncu)
const SPOON_W  = 46, SPOON_H = 58;
const ALIEN_W  = 42*1.3, ALIEN_H = 30*1.3;   // çay altlığı %30 büyüdü
const GHOST_W  = 28*1.2, GHOST_H = 28*1.2;

const KEY_W = 28, KEY_H = 28;
const COIN_W = 20*1.4, COIN_H = 20*1.4;
const CHEST_W = 36, CHEST_H = 30;

const PLAYER_SPEED = 160;
const BULLET_SPEED = 480;
const SHOOT_CD_MS  = 260;

const HP_MAX = 100;
const DMG_GHOST = 15;
const DMG_SPOON = 25;
const DMG_ALIEN = 6; // alien (çay altlığı) mermisi %50 azaltıldı

const SHIELD_REDUCE = 0.85; // %85 azaltma (L1 shield)
const SHIELD_TIME_MS = 10000;
const L2_INVULN_TIME_MS = 30000; // Nazar

const KEYS_NEEDED = 3;
const LEVEL_TIME  = 180; // 3:00

const CHEST_SPAWN_EVERY = 10;
const GUARANTEE_KEYS_WINDOW_L1 = 90;
const GUARANTEE_KEYS_WINDOW_L2 = 120;
const GUARANTEE_KEYS_COUNT     = 2;

const THEME = {
  uiBlack: [0,0,0],
  uiWhite: [255,255,255],
  hpG: [60,200,120],
  hpR: [220,70,70],
  shield: [120,200,255],
  teaBullet: [145,90,50],
  enemyRed: [230,60,60],
  thorn: [70,70,90],
  doorArrow: [240,200,60],
  moveArrow: [230,230,255],
  rain: [200,200,255,90],
  compass: [255,220,90]
};
const RAIN_COUNT = 160;
const BASE_FLASH_CHANCE = 0.009;
const AOE_RADIUS_BASE = 60;

// Tam ekran butonu (HP barı yanına)
const FS_BTN = { x: 240, y: 10, w: 24, h: 16 };

/* === (2) Durum === */
let px,py,vx=0,vy=0,lastShoot=0,centerCam;
let hp, shieldUntil=0, invulUntil=0;
let scoreTotal=0, bestTotal=0;
let chapter=0, level=0, timeLeft, gameState="menu";
let paused=false;

let coins=[], thorns=[], thornStayTime=0;
let enemies=[], bullets=[], enemyBullets=[];
let chests=[], loots=[], chestSpawnClock=0;
let openedChestsKeysGiven=0, openedFlasksKeysGiven=0;
let lightTelegraphs=[], lightStrikes=[];
let keyCount=0, doorJustActivated=false;
let lastMoveDir={x:1,y:0};
let deathPhase=null, deathStart=0, zoomScale=1;
let splashAlpha=0, splashFadeDir=1;
let bgBrightness=1.0, masterVol=0.8;
let levelStartTime=0, waveClock=0;
let transitionStart=0;

/* === (3) L2 Özel === */
let isL2=false;
let l2_traps=[], l2_fingers=[], l2_telegraphs=[];
let l2_flasks=[];
let rain=[];

/* === (4) Görseller === */
let splashImg,bg1Img,bg1AltImg,bgDefImg;
let playerImg,spoonImg,alienImg,ghostImg,keyImg,coinImg,chestClosedImg,chestOpenImg;
let l2_bg1,l2_bg2,l2_trap,l2_finger,l2_nazar,l2_honey,l2_mirror,l2_swing,l2_beak,l2_player,l2_death,l2_flaskC,l2_flaskO;
let deathGifL1;

/* === (5) Sesler === */
let sfxShoot,sfxDoor,sfxLightning,musicBg;
let l2_musicBg,l2_sfxShoot,l2_sfxDoor,l2_sfxFinger;

/* === (6) Yardımcılar === */
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function dist2(ax,ay,bx,by){ let dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function now(){ return millis(); }
function secondsSince(ms){ return (now()-ms)/1000; }
function hasShield(){ return now() < shieldUntil; }
function hasInvul(){ return now() < invulUntil; }
function randInWorld(m=80){ return {x:random(m,WORLD_W-m), y:random(m,WORLD_H-m)}; }
function worldClamp(){ px=clamp(px,20,WORLD_W-20); py=clamp(py,20,WORLD_H-20); }
function screenToWorldX(x){ return x + (centerCam.x - VIEW_W/2); }
function screenToWorldY(y){ return y + (centerCam.y - VIEW_H/2); }
function setGlobalVolume(v){ try{ if (typeof masterVolume==='function') masterVolume(v); }catch(e){} }

// Çıkış kapısı bölgesi
function getDoorZone(){
  if (!isL2){ // L1: sağ-üst %20x%20
    return { x: WORLD_W*0.8, y: 0, w: WORLD_W*0.2, h: WORLD_H*0.2 };
  } else {    // L2: orta-alt %20x%20
    return { x: WORLD_W*0.4, y: WORLD_H*0.8, w: WORLD_W*0.2, h: WORLD_H*0.2 };
  }
}

/* ========================= LEVEL / ORTAK ========================= */
function baseResetCommon(){
  const p=randInWorld(200); px=p.x; py=p.y; vx=vy=0; worldClamp();
  hp=HP_MAX; keyCount=0; doorJustActivated=false;
  timeLeft=LEVEL_TIME; enemies=[]; enemyBullets=[]; bullets=[];
  coins=[]; loots=[]; chests=[]; thorns=[]; thornStayTime=0;
  lightTelegraphs=[]; lightStrikes=[];
  l2_traps=[]; l2_fingers=[]; l2_telegraphs=[]; l2_flasks=[];
  shieldUntil=0; invulUntil=0;
  rain=[]; for (let i=0;i<RAIN_COUNT;i++) rain.push({x:random(WORLD_W),y:random(WORLD_H),v:600+random(300)});
  waveClock=0; chestSpawnClock=0;
  openedChestsKeysGiven=0; openedFlasksKeysGiven=0;
  levelStartTime=now();
}

function resetLevel(){
  baseResetCommon();
  isL2 = (level===1);
  if (!isL2){ // L1
    spawnThorns(10);
    for(let i=0;i<3;i++) coins.push({...randInWorld(100), taken:false});
  } else { // L2
    for(let i=0;i<6;i++) l2_flasks.push({...randInWorld(140), open:false, alive:true});
    for(let i=0;i<8;i++) l2_traps.push({...randInWorld(120)});
    for(let i=0;i<4;i++) l2_fingers.push({});
  }
}

function nextLevel(){
  level++;
  if (level >= 5){
    chapter++;
    if (chapter>=3){ gameState="gameover"; updateBest(); return; }
    level=0;
  }
  resetLevel();
}

function resetChapter(first=false){
  level=0; resetLevel();
  if (!first && sfxDoor) sfxDoor.play();
}

function updateBest(){
  try{
    const b=Number(localStorage.getItem("tea_runner_best")||"0");
    if (scoreTotal>b) localStorage.setItem("tea_runner_best", String(scoreTotal));
    bestTotal=Number(localStorage.getItem("tea_runner_best")||"0");
  }catch(e){ bestTotal=bestTotal||0; }
}

/* ========================= L1 İçerikleri ========================= */
function spawnThorns(n){
  for(let i=0;i<n;i++){
    const p=randInWorld(120); const w=random(120,240), h=random(60,160);
    thorns.push({x:p.x,y:p.y,w,h});
  }
}
function drawThorns(){
  fill(THEME.thorn[0],THEME.thorn[1],THEME.thorn[2]);
  for (let t of thorns){
    rect(t.x,t.y,t.w,t.h,6);
    fill(120,120,140,80);
    for (let i=0;i<8;i++){
      triangle(t.x+random(t.w), t.y+random(t.h),
               t.x+random(t.w), t.y+random(t.h),
               t.x+random(t.w), t.y+random(t.h));
    }
    fill(THEME.thorn[0],THEME.thorn[1],THEME.thorn[2]);
  }
}
function updateThorns(){
  let on=false;
  for (let t of thorns){
    if (px>t.x && px<t.x+t.w && py>t.y && py<t.y+t.h){
      on=true;
      if (thornStayTime<2000){
        if (frameCount%20===0) damagePlayerTyped(8,"thorn");
      } else {
        if (frameCount%10===0){
          const ang=random(TWO_PI); px+=cos(ang)*6; py+=sin(ang)*6; worldClamp();
        }
      }
      break;
    }
  }
  if (on) thornStayTime+=deltaTime; else thornStayTime=0;
}

/* Sandık */
function spawnChest(){ const p=randInWorld(140); chests.push({x:p.x,y:p.y,open:false,alive:true,despawnAt:null}); }
function trySpawnChest(dt){ chestSpawnClock+=dt; if (chestSpawnClock>=CHEST_SPAWN_EVERY){ chestSpawnClock=0; spawnChest(); } }
function openChest(c){
  if (c.open) return;
  c.open = true;
  const t = secondsSince(levelStartTime);
  let drop = "none";

  // İlk 90 sn min 2 key
  if (t < GUARANTEE_KEYS_WINDOW_L1 && openedChestsKeysGiven < GUARANTEE_KEYS_COUNT){
    drop = "key";
    openedChestsKeysGiven++;
  } else {
    // L1: %25 shield, %20 key, %30 coin, %25 none
    const r = random();
    if (r < 0.25) drop = "shield";
    else if (r < 0.45) drop = "key";
    else if (r < 0.75) drop = "coin";
    else drop = "none";
  }

  if (drop === "shield") loots.push({x:c.x, y:c.y, type:"shield", alive:true, origin:c});
  if (drop === "key")    loots.push({x:c.x, y:c.y, type:"key",    alive:true, origin:c});
  if (drop === "coin")   coins.push({x:c.x + random(-6,6), y:c.y + random(-6,6), taken:false, originChest:c});
  if (drop === "none")   c.despawnAt = now() + 5000; // BOŞ ise 5 sn
}

/* ========================= L2 İçerikleri ========================= */
// Parmak (telegraph + darbe)
function l2SpawnFingerTelegraph(){
  const p=randInWorld(120);
  l2_telegraphs.push({x:p.x,y:p.y, tHit:now()+1000, type:"finger"});
}
function l2MaybeFinger(){ if (random()<0.01){ l2SpawnFingerTelegraph(); } }
function l2UpdateTelegraphs(){
  const t=now(); const keep=[];
  for (let g of l2_telegraphs){
    if (t>=g.tHit){
      if (g.type==="finger"){
        if (l2_sfxFinger) l2_sfxFinger.play();
        if (dist2(px,py,g.x,g.y) < (22*22) && !hasInvul()) damagePlayerTyped(Math.round(HP_MAX*0.30),"finger");
      }
    } else keep.push(g);
  }
  l2_telegraphs.length=0; l2_telegraphs.push(...keep);
}
// Kuş kapanı
let l2_trapHold = {until:0, invisible:false};
function l2UpdateTraps(){
  if (now()<l2_trapHold.until){} else { l2_trapHold.invisible=false; }
  for (let t of l2_traps){
    const tx = t.x ?? (t.x=randInWorld(100).x);
    const ty = t.y ?? (t.y=randInWorld(100).y);
    if (dist2(px,py,tx,ty) < (26*26)){
      if (now()>=l2_trapHold.until){
        l2_trapHold.until = now()+1000; l2_trapHold.invisible = true;
        setTimeout(()=>{
          if (!hasInvul()) damagePlayerTyped(Math.round(HP_MAX*0.30), "trap");
          const q=randInWorld(200); px=q.x; py=q.y; worldClamp();
          l2_trapHold.invisible=false;
        },1000);
      }
      break;
    }
  }
}
// Suluk (kapalı/açık)
function l2OpenFlask(f){
  if (f.open) return;
  f.open = true;
  const t = secondsSince(levelStartTime);
  let drop = "none";

  // İlk 120 sn min 2 key
  if (t < GUARANTEE_KEYS_WINDOW_L2 && openedFlasksKeysGiven < GUARANTEE_KEYS_COUNT){
    drop = "key";
    openedFlasksKeysGiven++;
  } else {
    // L2: %25 nazar, %15 key, %30 honey, %30 none
    const r = random();
    if (r < 0.25) drop = "nazar";
    else if (r < 0.40) drop = "key";
    else if (r < 0.70) drop = "honey";
    else drop = "none";
  }

  if (drop === "nazar") loots.push({x:f.x, y:f.y, type:"nazar", alive:true, origin:f});
  if (drop === "key")   loots.push({x:f.x, y:f.y, type:"key",   alive:true, origin:f});
  if (drop === "honey") coins.push({x:f.x + random(-6,6), y:f.y + random(-6,6), taken:false, originFlask:f});
  if (drop === "none")  f.despawnAt = now() + 5000;
}

/* ========================= Düşmanlar ========================= */
function spawnEnemy(type){
  // oyuncuya çok yakın doğmasın
  let tries = 0, x=0, y=0;
  do{
    const side = floor(random(4));
    if (side===0){ x=random(WORLD_W); y=-40; }
    if (side===1){ x=random(WORLD_W); y=WORLD_H+40; }
    if (side===2){ x=-40; y=random(WORLD_H); }
    if (side===3){ x=WORLD_W+40; y=random(WORLD_H); }
    tries++;
  } while (tries < 10 && dist2(x,y,px,py) < (320*320));
  enemies.push({type, x, y, vx:0, vy:0, cd:0, alive:true});
}
function updateEnemies(dt){
  enemies = enemies.filter(e=>e.alive);
  const t=secondsSince(levelStartTime);
  waveClock+=dt;
  let spawnRate = (t>100)?2.0:1.0;
  const spawnInterval = 2.5/spawnRate;

  if (waveClock>=spawnInterval){
    waveClock=0;
    if (!isL2){
      if (t<10){ spawnEnemy("ghost"); }
      else if (t<20){ if(random()<0.6)spawnEnemy("ghost"); if(random()<0.5)spawnEnemy("spoon"); }
      else if (t<60){ if(random()<0.7)spawnEnemy("ghost"); if(random()<0.4)spawnEnemy("spoon"); }
      else { if(random()<0.7)spawnEnemy("ghost"); if(random()<0.5)spawnEnemy("spoon"); if(random()<0.3)spawnEnemy("alien"); }
    } else {
      const r=random();
      if (r<0.34) spawnEnemy("mirror");
      else if (r<0.67) spawnEnemy("swing");
      else spawnEnemy("beak");
    }
  }

  for (let e of enemies){
    const dx=px-e.x, dy=py-e.y, d=max(1,Math.hypot(dx,dy));

    if (!isL2){
      if (e.type==="ghost"){
        const sp=120; e.x+=(dx/d)*sp*dt; e.y+=(dy/d)*sp*dt;
        if (dist2(px,py,e.x,e.y) < 22*22){
          if(!hasInvul()) damagePlayerTyped(DMG_GHOST,"ghost");
          enemyKnockbackFrom(e.x,e.y);
        }
      } else if (e.type==="spoon"){
        const sp=150; e.x+=(dx/d)*sp*dt; e.y+=(dy/d)*sp*dt;
        if (dist2(px,py,e.x,e.y) < 28*28){
          if(!hasInvul()) damagePlayerTyped(DMG_SPOON,"spoonExplosion");
          enemyKnockbackFrom(e.x,e.y);
          e.alive=false;
        }
      } else if (e.type==="alien"){
        const base=atan2(dy,dx), ang=base+sin(frameCount*0.03)*0.6;
        const sp=110; e.x+=cos(ang)*sp*dt; e.y+=sin(ang)*sp*dt;
        e.cd-=dt; if (e.cd<=0){ shootEnemyBullet(e.x,e.y, px,py); e.cd=1.6; }
        if (dist2(px,py,e.x,e.y) < 24*24){
          if(!hasInvul()) damagePlayerTyped(DMG_GHOST,"alienTouch");
          enemyKnockbackFrom(e.x,e.y);
        }
      }
    } else {
      if (e.type==="mirror"){
        if (dist2(px,py,e.x,e.y) < 26*26){
          e.alive=false; coins.push({x:e.x, y:e.y, taken:false});
        }
      } else if (e.type==="swing"){
        e.x += Math.sin(frameCount*0.03)*180*dt;
        if (dist2(px,py,e.x,e.y) < 28*28){
          if(!hasInvul()) damagePlayerTyped(Math.round(HP_MAX*0.30),"swing");
          enemyKnockbackFrom(e.x,e.y,70);
        }
      } else if (e.type==="beak"){
        e.cd -= dt;
        if (e.cd<=0){
          e.cd = 1.4;
          for (let i=-1;i<=1;i++){
            const ang = Math.atan2(dy,dx) + i*0.15;
            enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(ang)*300,vy:Math.sin(ang)*300,alive:true,type:"beak"});
          }
        }
        if (dist2(px,py,e.x,e.y) < 26*26){
          if(!hasInvul()) damagePlayerTyped(Math.round(HP_MAX*0.50),"beakTouch");
          enemyKnockbackFrom(e.x,e.y);
        }
      }
    }

    e.x=clamp(e.x,-60,WORLD_W+60);
    e.y=clamp(e.y,-60,WORLD_H+60);
  }
}
function enemyKnockbackFrom(x,y, mul=40){
  const dx=px-x, dy=py-y; const d=max(1,Math.hypot(dx,dy));
  px += (dx/d)*mul; py += (dy/d)*mul; worldClamp();
}
function shootEnemyBullet(x,y,tx,ty){
  const dx=tx-x, dy=ty-y, d=max(1,Math.hypot(dx,dy));
  enemyBullets.push({x,y,vx:dx/d*280,vy:dy/d*280,alive:true,type:"alien"});
}
function updateEnemyBullets(dt){
  enemyBullets = enemyBullets.filter(b=>b.alive);
  for (let b of enemyBullets){
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    if (b.x<-50||b.y<-50||b.x>WORLD_W+50||b.y>WORLD_H+50) b.alive=false;
    if (dist2(px,py,b.x,b.y)<18*18){
      if(!hasInvul()) damagePlayerTyped(b.type==="beak"?Math.round(HP_MAX*0.03):DMG_ALIEN, "enemyBullet");
      b.alive=false;
    }
  }
}

/* ========================= Oyuncu / Mermi ========================= */
function effectiveDamage(amount, type){
  if (hasInvul()) return 0;
  if (hasShield()){
    const reduced=Math.ceil(amount*(1.0-SHIELD_REDUCE));
    if (type==="spoonExplosion") return Math.max(Math.ceil(amount*0.20), reduced);
    return reduced;
  }
  return amount;
}
function damagePlayerTyped(amount, type){
  const dmg=effectiveDamage(amount,type);
  if (dmg<=0) return;
  hp-=dmg; if (hp<=0) startDeathSequence();
}

/* L1 mermisi — 3 kıvrımlı damla */
function shootPlayer_L1(){
  const t=now(); if (t-lastShoot<SHOOT_CD_MS) return; lastShoot=t;
  const mx=screenToWorldX(mouseX), my=screenToWorldY(mouseY);
  const base=atan2(my-py,mx-px); const spreads=[-0.22,0,0.22];
  for (let s of spreads){
    const a=base+s;
    bullets.push({x:px,y:py,vx:cos(a)*BULLET_SPEED,vy:sin(a)*BULLET_SPEED,
      alive:true,life:1.2+random(-0.2,0.2),r:5+random(-1,1),curveA:random(60,100),curveF:random(4,8),phase:random(TWO_PI),
      ax:0,ay:0, wave:false, reflect:false});
  }
  if (sfxShoot) sfxShoot.play();
}
/* L2 mermisi — 45°’lik büyüyen yay (arc) */
function shootPlayer_L2(){
  const t=now(); if (t-lastShoot<SHOOT_CD_MS) return; lastShoot=t;
  const mx=screenToWorldX(mouseX), my=screenToWorldY(mouseY);
  const aim = Math.atan2(my - py, mx - px);
  const offs = [-0.12, 0, 0.12];
  for (let o of offs){
    bullets.push({
      x:px, y:py,
      alive:true, life:1.1,
      r:14, grow:220,
      wave:true, arc:true,
      a: aim + o,
      width: Math.PI/4,
      reflect:false
    });
  }
  if (l2_sfxShoot) l2_sfxShoot.play();
}
function shootPlayer(){ if (isL2) shootPlayer_L2(); else shootPlayer_L1(); }

/* Mermiler — Ayna hariç tek vuruşta öldür; ARC desteği */
function updateBullets(dt){
  bullets = bullets.filter(b=>b.alive);
  const t=now()/1000;
  function angDiff(a,b){ return Math.abs(Math.atan2(Math.sin(a-b), Math.cos(a-b))); }

  for (let b of bullets){
    if (!b.wave){
      const perpX=-b.vy, perpY=b.vx, plen=Math.max(1,Math.hypot(perpX,perpY));
      const nx=perpX/plen, ny=perpY/plen;
      const mag=(b.curveA||80) * Math.sin((b.phase||0) + t*(b.curveF||6)*TWO_PI);
      b.ax=nx*mag; b.ay=ny*mag;
      b.x+=(b.vx+b.ax)*dt; b.y+=(b.vy+b.ay)*dt;
    } else {
      b.r += (b.grow||200)*dt;
    }

    b.life-=dt; if (b.life<=0){ b.alive=false; continue; }
    if (!b.wave && (b.x<-50||b.y<-50||b.x>WORLD_W+50||b.y>WORLD_H+50)){ b.alive=false; continue; }

    // Sandık / Suluk
    if (!isL2){
      for (let c of chests){
        if (!c.alive||c.open) continue;
        let hit=false;
        if (!b.wave){
          hit = dist2(b.x,b.y,c.x,c.y) < ((b.r||6)+18)*((b.r||6)+18);
        } else if (b.arc){
          const d = Math.hypot(c.x - b.x, c.y - b.y);
          const da = angDiff(Math.atan2(c.y - b.y, c.x - b.x), b.a);
          hit = (Math.abs(d - (b.r||18)) < 10) && (da <= (b.width||Math.PI/4)/2);
        }
        if (hit){ openChest(c); b.alive=false; break; }
      }
    } else {
      for (let f of l2_flasks){
        if (!f.alive || f.open) continue;
        const fx = f.x ?? (f.x=randInWorld(140).x);
        const fy = f.y ?? (f.y=randInWorld(140).y);
        let hit=false;
        if (!b.wave){
          hit = dist2(b.x,b.y,fx,fy) < ((b.r||6)+18)*((b.r||6)+18);
        } else if (b.arc){
          const d = Math.hypot(fx - b.x, fy - b.y);
          const da = angDiff(Math.atan2(fy - b.y, fx - b.x), b.a);
          hit = (Math.abs(d - (b.r||18)) < 10) && (da <= (b.width||Math.PI/4)/2);
        }
        if (hit){ l2OpenFlask(f); b.alive=false; break; }
      }
    }

    // Düşman çarpışma — tek vuruş
    for (let e of enemies){
      if (!e.alive) continue;
      let hit=false;

      if (!b.wave){
        hit = dist2(b.x,b.y,e.x,e.y) < ((b.r||6)+14)*((b.r||6)+14);
      } else if (b.arc){
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        const da = angDiff(Math.atan2(e.y - b.y, e.x - b.x), b.a);
        hit = (Math.abs(d - (b.r||18)) < 10) && (da <= (b.width||Math.PI/4)/2);
      } else {
        const d=Math.hypot(e.x-b.x, e.y-b.y);
        hit = Math.abs(d - (b.r||18)) < 10;
      }

      if (hit){
        if (isL2 && e.type==="mirror"){
          if (!b.wave){
            if (!b.reflect){ b.vx*=-1; b.vy*=-1; b.reflect=true; }
          } else {
            b.alive=false;
          }
          continue;
        }
        e.alive=false;
        coins.push({x:e.x, y:e.y, taken:false});
        if (!b.wave || b.arc) b.alive=false;
        break;
      }
    }
  }
}

/* ========================= Şimşek & Hava ========================= */
function maybeLightning(){
  if (!isL2 && random()<BASE_FLASH_CHANCE){
    const p=randInWorld(120); const r=random(AOE_RADIUS_BASE, AOE_RADIUS_BASE*2);
    lightTelegraphs.push({x:p.x,y:p.y,tHit:now()+1000,r});
  }
  const t=now(); const keep=[];
  for (let w of lightTelegraphs){
    if (t>=w.tHit){
      lightStrikes.push({x:w.x,y:w.y,tFade:t+220,r:w.r});
      if (sfxLightning) sfxLightning.play();
      if (dist2(px,py,w.x,w.y)<(w.r*w.r) && !hasInvul()) damagePlayerTyped(24,"lightning");
    } else keep.push(w);
  }
  lightTelegraphs=keep;
  lightStrikes=lightStrikes.filter(s=>now()<s.tFade);
}

/* ========================= Coins / Loot / Door ========================= */
function ensureFinalKey(){
  if (timeLeft <= 30 && keyCount < KEYS_NEEDED){
    const exists = loots.some(l => l.alive && l.type==="key");
    if (!exists){
      const p = randInWorld(120);
      loots.push({x:p.x, y:p.y, type:"key", alive:true, origin:null});
    }
  }
}

function updateCoinsAndDoor(){
  // Coin pickup (+%3 HP) + despawn işaretleme
  for (let c of coins){
    if (!c.taken && dist2(px,py,c.x,c.y)<18*18){
      c.taken=true; scoreTotal+=3; hp=Math.min(HP_MAX, hp+Math.round(HP_MAX*0.03));
      if (c.originChest) c.originChest.despawnAt = now()+5000;
      if (c.originFlask) c.originFlask.despawnAt = now()+5000;
    }
  }

  // Loot pickup
  for (let l of loots){
    if (!l.alive) continue;
    if (dist2(px,py,l.x,l.y)<20*20){
      l.alive=false;
      if (l.type==="shield") shieldUntil=now()+SHIELD_TIME_MS;
      if (l.type==="nazar")  invulUntil=now()+L2_INVULN_TIME_MS;
      if (l.type==="key"){
        const before=keyCount; keyCount=Math.min(KEYS_NEEDED,keyCount+1);
        if (keyCount>=KEYS_NEEDED && before<KEYS_NEEDED){
          doorJustActivated=true;
          if (!isL2) { if (sfxDoor) sfxDoor.play(); } else { if (l2_sfxDoor) l2_sfxDoor.play(); }
        }
      }
      if (l.origin) l.origin.despawnAt = now()+5000;
    }
  }
  loots=loots.filter(l=>l.alive);

  for (let c of chests){ if (c.alive && c.despawnAt && now()>c.despawnAt) c.alive=false; }
  for (let f of l2_flasks){ if (f.alive && f.despawnAt && now()>f.despawnAt) f.alive=false; }

  if (keyCount>=KEYS_NEEDED){
    const DZ = getDoorZone();
    if (px>DZ.x && px<DZ.x+DZ.w && py>DZ.y && py<DZ.y+DZ.h){
      gameState="levelTransition"; transitionStart=now();
    }
  }
}

/* ========================= Kamera & Çizimler ========================= */
function updateCamera(){
  centerCam = centerCam || createVector(WORLD_W/2, WORLD_H/2);
  centerCam.x=clamp(px,VIEW_W/2, WORLD_W-VIEW_W/2);
  centerCam.y=clamp(py,VIEW_H/2, WORLD_H-VIEW_H/2);
}
function drawRain(){
  stroke(THEME.rain[0],THEME.rain[1],THEME.rain[2],THEME.rain[3]);
  for (let r of rain){
    const len=12; line(r.x-3,r.y-len, r.x,r.y);
    r.x+=-220*deltaTime/1000; r.y+=r.v*deltaTime/1000;
    if (r.y>WORLD_H+20){ r.y=-random(200); r.x=random(WORLD_W); }
    if (r.x<-20){ r.x=WORLD_W+random(40); }
  }
  noStroke();
}
function drawBG(){
  if (!isL2){
    if (keyCount>=KEYS_NEEDED && bg1AltImg&&bg1AltImg.width) image(bg1AltImg,0,0,WORLD_W,WORLD_H);
    else if (bg1Img&&bg1Img.width) image(bg1Img,0,0,WORLD_W,WORLD_H);
    else if (bgDefImg&&bgDefImg.width) image(bgDefImg,0,0,WORLD_W,WORLD_H);
    else background(12,14,18);
  } else {
    if (keyCount>=KEYS_NEEDED && l2_bg2&&l2_bg2.width) image(l2_bg2,0,0,WORLD_W,WORLD_H);
    else if (l2_bg1&&l2_bg1.width) image(l2_bg1,0,0,WORLD_W,WORLD_H);
    else background(10,12,16);
  }
  drawRain();
}
function drawLightning(){
  if (isL2) return;
  textAlign(CENTER,CENTER); fill(255,230,80);
  for (let w of lightTelegraphs){ textSize(22); text("!",w.x,w.y-28); noFill(); stroke(255,230,80); circle(w.x,w.y,w.r*2); noStroke(); }
  stroke(180,220,255); strokeWeight(3);
  for (let s of lightStrikes){ line(s.x,0,s.x,WORLD_H); noStroke(); fill(255,255,255,40); circle(s.x,s.y,s.r*2.2); }
  noStroke();
}
function drawL2Telegraphs(){
  textAlign(CENTER,CENTER); fill(255,230,80);
  for (let g of l2_telegraphs){ textSize(22); text("!", g.x, g.y-28); noFill(); stroke(255,230,80); circle(g.x,g.y,40); noStroke(); }
}
function drawChests(){
  for (let c of chests){
    if (!c.alive) continue; imageMode(CENTER);
    const img=c.open?chestOpenImg:chestClosedImg;
    if (img&&img.width) image(img,c.x,c.y,CHEST_W,CHEST_H);
    else { fill(c.open?[200,160,60]:[160,120,60]); rect(c.x-14,c.y-10,28,20,4); }
  }
}
function drawL2Flasks(){
  for (let f of l2_flasks){
    if (!f.alive) continue;
    imageMode(CENTER);
    const img=f.open?l2_flaskO:l2_flaskC;
    const fx = f.x ?? (f.x=randInWorld(140).x);
    const fy = f.y ?? (f.y=randInWorld(140).y);
    if (img&&img.width) image(img, fx, fy, CHEST_W, CHEST_H);
    else { fill(f.open?[200,180,90]:[120,100,60]); rect(fx-14,fy-10,28,20,4); }
  }
}
function drawEnemiesAndBullets(){
  // düşmanlar
  for (let e of enemies){
    if (!isL2){
      if (e.type==="ghost"){ imageMode(CENTER); if (ghostImg&&ghostImg.width) image(ghostImg,e.x,e.y,GHOST_W,GHOST_H); else { fill(240); ellipse(e.x,e.y,24,24); } }
      else if (e.type==="spoon"){ imageMode(CENTER); if (spoonImg&&spoonImg.width) image(spoonImg,e.x,e.y,SPOON_W,SPOON_H); else { fill(200); rect(e.x-6,e.y-20,12,40,6);} }
      else if (e.type==="alien"){ imageMode(CENTER); if (alienImg&&alienImg.width) image(alienImg,e.x,e.y,ALIEN_W,ALIEN_H); else { fill(200,60,60); ellipse(e.x,e.y,ALIEN_W,ALIEN_H*0.7);} }
    } else {
      if (e.type==="mirror"){ imageMode(CENTER); if (l2_mirror&&l2_mirror.width) image(l2_mirror,e.x,e.y,40,40); else { fill(180); rect(e.x-16,e.y-16,32,32,6);} }
      else if (e.type==="swing"){ imageMode(CENTER); if (l2_swing&&l2_swing.width) image(l2_swing,e.x,e.y,46,46); else { fill(150); ellipse(e.x,e.y,34,34);} }
      else if (e.type==="beak"){ imageMode(CENTER); if (l2_beak&&l2_beak.width) image(l2_beak,e.x,e.y,40,28); else { fill(220,180,60); triangle(e.x-12,e.y+8, e.x+12,e.y+8, e.x, e.y-10);} }
    }
  }

  // düşman mermileri
  fill(isL2? THEME.enemyRed : [220,60,60]);
  for (let b of enemyBullets){ circle(b.x,b.y,6); }

  // oyuncu mermileri
  for (let b of bullets){
    if (!b.wave){
      fill(THEME.teaBullet[0],THEME.teaBullet[1],THEME.teaBullet[2]); circle(b.x,b.y,b.r*2);
      noFill(); stroke(255,150); circle(b.x,b.y,b.r*2.4); noStroke();
    } else {
      if (b.arc){
        noFill(); stroke(255);
        const start = b.a - (b.width||Math.PI/4)/2;
        const stop  = b.a + (b.width||Math.PI/4)/2;
        arc(b.x, b.y, (b.r*2), (b.r*2), start, stop);
        noStroke();
      } else {
        noFill(); stroke(255); circle(b.x,b.y, b.r*2); noStroke();
      }
    }
  }
}
function drawCoins(){
  for (let c of coins){ if (c.taken) continue; imageMode(CENTER);
    if (coinImg&&coinImg.width) image(coinImg,c.x,c.y,COIN_W,COIN_H); else { fill(240,200,90); circle(c.x,c.y,14); }
  }
}
function drawLoots(){
  for (let l of loots){ if (!l.alive) continue;
    if (l.type==="key"){ imageMode(CENTER); if (keyImg&&keyImg.width) image(keyImg,l.x,l.y,KEY_W,KEY_H); else { fill(255,200,80); rect(l.x-10,l.y-6,20,12,3);} }
    else if (l.type==="shield"){ fill(120,200,255,180); circle(l.x,l.y,22); noFill(); stroke(255); circle(l.x,l.y,26); noStroke(); }
    else if (l.type==="nazar"){ imageMode(CENTER); if (l2_nazar&&l2_nazar.width) image(l2_nazar,l.x,l.y,24,24); else { fill(0,120,255); circle(l.x,l.y,20);} }
  }
}
function drawPlayer(){
  if (l2_trapHold.invisible) return;
  if (hasShield()){ noFill(); stroke(THEME.shield); strokeWeight(3); circle(px,py,40); noStroke(); }
  if (hasInvul()){ noFill(); stroke(0,180,255); strokeWeight(3); circle(px,py,44); noStroke(); }

  imageMode(CENTER);
  if (!isL2){
    if (playerImg&&playerImg.width) image(playerImg, px,py,PLAYER_W,PLAYER_H);
    else { fill(200,70,70); ellipse(px,py,20,20); }
  } else {
    if (l2_player&&l2_player.width) image(l2_player, px,py,PLAYER_W,PLAYER_H);
    else { fill(200,200,240); ellipse(px,py,22,22); }
  }

  // küçük hareket oku
  const mv=Math.hypot(vx,vy);
  if (mv>1){ lastMoveDir.x=vx/mv; lastMoveDir.y=vy/mv; }
  const ax=px+lastMoveDir.x*24, ay=py+lastMoveDir.y*24;
  fill(THEME.moveArrow); noStroke();
  triangle(ax,ay, ax-lastMoveDir.y*8, ay+lastMoveDir.x*8, ax+lastMoveDir.y*8, ay-lastMoveDir.x*8);

  // 3 anahtar sonrası: oyuncunun ÜZERİNDE pusula oku
  if (keyCount>=KEYS_NEEDED){
    const DZ = getDoorZone();
    const tx = DZ.x + DZ.w/2, ty = DZ.y + DZ.h/2;
    const ang = Math.atan2(ty - py, tx - px);
    push();
    translate(px, py - (PLAYER_H*0.9));
    rotate(ang);
    fill(THEME.compass);
    rect(-2, -14, 4, 18, 2);
    triangle(0, -22, -7, -10, 7, -10);
    pop();
  }
}
function drawUI(){
  resetMatrix(); translate(0,0);
  if (bgBrightness!==1.0){
    const a=Math.abs(bgBrightness-1.0)*140; if (bgBrightness>1.0) fill(255,255,255,a); else fill(0,0,0,a);
    rect(0,0,VIEW_W,VIEW_H);
  }
  // HP bar
  fill(40,40,50); rect(12,12,220,12,6);
  const r=clamp(hp/HP_MAX,0,1); fill( lerpColor(color(THEME.hpR), color(THEME.hpG), r) ); rect(12,12,220*r,12,6);
  if (hasShield()){ noFill(); stroke(THEME.shield); rect(10,10,224,16,6); noStroke(); }
  if (hasInvul()){ noFill(); stroke(0,180,255); rect(8,8,228,20,6); noStroke(); }

  // Fullscreen düğmesi (HP yanında)
  fill(255); rect(FS_BTN.x, FS_BTN.y, FS_BTN.w, FS_BTN.h, 3);
  fill(0);
  if (!fullscreen()){
    rect(FS_BTN.x+5, FS_BTN.y+4, 4, 4);
    rect(FS_BTN.x+FS_BTN.w-9, FS_BTN.y+FS_BTN.h-8, 4, 4);
  } else {
    rect(FS_BTN.x+FS_BTN.w-9, FS_BTN.y+4, 4, 4);
    rect(FS_BTN.x+5, FS_BTN.y+FS_BTN.h-8, 4, 4);
  }

  // Sayaç ortada ve renkli
  const m=nf(floor(timeLeft/60),2), s=nf(floor(timeLeft%60),2);
  const tsec = timeLeft;
  let tc = color(255);            // 3-2 dk beyaz
  if (tsec <= 120 && tsec > 60) tc = color(255,215,0);   // 2-1 dk sarı
  if (tsec <= 60)                tc = color(255,70,70);  // 1-0 dk kırmızı
  fill(tc);
  textAlign(CENTER,TOP); textSize(14);
  text(`Süre: ${m}:${s}`, VIEW_W/2, 10);

  // Anahtar / skor (sol üst)
  fill(THEME.uiWhite); textSize(14); textAlign(LEFT,TOP);
  text(`Anahtar: ${keyCount}/${KEYS_NEEDED}`, 12, 32);
  text(`Skor: ${scoreTotal}`, 12, 50);

  // Pause ikonu (sağ üst)
  fill(255); rect(VIEW_W-26,10,4,16,2); rect(VIEW_W-18,10,4,16,2);

  // Ekran kenarı yön oku (bilgi)
  if (keyCount>=KEYS_NEEDED){
    fill(THEME.doorArrow);
    if (!isL2){ const tx=VIEW_W-40,ty=40; triangle(tx,ty, tx-14,ty-8, tx-14,ty+8); }
    else { const tx=VIEW_W/2, ty=VIEW_H-36; triangle(tx,ty, tx-12,ty+18, tx+12,ty+18); }
  }
}
function drawPauseOverlay(){
  fill(0,180); rect(0,0,VIEW_W,VIEW_H);
  fill(255); textAlign(CENTER,TOP); textSize(20); text("Duraklatıldı", VIEW_W/2, 24);
  textSize(14); textAlign(LEFT,TOP); fill(255);
  text("Ses (master)", 40, 80);
  drawButton({x:40,y:100,w:28,h:20},"-"); drawButton({x:212,y:100,w:28,h:20},"+");
  fill(220); rect(72,100,136,8,4); fill(255); circle(72+clamp(masterVol,0,1)*136,104,10);

  fill(255); text("Parlaklık", 40, 140);
  drawButton({x:40,y:160,w:28,h:20},"-"); drawButton({x:212,y:160,w:28,h:20},"+");
  fill(220); rect(72,160,136,8,4); const bn=clamp((bgBrightness-0.5)/1.0,0,1); fill(255); circle(72+bn*136,164,10);

  text(`Süre: ${nf(floor(timeLeft/60),2)}:${nf(floor(timeLeft%60),2)}`, 40, 210);
  text(`Anahtar: ${keyCount}/${KEYS_NEEDED}`, 40, 230);
  text(`Skor: ${scoreTotal}`, 40, 250);

  drawButton({x:40,y:290,w:120,h:30},"Menüye Dön", true);
}
function drawButton(r,label){ fill(255); rect(r.x,r.y,r.w,r.h,6); fill(0); textAlign(CENTER,CENTER); text(label, r.x+r.w/2, r.y+r.h/2); }
function drawMenus(){
  background(10,12,16);
  splashAlpha += 0.02*splashFadeDir; if (splashAlpha>1){splashAlpha=1;splashFadeDir=-1;} if (splashAlpha<0.2){splashAlpha=0.2;splashFadeDir=1;}
  if (splashImg&&splashImg.width){
    imageMode(CENTER); tint(255,255*splashAlpha);
    const maxW=VIEW_W*0.8,maxH=VIEW_H*0.7, iw=splashImg.width, ih=splashImg.height, sc=Math.min(maxW/iw,maxH/ih);
    image(splashImg, VIEW_W/2, VIEW_H/2-20, iw*sc, ih*sc);
    noTint(); blendMode(BLEND);
  }
  fill(0); textAlign(CENTER,CENTER); textSize(32); text("Storm Night: Tea Runner", VIEW_W/2, VIEW_H/2+96);
  textSize(14); text("Başlamak için Tıkla veya Space", VIEW_W/2, VIEW_H/2+136);
  textSize(12); text("WASD • Fare/Space ateş • 3 anahtar → çıkış", VIEW_W/2, VIEW_H/2+160);
}
function drawLevelTransition(){
  background(0); fill(255); textAlign(CENTER,CENTER); textSize(26);
  text(`Level ${level+2}`, VIEW_W/2, VIEW_H/2);
}
function drawDeathCinematic(){
  const el=(now()-deathStart)/1000;
  if (deathPhase==="zoom"){
    // Daha az ve daha yavaş zoom
    zoomScale=Math.min(1.125, 1 + el*0.3125);
    if (zoomScale>=1.125){ deathPhase="gif"; deathStart=now(); }
    push(); translate(VIEW_W/2, VIEW_H/2); scale(zoomScale);
    translate(-px + (centerCam.x - VIEW_W/2), -py + (centerCam.y - VIEW_H/2));
    drawBG(); if (!isL2) drawThorns(); drawChests(); drawL2Flasks(); drawEnemiesAndBullets(); drawPlayer(); pop();
  } else {
    background(0); imageMode(CENTER);
    const img = isL2 ? (l2_death||deathGifL1) : (deathGifL1||l2_death);
    if (img&&img.width){ const iw=img.width, ih=img.height, sc=Math.max(VIEW_W/iw, VIEW_H/ih); image(img, VIEW_W/2, VIEW_H/2, iw*sc, ih*sc); }
    else { fill(255); textAlign(CENTER,CENTER); textSize(24); text("Öldünüz", VIEW_W/2, VIEW_H/2); }
    if (el>=4){ gameState="gameover"; deathPhase=null; if (musicBg) musicBg.setVolume(masterVol*0.6,0.2); if (l2_musicBg) l2_musicBg.setVolume(masterVol*0.6,0.2); updateBest(); }
  }
}

/* ========================= p5 lifecycle ========================= */
function preload(){
  // IMG
  splashImg      = loadImage(PATH.img+"splash.png");
  bg1Img         = loadImage(PATH.img+"bg1.png");
  bg1AltImg      = loadImage(PATH.img+"bg1_alt.png");
  bgDefImg       = loadImage(PATH.img+"bg1.png"); // yedek

  playerImg      = loadImage(PATH.img+"player.png");
  spoonImg       = loadImage(PATH.img+"spoon.png");
  alienImg       = loadImage(PATH.img+"alien.png");
  ghostImg       = loadImage(PATH.img+"ghost.png");
  keyImg         = loadImage(PATH.img+"key.png");
  coinImg        = loadImage(PATH.img+"coin.png");
  chestClosedImg = loadImage(PATH.img+"chest_closed.png");
  chestOpenImg   = loadImage(PATH.img+"chest_open.png");

  // L2
  l2_bg1         = loadImage(PATH.img+"l2_bg1.png");
  l2_bg2         = loadImage(PATH.img+"l2_bg2.png");
  l2_trap        = loadImage(PATH.img+"l2_trap.png");
  l2_finger      = loadImage(PATH.img+"l2_finger.png");
  l2_nazar       = loadImage(PATH.img+"l2_nazar.png");
  l2_honey       = loadImage(PATH.img+"l2_honey.png");
  l2_mirror      = loadImage(PATH.img+"l2_mirror.png");
  l2_swing       = loadImage(PATH.img+"l2_swing.png");
  l2_beak        = loadImage(PATH.img+"l2_beak.png");
  l2_player      = loadImage(PATH.img+"l2_player.png");
  try{ l2_death  = loadImage(PATH.img+"l2_death.png"); }catch(e){}
  try{ if (!l2_death) l2_death = loadImage(PATH.img+"l2_death.gif"); }catch(e){}
  l2_flaskC      = loadImage(PATH.img+"l2_flask_closed.png");
  l2_flaskO      = loadImage(PATH.img+"l2_flask_open.png");
  try{ deathGifL1 = loadImage(PATH.img+"death_l1.gif"); }catch(e){}

  // Sesler
  musicBg     = loadSound(PATH.audio+"bg_music.wav");
  sfxShoot    = loadSound(PATH.audio+"shoot.wav");
  sfxDoor     = loadSound(PATH.audio+"door.wav");
  sfxLightning= loadSound(PATH.audio+"lightning.wav");

  l2_musicBg  = loadSound(PATH.audio+"l2_bg_music.wav");
  l2_sfxShoot = loadSound(PATH.audio+"l2_shoot.wav");
  l2_sfxDoor  = loadSound(PATH.audio+"l2_door.wav");
  l2_sfxFinger= loadSound(PATH.audio+"l2_finger.wav");
}
function setup(){
  createCanvas(VIEW_W, VIEW_H);
  pixelDensity(1);   // ghosting azalt
  frameRate(60);
  noSmooth();        // smear azalt
  centerCam=createVector(WORLD_W/2, WORLD_H/2);
  try{ bestTotal=Number(localStorage.getItem("tea_runner_best")||"0"); }catch(e){}
}
function startGame(){
  try{ if (getAudioContext().state!=='running') getAudioContext().resume(); }catch(e){}
  chapter=0; scoreTotal=0; level=0; resetLevel(); gameState="play"; lastFrameMillis=millis();
  if (musicBg){
    setGlobalVolume(masterVol);
    musicBg.setLoop(true);
    musicBg.setVolume(masterVol*0.6);
    musicBg.loop(0,1,masterVol*0.6,0,5.0);
    musicBg.onended(()=>{ if (musicBg && !musicBg.isPlaying()) musicBg.loop(0,1,masterVol*0.6,0,5.0); });
  }
}

let lastFrameMillis=0;
function draw(){
  // --- ghosting fix: kare başı sert reset ---
  resetMatrix();
  blendMode(BLEND);
  noTint();
  noStroke();
  background(0,0,0,255);
  // -----------------------------------------

  const ms=millis(), dt=lastFrameMillis? (ms-lastFrameMillis)/1000:0.016; lastFrameMillis=ms;

  if (gameState==="menu"){ drawMenus(); return; }
  if (gameState==="levelTransition"){
    drawLevelTransition();
    if ((now()-transitionStart)>=2000){
      if (level===0 && musicBg && l2_musicBg){
        musicBg.stop();
        l2_musicBg.setLoop(true); l2_musicBg.setVolume(masterVol*0.6);
        l2_musicBg.loop(0,1,masterVol*0.6,0,5.0);
      }
      gameState="play"; nextLevel();
    }
    return;
  }
  if (gameState==="gameover"){ drawGameOver(); return; }

  if (paused){ drawPauseWorld(); drawPauseOverlay(); return; }
  if (deathPhase){ drawDeathCinematic(); return; }

  if (timeLeft>0){ timeLeft-=dt; if (timeLeft<=0){ timeLeft=0; startDeathSequence(); } }

  let ax=0,ay=0;
  if (now()>=l2_trapHold.until){
    if (keyIsDown(65) || keyIsDown(37)) ax-=1;
    if (keyIsDown(68) || keyIsDown(39)) ax+=1;
    if (keyIsDown(87) || keyIsDown(38)) ay-=1;
    if (keyIsDown(83) || keyIsDown(40)) ay+=1;
  }
  const len=Math.hypot(ax,ay)||1; vx=(ax/len)*PLAYER_SPEED; vy=(ay/len)*PLAYER_SPEED;
  px+=vx*dt; py+=vy*dt; worldClamp();

  if (!isL2) trySpawnChest(dt); else { l2MaybeFinger(); l2UpdateTelegraphs(); l2UpdateTraps(); }
  updateEnemies(dt);
  updateEnemyBullets(dt);
  updateBullets(dt);
  if (!isL2){ updateThorns(); maybeLightning(); }
  updateCoinsAndDoor();
  ensureFinalKey();  // son 30 sn anahtar garantisi
  updateCamera();

  push(); translate(-centerCam.x+VIEW_W/2, -centerCam.y+VIEW_H/2);
  drawBG();
  if (!isL2){ drawThorns(); drawLightning(); drawChests(); } else { drawL2Flasks(); drawL2Telegraphs(); }
  drawCoins(); drawLoots(); drawEnemiesAndBullets(); drawPlayer();
  pop();

  drawUI();

  if (doorJustActivated){ doorJustActivated=false; if (!isL2){ if (sfxDoor) sfxDoor.play(); } else { if (l2_sfxDoor) l2_sfxDoor.play(); } }
}
function drawPauseWorld(){
  push(); translate(-centerCam.x+VIEW_W/2, -centerCam.y+VIEW_H/2);
  drawBG(); if (!isL2){ drawThorns(); drawLightning(); drawChests(); } else { drawL2Flasks(); drawL2Telegraphs(); }
  drawCoins(); drawLoots(); drawEnemiesAndBullets(); drawPlayer(); pop(); drawUI();
}

/* ========================= Input ========================= */
function mousePressed(){
  if (gameState==="menu"){ startGame(); return; }
  if (gameState==="levelTransition" || gameState==="levelClear"){ return; }
  if (gameState==="gameover"){ startGame(); return; }

  if (paused){
    const x=mouseX,y=mouseY;
    if (x>=40&&x<=68&&y>=100&&y<=120){ masterVol=clamp(masterVol-0.1,0,1); setGlobalVolume(masterVol); if (musicBg) musicBg.setVolume(masterVol*0.6); if (l2_musicBg) l2_musicBg.setVolume(masterVol*0.6); }
    if (x>=212&&x<=240&&y>=100&&y<=120){ masterVol=clamp(masterVol+0.1,0,1); setGlobalVolume(masterVol); if (musicBg) musicBg.setVolume(masterVol*0.6); if (l2_musicBg) l2_musicBg.setVolume(masterVol*0.6); }
    if (x>=40&&x<=68&&y>=160&&y<=180){ const v=clamp((bgBrightness-0.5)/1.0 - 0.1,0,1); bgBrightness=0.5+v*1.0; }
    if (x>=212&&x<=240&&y>=160&&y<=180){ const v=clamp((bgBrightness-0.5)/1.0 + 0.1,0,1); bgBrightness=0.5+v*1.0; }
    if (x>=40&&x<=160&&y>=290&&y<=320){ paused=false; gameState="menu"; if (musicBg) musicBg.stop(); if (l2_musicBg) l2_musicBg.stop(); }
    return;
  }

  // Fullscreen butonu (pause değilken)
  if (mouseX>=FS_BTN.x && mouseX<=FS_BTN.x+FS_BTN.w && mouseY>=FS_BTN.y && mouseY<=FS_BTN.y+FS_BTN.h){
    fullscreen(!fullscreen());
    return;
  }

  shootPlayer();
}
function keyPressed(){
  if (key===' '){
    if (gameState==="menu"){ startGame(); return; }
    if (gameState==="gameover"){ startGame(); return; }
    if (!paused && !deathPhase) shootPlayer();
  }
  if (key==='p' || key==='P'){
    if (!deathPhase && (gameState==="play")){ paused=!paused; const vol=masterVol*(paused?0.3:0.6); if (musicBg) musicBg.setVolume(vol,0.2); if (l2_musicBg) l2_musicBg.setVolume(vol,0.2); }
  }
}

/* ========================= Ölüm / Game Over ========================= */
function startDeathSequence(){
  deathPhase="zoom"; deathStart=now(); zoomScale=1;
  if (musicBg) musicBg.setVolume(masterVol*0.3,0.2);
  if (l2_musicBg) l2_musicBg.setVolume(masterVol*0.3,0.2);
}
function drawGameOver(){
  resetMatrix(); background(10,12,16); fill(235); textAlign(CENTER,CENTER); textSize(32);
  text("OYUN BİTTİ", VIEW_W/2, VIEW_H/2-60);
  textSize(16); text(`Skor: ${scoreTotal}  |  Best: ${bestTotal}`, VIEW_W/2, VIEW_H/2-8);
  text("Yeniden başlamak için Tıkla veya Space", VIEW_W/2, VIEW_H/2+40);
}
