# Ranxin / 然鑫个人网站

Astro 静态个人作品集。英文昵称 Ranxin 与中文昵称然鑫分别维护；真实姓名在个人资料面板和简历中展示。服务器与 GitHub Pages 共用公开资料与交互。

## 本地构建与预览

需要 Node.js 22.23.4 以上（建议 Node.js 24）和 npm。

```powershell
npm ci
npm test
npm run check
npm run build
npm run preview -- --port 4321
```

项目路径包含 `#` 时，Vite 开发服务可能无法解析虚拟模块；使用上面的静态构建预览。构建会先清理本项目的 `dist/`，避免历史资源进入交付包。

## 公开资料与简历

统一编辑 `src/data/content.json`。`profile.nicknameEn` 是英文昵称，`profile.nicknameZh` 是中文昵称，`profile.name` 是真实姓名。项目中的个人职责、团队产出、验证阶段与实践收获分别维护。

网页与 PDF 使用同一份资料。安装 Python 的 reportlab 后运行：

```powershell
python scripts/generate_resume.py
npm run build
```

生成器使用可嵌入中文字体；也可用 `PORTFOLIO_CJK_FONT` 指定字体文件。构建会核对 PDF 的资料摘要，资料变化而 PDF 未更新时阻止发布。公开附件随站部署，发布版本在 `dist/release.json`。

## 三个核心体验

首页可以直接操作，项目详情提供完整控件。两处复用公开样例与计算逻辑，页面内保留各自状态；重置或刷新恢复初始状态。

- **拆板工作台**：BH 三块板、BOX 四块板的合拢、拆开与按比例展平；板件选择与尺寸联动，普通／余量轮廓对比。余量按每端计，左右各外扩设定值，总长为原长加两倍余量；板宽、孔位和孔径保持不变。缺少尺寸时显示待核并阻止核对通过。预处理与余料库体验保留在详情页次级展开区。
- **气象与出力**：独立生成的风速、辐照与参考出力，使用明确的教学功率曲线；气象调整只改变预测。比较固定 T+0 持续性基线，按 4／12／24 小时重算 MAE、RMSE、平均偏差。
- **跨页追线**：双页端子、器件与导线，选择起点和目标后按顺序追踪；查询结果可定位图页和线段。待核、冲突和器件内部关系不进入已确认路径。

所有样例集中在 `src/experiences/`，不包含真实图纸、场站数据、私有解析器或业务接口。拆板展示团队项目流程，本人贡献、团队产出和验证阶段分别说明。教学计算不代表实际设备曲线或模型精度。

首页使用系统指针与稳定控件。项目字带按实测宽度循环铺满；动画用于解释拆板、出力变化和追线路径。支持深浅主题、键盘、触屏、减少动画、无脚本静态阅读及打印。隐藏或离开视口的工作台暂停动画。

## 检查

```powershell
npm test
npm run check
npm run build
# 预览服务在 4321 运行后：
npm run test:browser
```

浏览器检查覆盖身份展示、三个体验、筛选、键盘、移动视口、减少动画、存储受限、无脚本、打印和同源资源。使用 `TEST_URL` 与 `TEST_BASE` 检查其他入口；模拟视口不等同于真机验收。

## 双端部署与回退

GitHub Pages 的 Source 使用 GitHub Actions。主分支提交执行检查；公开发布在 Actions 中手动运行 `Publish personal website`。工作流从 Pages 设置获取站点地址与路径前缀。

```powershell
$env:SITE_URL = 'https://ranbaixin.github.io'
$env:SITE_BASE = '/personal-portfolio/'
npm run build
```

服务器使用 `deploy/Caddyfile`，正式域名确定且接入条件满足后设置 `PORTFOLIO_DOMAIN`。网站根目录为 `/srv/portfolio/current`。首次正式域名构建时设置 `SITE_URL`、`SITE_BASE=/`；备案号使用 `PUBLIC_ICP_NUMBER`。域名及备案尚未就绪时只做回环地址验收。

部署只取 `dist/`。更新前记录稳定提交和包的 SHA-256，服务器使用独立版本目录。Pages 回退时从已记录的稳定提交恢复并重新运行发布工作流；服务器回退为恢复上一版本的 `current` 链接。保留证书、历史版本与其他服务状态。

该仓库只存放已确认公开的内容和独立样例。来源核对、企业材料、服务器管理、凭据与验收原始记录留在本地项目目录之外的私有交付区域。
