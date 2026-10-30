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

## 三个交互体验

- 图纸流程：重绘几何、缺失字段校验、重复记录处理、交接字段转换和余料库存状态。通过校验后锁定源字段，重置后可再次编辑。
- 出力预测：确定性生成场景，比较演示预测与固定起点的持续性基线，按窗口实时计算 MAE、RMSE 与平均偏差。
- 端口查询：重建连接图，区分直接连接、已确认网络、待核与冲突，查询时保留器件边界和样例依据。

每个体验的公开样例、纯计算逻辑、静态视图与客户端交互集中在 `src/experiences/` 对应目录。页面按需加载自己的客户端模块。所有状态只在当前页面内存在，刷新或重置恢复；不向真实业务系统发送请求。

样例由网站独立构建，不包含原始业务图纸、真实场站数据或私有软件代码。演示计算与实际研究验证分别说明。项目页默认展示体验，职责和成果按需切换；禁用脚本仍可阅读静态结果与完整正文，打印包含全部项目说明。

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
