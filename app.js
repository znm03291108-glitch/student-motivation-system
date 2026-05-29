import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, serverTimestamp, increment, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// 重要：把下面配置替换成你 Firebase 项目的配置
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const authView = $("authView");
const mainView = $("mainView");
const authMsg = $("authMsg");
let currentUser = null;
let currentProfile = null;
let unsubscribers = [];

const defaultTasks = [
  ["每日阅读 30 分钟", 10],
  ["英语跟读 15 分钟", 12],
  ["错题复盘 3 道", 8]
];
const defaultRewards = [["看动画 20 分钟", 30], ["周末小零食", 50], ["亲子游戏一次", 80]];
const defaultPenalties = [["作业拖延", 5], ["上课走神", 5], ["未完成计划", 10]];

function showMsg(text){ authMsg.textContent = text || ""; }
function isAdmin(){ return currentProfile && ["parent","teacher"].includes(currentProfile.role); }
function roleName(role){ return role === "teacher" ? "老师" : role === "parent" ? "家长" : "学生"; }
function todayKey(){ return new Date().toISOString().slice(0,10); }
function level(score){ if(score>=300) return "钻石小学霸"; if(score>=180) return "黄金小学霸"; if(score>=80) return "白银小学霸"; return "青铜小学霸"; }
function nextNeed(score){ if(score<80) return 80-score; if(score<180) return 180-score; if(score<300) return 300-score; return 0; }

async function seedDefaults(){
  const seedRef = doc(db,"system","seed");
  const seed = await getDoc(seedRef);
  if(seed.exists()) return;
  for(const [title,points] of defaultTasks) await addDoc(collection(db,"tasks"),{title,points,createdAt:serverTimestamp()});
  for(const [title,cost] of defaultRewards) await addDoc(collection(db,"rewards"),{title,cost,createdAt:serverTimestamp()});
  for(const [title,points] of defaultPenalties) await addDoc(collection(db,"penalties"),{title,points,createdAt:serverTimestamp()});
  await setDoc(seedRef,{done:true,createdAt:serverTimestamp()});
}

async function logAction(text, userId=currentUser?.uid){
  await addDoc(collection(db,"logs"),{text,userId,name:currentProfile?.name||"用户",createdAt:serverTimestamp()});
}
async function addScore(delta, reason){
  const ref = doc(db,"users",currentUser.uid);
  await updateDoc(ref,{score:increment(delta),updatedAt:serverTimestamp()});
  await logAction(`${reason}：${delta>0?"+":""}${delta} 分`);
}

function switchPage(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===page));
  document.querySelectorAll(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
}

document.querySelectorAll("[data-auth-tab]").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll("[data-auth-tab]").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  const login = btn.dataset.authTab === "login";
  $("loginForm").classList.toggle("hidden",!login);
  $("registerForm").classList.toggle("hidden",login);
});
document.querySelectorAll(".nav-btn").forEach(btn=>btn.onclick=()=>switchPage(btn.dataset.page));

