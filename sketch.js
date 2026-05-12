let video, faceMesh, handPose;
let facePredictions = [], handPredictions = [];
let maskImages = [];
let offscreen, maskCanvas;
let currentMask = 0;

// ── 臉譜定義：圖片型 + 程式碼型 ──
// type:'img' = 圖片臉譜, type:'code' = 程式碼繪製
const MASKS = [
  { type:'img', file:'mask1_red.png',
    leftEye:{u:0.3063,v:0.4635}, rightEye:{u:0.6937,v:0.4635},
    eyeSpanU:0.3875, eyeMidU:0.5000, eyeMidV:0.4635, eyeToMouthV:0.2365,
    label:'紅臉・關羽' },
  { type:'img', file:'mask2_blue.png',
    leftEye:{u:0.3063,v:0.4604}, rightEye:{u:0.6937,v:0.4604},
    eyeSpanU:0.3875, eyeMidU:0.5000, eyeMidV:0.4604, eyeToMouthV:0.2396,
    label:'藍臉・竇爾墩' },
  { type:'img', file:'mask3_gold.png',
    leftEye:{u:0.3063,v:0.4604}, rightEye:{u:0.6937,v:0.4604},
    eyeSpanU:0.3875, eyeMidU:0.5000, eyeMidV:0.4604, eyeToMouthV:0.2375,
    label:'金臉・神仙' },
  { type:'img', file:'mask4_white.png',
    leftEye:{u:0.3063,v:0.4583}, rightEye:{u:0.6937,v:0.4583},
    eyeSpanU:0.3875, eyeMidU:0.5000, eyeMidV:0.4583, eyeToMouthV:0.2396,
    label:'白臉・曹操' },
  { type:'img', file:'4379902.png',
    leftEye:{u:261/1122,v:710/1389}, rightEye:{u:861/1122,v:710/1389},
    eyeSpanU:600/1122, eyeMidU:561/1122, eyeMidV:710/1389, eyeToMouthV:411/1389,
    label:'紫臉・花臉' },
  { type:'img', file:'4379901.png',
    leftEye:{u:0.2844,v:0.4359}, rightEye:{u:0.7173,v:0.4359},
    eyeSpanU:0.4329, eyeMidU:0.5008, eyeMidV:0.4359, eyeToMouthV:0.3621,
    label:'黑臉・武生' },

  // ── 程式碼臉譜：關鍵點位置固定（畫布 600x720）──
  { type:'code', drawFn:'drawGhostKing',
    // 眼睛在臉部中央偏上：眼距~220px / 600 = 0.367, 眼心Y~310/720=0.431
    leftEye:{u:0.192,v:0.431}, rightEye:{u:0.808,v:0.431},
    eyeSpanU:0.367, eyeMidU:0.500, eyeMidV:0.431, eyeToMouthV:0.264,
    label:'綠臉・鬼王' },
  { type:'code', drawFn:'drawButterflyDan',
    leftEye:{u:0.217,v:0.406}, rightEye:{u:0.783,v:0.406},
    eyeSpanU:0.350, eyeMidU:0.500, eyeMidV:0.406, eyeToMouthV:0.278,
    label:'粉臉・彩蝶' },
];

// ── 五種耳飾 ──
const ACCESSORIES = [
  { file:'acc1_ring.png',    name:'金環',   anchorU:0.5, anchorV:0.05, scale:0.18, offsetX:0, offsetY:0.02 },
  { file:'acc2_pearl.png',   name:'珍珠串', anchorU:0.5, anchorV:0.04, scale:0.15, offsetX:0, offsetY:0.02 },
  { file:'acc3_tassel.png',  name:'紅流蘇', anchorU:0.5, anchorV:0.04, scale:0.16, offsetX:0, offsetY:0.02 },
  { file:'acc4_jade.png',    name:'翡翠墜', anchorU:0.5, anchorV:0.04, scale:0.16, offsetX:0, offsetY:0.02 },
  { file:'acc5_phoenix.png', name:'鳳凰羽', anchorU:0.5, anchorV:0.04, scale:0.20, offsetX:0, offsetY:0.01 },
];

let accImages = [];
let currentAcc = 0, targetAcc = 0, accAlpha = 0;
let swipe = { startX:null, triggered:false };
let anim  = { active:false, progress:0, frames:22 };
let fingerNum = { raw:0, stable:0, holdCount:0, holdNeeded:8 };

// 程式碼臉譜的離屏畫布（600×720）
const CW = 600, CH = 720, CCX = 300, CCY = 360;

function preload() {
  for (let m of MASKS) if (m.type==='img') m.img = loadImage(m.file);
  for (let i=0; i<ACCESSORIES.length; i++) accImages[i] = loadImage(ACCESSORIES[i].file);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  offscreen  = createGraphics(windowWidth, windowHeight);
  maskCanvas = createGraphics(CW, CH);
  offscreen.pixelDensity(1);
  maskCanvas.pixelDensity(1);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  faceMesh = ml5.faceMesh(video, {maxFaces:1}, () => {
    faceMesh.detectStart(video, r => { facePredictions = r; });
  });
  handPose = ml5.handPose(video, {maxHands:2}, () => {
    handPose.detectStart(video, r => { handPredictions = r; });
  });
}

