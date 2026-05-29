const defaultData = {
  points: 0,
  checkedDate: "",
  tasks: [
    { id: 1, name: "完成数学口算 20 题", points: 10, done: false },
    { id: 2, name: "英语跟读 15 分钟", points: 15, done: false },
    { id: 3, name: "语文阅读 20 分钟", points: 12, done: false },
    { id: 4, name: "整理错题本", points: 10, done: false }
  ],
  rewards: [
    { id: 1, name: "看动画片 20 分钟", cost: 30 },
    { id: 2, name: "周末公园游玩", cost: 80 },
    { id: 3, name: "兑换一个小礼物", cost: 120 },
    { id: 4, name: "选择一次晚餐菜单", cost: 60 }
  ],
  punishments: [
    { id: 1, name: "作业拖延超过 30 分钟", cost: 10 },
    { id: 2, name: "上课/学习分心严重", cost: 8 },
    { id: 3, name: "未整理学习用品", cost: 5 },
    { id: 4, name: "当天任务未完成", cost: 15 }
  ],
  students: [
    { name: "小明", points: 86 },
    { name: "小红", points: 72 },
    { name: "小宇", points: 58 }
  ]
};

let data = JSON.parse(localStorage.getItem("study-system") || "null") || defaultData;

function save() {
  localStorage.setItem("study-system", JSON.stringify(data));
  render();
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

function level(points) {
  if (points >= 300) return ["钻石小学霸", 300, 500];
  if (points >= 150) return ["黄金小学霸", 150, 300];
  if (points >= 50) return ["白银小学霸", 50, 150];
  return ["青铜小学霸", 0, 50];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function switchTab(tab) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === tab));
}

document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

document.getElementById("dailyCheckBtn").addEventListener("click", () => {
  if (data.checkedDate === today()) return toast("今天已经签到过啦");
  data.checkedDate = today();
  data.points += 5;
  toast("签到成功，积分 +5");
  save();
});

document.getElementById("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  data.tasks.push({ id: Date.now(), name: taskName.value, points: Number(taskPoints.value), done: false });
  e.target.reset(); taskPoints.value = 10;
  toast("任务已添加"); save();
});

document.getElementById("rewardForm").addEventListener("submit", (e) => {
  e.preventDefault();
  data.rewards.push({ id: Date.now(), name: rewardName.value, cost: Number(rewardCost.value) });
  e.target.reset(); rewardCost.value = 30;
  toast("奖励已添加"); save();
});

document.getElementById("punishForm").addEventListener("submit", (e) => {
  e.preventDefault();
  data.punishments.push({ id: Date.now(), name: punishName.value, cost: Number(punishCost.value) });
  e.target.reset(); punishCost.value = 10;
  toast("惩罚规则已添加"); save();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  localStorage.removeItem("study-system");
  data = JSON.parse(JSON.stringify(defaultData));
  toast("已恢复初始数据"); save();
});

function completeTask(id) {
  const task = data.tasks.find(t => t.id === id);
  if (!task || task.done) return;
  task.done = true;
  data.points += task.points;
  toast(`完成任务，积分 +${task.points}`);
  save();
}

function exchangeReward(id) {
  const reward = data.rewards.find(r => r.id === id);
  if (!reward) return;
  if (data.points < reward.cost) return toast("积分不足，继续努力");
  data.points -= reward.cost;
  toast(`兑换成功：${reward.name}`);
  save();
}

function applyPunish(id) {
  const p = data.punishments.find(x => x.id === id);
  if (!p) return;
  data.points = Math.max(0, data.points - p.cost);
  toast(`已扣除 ${p.cost} 积分`);
  save();
}

function render() {
  const doneCount = data.tasks.filter(t => t.done).length;
  const [name, min, max] = level(data.points);
  const percent = Math.min(100, ((data.points - min) / (max - min)) * 100);
  totalPoints.textContent = data.points;
  levelName.textContent = name;
  todayDone.textContent = doneCount;
  levelProgress.style.width = `${percent}%`;
  nextLevelText.textContent = data.points >= 300 ? "你已经是最高等级，继续保持！" : `距离下一等级还需 ${max - data.points} 分`;

  taskList.innerHTML = data.tasks.map(t => `
    <div class="task ${t.done ? "done" : ""}">
      <div><strong>${t.name}</strong><br><span class="badge">+${t.points} 分</span></div>
      <button onclick="completeTask(${t.id})" ${t.done ? "disabled" : ""}>${t.done ? "已完成" : "完成"}</button>
    </div>
  `).join("");

  rewardList.innerHTML = data.rewards.map(r => `
    <div class="card">
      <div class="row"><strong>${r.name}</strong><span class="badge">${r.cost} 分</span></div>
      <button onclick="exchangeReward(${r.id})">兑换奖励</button>
    </div>
  `).join("");

  punishList.innerHTML = data.punishments.map(p => `
    <div class="card">
      <div class="row"><strong>${p.name}</strong><span class="badge">-${p.cost} 分</span></div>
      <button onclick="applyPunish(${p.id})">执行扣分</button>
    </div>
  `).join("");

  const rank = [{ name: "我的孩子", points: data.points }, ...data.students].sort((a,b) => b.points - a.points);
  rankList.innerHTML = rank.map((s, i) => `
    <div class="rank-item">
      <strong>${i + 1}. ${s.name}</strong>
      <span class="badge">${s.points} 分</span>
    </div>
  `).join("");
}

render();