$("registerForm").onsubmit = async (e)=>{
  e.preventDefault(); showMsg("正在注册...");
  try{
    const name = $("regName").value.trim();
    const role = $("regRole").value;
    const cred = await createUserWithEmailAndPassword(auth,$("regEmail").value,$("regPassword").value);
    await setDoc(doc(db,"users",cred.user.uid),{name,email:cred.user.email,role,score:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    showMsg("");
  }catch(err){ showMsg("注册失败：" + err.message); }
};
$("loginForm").onsubmit = async (e)=>{
  e.preventDefault(); showMsg("正在登录...");
  try{ await signInWithEmailAndPassword(auth,$("loginEmail").value,$("loginPassword").value); showMsg(""); }
  catch(err){ showMsg("登录失败：" + err.message); }
};
$("logoutBtn").onclick = () => signOut(auth);

$("checkinBtn").onclick = async ()=>{
  const ref = doc(db,"users",currentUser.uid,"daily",todayKey());
  const snap = await getDoc(ref);
  if(snap.exists() && snap.data().checkedIn){ alert("今天已经签到过了"); return; }
  await setDoc(ref,{checkedIn:true,doneCount:snap.data()?.doneCount||0,updatedAt:serverTimestamp()},{merge:true});
  await addScore(5,"每日签到");
};

$("taskForm").onsubmit = async(e)=>{ e.preventDefault(); if(!isAdmin()) return; await addDoc(collection(db,"tasks"),{title:$("taskTitle").value,points:Number($("taskPoints").value),createdAt:serverTimestamp()}); e.target.reset(); };
$("rewardForm").onsubmit = async(e)=>{ e.preventDefault(); if(!isAdmin()) return; await addDoc(collection(db,"rewards"),{title:$("rewardTitle").value,cost:Number($("rewardCost").value),createdAt:serverTimestamp()}); e.target.reset(); };
$("penaltyForm").onsubmit = async(e)=>{ e.preventDefault(); if(!isAdmin()) return; await addDoc(collection(db,"penalties"),{title:$("penaltyTitle").value,points:Number($("penaltyPoints").value),createdAt:serverTimestamp()}); e.target.reset(); };

function renderTasks(){
  const q = query(collection(db,"tasks"),orderBy("createdAt","desc"));
  unsubscribers.push(onSnapshot(q,snap=>{
    $("taskList").innerHTML = "";
    snap.forEach(d=>{
      const x = d.data(); const el = document.createElement("div"); el.className="item";
      el.innerHTML = `<div><strong>${x.title}</strong><small>完成奖励 ${x.points} 分</small></div><button class="secondary">完成</button>`;
      el.querySelector("button").onclick = async()=>{
        const dayRef = doc(db,"users",currentUser.uid,"daily",todayKey());
        const day = await getDoc(dayRef);
        await setDoc(dayRef,{doneCount:(day.data()?.doneCount||0)+1,updatedAt:serverTimestamp()},{merge:true});
        await addScore(Number(x.points||0),`完成任务「${x.title}」`);
      };
      $("taskList").appendChild(el);
    });
  }));
}
function renderRewards(){
  const q = query(collection(db,"rewards"),orderBy("createdAt","desc"));
  unsubscribers.push(onSnapshot(q,snap=>{
    $("rewardList").innerHTML = "";
    snap.forEach(d=>{ const x=d.data(); const el=document.createElement("div"); el.className="item"; el.innerHTML=`<div><strong>${x.title}</strong><small>需要 ${x.cost} 分</small></div><button class="primary">兑换</button>`; el.querySelector("button").onclick=async()=>{ if((currentProfile.score||0)<x.cost){alert("积分不足");return;} await addScore(-Number(x.cost||0),`兑换奖励「${x.title}」`); }; $("rewardList").appendChild(el); });
  }));
}
function renderPenalties(){
  const q = query(collection(db,"penalties"),orderBy("createdAt","desc"));
  unsubscribers.push(onSnapshot(q,snap=>{
    $("penaltyList").innerHTML = "";
    snap.forEach(d=>{ const x=d.data(); const el=document.createElement("div"); el.className="item"; el.innerHTML=`<div><strong>${x.title}</strong><small>扣 ${x.points} 分</small></div><button class="danger">执行扣分</button>`; el.querySelector("button").onclick=async()=>{ if(!isAdmin()){alert("只有家长/老师可以执行扣分");return;} await addScore(-Number(x.points||0),`惩罚扣分「${x.title}」`); }; $("penaltyList").appendChild(el); });
  }));
}
function renderRanking(){
  const q = query(collection(db,"users"),orderBy("score","desc"),limit(20));
  unsubscribers.push(onSnapshot(q,snap=>{
    const html=[]; let i=1;
    snap.forEach(d=>{ const x=d.data(); html.push(`<div class="rank-item"><strong>${i++}. ${x.name||"未命名"} <small>${roleName(x.role)}</small></strong><span class="pill">${x.score||0} 分</span></div>`); });
    $("rankList").innerHTML=html.join("")||"暂无数据"; $("adminStudents").innerHTML=html.join("")||"暂无数据";
  }));
}
function renderLogs(){
  const q = query(collection(db,"logs"),orderBy("createdAt","desc"),limit(50));
  unsubscribers.push(onSnapshot(q,snap=>{
    $("logList").innerHTML="";
    snap.forEach(d=>{ const x=d.data(); const el=document.createElement("div"); el.className="log-item"; const t=x.createdAt?.toDate?x.createdAt.toDate().toLocaleString():"刚刚"; el.innerHTML=`<div><strong>${x.name||"用户"}</strong><br><span>${x.text}</span><br><small>${t}</small></div>`; $("logList").appendChild(el); });
  }));
}
function renderDaily(){
  const ref = doc(db,"users",currentUser.uid,"daily",todayKey());
  unsubscribers.push(onSnapshot(ref,snap=>{$("todayDone").textContent=snap.data()?.doneCount||0;}));
}
function updateProfileUI(){
  const score = currentProfile.score || 0;
  $("scoreValue").textContent = score;
  $("levelValue").textContent = level(score);
  $("userLine").textContent = `${currentProfile.name} · ${roleName(currentProfile.role)} · ${currentUser.email}`;
  const need = nextNeed(score); $("nextLevelText").textContent = need ? `距离下一等级还需 ${need} 分` : "已达到最高等级";
  const percent = score<80 ? score/80*100 : score<180 ? (score-80)/100*100 : score<300 ? (score-180)/120*100 : 100;
  $("levelBar").style.width = Math.max(0,Math.min(100,percent)) + "%";
  document.querySelectorAll(".admin-only").forEach(x=>x.classList.toggle("hidden",!isAdmin()));
}

onAuthStateChanged(auth, async(user)=>{
  unsubscribers.forEach(fn=>fn()); unsubscribers=[]; currentUser=user;
  if(!user){ authView.classList.remove("hidden"); mainView.classList.add("hidden"); return; }
  try{ await seedDefaults(); }catch(e){ console.warn(e); }
  const ref = doc(db,"users",user.uid);
  let snap = await getDoc(ref);
  if(!snap.exists()) await setDoc(ref,{name:user.email.split("@")[0],email:user.email,role:"student",score:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  authView.classList.add("hidden"); mainView.classList.remove("hidden");
  unsubscribers.push(onSnapshot(ref,s=>{ currentProfile=s.data(); updateProfileUI(); }));
  renderTasks(); renderRewards(); renderPenalties(); renderRanking(); renderLogs(); renderDaily();
});
