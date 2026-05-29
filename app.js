import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, serverTimestamp, increment, query, orderBy, limit, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCyiA9YxmIMR81ken1XhAdnmtKYKQi2rMo",
  authDomain: "student-motivation-system.firebaseapp.com",
  projectId: "student-motivation-system",
  storageBucket: "student-motivation-system.firebasestorage.app",
  messagingSenderId: "868892030834",
  appId: "1:868892030834:web:f46e6104f2f80388cc8feb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let unsubscribers = [];
let selectedLesson = null;

const gradeLabels = { g1: "一年级", g2: "二年级", g3: "三年级", g4: "四年级", g5: "五年级", g6: "六年级" };
const subjectLabels = { math: "数学", chinese: "语文", english: "英语" };
const termLabels = { up: "上册", down: "下册" };

const baseUnits = {
  math: {
    g1: ["数一数与比一比", "10以内加减法", "认识图形和钟表", "20以内进位加法"],
    g2: ["表内乘法", "除法初步", "长度单位", "角的初步认识"],
    g3: ["两三位数乘除法", "千克和克", "长方形和正方形", "分数初步认识"],
    g4: ["大数认识", "三位数乘两位数", "平行与垂直", "统计与可能性"],
    g5: ["小数乘除法", "简易方程", "多边形面积", "因数与倍数"],
    g6: ["分数乘除法", "百分数", "圆", "比例与解决问题"]
  },
  chinese: {
    g1: ["拼音与识字", "看图说话", "短句朗读", "基础阅读"],
    g2: ["识字写字", "词语积累", "句子练习", "阅读理解"],
    g3: ["段落阅读", "观察作文", "古诗积累", "词句运用"],
    g4: ["概括主要内容", "人物描写", "说明性阅读", "习作表达"],
    g5: ["阅读策略", "修辞运用", "写景作文", "整本书阅读"],
    g6: ["主题阅读", "议论表达", "综合复习", "毕业衔接"]
  },
  english: {
    g1: ["字母启蒙", "日常问候", "颜色和数字", "课堂用语"],
    g2: ["家庭成员", "动物和物品", "简单句型", "听说练习"],
    g3: ["自我介绍", "学校生活", "一般疑问句", "主题词汇"],
    g4: ["时间表达", "地点方位", "现在进行时", "阅读小短文"],
    g5: ["一般现在时", "过去经历", "购物与问路", "写作基础"],
    g6: ["综合语法", "阅读理解", "话题写作", "小升初复习"]
  }
};

function makeLesson(grade, subject, term, unit, idx) {
  const gName = gradeLabels[grade];
  const sName = subjectLabels[subject];
  const tName = termLabels[term];
  const title = `${gName}${sName}${tName} · ${unit}`;
  const subjectTips = {
    math: ["先理解概念，再看例题，最后独立完成练习。", "遇到应用题时，先找已知条件和问题，再列式。", "计算题要养成验算习惯，减少粗心失分。"],
    chinese: ["先读通句子，再理解词语，最后概括主要意思。", "写作时按照观察、表达、修改三步完成。", "阅读题要从原文中找依据，不凭感觉答题。"],
    english: ["先听读，再模仿，最后尝试自己说出来。", "单词要放在句子里记，记得更牢。", "句型练习要注意人称、时态和语序。"]
  };
  const quizBank = {
    math: [
      { q: "做应用题第一步应该做什么？", options: ["直接写答案", "找已知条件和问题", "随便列式", "先看同桌答案"], answer: 1 },
      { q: "计算完成后，最好的习惯是？", options: ["立刻交卷", "验算检查", "擦掉过程", "跳过题目"], answer: 1 }
    ],
    chinese: [
      { q: "阅读理解答题时，最好从哪里找依据？", options: ["原文", "猜测", "题目外", "随便写"], answer: 0 },
      { q: "写作文前先做什么更好？", options: ["直接抄", "想清楚顺序和重点", "只写一句", "不修改"], answer: 1 }
    ],
    english: [
      { q: "记英语单词更好的方法是？", options: ["只看一眼", "放进句子里读", "不发音", "只写中文"], answer: 1 },
      { q: "练习英语口语时，应该？", options: ["不开口", "先听再模仿", "只看中文", "跳过发音"], answer: 1 }
    ]
  };
  return {
    id: `${grade}-${subject}-${term}-${idx}`,
    grade, subject, term, unit, title,
    summary: `本课围绕“${unit}”进行基础讲解，适合${gName}学生进行同步预习、复习和闯关训练。`,
    points: 8 + idx,
    knowledge: [
      `核心目标：掌握${unit}中的基本概念和常见题型。`,
      `学习方法：${subjectTips[subject][0]}`,
      `易错提醒：${subjectTips[subject][1]}`,
      `巩固建议：${subjectTips[subject][2]}`
    ],
    example: subject === "math" ? `例题：围绕“${unit}”设计一道基础题，先分析数量关系，再分步计算。` : subject === "chinese" ? `例题：阅读一段与“${unit}”相关的短文，找关键词并用自己的话概括。` : `例题：围绕“${unit}”练习 3 个核心单词和 1 个常用句型。`,
    quiz: quizBank[subject].map((q, n) => ({ ...q, id: `${grade}-${subject}-${term}-${idx}-q${n}` }))
  };
}