// ══════════════════════════════════════════════════════
// 程式碼臉譜 A：綠臉鬼王
// 畫布 600×720，臉部橢圓中心 (300,360)，rx=230,ry=295
// 左眼中心 (185,310)，右眼中心 (415,310)
// 嘴中心 (300,500)
// ══════════════════════════════════════════════════════
function drawGhostKing(g) {
  const cx=CCX, cy=CCY, rx=230, ry=295;
  g.clear();
  g.noStroke();

  // ── 臉底：深綠到翠綠漸層（多層橢圓模擬）──
  for (let i=10; i>0; i--) {
    let t=i/10;
    let r=int(lerp(10,40,t)), gv=int(lerp(80,140,t)), b=int(lerp(30,60,t));
    g.fill(r,gv,b);
    g.ellipse(cx, cy+10*t, rx*2*t/10+rx*2*9/10, ry*2*t/10+ry*2*9/10);
  }
  // 主臉底
  g.fill(18,110,45);
  g.stroke(8,55,18); g.strokeWeight(5);
  g.ellipse(cx, cy, rx*2, ry*2);
  g.noStroke();

  // ── 額頭黑色帽飾 ──
  g.fill(15,15,15);
  g.arc(cx, cy-40, rx*2+10, ry*2+10, PI+0.22, TWO_PI-0.22, CHORD);

  // 帽頂金色紋章
  g.fill(200,155,0);
  g.ellipse(cx, cy-ry+20, 80, 55);
  g.fill(230,190,20);
  g.triangle(cx-25,cy-ry+22, cx+25,cy-ry+22, cx,cy-ry-18);
  g.fill(255,220,50);
  g.ellipse(cx, cy-ry, 22, 22);

  // 帽緣金邊
  g.stroke(200,160,10); g.strokeWeight(6); g.noFill();
  g.arc(cx, cy-40, rx*2+10, ry*2+10, PI+0.24, TWO_PI-0.24, OPEN);
  g.noStroke();

  // ── 鬼紋：額頭兩側火焰爪紋 ──
  g.fill(0,180,60,180);
  // 左爪
  g.beginShape();
  g.vertex(cx-rx+30, cy-100);
  g.bezierVertex(cx-rx+10,cy-160, cx-60,cy-200, cx-90,cy-170);
  g.bezierVertex(cx-50,cy-195, cx-30,cy-155, cx-70,cy-120);
  g.bezierVertex(cx-30,cy-148, cx-20,cy-110, cx-55,cy-85);
  g.endShape(CLOSE);
  // 右爪
  g.beginShape();
  g.vertex(cx+rx-30, cy-100);
  g.bezierVertex(cx+rx-10,cy-160, cx+60,cy-200, cx+90,cy-170);
  g.bezierVertex(cx+50,cy-195, cx+30,cy-155, cx+70,cy-120);
  g.bezierVertex(cx+30,cy-148, cx+20,cy-110, cx+55,cy-85);
  g.endShape(CLOSE);

  // ── 眼周：銀白色菱形光芒 ──
  g.fill(230,255,235,200);
  // 左眼框
  g.beginShape();
  [[-130,0],[-65,-45],[0,0],[-65,45]].forEach(([dx,dy]) => g.vertex(cx-185+dx+185, cy-310+dy+310));
  g.endShape(CLOSE);
  // 右眼框
  g.beginShape();
  [[130,0],[65,-45],[0,0],[65,45]].forEach(([dx,dy]) => g.vertex(cx+415-415+dx+185, cy-310+dy+310));
  g.endShape(CLOSE);

  // 左眼框（用絕對座標更清晰）
  g.fill(200,240,210,220);
  g.beginShape();
  g.vertex(cx-310,cy-310); g.vertex(cx-185,cy-360);
  g.vertex(cx-60, cy-310); g.vertex(cx-185,cy-258);
  g.endShape(CLOSE);
  g.beginShape();
  g.vertex(cx+310,cy-310); g.vertex(cx+185,cy-360);
  g.vertex(cx+60, cy-310); g.vertex(cx+185,cy-258);
  g.endShape(CLOSE);

  // 濃黑眉（斜向上，威嚴）
  g.fill(10,10,10);
  g.beginShape();
  g.vertex(cx-310,cy-348); g.vertex(cx-150,cy-390);
  g.vertex(cx-60, cy-370); g.vertex(cx-90, cy-345);
  g.vertex(cx-175,cy-362); g.vertex(cx-295,cy-330);
  g.endShape(CLOSE);
  g.beginShape();
  g.vertex(cx+310,cy-348); g.vertex(cx+150,cy-390);
  g.vertex(cx+60, cy-370); g.vertex(cx+90, cy-345);
  g.vertex(cx+175,cy-362); g.vertex(cx+295,cy-330);
  g.endShape(CLOSE);

  // ── 鼻樑：綠黑條紋 ──
  g.fill(8,55,18);
  g.rect(cx-10, cy-200, 20, 120, 8);

  // ── 臉頰鬼紋：螺旋（靜態，貼近臉頰中央位置）──
  g.stroke(0,80,25,200); g.strokeWeight(5); g.noFill();
  for (let side of [-1,1]) {
    g.beginShape();
    for (let a=0; a<TWO_PI*2.5; a+=0.1) {
      let r2=a/(TWO_PI*2.5)*40;
      g.vertex(cx+side*195+cos(a)*r2, cy+60+sin(a)*r2);
    }
    g.endShape();
  }
  g.noStroke();

  // 鬍鬚（深綠色長毛，嘴周下方）
  g.stroke(5,60,15,220); g.strokeWeight(4);
  for (let i=-4; i<=4; i++) {
    g.line(cx+i*18-5, cy+175, cx+i*16+5, cy+255+abs(i)*8);
  }
  g.noStroke();

  // ── 挖空：只挖眼睛，嘴巴完全交給動態函數 ──
  g.erase();
  g.rect(cx-315, cy-365, 255, 115, 8);  // 左眼區
  g.rect(cx+60,  cy-365, 255, 115, 8);  // 右眼區
  g.noErase();
}

