# 暖日 · Warm Days

一个手机优先的个人生活管理网站。React + TypeScript + Vite，IndexedDB 本地保存，适合 GitHub Pages。无需登录，没有后台服务；不包含任何真实个人记录。

## 使用

手机底部六个入口：**今天、日程、待办、游戏、记录、我的**。电脑端使用侧栏。

- 今天：当天安排、待办、习惯打卡与专注入口。
- 日程：月历、每周重复课程、单次调课/取消、未来课程分段修改、多次站内提醒。
- 待办：自定义分类、完成归档与恢复，和日历共享日程状态。
- 记录：健身与饮食、体重/围度曲线、勾选/数量打卡、番茄钟与学习趋势、自动保存日记、备忘录。
- 我的：倒数日/纪念日、时区与专注偏好、分类管理、备份导入导出。
- 游戏：瓦罗兰特、三角洲、Steam 占位页面，后续再扩展。

提醒可多选提前1/3/5/7小时。日期事项以当天23:59为基准。提醒仅在页面运行时触发，后台暂停、锁屏或关闭后无法保证准时。再次打开可查看未确认提醒。计时器采用时间戳恢复，暂停和休息不累计学习时间；运行中的计时离开后继续至本轮目标时长，最多记录该目标时长。

## 用 GitHub Desktop 免费部署

1. 解压源码包，保留所有文件，包括隐藏的 `.github` 文件夹。不要只上传 `src`。
2. 打开 GitHub Desktop，选择 **File → Add Local Repository**，选择项目文件夹 `warm-days`。如提示不是仓库，选择 **create a repository here**，创建仓库并提交文件。默认分支使用 `main`。
3. 点击 **Publish repository**，名称可用 `warm-days`。免费 GitHub Pages 方案使用公开仓库，取消 **Keep this code private** 后发布。上传的是网站代码，不是浏览器中的日记和健康数据。
4. 在 GitHub 仓库打开 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
5. 打开 **Actions → Deploy Warm Days to GitHub Pages → Run workflow**，选择 `main`。如果首次提交的任务因尚未启用 Pages 失败，启用后重新运行即可。
6. 等待 build、deploy 成功，在 **Settings → Pages** 获取链接，通常是 `https://你的用户名.github.io/warm-days/`。

后续修改代码，提交并推送至 `main`，网站会自动更新。导出的个人备份请保存在仓库外，不要提交到 GitHub。

参考：[GitHub Pages 可用范围](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[自定义部署流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 本地开发

安装 Node.js 22 和 pnpm 11，然后在项目目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

构建与验证：

```sh
pnpm test
pnpm build
pnpm preview
```

`dist/` 是静态构建结果。请通过 HTTP 服务预览，不要双击 `index.html` 使用 `file://` 打开。`vite.config.ts` 使用相对资源路径与 Hash 路由，支持仓库子目录和独立域名。数据库命名不跟随文件哈希或部署版本变化。

## 数据与备份

所有业务记录存入 IndexedDB；偏好也随完整数据保存；日记尚未提交的草稿暂存于本机。Google Fonts 仅用于加载字体，不发送记录内容；不可用时自动使用系统字体。

- 网站更新不会主动删除数据。清理浏览器、隐私模式退出或浏览器存储回收可能删除记录。
- 手机与电脑、不同浏览器的数据互不同步。更换域名或浏览器请先在「我的」导出完整备份，再到新位置导入。
- 导入先校验结构、版本、唯一 ID 与关联关系；确认后原子替换。失败不改动已有记录。
- 导入会暂停备份内计时器，避免重复累计；先导出当前数据再替换。
- 日程的“仅本次”保留其他周；“本次及以后”创建新分段并清除该分段原来的未来例外。删除整组重复课程在“管理重复课程”中操作。
- 网页本身不提供访问密码，但个人记录不会因为别人打开同一个链接而传给别人。共用设备和浏览器的人能够访问其中的本地记录。

## 项目结构与云端升级

- `src/model.ts`：版本化数据类型、输入与备份校验。
- `src/storage.ts`：异步 `DataRepository` 协议与 IndexedDB 适配器；事务版本检查防止多标签页覆盖。
- `src/service.ts`：业务操作、重复课程分段、计时、导入导出。
- `src/domain.ts` / `src/dates.ts`：日程实例、提醒调度、时区及跨午夜统计。
- `src/pages.tsx` / `src/editors.tsx`：页面与录入；不直接读写 IndexedDB。
- `src/webmcp.ts`：可选浏览器标准的只读日程工具；不支持的浏览器自动跳过。

详见 [云端升级说明](CLOUD-UPGRADE.md)。当前只实现本地模式，不包含云端、账号、跨设备同步或后台通知；未来可以保留页面，新增远程数据适配器和认证。

## 验证

`tests/domain.test.ts` 覆盖重复课程、提醒去重、时区、番茄钟、多标签页竞争、备份完整性与 IndexedDB 重开。

详见 [验收记录](QA.md)。开发模式的 `?qa` 查询参数使用独立测试数据库，正式构建忽略该参数；测试记录不会打包进产物。