function buildCourses() {
  const lessons = [];
  Object.keys(gradeLabels).forEach((grade) => {
    Object.keys(subjectLabels).forEach((subject) => {
      Object.keys(termLabels).forEach((term) => {
        baseUnits[subject][grade].forEach((unit, idx) => lessons.push(makeLesson(grade, subject, term, unit, idx + 1)));
      });
    });
  });
  return lessons;
}
const courseLessons = buildCourses();

const defaultTasks = [["完成今日课程学习", 10], ["复习错题 3 道", 8], ["英语跟读 15 分钟", 12], ["阅读 20 分钟", 10]];
const defaultRewards = [["看动画 20 分钟", 30], ["周末小零食", 50], ["亲子游戏一次", 80], ["兑换玩具奖励", 120]];
const defaultPenalties = [["未完成每日学习", 5], ["玩手机超时", 10], ["作业拖延", 8]];

function showMsg(text) { $("authMsg").textContent = text || ""; }
function isAdmin() { return currentProfile && ["parent", "teacher"].includes(currentProfile.role); }
function roleName(role) { return role === "teacher" ? "老师" : role === "parent" ? "家长" : "学生"; }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function getLevel(score) { if (score >= 300) return "钻石小学霸"; if (score >= 180) return "黄金小学霸"; if (score >= 80) return "白银小学霸"; return "青铜小学霸"; }
function nextNeed(score) { if (score < 80) return 80 - score; if (score < 180) return 180 - score; if (score < 300) return 300 - score; return 0; }

async function seedDefaults() {
  const seedRef = doc(db, "system", "seed-v3");
  const seedSnap = await getDoc(seedRef);
  if (seedSnap.exists()) return;
  for (const [title, points] of defaultTasks) await addDoc(collection(db, "tasks"), { title, points, createdAt: serverTimestamp() });
  for (const [title, cost] of defaultRewards) await addDoc(collection(db, "rewards"), { title, cost, createdAt: serverTimestamp() });
  for (const [title, points] of defaultPenalties) await addDoc(collection(db, "penalties"), { title, points, createdAt: serverTimestamp() });
  await setDoc(seedRef, { done: true, createdAt: serverTimestamp() });
}

async function logAction(text) {
  if (!currentUser || !currentProfile) return;
  await addDoc(collection(db, "logs"), { text, userId: currentUser.uid, name: currentProfile.name || "用户", createdAt: serverTimestamp() });
}
async function addScore(delta, reason) {
  if (!currentUser) return;
  await updateDoc(doc(db, "users", currentUser.uid), { score: increment(delta), updatedAt: serverTimestamp() });
  await logAction(`${reason}：${delta > 0 ? "+" : ""}${delta} 分`);
}

function switchPage(page) {
  document.querySelectorAll(".page").forEach((el) => el.classList.toggle("active", el.id === page));
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.page === page));
}
document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll("[data-auth-tab]").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    const isLogin = btn.dataset.authTab === "login";
    $("loginForm").classList.toggle("hidden", !isLogin);
    $("registerForm").classList.toggle("hidden", isLogin);
    showMsg("");
  };
});
document.querySelectorAll(".nav-btn").forEach((btn) => btn.onclick = () => switchPage(btn.dataset.page));
document.querySelectorAll("[data-jump]").forEach((btn) => btn.onclick = () => switchPage(btn.dataset.jump));