// ══════════════════════════════════════════════════════
// 程式碼臉譜 B：粉臉・彩蝶花旦
// 左眼中心 (170,293)，右眼中心 (430,293)
// 嘴中心 (300,493)
// ══════════════════════════════════════════════════════
function drawButterflyDan(g) {
  const cx=CCX, cy=CCY, rx=225, ry=290;
  g.clear();
  g.noStroke();

  // ── 臉底：粉白細膩 ──
  for (let i=8; i>0; i--) {
    let t=i/8;
    g.fill(int(lerp(255,230,t)), int(lerp(235,190,t)), int(lerp(240,210,t)));
    g.ellipse(cx, cy, rx*2*t/8+rx*2*7/8, ry*2*t/8+ry*2*7/8);
  }
  g.fill(250,228,235);
  g.stroke(200,160,175); g.strokeWeight(5);
  g.ellipse(cx, cy, rx*2, ry*2);
  g.noStroke();

  // ── 蝴蝶翅膀（額頭裝飾）──
  // 左翅
  g.fill(180,80,160,200);
  g.beginShape();
  g.vertex(cx,      cy-ry+10);
  g.bezierVertex(cx-180,cy-ry-80, cx-rx-40,cy-ry+80, cx-rx+20,cy-ry+150);
  g.bezierVertex(cx-60, cy-ry+80, cx-20,cy-ry+40, cx,cy-ry+10);
  g.endShape(CLOSE);
  // 右翅
  g.beginShape();
  g.vertex(cx,      cy-ry+10);
  g.bezierVertex(cx+180,cy-ry-80, cx+rx+40,cy-ry+80, cx+rx-20,cy-ry+150);
  g.bezierVertex(cx+60, cy-ry+80, cx+20,cy-ry+40, cx,cy-ry+10);
  g.endShape(CLOSE);

  // 翅膀紋路
  g.stroke(220,130,200,160); g.strokeWeight(2.5); g.noFill();
  g.bezierVertex && void 0; // dummy
  g.line(cx, cy-ry+10, cx-rx+20, cy-ry+150);
  g.line(cx, cy-ry+10, cx-140, cy-ry+20);
  g.line(cx, cy-ry+10, cx+rx-20, cy-ry+150);
  g.line(cx, cy-ry+10, cx+140, cy-ry+20);
  g.noStroke();

  // 翅膀金粉邊
  g.fill(240,180,210,180);
  g.ellipse(cx-rx+20, cy-ry+100, 60, 80);
  g.ellipse(cx+rx-20, cy-ry+100, 60, 80);

  // ── 額頭中央蝴蝶結 ──
  g.fill(220,100,180);
  g.ellipse(cx-25, cy-ry+18, 40, 28);
  g.ellipse(cx+25, cy-ry+18, 40, 28);
  g.fill(255,160,210);
  g.ellipse(cx, cy-ry+18, 18, 18);

  // ── 眼周：玫瑰色眼影 ──
  g.fill(220,120,170,190);
  g.ellipse(cx-170, cy-293, 170, 80);
  g.ellipse(cx+170, cy-293, 170, 80);
  // 眼周亮色
  g.fill(255,200,220,160);
  g.ellipse(cx-170, cy-308, 130, 50);
  g.ellipse(cx+170, cy-308, 130, 50);

  // 眉毛（細長彎月，花旦風）
  g.fill(120,50,80);
  g.beginShape();
  g.vertex(cx-290,cy-358); g.vertex(cx-120,cy-400);
  g.vertex(cx-60, cy-388); g.vertex(cx-80, cy-372);
  g.vertex(cx-140,cy-380); g.vertex(cx-278,cy-342);
  g.endShape(CLOSE);
  g.beginShape();
  g.vertex(cx+290,cy-358); g.vertex(cx+120,cy-400);
  g.vertex(cx+60, cy-388); g.vertex(cx+80, cy-372);
  g.vertex(cx+140,cy-380); g.vertex(cx+278,cy-342);
  g.endShape(CLOSE);

  // 眼角紅暈
  g.fill(220,80,120,180);
  g.triangle(cx-65,cy-293, cx-30,cy-275, cx-30,cy-310);
  g.triangle(cx+65,cy-293, cx+30,cy-275, cx+30,cy-310);

  // ── 腮紅 ──
  g.fill(240,140,170,100);
  g.ellipse(cx-195, cy+40, 120, 70);
  g.ellipse(cx+195, cy+40, 120, 70);

  // ── 鼻樑：細緻粉色 ──
  g.fill(230,180,200);
  g.rect(cx-6, cy-200, 12, 110, 6);

  // 蝴蝶觸角
  g.stroke(160,60,130,200); g.strokeWeight(2.5); g.noFill();
  g.bezier(cx-30,cy-ry+5, cx-80,cy-ry-60, cx-130,cy-ry-40, cx-120,cy-ry-80);
  g.bezier(cx+30,cy-ry+5, cx+80,cy-ry-60, cx+130,cy-ry-40, cx+120,cy-ry-80);
  g.noStroke();
  g.fill(220,100,180);
  g.ellipse(cx-120, cy-ry-80, 14, 14);
  g.ellipse(cx+120, cy-ry-80, 14, 14);

  // ── 挖空：只挖眼睛，嘴巴與臉頰裝飾全交給動態函數 ──
  g.erase();
  g.rect(cx-310, cy-348, 250, 110, 8);  // 左眼區
  g.rect(cx+60,  cy-348, 250, 110, 8);  // 右眼區
  g.noErase();
}

