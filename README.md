# 星星成长计划 V2：登录版 + 云端数据保存版

这是适合中小学生的学习效率激励系统 V2，支持邮箱注册登录、学生/家长/老师身份、积分云端保存、任务、奖励、惩罚、排行榜、操作记录。

## 一、项目文件

- `index.html`：页面入口
- `style.css`：页面样式
- `app.js`：系统逻辑 + Firebase 数据库

## 二、需要先开通 Firebase

1. 打开 Firebase 官网：https://firebase.google.com/
2. 使用 Google 账号登录
3. 点击 `Go to console`
4. 点击 `Add project / 添加项目`
5. 项目名建议：`student-motivation-system`
6. 创建完成后进入项目

## 三、开启登录功能

1. 左侧点击 `Build`
2. 点击 `Authentication`
3. 点击 `Get started`
4. 选择 `Email/Password`
5. 开启第一个 `Email/Password`
6. 点击 `Save`

## 四、开启数据库 Firestore

1. 左侧点击 `Build`
2. 点击 `Firestore Database`
3. 点击 `Create database`
4. 选择 `Start in test mode`
5. 地区任选，建议默认
6. 创建完成

## 五、复制 Firebase 配置

1. Firebase 项目主页点击 `</>` Web App
2. App nickname 填：`student-v2`
3. 注册 App
4. 复制 firebaseConfig
5. 打开本项目 `app.js`
6. 替换最上面的配置：

```js
const firebaseConfig = {
  apiKey: "你的 apiKey",
  authDomain: "你的 authDomain",
  projectId: "你的 projectId",
  storageBucket: "你的 storageBucket",
  messagingSenderId: "你的 messagingSenderId",
  appId: "你的 appId"
};
```

## 六、Firestore 测试规则

开发测试阶段可以先用下面规则，方便手机快速测试。后续正式运营一定要加强权限。

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 七、部署到 GitHub Pages

1. 把 `index.html / style.css / app.js / README.md` 上传到 GitHub 仓库根目录
2. 进入 `Settings`
3. 点击 `Pages`
4. Source 选择 `Deploy from a branch`
5. Branch 选择 `main`
6. Folder 选择 `/(root)`
7. 点击 `Save`
8. 等 1-3 分钟打开 GitHub Pages 网址

## 八、当前 V2 功能

- 学生邮箱注册登录
- 家长/老师邮箱注册登录
- 云端保存积分
- 学习任务完成加分
- 每日签到加分
- 奖励兑换扣分
- 惩罚规则扣分
- 排行榜
- 操作记录
- 家长/老师添加任务、奖励、惩罚

## 九、V3 可升级方向

- 家长绑定孩子账号
- 老师创建班级
- 作业上传图片
- AI 自动生成学习计划
- 错题本
- 积分商城订单审核
- 微信/Telegram 提醒
- 后台管理面板
