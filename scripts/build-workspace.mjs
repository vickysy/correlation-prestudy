#!/usr/bin/env node
/**
 * build-workspace.mjs — 用预习数据 + 孩子配置，构建「孩子的自学工作台」HTML
 *
 * 本脚本随 correlation-prestudy skill 分发。默认使用 skill 自带的
 * assets/workspace/ 下的模板与四年级样例数据；也可用参数指向自己生成的材料。
 *
 * 用法：
 *   # 1) 用站点配置（含孩子名字/年级/兴趣/问题/作品）
 *   node build-workspace.mjs --site site.json --out 我的学习台.html
 *
 *   # 2) 只给名字/年级，其余个性化留空（空白学习台，孩子自己长出来）
 *   node build-workspace.mjs --name 小宇 --grade 三年级 --out 我的学习台.html
 *
 *   # 3) 用自己的预习材料数据（必须与样例 JSON 结构一致）
 *   node build-workspace.mjs --name 小宇 --grade 三年级 \
 *       --chinese 我的语文.json --math 我的数学.json --mathres 我的数学资源.json \
 *       --out 我的学习台.html
 *
 * 站点配置 site.json 结构：
 *   {
 *     "name": "孩子名字", "grade": "四年级",
 *     "hasGetnote": false,        // 是否有本地 Get 笔记（决定档案页显示「一键同步」还是通用导入）
 *     "interests": [{n,c,x,y}],   // 兴趣星云（可空）
 *     "defaultQs": ["问题1",...],  // 问题墙初始（可空）
 *     "works": [{badge,t,m,tags}], // 作品（可空）
 *     "quote": "一句孩子的话（可空）"
 *   }
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// 脚本位于 <skill>/scripts/，skill 资源位于 <skill>/assets/workspace/
const SKILL_ROOT = join(__dirname, "..");
const WS_ASSETS = join(SKILL_ROOT, "assets", "workspace");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
}
function loadJson(p) {
  if (!p) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { console.error("读取失败:", p, e.message); process.exit(1); }
}
function pick(flag, fallback) {
  const v = arg(flag);
  if (v) return v;
  if (existsSync(fallback)) return fallback;
  return null;
}

// ---------- SITE ----------
let site = {};
const siteFile = arg("--site");
if (siteFile) site = loadJson(siteFile) || {};
const nameArg = arg("--name");
if (nameArg) site.name = nameArg;
const gradeArg = arg("--grade");
if (gradeArg) site.grade = gradeArg;
const quoteArg = arg("--quote");
if (quoteArg) site.quote = quoteArg;
const interestsFile = arg("--interests");
if (interestsFile) site.interests = loadJson(interestsFile) || [];
const qsFile = arg("--qs");
if (qsFile) site.defaultQs = loadJson(qsFile) || [];
const worksFile = arg("--works");
if (worksFile) site.works = loadJson(worksFile) || [];
if (!site.interests) site.interests = [];
if (!site.defaultQs) site.defaultQs = [];
if (!site.works) site.works = [];
if (!site.hasGetnote) site.hasGetnote = false;
if (!site.name) site.name = "我";

// ---------- 数据 ----------
const chinesePath = pick("--chinese", join(WS_ASSETS, "data", "chinese-units.json"));
const mathPath = pick("--math", join(WS_ASSETS, "data", "math-units.json"));
const mathresPath = pick("--mathres", join(WS_ASSETS, "data", "math-res.json"));
if (!chinesePath || !mathPath || !mathresPath) {
  console.error("缺少数据文件，请用 --chinese/--math/--mathres 指定，或确认 skill 资产完整");
  process.exit(1);
}
const chinese = readFileSync(chinesePath, "utf8");
const math = readFileSync(mathPath, "utf8");
const mathres = readFileSync(mathresPath, "utf8");

// ---------- 模板 ----------
const tplPath = pick("--template", join(WS_ASSETS, "workspace-template.html"));
if (!tplPath) { console.error("缺少模板文件 workspace-template.html"); process.exit(1); }
const tpl = readFileSync(tplPath, "utf8");

// ---------- 注入 ----------
let out = tpl
  .replace("/*__SITE__*/", JSON.stringify(site).replace(/<\//g, "<\\/"))
  .replace("__SITE_NAME__", site.name)
  .replace("/*__CHINESE__*/", chinese)
  .replace("/*__MATH_UNITS__*/", math)
  .replace("/*__MATH_RES__*/", mathres);

for (const [marker, label] of [
  ["/*__SITE__*/", "SITE"], ["__SITE_NAME__", "名字"],
  ["/*__CHINESE__*/", "语文"], ["/*__MATH_UNITS__*/", "数学"], ["/*__MATH_RES__*/", "数学资源"]
]) {
  if (out.includes(marker)) { console.error("占位符未替换: " + label); process.exit(1); }
}

const outPath = arg("--out") || join(process.cwd(), "index.html");
writeFileSync(outPath, out);
console.log("✅ 学习台已构建:", outPath, "(", (out.length / 1024).toFixed(1), "KB ) 孩子:", site.name, site.grade || "");

// ---------- 同步数学探险 app ----------
// 工作台里「今日旅程·数学」和数学知识卡都会打开 math-adventure/index.html（输出目录下的同名子文件夹）
const maSrc = join(SKILL_ROOT, "assets", "math-adventure", "index.html");
if (existsSync(maSrc)) {
  const maDir = join(dirname(outPath), "math-adventure");
  mkdirSync(maDir, { recursive: true });
  copyFileSync(maSrc, join(maDir, "index.html"));
  console.log("✅ 数学探险已铺好:", join(maDir, "index.html"));
} else {
  console.warn("⚠️ 未找到 math-adventure 资产，数学探险链接将失效");
}