// ══════════════════════════════════════════════════════
// 動態眼睛繪製（在主 canvas 上，依人臉 landmarks 定位）
// style: 'ghost'=鬼王風, 'butterfly'=彩蝶風
// ══════════════════════════════════════════════════════
function drawDynamicEye(pts, vx, vy, side, style) {
  let outerIdx, innerIdx, topIdx, botIdx, pupilIdx, topLidIdx, botLidIdx;
  if (side === 'R') {
    outerIdx=33;  innerIdx=133; topIdx=159; botIdx=145; pupilIdx=468;
    topLidIdx=158; botLidIdx=153; // 上下眼皮更精確點
  } else {
    outerIdx=263; innerIdx=362; topIdx=386; botIdx=374; pupilIdx=473;
    topLidIdx=385; botLidIdx=380;
  }

  let outer = {x:vx(pts[outerIdx].x), y:vy(pts[outerIdx].y)};
  let inner = {x:vx(pts[innerIdx].x), y:vy(pts[innerIdx].y)};
  let top   = {x:vx(pts[topIdx].x),   y:vy(pts[topIdx].y)};
  let bot   = {x:vx(pts[botIdx].x),   y:vy(pts[botIdx].y)};
  let pupil = pts[pupilIdx]
    ? {x:vx(pts[pupilIdx].x), y:vy(pts[pupilIdx].y)}
    : {x:(outer.x+inner.x)/2, y:(outer.y+inner.y)/2};

  let ew = dist(outer.x, outer.y, inner.x, inner.y);
  let eh = dist(top.x, top.y, bot.x, bot.y);

  // ── 眨眼偵測：計算眼睛開合比例 (EAR) ──
  // EAR = 眼高 / 眼寬，閉眼時趨近 0
  let ear = eh / ew;
  let eyeOpen = constrain(map(ear, 0.04, 0.20, 0.0, 1.0), 0.0, 1.0);
  // 閉眼閾值：ear < 0.07 視為眨眼
  let isBlinking = ear < 0.07;

  // 眼睛中心與旋轉角
  let ecx = (outer.x + inner.x) / 2;
  let ecy = (outer.y + inner.y) / 2;
  let eAngle = atan2(inner.y - outer.y, inner.x - outer.x);

  // 瞳孔在局部座標（去旋轉）
  let dpx = pupil.x - ecx, dpy = pupil.y - ecy;
  let rpx =  dpx*cos(-eAngle) - dpy*sin(-eAngle);
  let rpy =  dpx*sin(-eAngle) + dpy*cos(-eAngle);

  // 眼睛高度：最少 ew*0.18 避免完全消失（除非真的閉眼）
  let drawEH = max(eh, ew * 0.18);
  // 眨眼時上眼皮下壓動態
  let lidClose = isBlinking ? 1.0 : (1.0 - eyeOpen) * 0.3;

  push();
  translate(ecx, ecy);
  rotate(eAngle);

  if (style === 'ghost') {
    // ════ 鬼王眼 ════
    // 眼周菱形銀白光芒
    noStroke();
    fill(200, 240, 210, 190);
    let gR = ew * 0.72;
    beginShape();
    vertex(-gR, 0); vertex(0, -gR*0.55); vertex(gR, 0); vertex(0, gR*0.55);
    endShape(CLOSE);

    if (isBlinking) {
      // 閉眼：畫上下眼皮合攏
      fill(8, 50, 18);
      ellipse(0, 0, ew * 1.05, drawEH * 0.4);
      // 閉眼時黑色細線
      stroke(5, 5, 5); strokeWeight(max(2, ew*0.04)); noFill();
      line(-ew*0.5, 0, ew*0.5, 0);
    } else {
      // 眼白
      fill(210, 245, 215);
      let openH = drawEH * (1.0 - lidClose * 0.8);
      // 使用 beginShape 讓上眼皮可動態壓下
      beginShape();
      // 上半弧（隨眨眼壓低）
      for (let a = PI; a <= TWO_PI; a += 0.15) {
        vertex(cos(a)*ew*0.52, sin(a)*openH*0.75*(1-lidClose*0.6));
      }
      // 下半弧（固定）
      for (let a = 0; a <= PI; a += 0.15) {
        vertex(cos(a)*ew*0.52, sin(a)*drawEH*0.75);
      }
      endShape(CLOSE);

      // 黃綠虹膜（眨眼時縮小）
      let irisSize = drawEH * 0.95 * eyeOpen;
      fill(50, 195, 70);
      ellipse(rpx, rpy, irisSize, irisSize);

      // 黑色瞳孔（眨眼時瞳孔放大模擬）
      let pupilSize = irisSize * lerp(0.55, 0.75, 1.0-eyeOpen);
      fill(8, 8, 8);
      ellipse(rpx, rpy, pupilSize, pupilSize);

      // 高光
      fill(255, 255, 200, 220);
      ellipse(rpx - irisSize*0.22, rpy - irisSize*0.22, irisSize*0.22, irisSize*0.22);
      fill(255, 255, 180, 100);
      ellipse(rpx + irisSize*0.15, rpy + irisSize*0.1, irisSize*0.1, irisSize*0.1);

      // 上眼皮線（加粗，隨閉眼下壓）
      noFill();
      stroke(8, 8, 8);
      strokeWeight(max(2.5, ew*0.055));
      let lidY = -drawEH * 0.75 * (1-lidClose);
      beginShape();
      for (let a = PI; a <= TWO_PI; a += 0.1) {
        vertex(cos(a)*ew*0.52, sin(a)*openH*0.75*(1-lidClose*0.6));
      }
      endShape();

      // 下眼線（細）
      stroke(30, 80, 30, 160);
      strokeWeight(max(1.5, ew*0.025));
      arc(0, 0, ew*1.04, drawEH*1.5, 0, PI, OPEN);
    }

    // 眼角鬼氣尾線（無論開閉都顯示）
    noFill();
    stroke(0, 160, 50, 200);
    strokeWeight(max(2, ew*0.04));
    line(ew*0.52, -drawEH*0.1, ew*0.8, -drawEH*0.5);
    line(-ew*0.52, drawEH*0.05, -ew*0.75, drawEH*0.35);

  } else if (style === 'butterfly') {
    // ════ 彩蝶眼 ════
    // 眼影光暈（大橢圓，柔和）
    noStroke();
    fill(220, 110, 165, 150);
    ellipse(0, 0, ew*1.35, drawEH*2.4);

    if (isBlinking) {
      // 閉眼：上下眼皮合攏，畫細弧線
      fill(180, 80, 120);
      ellipse(0, 0, ew*1.02, drawEH*0.35);
      // 閉眼睫毛（往下彎）
      stroke(60, 15, 30); strokeWeight(max(2, ew*0.03)); noFill();
      for (let i=0; i<6; i++) {
        let t = (i/5)*ew*0.9 - ew*0.45;
        line(t, drawEH*0.05, t*1.05 + (i-2.5)*2, drawEH*0.35);
      }
    } else {
      // 眼白
      fill(255, 248, 252);
      let openH = drawEH * (1.0 - lidClose * 0.85);
      beginShape();
      for (let a = PI; a <= TWO_PI; a += 0.12) {
        vertex(cos(a)*ew*0.51, sin(a)*openH*0.72*(1-lidClose*0.5));
      }
      for (let a = 0; a <= PI; a += 0.12) {
        vertex(cos(a)*ew*0.51, sin(a)*drawEH*0.72);
      }
      endShape(CLOSE);

      // 虹膜（深棕紫，大而有神）
      let irisSize = drawEH * 1.05 * eyeOpen;
      fill(90, 40, 55);
      ellipse(rpx, rpy, irisSize, irisSize);

      // 瞳孔（深黑）
      let pupilSize = irisSize * lerp(0.50, 0.72, 1.0-eyeOpen);
      fill(12, 8, 10);
      ellipse(rpx, rpy, pupilSize, pupilSize);

      // 虹膜光環
      noFill();
      stroke(140, 70, 90, 80);
      strokeWeight(max(1, irisSize*0.06));
      ellipse(rpx, rpy, irisSize*0.75, irisSize*0.75);

      // 高光（大+小）
      noStroke();
      fill(255, 255, 255, 235);
      ellipse(rpx - irisSize*0.2, rpy - irisSize*0.2, irisSize*0.23, irisSize*0.23);
      fill(255, 255, 255, 120);
      ellipse(rpx + irisSize*0.12, rpy + irisSize*0.08, irisSize*0.11, irisSize*0.11);

      // 上眼線（深色加粗）
      noFill();
      stroke(70, 18, 38);
      strokeWeight(max(3, ew*0.058));
      beginShape();
      for (let a = PI; a <= TWO_PI; a += 0.1) {
        vertex(cos(a)*ew*0.51, sin(a)*openH*0.72*(1-lidClose*0.5));
      }
      endShape();

      // 眼尾上揚線（花旦特色）
      stroke(110, 35, 65);
      strokeWeight(max(2.5, ew*0.045));
      line(ew*0.49, -drawEH*0.08, ew*0.78, -drawEH*0.62);

      // 睫毛（7根，隨眼睛開合長度變化）
      stroke(35, 12, 22);
      strokeWeight(max(1.8, ew*0.028));
      let lashCount = 7;
      for (let i=0; i<lashCount; i++) {
        let t = (i/(lashCount-1)) - 0.5;
        let lx = t * ew * 0.88;
        let baseY = -sqrt(max(0, pow(ew*0.51,2)-pow(lx,2))) * openH*0.72*(1-lidClose*0.5) / ew*0.51;
        baseY = -openH * 0.72 * (1-lidClose*0.5) * sqrt(max(0,1-pow(lx/(ew*0.51),2)));
        let llen = drawEH * eyeOpen * (0.55 + 0.35*(1-abs(t)*1.6));
        line(lx, baseY, lx + t*drawEH*0.18, baseY - llen);
      }

      // 下眼線（細粉）
      stroke(170, 75, 125, 130);
      strokeWeight(max(1.2, ew*0.022));
      arc(0, 0, ew*1.02, drawEH*1.44, 0, PI, OPEN);
    }
  }

  noStroke(); pop();
}

