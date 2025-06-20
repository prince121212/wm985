const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 创建 diff 目录（如果不存在）
const diffDir = path.join(__dirname, '..', 'diff');
if (!fs.existsSync(diffDir)) {
  fs.mkdirSync(diffDir, { recursive: true });
}

// 生成北京时间（UTC+8）的时间戳
function getBeiJingTime() {
  const now = new Date();
  // 获取当前时区的偏移分钟数
  const localOffset = now.getTimezoneOffset();
  // 北京时区偏移为 -480 分钟（UTC+8）
  const targetOffset = -480;
  // 计算时差（分钟）
  const offsetDiff = targetOffset - localOffset;
  // 调整时间
  const beijingTime = new Date(now.getTime() + offsetDiff * 60 * 1000);
  
  return beijingTime;
}

// 格式化北京时间为文件名友好的格式
const beijingTime = getBeiJingTime();
const year = beijingTime.getFullYear();
const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
const day = String(beijingTime.getDate()).padStart(2, '0');
const hours = String(beijingTime.getHours()).padStart(2, '0');
const minutes = String(beijingTime.getMinutes()).padStart(2, '0');
const seconds = String(beijingTime.getSeconds()).padStart(2, '0');

const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
const outputFile = path.join(diffDir, `diff-${timestamp}.md`);

try {
  // 先执行 git diff --stat 并显示在控制台
  console.log('变更概览:');
  console.log('----------------------------------------');
  if (process.platform === 'win32') {
    // 在 Windows 上执行 PowerShell 命令
    const statCommand = 'powershell -Command "$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; git diff --stat HEAD"';
    console.log(execSync(statCommand).toString('utf8'));
  } else {
    // 在 Linux/Mac 上执行 git diff --stat 命令
    console.log(execSync('git diff --stat HEAD').toString('utf8'));
  }
  console.log('----------------------------------------');
  
  // 然后生成完整的 diff 文件
  if (process.platform === 'win32') {
    const command = 'powershell -Command "$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; git diff HEAD"';
    const diff = execSync(command).toString('utf8');
    
    // 写入带时间戳的文件
    fs.writeFileSync(outputFile, diff, 'utf8');
  } else {
    // 在 Linux/Mac 上执行 git diff 命令
    const diff = execSync('git diff HEAD').toString('utf8');
    
    // 写入带时间戳的文件
    fs.writeFileSync(outputFile, diff, 'utf8');
  }
  
  console.log(`Git diff 已保存到 ${outputFile}`);
} catch (error) {
  console.error('生成 diff 时出错:', error.message);
  process.exit(1);
}



