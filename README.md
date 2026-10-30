# 肖逸辰个人网站

Astro 静态个人作品集。公开资料只有一份内容源，服务器与 GitHub Pages 使用相同页面与交互。

## 本地使用

需要 Node.js 22.23.4 以上，建议使用 Node.js 24，以及 npm。

```powershell
npm ci
npm test
npm run check
npm run dev
```

## 更新资料与简历

编辑 `src/data/content.json`。项目的个人职责、团队产出、验证范围与实践收获分别维护，不在页面组件中复制个人经历。

公开 PDF 与网页使用同一内容源。安装 Python 的 reportlab 后生成 PDF：

```powershell
python scripts/generate_resume.py
npm run build
```

生成器优先使用系统中文字体，也可用 `PORTFOLIO_CJK_FONT` 指定可嵌入的中文 TrueType 字体。构建会核对 PDF 中的内容摘要，资料变化而 PDF 未更新时会阻止发布。

`npm run build` 生成 `dist/`，部署目录只取该目录。发布信息在 `dist/release.json`，公开附件均随部署包提供。

## 双端部署

GitHub Pages：仓库 Settings → Pages → Source 选择 GitHub Actions，在 Actions 中手动运行 `Publish personal website`。工作流从 Pages 设置获取站点地址与路径前缀，无需修改内容源。主分支提交自动执行检查，公开发布使用手动工作流。

服务器：以 `deploy/Caddyfile` 为模板，设置已完成接入条件的 `PORTFOLIO_DOMAIN`，站点目录为 `/srv/portfolio/current`。在域名及备案就绪后再开放公网入口；配置文件不能替代这些接入条件。

不同根路径构建示例：

```powershell
$env:SITE_URL = 'https://ranbaixin.github.io'
$env:SITE_BASE = '/personal-portfolio/'
npm run build
```

服务器正式域名确定后，设置 `SITE_URL` 为实际 HTTPS 地址、`SITE_BASE=/`；有备案号时同时设置 `PUBLIC_ICP_NUMBER`，重新构建后显示网站页脚。避免将占位域名作为正式入口。

更新流程：修改公开资料 → 更新 PDF → 单元检查和构建 → 检查静态页面 → 提交 → 手动发布 Pages → 新版本目录部署服务器。服务器通过版本目录和 `current` 链接切换；回退时恢复上一稳定版本，保留证书与其他业务配置。

## 浏览器验收

构建后启动 `npm run preview -- --port 4321`，在另一终端运行 `npm run test:browser`。前缀站点测试时同时设置 `TEST_BASE`，并使用相同前缀构建后启动静态服务。

首版包含：项目筛选、经历展开、主题切换、减少动画、联系邮箱、简历打印与下载、独立项目详情。介绍、项目和简历在无 JavaScript 时仍可读。

该仓库只包含已确认公开的个人介绍与项目简述，不存放企业原始资料、原始证书、服务器身份、登录凭据或本地资料目录。