// ══════════════════════════════════════════════════════
// 動態嘴巴繪製（隨張口即時變化）
// style: 'ghost'=鬼王風, 'butterfly'=彩蝶風
// ══════════════════════════════════════════════════════
function drawDynamicMouth(pts, vx, vy, style) {
  let mL   = {x:vx(pts[61].x),  y:vy(pts[61].y)};
  let mR   = {x:vx(pts[291].x), y:vy(pts[291].y)};
  let mUT  = {x:vx(pts[13].x),  y:vy(pts[13].y)};
  let mLB  = {x:vx(pts[14].x),  y:vy(pts[14].y)};
  let mUL  = {x:vx(pts[39].x),  y:vy(pts[39].y)};
  let mUR  = {x:vx(pts[269].x), y:vy(pts[269].y)};
  let mLL  = {x:vx(pts[181].x), y:vy(pts[181].y)};
  let mLR  = {x:vx(pts[405].x), y:vy(pts[405].y)};
  let mUI  = {x:vx(pts[0].x),   y:vy(pts[0].y)};
  let mLI  = {x:vx(pts[17].x),  y:vy(pts[17].y)};

  let mw     = dist(mL.x,mL.y,mR.x,mR.y);
  let mOpen  = dist(mUI.x,mUI.y,mLI.x,mLI.y);
  let mcx    = (mL.x+mR.x)/2, mcy=(mL.y+mR.y)/2;
  let mAngle = atan2(mR.y-mL.y, mR.x-mL.x);
  let openRatio = constrain(mOpen/(mw*0.5),0,1);

  const toLocal = (p) => {
    let dx=p.x-mcx, dy=p.y-mcy;
    return { x: dx*cos(-mAngle)-dy*sin(-mAngle),
             y: dx*sin(-mAngle)+dy*cos(-mAngle) };
  };
  let lL=toLocal(mL), lR=toLocal(mR);
  let lUT=toLocal(mUT), lLB=toLocal(mLB);
  let lUL=toLocal(mUL), lUR=toLocal(mUR);
  let lLL=toLocal(mLL), lLR=toLocal(mLR);
  let lUI=toLocal(mUI), lLI=toLocal(mLI);
  let hw=mw/2;

  push();
  translate(mcx,mcy);
  rotate(mAngle);

  if (style==='ghost') {
    noStroke();
    // 口腔底色
    if (openRatio>0.05) {
      fill(120,10,10);
      beginShape();
      vertex(lL.x,lL.y);
      bezierVertex(lL.x+hw*0.3,lUI.y*0.6,lR.x-hw*0.3,lUI.y*0.6,lR.x,lR.y);
      bezierVertex(lR.x-hw*0.3,lLI.y*0.8,lL.x+hw*0.3,lLI.y*0.8,lL.x,lL.y);
      endShape(CLOSE);
      fill(55,5,5,170);
      ellipse(0,(lUI.y+lLI.y)*0.5,mw*0.48,mOpen*0.45);
    }
    // 上排牙（鋸齒）
    if (openRatio>0.08) {
      let tw=mw*0.72, tN=5, tH=min(abs(lUI.y)*0.85,mOpen*0.38);
      for (let i=0;i<tN;i++) {
        let t=i/(tN-1), tx=lerp(-tw/2,tw/2,t), tsw=tw/tN*0.88;
        fill(225,240,218);
        rect(tx-tsw/2,lUI.y*0.08,tsw,tH*0.6,2);
        triangle(tx-tsw/2,lUI.y*0.08,tx+tsw/2,lUI.y*0.08,tx,lUI.y*0.08-tH*0.45);
      }
      if (openRatio>0.15) {
        let bN=4, bH=min(lLI.y*0.75,mOpen*0.28);
        for (let i=0;i<bN;i++) {
          let t=i/(bN-1), tx=lerp(-tw*0.45,tw*0.45,t), bsw=tw/bN*0.82;
          fill(215,230,208);
          rect(tx-bsw/2,lLI.y*0.06-bH*0.5,bsw,bH*0.5,2);
          triangle(tx-bsw/2,lLI.y*0.08,tx+bsw/2,lLI.y*0.08,tx,lLI.y*0.08+bH*0.45);
        }
      }
    }
    // 上唇
    fill(12,60,22);
    beginShape();
    vertex(lL.x,lL.y);
    bezierVertex(lL.x+hw*0.25,lUL.y*1.1,lUL.x,lUL.y*1.3,0,lUT.y*1.5);
    bezierVertex(lUR.x,lUR.y*1.3,lR.x-hw*0.25,lUL.y*1.1,lR.x,lR.y);
    bezierVertex(lR.x-hw*0.3,lUI.y*0.22,lL.x+hw*0.3,lUI.y*0.22,lL.x,lL.y);
    endShape(CLOSE);
    fill(25,90,35,175);
    triangle(lUL.x*0.5,lUT.y*1.2,lUR.x*0.5,lUR.y*1.2,0,lUT.y*1.65);
    // 下唇
    fill(15,72,28);
    beginShape();
    vertex(lL.x,lL.y);
    bezierVertex(lL.x+hw*0.3,lLI.y*0.22,lR.x-hw*0.3,lLI.y*0.22,lR.x,lR.y);
    bezierVertex(lLR.x,lLR.y*1.1,lLL.x,lLL.y*1.1,lL.x,lL.y);
    endShape(CLOSE);
    fill(35,110,45,145);
    ellipse(0,lLB.y*0.82,mw*0.33,abs(lLB.y)*0.2);
    // 嘴角橫線
    stroke(5,35,10,215);
    strokeWeight(max(2.5,mw*0.035));
    line(lL.x,lL.y,lL.x-mw*0.15,lL.y-mOpen*0.25);
    line(lR.x,lR.y,lR.x+mw*0.15,lR.y-mOpen*0.25);

  } else if (style==='butterfly') {
    noStroke();
    // 口腔底色
    if (openRatio>0.05) {
      fill(190,65,95);
      beginShape();
      vertex(lL.x,lL.y);
      bezierVertex(lL.x+hw*0.3,lUI.y*0.5,lR.x-hw*0.3,lUI.y*0.5,lR.x,lR.y);
      bezierVertex(lR.x-hw*0.3,lLI.y*0.8,lL.x+hw*0.3,lLI.y*0.8,lL.x,lL.y);
      endShape(CLOSE);
      // 舌頭
      if (openRatio>0.3) {
        fill(230,100,130,195);
        ellipse(0,(lUI.y+lLI.y)*0.42,mw*0.38,mOpen*0.44);
        stroke(200,70,100,140); strokeWeight(max(1,mw*0.015));
        line(0,(lUI.y+lLI.y)*0.24,0,(lUI.y+lLI.y)*0.62);
        noStroke();
      }
    }
    // 上排牙（圓潤）
    if (openRatio>0.08) {
      let tw=mw*0.68, tN=6, tH=min(abs(lUI.y)*0.9,mOpen*0.42);
      for (let i=0;i<tN;i++) {
        let t=i/(tN-1), tx=lerp(-tw/2,tw/2,t), tsw=tw/tN*0.86;
        fill(255,250,253);
        rect(tx-tsw/2,lUI.y*0.08,tsw,tH,3,3,0,0);
      }
      if (openRatio>0.18) {
        let bN=5, bH=min(lLI.y*0.78,mOpen*0.3);
        for (let i=0;i<bN;i++) {
          let t=i/(bN-1), tx=lerp(-tw*0.42,tw*0.42,t), bsw=tw/bN*0.82;
          fill(250,246,250);
          rect(tx-bsw/2,lLI.y*0.06-bH,bsw,bH,0,0,3,3);
        }
      }
    }
    // 上唇（蝴蝶結）
    fill(205,60,100);
    beginShape();
    vertex(lL.x,lL.y);
    bezierVertex(lL.x+hw*0.2,lUL.y*0.8,lUL.x,lUL.y*1.2,0,lUT.y*1.45);
    bezierVertex(lUR.x,lUR.y*1.2,lR.x-hw*0.2,lUR.y*0.8,lR.x,lR.y);
    bezierVertex(lR.x-hw*0.3,lUI.y*0.2,lL.x+hw*0.3,lUI.y*0.2,lL.x,lL.y);
    endShape(CLOSE);
    fill(235,95,130);
    ellipse(0,lUT.y*0.88,mw*0.17,abs(lUT.y)*0.52);
    // 下唇
    fill(220,72,108);
    beginShape();
    vertex(lL.x,lL.y);
    bezierVertex(lL.x+hw*0.3,lLI.y*0.22,lR.x-hw*0.3,lLI.y*0.22,lR.x,lR.y);
    bezierVertex(lLR.x,lLR.y*1.12,lLL.x,lLL.y*1.12,lL.x,lL.y);
    endShape(CLOSE);
    fill(255,165,190,172);
    ellipse(0,lLB.y*0.66,mw*0.31,abs(lLB.y)*0.26);
    fill(255,200,215,98);
    ellipse(hw*0.2,lLB.y*0.52,mw*0.11,abs(lLB.y)*0.14);
    // 嘴角弧
    noFill();
    stroke(160,50,85,165);
    strokeWeight(max(1.8,mw*0.028));
    arc(lL.x+mw*0.06,lL.y,mw*0.14,mOpen*0.5+mw*0.1,PI*0.6,PI*1.35);
    arc(lR.x-mw*0.06,lR.y,mw*0.14,mOpen*0.5+mw*0.1,PI*1.65,PI*2.4);
  }
  noStroke(); pop();
}


