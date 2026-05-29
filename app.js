import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  increment,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   Firebase 配置
========================= */

const firebaseConfig = {
  apiKey: "AIzaSyCyiA9YxmIMR81ken1XhAdnmtKYKQi2rMo",
  authDomain: "student-motivation-system.firebaseapp.com",
  projectId: "student-motivation-system",
  storageBucket: "student-motivation-system.firebasestorage.app",
  messagingSenderId: "868892030834",
  appId: "1:868892030834:web:f46e6104f2f80388cc8feb"
};

/* =========================
   初始化
========================= */

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
  ["错题复盘 3 道", 8],
  ["完成数学练习", 10],
  ["背诵古诗/课文", 10]
];

const defaultRewards = [
  ["看动画 20 分钟", 30],
  ["周末小零食", 50],
  ["亲子游戏一次", 80],
  ["兑换一次玩具奖励", 120],
  ["周末外出游玩一次", 200]
];

const defaultPenalties = [
  ["作业拖延", 5],
  ["上课走神", 5],
  ["未完成计划", 10],
  ["玩手机超时", 10],
  ["没有按时睡觉", 8]
];

function showMsg(text) {
  if (authMsg) authMsg.textContent = text || "";
}

function isAdmin() {
  return currentProfile && ["parent", "teacher"].includes(currentProfile.role);
}

function roleName(role) {
  if (role === "teacher") return "老师";
  if (role === "parent") return "家长";
  return "学生";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getLevel(score) {
  if (score >= 300) return "钻石小学霸";
  if (score >= 180) return "黄金小学霸";
  if (score >= 80) return "白银小学霸";
  return "青铜小学霸";
}

function nextNeed(score) {
  if (score < 80) return 80 - score;
  if (score < 180) return 180 - score;
  if (score < 300) return 300 - score;
  return 0;
}

/* =========================
   初始化默认数据
========================= */

async function seedDefaults() {
  const seedRef = doc(db, "system", "seed");
  const seedSnap = await getDoc(seedRef);

  if (seedSnap.exists()) return;

  for (const [title, points] of defaultTasks) {
    await addDoc(collection(db, "tasks"), {
      title,
      points,
      createdAt: serverTimestamp()
    });
  }

  for (const [title, cost] of defaultRewards) {
    await addDoc(collection(db, "rewards"), {
      title,
      cost,
      createdAt: serverTimestamp()
    });
  }

  for (const [title, points] of defaultPenalties) {
    await addDoc(collection(db, "penalties"), {
      title,
      points,
      createdAt: serverTimestamp()
    });
  }

  await setDoc(seedRef, {
    done: true,
    createdAt: serverTimestamp()
  });
}

/* =========================
   日志与积分
========================= */

async function logAction(text) {
  if (!currentUser || !currentProfile) return;

  await addDoc(collection(db, "logs"), {
    text,
    userId: currentUser.uid,
    name: currentProfile.name || "用户",
    createdAt: serverTimestamp()
  });
}

async function addScore(delta, reason) {
  if (!currentUser) return;

  const userRef = doc(db, "users", currentUser.uid);

  await updateDoc(userRef, {
    score: increment(delta),
    updatedAt: serverTimestamp()
  });

  await logAction(`${reason}：${delta > 0 ? "+" : ""}${delta} 分`);
}

/* =========================
   页面切换
========================= */

function switchPage(page) {
  document.querySelectorAll(".page").forEach((el) => {
    el.classList.toggle("active", el.id === page);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
}

document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll("[data-auth-tab]").forEach((x) => {
      x.classList.remove("active");
    });

    btn.classList.add("active");

    const isLogin = btn.dataset.authTab === "login";

    $("loginForm").classList.toggle("hidden", !isLogin);
    $("registerForm").classList.toggle("hidden", isLogin);
    showMsg("");
  };
});

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.onclick = () => switchPage(btn.dataset.page);
});

/* =========================
   注册
========================= */

$("registerForm").onsubmit = async (e) => {
  e.preventDefault();
  showMsg("正在注册...");

  try {
    const name = $("regName").value.trim();
    const role = $("regRole").value;
    const email = $("regEmail").value.trim();
    const password = $("regPassword").value;

    if (!name) {
      showMsg("请输入姓名");
      return;
    }

    if (password.length < 6) {
      showMsg("密码至少需要 6 位");
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      role,
      score: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    showMsg("注册成功，正在进入系统...");
  } catch (err) {
    showMsg("注册失败：" + err.message);
  }
};

/* =========================
   登录
========================= */

$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  showMsg("正在登录...");

  try {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    await signInWithEmailAndPassword(auth, email, password);
    showMsg("");
  } catch (err) {
    showMsg("登录失败：" + err.message);
  }
};