$("registerForm").onsubmit = async (e) => {
  e.preventDefault();
  showMsg("正在注册...");
  try {
    const name = $("regName").value.trim();
    const role = $("regRole").value;
    const email = $("regEmail").value.trim();
    const password = $("regPassword").value;
    if (!name) return showMsg("请输入姓名");
    if (password.length < 6) return showMsg("密码至少需要 6 位");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), { name, email, role, score: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    showMsg("注册成功，正在进入系统...");
  } catch (err) { showMsg("注册失败：" + err.message); }
};
$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  showMsg("正在登录...");
  try { await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPassword").value); showMsg(""); }
  catch (err) { showMsg("登录失败：" + err.message); }
};
$("logoutBtn").onclick = () => signOut(auth);
$("checkinBtn").onclick = async () => {
  const ref = doc(db, "users", currentUser.uid, "daily", todayKey());
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().checkedIn) return alert("今天已经签到过了");
  await setDoc(ref, { checkedIn: true, doneCount: snap.data()?.doneCount || 0, updatedAt: serverTimestamp() }, { merge: true });
  await addScore(5, "每日签到");
};

function fillSelects() {
  const gradeOptions = Object.entries(gradeLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  const subjectOptions = Object.entries(subjectLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  const termOptions = Object.entries(termLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  ["gradeSelect", "practiceGrade"].forEach(id => $(id).innerHTML = gradeOptions);
  ["subjectSelect", "practiceSubject"].forEach(id => $(id).innerHTML = subjectOptions);
  $("termSelect").innerHTML = termOptions;
  ["gradeSelect", "subjectSelect", "termSelect"].forEach(id => $(id).onchange = renderCourseList);
  ["practiceGrade", "practiceSubject"].forEach(id => $(id).onchange = renderPractice);
}

function filteredLessons() {
  return courseLessons.filter(l => l.grade === $("gradeSelect").value && l.subject === $("subjectSelect").value && l.term === $("termSelect").value);
}
function renderCourseList() {
  const list = filteredLessons();
  $("courseList").innerHTML = list.map((l) => `
    <div class="lesson-card">
      <div>
        <span class="badge">${gradeLabels[l.grade]} · ${subjectLabels[l.subject]} · ${termLabels[l.term]}</span>
        <h3>${l.unit}</h3>
        <small>${l.summary}</small>
      </div>
      <button class="primary" data-lesson="${l.id}">学习 +${l.points}</button>
    </div>
  `).join("");
  document.querySelectorAll("[data-lesson]").forEach(btn => btn.onclick = () => openLesson(btn.dataset.lesson));
  $("lessonDetail").classList.add("hidden");
}
function openLesson(id) {
  selectedLesson = courseLessons.find(l => l.id === id);
  const l = selectedLesson;
  $("lessonDetail").classList.remove("hidden");
  $("lessonDetail").innerHTML = `
    <span class="badge">${gradeLabels[l.grade]} · ${subjectLabels[l.subject]} · ${termLabels[l.term]}</span>
    <h3>${l.unit}</h3>
    <p>${l.summary}</p>
    <h3>知识点讲解</h3>
    ${l.knowledge.map(k => `<div class="kp">${k}</div>`).join("")}
    <h3>原创例题</h3>
    <div class="kp">${l.example}</div>
    <h3>闯关测验</h3>
    <div class="quiz">${l.quiz.map((q, i) => renderQuestion(q, i)).join("")}</div>
    <button class="primary" id="finishLessonBtn">完成本课 +${l.points}</button>
  `;
  $("finishLessonBtn").onclick = async () => {
    await addScore(l.points, `完成课程「${l.title}」`);
    await addProgress(l, "learned");
    alert("学习完成，积分已增加！");
  };
  document.querySelectorAll("[data-answer]").forEach(btn => btn.onclick = () => answerQuestion(btn));
  $("lessonDetail").scrollIntoView({ behavior: "smooth" });
}
function renderQuestion(q, idx) {
  return `<div class="kp"><strong>${idx + 1}. ${q.q}</strong>${q.options.map((o, i) => `<button class="option" data-answer="${i}" data-qid="${q.id}">${o}</button>`).join("")}</div>`;
}
async function answerQuestion(btn) {
  const qid = btn.dataset.qid;
  const q = selectedLesson.quiz.find(x => x.id === qid);
  const chosen = Number(btn.dataset.answer);
  const siblings = btn.parentElement.querySelectorAll(".option");
  siblings.forEach((b, i) => { b.disabled = true; if (i === q.answer) b.classList.add("correct"); });
  if (chosen === q.answer) {
    await addScore(2, `答对课程题「${selectedLesson.unit}」`);
  } else {
    btn.classList.add("wrong");
    await addMistake(q, selectedLesson, chosen);
  }
}
async function addProgress(lesson, type) {
  const ref = doc(db, "users", currentUser.uid, "progress", lesson.id);
  await setDoc(ref, { lessonId: lesson.id, title: lesson.title, grade: lesson.grade, subject: lesson.subject, type, updatedAt: serverTimestamp() }, { merge: true });
  const dayRef = doc(db, "users", currentUser.uid, "daily", todayKey());
  const snap = await getDoc(dayRef);
  await setDoc(dayRef, { doneCount: (snap.data()?.doneCount || 0) + 1, updatedAt: serverTimestamp() }, { merge: true });
}
async function addMistake(q, lesson, chosen) {
  await addDoc(collection(db, "users", currentUser.uid, "mistakes"), { question: q.q, options: q.options, answer: q.answer, chosen, lessonTitle: lesson.title, createdAt: serverTimestamp(), reviewed: false });
  await logAction(`错题记录：「${q.q}」`);
}

function renderPractice() {
  const grade = $("practiceGrade").value;
  const subject = $("practiceSubject").value;
  const lessons = courseLessons.filter(l => l.grade === grade && l.subject === subject).slice(0, 4);
  const qs = lessons.flatMap(l => l.quiz.map(q => ({ ...q, lesson: l })));
  $("practiceBox").innerHTML = `<h2>${gradeLabels[grade]}${subjectLabels[subject]}同步练习</h2><div class="quiz">${qs.map((q, i) => `<div class="kp"><strong>${i + 1}. ${q.q}</strong>${q.options.map((o, n) => `<button class="option" data-practice="${i}" data-choice="${n}">${o}</button>`).join("")}</div>`).join("")}</div>`;
  document.querySelectorAll("[data-practice]").forEach(btn => btn.onclick = async () => {
    const q = qs[Number(btn.dataset.practice)];
    const chosen = Number(btn.dataset.choice);
    btn.parentElement.querySelectorAll(".option").forEach((b, i) => { b.disabled = true; if (i === q.answer) b.classList.add("correct"); });
    if (chosen === q.answer) await addScore(2, "同步练习答对"); else { btn.classList.add("wrong"); await addMistake(q, q.lesson, chosen); }
  });
}

function renderMistakes() {
  const q = query(collection(db, "users", currentUser.uid, "mistakes"), orderBy("createdAt", "desc"), limit(50));
  unsubscribers.push(onSnapshot(q, snap => {
    $("mistakeList").innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement("div");
      div.className = "mistake-item";
      div.innerHTML = `<div><strong>${m.question}</strong><small>${m.lessonTitle}<br>正确答案：${m.options?.[m.answer] || ""}</small></div><button class="secondary">复习完成 +3</button>`;
      div.querySelector("button").onclick = async () => { await setDoc(doc(db, "users", currentUser.uid, "mistakes", d.id), { reviewed: true, reviewedAt: serverTimestamp() }, { merge: true }); await addScore(3, "错题复习完成"); };
      $("mistakeList").appendChild(div);
    });
    if (!snap.size) $("mistakeList").innerHTML = `<div class="card">暂无错题，继续保持！</div>`;
  }));
}

function renderTasks() {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  unsubscribers.push(onSnapshot(q, snap => {
    $("taskList").innerHTML = "";
    snap.forEach(d => {
      const x = d.data();
      const item = document.createElement("div"); item.className = "item";
      item.innerHTML = `<div><strong>${x.title}</strong><small>完成奖励 ${x.points} 分</small></div><button class="secondary">完成</button>`;
      item.querySelector("button").onclick = async () => { await addScore(Number(x.points || 0), `完成任务「${x.title}」`); };
      $("taskList").appendChild(item);
    });
  }));
}
function renderRewards() {
  const q = query(collection(db, "rewards"), orderBy("createdAt", "desc"));
  unsubscribers.push(onSnapshot(q, snap => {
    $("rewardList").innerHTML = "";
    snap.forEach(d => {
      const x = d.data();
      const item = document.createElement("div"); item.className = "item";
      item.innerHTML = `<div><strong>${x.title}</strong><small>需要 ${x.cost} 分</small></div><button class="primary">兑换</button>`;
      item.querySelector("button").onclick = async () => { if ((currentProfile.score || 0) < x.cost) return alert("积分不足"); await addScore(-Number(x.cost || 0), `兑换奖励「${x.title}」`); };
      $("rewardList").appendChild(item);
    });
  }));
}
function renderPenalties() {
  const q = query(collection(db, "penalties"), orderBy("createdAt", "desc"));
  unsubscribers.push(onSnapshot(q, snap => {
    $("penaltyList").innerHTML = "";
    snap.forEach(d => {
      const x = d.data();
      const item = document.createElement("div"); item.className = "item";
      item.innerHTML = `<div><strong>${x.title}</strong><small>扣 ${x.points} 分</small></div><button class="danger">执行扣分</button>`;
      item.querySelector("button").onclick = async () => { if (!isAdmin()) return alert("只有家长或老师可以执行扣分"); await addScore(-Number(x.points || 0), `惩罚扣分「${x.title}」`); };
      $("penaltyList").appendChild(item);
    });
  }));
}
function renderRanking() {
  const q = query(collection(db, "users"), orderBy("score", "desc"), limit(20));
  unsubscribers.push(onSnapshot(q, snap => {
    let html = ""; let i = 1;
    snap.forEach(d => { const x = d.data(); html += `<div class="rank-item"><strong>${i++}. ${x.name || "未命名"} <small>${roleName(x.role)}</small></strong><span class="pill">${x.score || 0} 分</span></div>`; });
    $("rankList").innerHTML = html || "暂无数据";
  }));
}
function renderLogs() {
  const q = query(collection(db, "logs"), orderBy("createdAt", "desc"), limit(50));
  unsubscribers.push(onSnapshot(q, snap => {
    $("logList").innerHTML = "";
    snap.forEach(d => { const x = d.data(); const t = x.createdAt?.toDate ? x.createdAt.toDate().toLocaleString() : "刚刚"; const item = document.createElement("div"); item.className = "log-item"; item.innerHTML = `<div><strong>${x.name || "用户"}</strong><br><span>${x.text || ""}</span><br><small>${t}</small></div>`; $("logList").appendChild(item); });
  }));
}
function renderDaily() {
  const ref = doc(db, "users", currentUser.uid, "daily", todayKey());
  unsubscribers.push(onSnapshot(ref, snap => { $("todayDone").textContent = snap.data()?.doneCount || 0; }));
}
function renderReport() {
  $("reportBox").innerHTML = `<div class="report-grid"><div><strong>${courseLessons.length}</strong><br>内置课程点</div><div><strong>1-6</strong><br>覆盖年级</div><div><strong>语数英</strong><br>学习科目</div></div>`;
}

["taskForm", "rewardForm", "penaltyForm"].forEach(formId => {
  $(formId).onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return alert("只有家长或老师可以操作");
    if (formId === "taskForm") await addDoc(collection(db, "tasks"), { title: $("taskTitle").value.trim(), points: Number($("taskPoints").value), createdAt: serverTimestamp() });
    if (formId === "rewardForm") await addDoc(collection(db, "rewards"), { title: $("rewardTitle").value.trim(), cost: Number($("rewardCost").value), createdAt: serverTimestamp() });
    if (formId === "penaltyForm") await addDoc(collection(db, "penalties"), { title: $("penaltyTitle").value.trim(), points: Number($("penaltyPoints").value), createdAt: serverTimestamp() });
    e.target.reset();
  };
});