// ── 程式碼臉譜渲染到 offscreen ──
function drawDynamicCheeks(pts, vx, vy, style) {
  // 臉頰中心：用顴骨 landmark
  // 左顴: 234(耳前), 50(臉頰), 右顴: 454, 280
  // 用更穩定的點：左 116, 右 345（臉頰中外側）
  let cL = { x: vx(pts[116].x), y: vy(pts[116].y) };
  let cR = { x: vx(pts[345].x), y: vy(pts[345].y) };

  // 臉寬（估算裝飾尺寸）
  let faceW = abs(vx(pts[33].x) - vx(pts[263].x)) * 2.2;
  let sz = faceW * 0.13; // 裝飾基礎大小

  if (style === 'ghost') {
    // ── 鬼王臉頰：動態螺旋鬼紋 ──
    for (let side of [cL, cR]) {
      noFill();
      stroke(0, 160, 50, 200);
      strokeWeight(max(3, sz * 0.08));
      // 螺旋（從外到內）
      beginShape();
      for (let a = 0; a < TWO_PI * 2.8; a += 0.08) {
        let r = sz * (1 - a / (TWO_PI * 2.8)) * 0.9;
        vertex(side.x + cos(a) * r, side.y + sin(a) * r);
      }
      endShape();
      // 外圓
      stroke(0, 120, 35, 150);
      strokeWeight(max(2, sz * 0.05));
      noFill();
      ellipse(side.x, side.y, sz * 2, sz * 2);
      // 中心點
      noStroke();
      fill(0, 180, 55, 200);
      ellipse(side.x, side.y, sz * 0.25, sz * 0.25);
    }

  } else if (style === 'butterfly') {
    // ── 彩蝶臉頰：鳳仙花 + 腮紅 ──
    for (let side of [cL, cR]) {
      // 柔和腮紅底層
      noStroke();
      fill(240, 130, 165, 70);
      ellipse(side.x, side.y, sz * 2.8, sz * 1.8);

      // 六瓣鳳仙花
      fill(220, 95, 165, 175);
      for (let a = 0; a < TWO_PI; a += TWO_PI / 6) {
        ellipse(
          side.x + cos(a) * sz * 0.55,
          side.y + sin(a) * sz * 0.55,
          sz * 0.55, sz * 0.55
        );
      }
      // 花心
      fill(255, 215, 230);
      ellipse(side.x, side.y, sz * 0.45, sz * 0.45);
      // 花心小點
      fill(220, 90, 150);
      ellipse(side.x, side.y, sz * 0.18, sz * 0.18);

      // 光澤小點（隨機對稱）
      fill(255, 240, 245, 160);
      for (let a = PI/6; a < TWO_PI; a += TWO_PI/3) {
        ellipse(
          side.x + cos(a) * sz * 0.3,
          side.y + sin(a) * sz * 0.3,
          sz * 0.12, sz * 0.12
        );
      }
    }
  }
  noStroke();
}