/* =========================
   退出
========================= */

$("logoutBtn").onclick = async () => {
  await signOut(auth);
};

/* =========================
   每日签到
========================= */

$("checkinBtn").onclick = async () => {
  const dayRef = doc(db, "users", currentUser.uid, "daily", todayKey());
  const daySnap = await getDoc(dayRef);

  if (daySnap.exists() && daySnap.data().checkedIn) {
    alert("今天已经签到过了");
    return;
  }

  await setDoc(
    dayRef,
    {
      checkedIn: true,
      doneCount: daySnap.data()?.doneCount || 0,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await addScore(5, "每日签到");
};

/* =========================
   添加任务
========================= */

$("taskForm").onsubmit = async (e) => {
  e.preventDefault();

  if (!isAdmin()) {
    alert("只有家长或老师可以添加任务");
    return;
  }

  const title = $("taskTitle").value.trim();
  const points = Number($("taskPoints").value);

  if (!title || !points) return;

  await addDoc(collection(db, "tasks"), {
    title,
    points,
    createdAt: serverTimestamp()
  });

  e.target.reset();
};

/* =========================
   添加奖励
========================= */

$("rewardForm").onsubmit = async (e) => {
  e.preventDefault();

  if (!isAdmin()) {
    alert("只有家长或老师可以添加奖励");
    return;
  }

  const title = $("rewardTitle").value.trim();
  const cost = Number($("rewardCost").value);

  if (!title || !cost) return;

  await addDoc(collection(db, "rewards"), {
    title,
    cost,
    createdAt: serverTimestamp()
  });

  e.target.reset();
};

/* =========================
   添加惩罚
========================= */

$("penaltyForm").onsubmit = async (e) => {
  e.preventDefault();

  if (!isAdmin()) {
    alert("只有家长或老师可以添加惩罚规则");
    return;
  }

  const title = $("penaltyTitle").value.trim();
  const points = Number($("penaltyPoints").value);

  if (!title || !points) return;

  await addDoc(collection(db, "penalties"), {
    title,
    points,
    createdAt: serverTimestamp()
  });

  e.target.reset();
};

/* =========================
   渲染任务
========================= */

function renderTasks() {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));

  const unsub = onSnapshot(q, (snap) => {
    $("taskList").innerHTML = "";

    snap.forEach((d) => {
      const data = d.data();

      const item = document.createElement("div");
      item.className = "item";

      item.innerHTML = `
        <div>
          <strong>${data.title}</strong>
          <small>完成奖励 ${data.points} 分</small>
        </div>
        <button class="secondary">完成</button>
      `;

      item.querySelector("button").onclick = async () => {
        const dayRef = doc(db, "users", currentUser.uid, "daily", todayKey());
        const daySnap = await getDoc(dayRef);

        await setDoc(
          dayRef,
          {
            doneCount: (daySnap.data()?.doneCount || 0) + 1,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );

        await addScore(Number(data.points || 0), `完成任务「${data.title}」`);
      };

      $("taskList").appendChild(item);
    });
  });

  unsubscribers.push(unsub);
}

/* =========================
   渲染奖励
========================= */

function renderRewards() {
  const q = query(collection(db, "rewards"), orderBy("createdAt", "desc"));

  const unsub = onSnapshot(q, (snap) => {
    $("rewardList").innerHTML = "";

    snap.forEach((d) => {
      const data = d.data();

      const item = document.createElement("div");
      item.className = "item";

      item.innerHTML = `
        <div>
          <strong>${data.title}</strong>
          <small>需要 ${data.cost} 分</small>
        </div>
        <button class="primary">兑换</button>
      `;

      item.querySelector("button").onclick = async () => {
        if ((currentProfile.score || 0) < data.cost) {
          alert("积分不足");
          return;
        }

        await addScore(-Number(data.cost || 0), `兑换奖励「${data.title}」`);
      };

      $("rewardList").appendChild(item);
    });
  });

  unsubscribers.push(unsub);
}

/* =========================
   渲染惩罚
========================= */

function renderPenalties() {
  const q = query(collection(db, "penalties"), orderBy("createdAt", "desc"));

  const unsub = onSnapshot(q, (snap) => {
    $("penaltyList").innerHTML = "";

    snap.forEach((d) => {
      const data = d.data();

      const item = document.createElement("div");
      item.className = "item";

      item.innerHTML = `
        <div>
          <strong>${data.title}</strong>
          <small>扣 ${data.points} 分</small>
        </div>
        <button class="danger">执行扣分</button>
      `;

      item.querySelector("button").onclick = async () => {
        if (!isAdmin()) {
          alert("只有家长或老师可以执行扣分");
          return;
        }

        await addScore(-Number(data.points || 0), `惩罚扣分「${data.title}」`);
      };

      $("penaltyList").appendChild(item);
    });
  });

  unsubscribers.push(unsub);
}

/* =========================
   排行榜
========================= */

function renderRanking() {
  const q = query(collection(db, "users"), orderBy("score", "desc"), limit(20));

  const unsub = onSnapshot(q, (snap) => {
    let html = "";
    let index = 1;

    snap.forEach((d) => {
      const data = d.data();

      html += `
        <div class="rank-item">
          <strong>${index++}. ${data.name || "未命名"} 
            <small>${roleName(data.role)}</small>
          </strong>
          <span class="pill">${data.score || 0} 分</span>
        </div>
      `;
    });

    $("rankList").innerHTML = html || "暂无数据";
    $("adminStudents").innerHTML = html || "暂无数据";
  });

  unsubscribers.push(unsub);
}

/* =========================
   操作记录
========================= */

function renderLogs() {
  const q = query(collection(db, "logs"), orderBy("createdAt", "desc"), limit(50));

  const unsub = onSnapshot(q, (snap) => {
    $("logList").innerHTML = "";

    snap.forEach((d) => {
      const data = d.data();

      const time = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleString()
        : "刚刚";

      const item = document.createElement("div");
      item.className = "log-item";

      item.innerHTML = `
        <div>
          <strong>${data.name || "用户"}</strong><br>
          <span>${data.text || ""}</span><br>
          <small>${time}</small>
        </div>
      `;

      $("logList").appendChild(item);
    });
  });

  unsubscribers.push(unsub);
}

/* =========================
   今日数据
========================= */

function renderDaily() {
  const dayRef = doc(db, "users", currentUser.uid, "daily", todayKey());

  const unsub = onSnapshot(dayRef, (snap) => {
    $("todayDone").textContent = snap.data()?.doneCount || 0;
  });

  unsubscribers.push(unsub);
}

/* =========================
   用户界面
========================= */

function updateProfileUI() {
  if (!currentProfile) return;

  const score = currentProfile.score || 0;

  $("scoreValue").textContent = score;
  $("levelValue").textContent = getLevel(score);

  $("userLine").textContent = `${currentProfile.name || "用户"} · ${roleName(
    currentProfile.role
  )} · ${currentUser.email}`;

  const need = nextNeed(score);

  $("nextLevelText").textContent = need
    ? `距离下一等级还需 ${need} 分`
    : "已达到最高等级";

  let percent = 100;

  if (score < 80) {
    percent = (score / 80) * 100;
  } else if (score < 180) {
    percent = ((score - 80) / 100) * 100;
  } else if (score < 300) {
    percent = ((score - 180) / 120) * 100;
  }

  $("levelBar").style.width = Math.max(0, Math.min(100, percent)) + "%";

  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin());
  });
}

/* =========================
   登录状态监听
========================= */

onAuthStateChanged(auth, async (user) => {
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];
  currentUser = user;
  currentProfile = null;

  if (!user) {
    authView.classList.remove("hidden");
    mainView.classList.add("hidden");
    return;
  }

  try {
    await seedDefaults();
  } catch (err) {
    console.warn("初始化默认数据失败：", err);
  }

  const userRef = doc(db, "users", user.uid);
  let userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      name: user.email.split("@")[0],
      email: user.email,
      role: "student",
      score: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  authView.classList.add("hidden");
  mainView.classList.remove("hidden");

  const unsubUser = onSnapshot(userRef, (snap) => {
    currentProfile = snap.data();
    updateProfileUI();
  });

  unsubscribers.push(unsubUser);

  renderTasks();
  renderRewards();
  renderPenalties();
  renderRanking();
  renderLogs();
  renderDaily();
});