function updateProfileUI() {
  if (!currentProfile) return;
  const score = currentProfile.score || 0;
  $("scoreValue").textContent = score;
  $("levelValue").textContent = getLevel(score);
  $("userLine").textContent = `${currentProfile.name || "用户"} · ${roleName(currentProfile.role)} · ${currentUser.email}`;
  const need = nextNeed(score);
  $("nextLevelText").textContent = need ? `距离下一等级还需 ${need} 分` : "已达到最高等级";
  let percent = score < 80 ? score / 80 * 100 : score < 180 ? (score - 80) / 100 * 100 : score < 300 ? (score - 180) / 120 * 100 : 100;
  $("levelBar").style.width = Math.max(0, Math.min(100, percent)) + "%";
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !isAdmin()));
}

onAuthStateChanged(auth, async (user) => {
  unsubscribers.forEach(fn => fn()); unsubscribers = []; currentUser = user; currentProfile = null;
  if (!user) { $("authView").classList.remove("hidden"); $("mainView").classList.add("hidden"); return; }
  try { await seedDefaults(); } catch (err) { console.warn("初始化默认数据失败：", err); }
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) await setDoc(userRef, { name: user.email.split("@")[0], email: user.email, role: "student", score: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  $("authView").classList.add("hidden"); $("mainView").classList.remove("hidden");
  unsubscribers.push(onSnapshot(userRef, (snap) => { currentProfile = snap.data(); updateProfileUI(); }));
  fillSelects(); renderCourseList(); renderPractice(); renderMistakes(); renderTasks(); renderRewards(); renderPenalties(); renderRanking(); renderLogs(); renderDaily(); renderReport();
});