function renderCodeMask(pts, vx, vy, drawFn) {
  let fLE = pts[468]
    ? {x:vx(pts[468].x),y:vy(pts[468].y)}
    : {x:(vx(pts[133].x)+vx(pts[33].x))/2, y:(vy(pts[133].y)+vy(pts[33].y))/2};
  let fRE = pts[473]
    ? {x:vx(pts[473].x),y:vy(pts[473].y)}
    : {x:(vx(pts[362].x)+vx(pts[263].x))/2, y:(vy(pts[362].y)+vy(pts[263].y))/2};
  let fM  = {x:vx(pts[13].x), y:vy(pts[13].y)};

  let m = MASKS[currentMask];
  let eyeMidX = (fLE.x+fRE.x)/2, eyeMidY = (fLE.y+fRE.y)/2;
  let faceEyeSpan  = dist(fLE.x,fLE.y,fRE.x,fRE.y);
  let eyeToMouth   = dist(eyeMidX,eyeMidY,fM.x,fM.y);
  let angle = atan2(fLE.y-fRE.y, fLE.x-fRE.x);

  let scaleW = faceEyeSpan / (m.eyeSpanU * CW);
  let scaleH = eyeToMouth  / (m.eyeToMouthV * CH);
  let sc = max(scaleW, scaleH);

  // 1. 繪製臉譜底圖到 maskCanvas
  if (drawFn === 'drawGhostKing')    drawGhostKing(maskCanvas);
  if (drawFn === 'drawButterflyDan') drawButterflyDan(maskCanvas);

  // 2. 貼到 offscreen（縮放+旋轉）
  let og = offscreen.drawingContext;
  offscreen.clear();
  og.save();
  og.translate(eyeMidX, eyeMidY);
  og.rotate(angle);
  og.scale(sc, sc);
  og.drawImage(maskCanvas.canvas, -m.eyeMidU*CW, -m.eyeMidV*CH, CW, CH);
  og.restore();

  // 3. 只挖空眼睛（嘴巴不挖，直接用動態函數覆蓋）
  applyEyeCutout(pts, vx, vy);

  // 4. 貼到主 canvas
  image(offscreen, 0, 0);

  let style = (drawFn === 'drawGhostKing') ? 'ghost' : 'butterfly';

  // 5. 動態眼睛（在透明孔上方繪製）
  drawDynamicEye(pts, vx, vy, 'R', style);
  drawDynamicEye(pts, vx, vy, 'L', style);

  // 6. 動態嘴巴（直接覆蓋在臉譜上，不需先挖空）
  drawDynamicMouth(pts, vx, vy, style);

  // 7. 動態臉頰裝飾
  drawDynamicCheeks(pts, vx, vy, style);
}

function applyFaceCutout(pts, vx, vy) {
  let og = offscreen.drawingContext;
  og.save();
  og.globalCompositeOperation = 'destination-out';
  og.fillStyle = 'rgba(0,0,0,1)';
  const cut = idxArr => {
    og.beginPath();
    idxArr.forEach((idx,i) => {
      let p=pts[idx]; if(!p)return;
      i===0 ? og.moveTo(vx(p.x),vy(p.y)) : og.lineTo(vx(p.x),vy(p.y));
    });
    og.closePath(); og.fill();
  };
  cut([33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]);
  cut([263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466]);
  cut([61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185]);
  og.restore();
}

// 只挖眼睛（程式碼臉譜用，嘴巴不挖讓動態嘴巴直接覆蓋）
function applyEyeCutout(pts, vx, vy) {
  let og = offscreen.drawingContext;
  og.save();
  og.globalCompositeOperation = 'destination-out';
  og.fillStyle = 'rgba(0,0,0,1)';
  const cut = idxArr => {
    og.beginPath();
    idxArr.forEach((idx,i) => {
      let p=pts[idx]; if(!p)return;
      i===0 ? og.moveTo(vx(p.x),vy(p.y)) : og.lineTo(vx(p.x),vy(p.y));
    });
    og.closePath(); og.fill();
  };
  cut([33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]);
  cut([263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466]);
  og.restore();
}

// ── 圖片臉譜渲染 ──
function renderImgMask(pts, vx, vy) {
  let m = MASKS[currentMask];
  let img = m.img;
  if (!img || !img.canvas) return;

  let fLE = pts[468]
    ? {x:vx(pts[468].x),y:vy(pts[468].y)}
    : {x:(vx(pts[133].x)+vx(pts[33].x))/2, y:(vy(pts[133].y)+vy(pts[33].y))/2};
  let fRE = pts[473]
    ? {x:vx(pts[473].x),y:vy(pts[473].y)}
    : {x:(vx(pts[362].x)+vx(pts[263].x))/2, y:(vy(pts[362].y)+vy(pts[263].y))/2};
  let fM  = {x:vx(pts[13].x), y:vy(pts[13].y)};

  let eyeMidX=(fLE.x+fRE.x)/2, eyeMidY=(fLE.y+fRE.y)/2;
  let faceEyeSpan=dist(fLE.x,fLE.y,fRE.x,fRE.y);
  let eyeToMouth =dist(eyeMidX,eyeMidY,fM.x,fM.y);
  let angle=atan2(fLE.y-fRE.y,fLE.x-fRE.x);

  let drawW=max(faceEyeSpan/m.eyeSpanU,(eyeToMouth/m.eyeToMouthV)*(img.width/img.height));
  let drawH=drawW/(img.width/img.height);

  let og=offscreen.drawingContext;
  offscreen.clear();
  og.save();
  og.translate(eyeMidX,eyeMidY);
  og.rotate(angle);
  og.drawImage(img.canvas,-m.eyeMidU*drawW,-m.eyeMidV*drawH,drawW,drawH);
  og.restore();
  applyFaceCutout(pts,vx,vy);
}

function getFingerCount(hand) {
  const kp = hand.keypoints;
  const index  = kp[8].y  < kp[6].y;
  const middle = kp[12].y < kp[10].y;
  const ring   = kp[16].y < kp[14].y;
  const pinky  = kp[20].y < kp[18].y;
  let palmSize   = dist(kp[0].x,kp[0].y,kp[9].x,kp[9].y);
  let tipToIndex = dist(kp[4].x,kp[4].y,kp[5].x,kp[5].y);
  const thumb = tipToIndex > palmSize * 0.45;
  if (thumb && index && middle && ring && pinky) return 5;
  if (!thumb && index && middle && ring && pinky) return 4;
  if (index && middle && ring && !pinky) return 3;
  if (index && middle && !ring && !pinky) return 2;
  if (index && !middle && !ring && !pinky) return 1;
  return 0;
}

function getEarPos(pts, vx, vy, side) {
  let lobeIdx = side==='left' ? 177 : 401;
  let topIdx  = side==='left' ? 234 : 454;
  if (!pts[lobeIdx]||!pts[topIdx]) return null;
  return {
    lobe:{x:vx(pts[lobeIdx].x),y:vy(pts[lobeIdx].y)},
    top: {x:vx(pts[topIdx].x), y:vy(pts[topIdx].y)},
  };
}

