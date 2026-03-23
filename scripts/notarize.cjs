const path = require('path');
const { notarize } = require('@electron/notarize');

module.exports = async function notarizeApp(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('[notarize] 未提供 Apple 公证环境变量，跳过公证');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.log(`[notarize] 开始公证 ${appPath}`);

  await notarize({
    appBundleId: context.packager.appInfo.id,
    appPath,
    appleId,
    appleIdPassword,
    teamId
  });

  console.log('[notarize] 公证完成');
};