function draw() {
  background(15);
  push(); translate(width,0); scale(-1,1);
  image(video,0,0,width,height);
  pop();

  const vx = x => map(x,0,video.width,width,0);
  const vy = y => map(y,0,video.height,0,height);

  processHands(vx,vy);

  let wantAcc = targetAcc > 0;
  accAlpha = constrain(accAlpha+(wantAcc?15:-15),0,255);

  if (facePredictions.length > 0) {
    let pts = facePredictions[0].keypoints;
    if (accAlpha>0 && targetAcc>0) {
      drawAccessory(pts,vx,vy,'left');
      drawAccessory(pts,vx,vy,'right');
    }
    let m = MASKS[currentMask];
    if (m.type==='img') {
      renderImgMask(pts,vx,vy);
      image(offscreen,0,0);
    } else {
      // renderCodeMask 內部自行呼叫 image(offscreen) 並繪製動態眼嘴
      renderCodeMask(pts,vx,vy,m.drawFn);
    }
  }

  if (anim.active) {
    anim.progress += 1/anim.frames;
    fill(0,0,0,sin(anim.progress*PI)*200);
    noStroke(); rect(0,0,width,height);
    if (anim.progress>=1){anim.active=false;anim.progress=0;}
  }

  drawHandFeedback(vx,vy);
  drawHUD();
}

function processHands(vx,vy) {
  if (handPredictions.length===0){
    swipe.startX=null; swipe.triggered=false; fingerNum.holdCount=0; return;
  }
  let nums = handPredictions.map(h=>getFingerCount(h));
  let rawNum = Math.max(...nums);
  if (rawNum===fingerNum.raw) fingerNum.holdCount++;
  else { fingerNum.raw=rawNum; fingerNum.holdCount=0; }
  if (fingerNum.holdCount>=fingerNum.holdNeeded && fingerNum.stable!==fingerNum.raw) {
    fingerNum.stable=fingerNum.raw;
    targetAcc=fingerNum.stable;
  }
  let wx=vx(handPredictions[0].keypoints[0].x);
  if (swipe.startX===null){ swipe.startX=wx; swipe.triggered=false; }
  else {
    let dx=wx-swipe.startX;
    if (!swipe.triggered && abs(dx)>width*0.14) {
      swipe.triggered=true;
      let dir=dx>0?1:-1;
      let next=(currentMask+dir+MASKS.length)%MASKS.length;
      anim.active=true; anim.progress=0;
      setTimeout(()=>{currentMask=next;},(anim.frames/2)*(1000/60));
      setTimeout(()=>{swipe.startX=wx;swipe.triggered=false;},700);
    }
  }
}

function drawAccessory(pts,vx,vy,side) {
  let ear=getEarPos(pts,vx,vy,side);
  if (!ear) return;
  let accIdx=targetAcc-1;
  if (accIdx<0||accIdx>=ACCESSORIES.length) return;
  let acc=ACCESSORIES[accIdx], img=accImages[accIdx];
  if (!img||!img.canvas) return;
  let faceW=200;
  if (pts[33]&&pts[263]) faceW=abs(vx(pts[33].x)-vx(pts[263].x))*2.2;
  let drawW=faceW*acc.scale, drawH=drawW*(img.height/img.width);
  let ancX=acc.anchorU*drawW, ancY=acc.anchorV*drawH;
  let px=ear.lobe.x+faceW*acc.offsetX, py=ear.lobe.y+faceW*acc.offsetY;
  let ctx=drawingContext;
  ctx.save(); ctx.globalAlpha=accAlpha/255;
  ctx.translate(px,py);
  if (side==='right') ctx.scale(-1,1);
  ctx.drawImage(img.canvas,-ancX,-ancY,drawW,drawH);
  ctx.restore();
}

function drawHandFeedback(vx,vy) {
  if (handPredictions.length===0) return;
  for (let hand of handPredictions) {
    let w=hand.keypoints[0], wx=vx(w.x), wy=vy(w.y);
    fill(255,220,0,170); noStroke(); ellipse(wx,wy,22,22);
    if (swipe.startX!==null) {
      let prog=constrain(abs(wx-swipe.startX)/(width*0.14),0,1);
      noFill(); stroke(60,60,60,140); strokeWeight(5);
      arc(wx,wy-44,52,52,-PI,0,OPEN);
      stroke(swipe.triggered?color(255,80,80):color(80,255,150),220);
      arc(wx,wy-44,52,52,-PI,-PI+PI*prog,OPEN);
      noStroke();
      if (abs(wx-swipe.startX)>20){
        fill(255,220,0,180); textAlign(CENTER,CENTER); textSize(26);
        text(wx>swipe.startX?'▶':'◀',wx,wy-80);
      }
    }
  }
}

function drawHUD() {
  push(); textAlign(CENTER,CENTER); noStroke();
  let label=MASKS[currentMask].label;
  let lw=max(textWidth(label)+40,180);
  fill(0,0,0,145); rect(width/2-lw/2,12,lw,40,10);
  fill(255,215,0); textSize(max(15,width*0.022));
  text(label,width/2,32);
  // 耳飾標籤
  let accLabel=targetAcc>0?`${targetAcc} ${ACCESSORIES[targetAcc-1].name}`:'✋ 比數字換耳飾';
  fill(0,0,0,130); rect(width-180,12,168,40,10);
  fill(targetAcc>0?color(255,215,0):color(200,200,200));
  textSize(max(13,width*0.018)); text(accLabel,width-96,32);
  // 耳飾列
  let panelX=16,panelY=height-70;
  fill(0,0,0,120); rect(panelX-8,panelY-12,190,56,10);
  for (let i=0;i<5;i++){
    let bx=panelX+i*36, by=panelY+8, active=targetAcc===i+1;
    fill(active?color(255,215,0):color(60,60,60,180));
    ellipse(bx+8,by,28,28);
    fill(active?0:180); textSize(13); textAlign(CENTER,CENTER);
    text(i+1,bx+8,by);
    if (active){fill(255,215,0);textSize(10);text(ACCESSORIES[i].name,bx+8,by+20);}
  }
  // 頁碼點
  for (let i=0;i<MASKS.length;i++){
    fill(i===currentMask?color(255,215,0):color(180,180,180,120));
    ellipse(width/2+(i-(MASKS.length-1)/2)*22,height-20,11,11);
  }
  fill(255,255,255,90); textSize(30); textAlign(CENTER,CENTER);
  text('◀',32,height/2); text('▶',width-32,height/2);
  pop();
}

function windowResized(){
  resizeCanvas(windowWidth,windowHeight);
  offscreen.resizeCanvas(windowWidth,windowHeight);
}
